import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { RenderOverlay, RenderStyle } from '@/lib/ffmpeg-renderer';

interface RenderQueueJobContext {
  brandId?: string;
}

export interface RenderQueueJobInput {
  title: string;
  sourceClipName?: string;
  videoUrl: string;
  overlays: RenderOverlay[];
  style: RenderStyle;
  context?: RenderQueueJobContext;
}

export interface RenderQueueJob extends RenderQueueJobInput {
  id: string;
  status: 'queued';
  createdAt: string;
}

interface RenderQueueContextValue {
  jobs: RenderQueueJob[];
  enqueue: (job: RenderQueueJobInput) => string;
}

const RenderQueueContext = createContext<RenderQueueContextValue | undefined>(undefined);

export function RenderQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<RenderQueueJob[]>([]);

  const enqueue = useCallback((job: RenderQueueJobInput) => {
    const id = crypto.randomUUID();
    const queuedJob: RenderQueueJob = {
      ...job,
      id,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    setJobs(prev => [queuedJob, ...prev]);
    toast.success(`${job.title || 'Render'} queued`);

    return id;
  }, []);

  const value = useMemo(
    () => ({ jobs, enqueue }),
    [jobs, enqueue],
  );

  return (
    <RenderQueueContext.Provider value={value}>
      {children}
    </RenderQueueContext.Provider>
  );
}

export function useRenderQueue() {
  const context = useContext(RenderQueueContext);
  if (!context) {
    throw new Error('useRenderQueue must be used within a RenderQueueProvider');
  }
  return context;
}