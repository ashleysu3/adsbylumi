import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  healthy: { label: 'On Track', emoji: '✅', className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' },
  watching: { label: 'Watching', emoji: '⚠️', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  needs_attention: { label: 'Needs Attention', emoji: '🔴', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  paused: { label: 'Paused', emoji: '⏸️', className: 'bg-muted text-muted-foreground border-border' },
  turned_off: { label: 'Turned Off', emoji: '🚫', className: 'bg-muted text-muted-foreground border-border' },
};

export function ClientHealthBadge({ status, size = 'default' }: { status: string; size?: 'sm' | 'default' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
  return (
    <Badge variant="outline" className={cn(config.className, size === 'sm' && 'text-[10px] px-1.5 py-0')}>
      <span className="mr-1">{config.emoji}</span>
      {config.label}
    </Badge>
  );
}
