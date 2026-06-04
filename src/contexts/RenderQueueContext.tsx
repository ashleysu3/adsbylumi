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
// RenderQueueContext (patch #17)
//
// Patch #17 changes:
//   - Friendlier copy throughout ("Make my video" / "Got it" / "Your video
//     is ready").
//   - New optional `onAttached` callback on EnqueueSpec — fires after the
//     storage upload succeeds with { url, storagePath, filename }. Lets
//     callers (like CreativeChecklistCard) bind the rendered MP4 to a
//     creative item so the user doesn't have to re-upload.
// ============================================================================

export interface RenderContextMeta {
  brandId?: string;
  workspaceId?: string;
  creativeItemId?: string;
}

export interface AttachedRenderInfo {
  url: string;
  storagePath: string;
  filename: string;
}

export interface EnqueueSpec {
  title: string;
  sourceClipName?: string;
  videoUrl: string;
  overlays: RenderOverlay[];
  style: RenderStyle;
  loopVideo?: boolean;
  trimStart?: number;
  trimEnd?: number;
  context?: RenderContextMeta;
  /** Fired after the storage upload completes (before the toast / email).
   *  Use this to attach the rendered MP4 to wherever it needs to go in the
   *  rest of the app (e.g. a creative item's uploaded asset slot). Errors
   *  thrown here are logged but do not fail the render — the user still
   *  gets the download link. */
  onAttached?: (info: AttachedRenderInfo) => void | Promise<void>;
}

export type RenderJobStatus = 'pending' | 'rendering' | 'completed' | 'failed';

export interface RenderJob {
  id: string;
  status: RenderJobStatus;
  title: string;
  sourceClipName: string;
  progress: number;
  message: string;
  resultUrl?: string;
  downloadFilename: string;
  error?: string;
  enqueuedAt: number;
  completedAt?: number;
  context?: RenderContextMeta;
  spec: {
    videoUrl: string;
    overlays: RenderOverlay[];
    style: RenderStyle;
    loopVideo?: boolean;
    trimStart?: number;
    trimEnd?: number;
  };
  // onAttached lives here so the worker can call it on success. Held in a
  // separate ref-style field rather than inside `spec` so it doesn't
  // serialize awkwardly if we ever persist queue state.
  onAttached?: (info: AttachedRenderInfo) => void | Promise<void>;
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

const MAX_HISTORY = 10;

export function RenderQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
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
        loopVideo: next.spec.loopVideo,
        trimStart: next.spec.trimStart,
        trimEnd: next.spec.trimEnd,
        onProgress: info => {
          updateJob(next.id, { progress: info.pct, message: info.message });
        },
      });

      let publicUrl: string | undefined;
      let storagePath: string | undefined;
      try {
        const pathPrefix = next.context?.brandId ? `${next.context.brandId}/renders` : 'renders';
        storagePath = `${pathPrefix}/${next.id}-${next.downloadFilename}`;
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
        console.error('Render upload to creative-assets failed (non-fatal):', uploadErr);
      }

      // Auto-attach hook. Runs before the user-facing toast so by the time
      // the user sees "Your video is ready", the MP4 is already wired up
      // wherever the caller asked it to go.
      if (publicUrl && storagePath && next.onAttached) {
        try {
          await next.onAttached({
            url: publicUrl,
            storagePath,
            filename: next.downloadFilename,
          });
        } catch (attachErr) {
          console.error('onAttached callback failed (non-fatal):', attachErr);
        }
      }

      updateJob(next.id, {
        status: 'completed',
        progress: 100,
        message: 'Ready',
        resultUrl: publicUrl,
        completedAt: Date.now(),
      });

      const attached = !!publicUrl && !!next.onAttached;
      toast.success(`Your video is ready: ${next.title}`, {
        description: attached
          ? "It's already attached to the creative — open the bell if you want a download too."
          : publicUrl
            ? "Click Download to save it — or open the bell to find it later."
            : "Click Download to save it. (Cloud link unavailable; available for this session only.)",
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
      toast.error(`Couldn't make your video for "${next.title}"`, {
        description: err?.message || 'Unknown error — try again from the bell.',
      });
    } finally {
      processingRef.current = false;
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
      setTimeout(() => processQueue(), 50);
    }
  }, [updateJob]);

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
          loopVideo: spec.loopVideo,
          trimStart: spec.trimStart,
          trimEnd: spec.trimEnd,
        },
        onAttached: spec.onAttached,
      };
      setJobs(prev => [newJob, ...prev]);

      toast.info(`Got it — making your video: ${spec.title}`, {
        description:
          "Keep this LUMI tab open. We'll ping the bell + email you when it's ready (usually under 3 minutes).",
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
