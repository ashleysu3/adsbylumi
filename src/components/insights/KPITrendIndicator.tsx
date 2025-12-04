import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPITrendIndicatorProps {
  currentValue: number | null;
  previousValue: number | null;
  kpiKey: string;
  className?: string;
}

export function KPITrendIndicator({ 
  currentValue, 
  previousValue, 
  kpiKey,
  className 
}: KPITrendIndicatorProps) {
  // If no data, show nothing
  if (currentValue === null || previousValue === null || 
      currentValue === 0 || previousValue === 0 ||
      isNaN(currentValue) || isNaN(previousValue)) {
    return null;
  }

  const isROAS = kpiKey === 'roas';
  
  // Calculate percentage change
  const change = ((currentValue - previousValue) / previousValue) * 100;
  const absChange = Math.abs(change);
  
  // For ROAS, increase is good. For costs, decrease is good.
  const isImproving = isROAS ? change > 0 : change < 0;
  const isDeclining = isROAS ? change < 0 : change > 0;
  const isFlat = absChange < 2; // Less than 2% change is considered flat

  if (isFlat) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        <span>Stable</span>
      </div>
    );
  }

  if (isImproving) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-green-600", className)}>
        <TrendingUp className="h-3 w-3" />
        <span>{absChange.toFixed(0)}% better</span>
      </div>
    );
  }

  if (isDeclining) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-amber-600", className)}>
        <TrendingDown className="h-3 w-3" />
        <span>{absChange.toFixed(0)}% worse</span>
      </div>
    );
  }

  return null;
}
