import { Bell, Download, Loader2, RefreshCw, X, Film, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRenderQueue, type RenderJob } from '@/contexts/RenderQueueContext';

// ============================================================================
// RenderQueueBell
//
// Small bell button + popover dropdown that shows pending + recently-finished
// b-roll renders. Mounted globally (usually in AppSidebar / header) so users
// can start a render from Creative Studio, navigate anywhere in LUMI, and
// still see its status from any page.
// ============================================================================

function StatusRow({ job, onDismiss, onRetry }: { job: RenderJob; onDismiss: () => void; onRetry: () => void }) {
  const icon =
    job.status === 'rendering' ? (
      <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--lumi-orange-1))]" />
    ) : job.status === 'pending' ? (
      <Film className="h-4 w-4 text-muted-foreground" />
    ) : job.status === 'completed' ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-destructive" />
    );

  const handleDownload = () => {
    if (!job.resultUrl) return;
    const a = document.createElement('a');
    a.href = job.resultUrl;
    a.download = job.downloadFilename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="p-3 border-b last:border-b-0 space-y-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{job.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {job.status === 'pending' && 'Queued — waiting to start'}
            {job.status === 'rendering' && job.message}
            {job.status === 'completed' && 'Ready to download'}
            {job.status === 'failed' && (job.error || 'Render failed')}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 -mt-1 -mr-1"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {job.status === 'rendering' && (
        <Progress value={job.progress} className="h-1.5" />
      )}

      {job.status === 'completed' && job.resultUrl && (
        <Button
          size="sm"
          variant="lumi"
          className="w-full h-8 text-xs gap-1.5"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
          Download MP4
        </Button>
      )}

      {job.status === 'failed' && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function RenderQueueBell() {
  const { jobs, pendingCount, completedCount, dismissJob, retryJob, clearCompleted } = useRenderQueue();

  // Hide the bell entirely when the user has no queue history yet. No point
  // teaching a user about something they aren't using.
  if (jobs.length === 0) return null;

  const badgeCount = pendingCount + completedCount;
  const badge =
    pendingCount > 0 ? (
      <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-[hsl(var(--lumi-orange-1))] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
        {pendingCount}
      </span>
    ) : completedCount > 0 ? (
      <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
        {completedCount}
      </span>
    ) : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-xl p-2 hover:bg-muted transition-colors"
          aria-label={`Render queue (${badgeCount} ${badgeCount === 1 ? 'item' : 'items'})`}
          title="Render queue"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Video renders</p>
            <p className="text-[11px] text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} rendering — keep this tab open`
                : 'All caught up'}
            </p>
          </div>
          {completedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={clearCompleted}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {jobs.map(job => (
            <StatusRow
              key={job.id}
              job={job}
              onDismiss={() => dismissJob(job.id)}
              onRetry={() => retryJob(job.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
