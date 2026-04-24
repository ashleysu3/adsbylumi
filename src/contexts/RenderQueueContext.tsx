import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  renderVideoWithText,
  type RenderOverlay,
  type RenderStyle,
} from '@/lib/ffmpeg-renderer';

// ============================================================================
// RenderQueueContext
//
// Client-side queue for b-roll text-burn renders. Users click "Render" in the
// Creative Studio or B-Roll Library and the work goes here instead of running
// inline in a modal. Gives them:
//
//   1) An immediate "Queued!" confirmation (user keeps working).
//   2) A bell-icon list of pending + completed renders (see RenderQueueBell).
//   3) A toast when each render finishes with a download button.
//   4) An email notification with the download link (send-render-ready-email).
//   5) A stable URL (MP4 uploaded to Supabase `creative-assets` bucket) that
//      the email + any future auto-attach / Meta-upload flows can use.
//
// Constraint: the render runs in the browser via ffmpeg.wasm, so the user
// has to keep the LUMI tab open. Patch #12 is the MVP of the queue+notify
// UX; Patch #13 will add auto-attach to campaign + auto-upload to Meta, and
// a later patch could move the render to a server worker so the tab can
// close too.
// ============================================================================

export interface RenderContextMeta {
  // Optional campaign / brand context for later auto-attach / Meta upload
  // flows. Stored on the job so those paths have what they need when they
  // land.
  brandId?: string;
  workspaceId?: string;
  creativeItemId?: string;
}

export interface EnqueueSpec {
  /** Human-readable title shown in the bell and toast. */
  title: string;
  /** Clip name used in the saved filename. */
  sourceClipName?: string;
  /** Source video URL (same one ffmpeg-renderer expects). */
  videoUrl: string;
  overlays: RenderOverlay[];
  style: RenderStyle;
  context?: RenderContextMeta;
}

export type RenderJobStatus = 'pending' | 'rendering' | 'completed' | 'failed';

export interface RenderJob {
  id: string;
  status: RenderJobStatus;
  title: string;
  sourceClipName: string;
  progress: number;
  message: string;
  resultUrl?: string; // Public Supabase URL after upload
  downloadFilename: string;
  error?: string;
  enqueuedAt: number;
  completedAt?: number;
  context?: RenderContextMeta;
  // spec is kept so the queue worker can retry or re-render later if needed.
  spec: {
    videoUrl: string;
    overlays: RenderOverlay[];
    style: RenderStyle;
  };
}

interface RenderQueueContextValue {
  jobs: RenderJob[];
  pendingCount: number;
  completedCount: number;
  enqueue: (spec: EnqueueSpec) => string;
  dismissJob: (id: string) => void;
  retryJob: (id: string) => void;
  clearCompleted: () => void;
}

const RenderQueueContext = createContext<RenderQueueContextValue | null>(null);

// Max number of jobs to keep in memory. Older completed/failed ones get
// pruned after this. Keeps the bell tidy.
const MAX_HISTORY = 10;

export function RenderQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  // A ref mirror so we can read the current queue state inside async work
  // without triggering re-render churn on every progress tick.
  const jobsRef = useRef<RenderJob[]>([]);
  jobsRef.current = jobs;

  const processingRef = useRef(false);

  const updateJob = useCallback((id: string, patch: Partial<RenderJob>) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    const next = jobsRef.current.find(j => j.status === 'pending');
    if (!next) return;
    processingRef.current = true;
    updateJob(next.id, { status: 'rendering', progress: 0, message: 'Starting…' });

    try {
      const blob = await renderVideoWithText({
        videoUrl: next.spec.videoUrl,
        overlays: next.spec.overlays,
        style: next.spec.style,
        onProgress: info => {
          updateJob(next.id, { progress: info.pct, message: info.message });
        },
      });

      // Upload to Supabase storage so we have a stable URL for the email
      // link + any downstream auto-attach / Meta upload.
      let publicUrl: string | undefined;
      try {
        const pathPrefix = next.context?.brandId ? `${next.context.brandId}/renders` : 'renders';
        const storagePath = `${pathPrefix}/${next.id}-${next.downloadFilename}`;
        const { error: upErr } = await supabase.storage
          .from('creative-assets')
          .upload(storagePath, blob, {
            contentType: 'video/mp4',
            upsert: false,
          });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from('creative-assets')
          .getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;
      } catch (uploadErr) {
        // Non-fatal — we can still give the user a local download even if
        // the cloud save failed. They just don't get the email link.
        console.error('Render upload to creative-assets failed (non-fatal):', uploadErr);
      }

      updateJob(next.id, {
        status: 'completed',
        progress: 100,
        message: 'Ready to download',
        resultUrl: publicUrl,
        completedAt: Date.now(),
      });

      // In-app toast with a Download action.
      toast.success(`Video ready: ${next.title}`, {
        description: publicUrl
          ? 'Click Download to save it — or open the bell to find it later.'
          : 'Click Download to save it. (Cloud link unavailable; available for this session only.)',
        action: {
          label: 'Download',
          onClick: () => {
            const url = publicUrl || URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = next.downloadFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (!publicUrl) URL.revokeObjectURL(url);
          },
        },
        duration: 12000,
      });

      // Email notification (best-effort). Edge function `send-render-ready-email`
      // looks up the user via the auth session; falls back gracefully if
      // email fails.
      if (publicUrl) {
        try {
          await supabase.functions.invoke('send-render-ready-email', {
            body: {
              downloadUrl: publicUrl,
              filename: next.downloadFilename,
              clipName: next.sourceClipName,
              title: next.title,
              brandId: next.context?.brandId,
            },
          });
        } catch (emailErr) {
          console.error('Render-ready email failed (non-fatal):', emailErr);
        }
      }
    } catch (err: any) {
      console.error('Render job failed:', err);
      updateJob(next.id, {
        status: 'failed',
        message: 'Render failed',
        error: err?.message || 'Unknown error',
        completedAt: Date.now(),
      });
      toast.error(`Couldn't render "${next.title}"`, {
        description: err?.message || 'Unknown error — try again from the bell.',
      });
    } finally {
      processingRef.current = false;
      // Prune history.
      setJobs(prev => {
        const terminal = prev.filter(j => j.status === 'completed' || j.status === 'failed');
        if (terminal.length <= MAX_HISTORY) return prev;
        const excess = terminal.length - MAX_HISTORY;
        const oldestTerminalIds = terminal
          .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
          .slice(0, excess)
          .map(j => j.id);
        return prev.filter(j => !oldestTerminalIds.includes(j.id));
      });
      // Kick the next pending job, if any.
      setTimeout(() => processQueue(), 50);
    }
  }, [updateJob]);

  // Whenever jobs changes, see if there's work to do.
  useEffect(() => {
    processQueue();
  }, [jobs, processQueue]);

  const enqueue = useCallback(
    (spec: EnqueueSpec): string => {
      const id = `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const baseName = (spec.sourceClipName || 'broll')
        .replace(/\.[^.]+$/, '')
        .replace(/[^\w-]+/g, '_');
      const downloadFilename = `${baseName}-with-text.mp4`;
      const newJob: RenderJob = {
        id,
        status: 'pending',
        title: spec.title,
        sourceClipName: spec.sourceClipName || 'broll',
        progress: 0,
        message: 'Queued',
        downloadFilename,
        enqueuedAt: Date.now(),
        context: spec.context,
        spec: {
          videoUrl: spec.videoUrl,
          overlays: spec.overlays,
          style: spec.style,
        },
      };
      setJobs(prev => [newJob, ...prev]);

      // Confirm to the user right away so they know the action landed.
      toast.info(`Queued: ${spec.title}`, {
        description:
          'Your video is rendering in the background. Keep this LUMI tab open — we\'ll ping the bell icon and email you when it\'s ready. Takes up to about 3 minutes.',
        duration: 8000,
      });

      return id;
    },
    [],
  );

  const dismissJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const retryJob = useCallback((id: string) => {
    setJobs(prev =>
      prev.map(j =>
        j.id === id && j.status === 'failed'
          ? { ...j, status: 'pending', progress: 0, message: 'Queued (retry)', error: undefined }
          : j,
      ),
    );
  }, []);

  const clearCompleted = useCallback(() => {
    setJobs(prev => prev.filter(j => j.status !== 'completed' && j.status !== 'failed'));
  }, []);

  const pendingCount = jobs.filter(
    j => j.status === 'pending' || j.status === 'rendering',
  ).length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;

  return (
    <RenderQueueContext.Provider
      value={{
        jobs,
        pendingCount,
        completedCount,
        enqueue,
        dismissJob,
        retryJob,
        clearCompleted,
      }}
    >
      {children}
    </RenderQueueContext.Provider>
  );
}

export function useRenderQueue(): RenderQueueContextValue {
  const ctx = useContext(RenderQueueContext);
  if (!ctx) {
    throw new Error('useRenderQueue must be used within a RenderQueueProvider');
  }
  return ctx;
}
