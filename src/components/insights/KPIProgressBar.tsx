import { cn } from '@/lib/utils';

interface KPIProgressBarProps {
  value: number | null;
  benchmark: { min: number; max: number; unit: string };
  userGoal?: number | null;
  kpiKey: string;
  className?: string;
}

export function KPIProgressBar({ 
  value, 
  benchmark, 
  userGoal, 
  kpiKey,
  className 
}: KPIProgressBarProps) {
  if (value === null || value === undefined || isNaN(value)) {
    return (
      <div className={cn("w-full h-2 rounded-full bg-muted", className)} />
    );
  }

  const isROAS = kpiKey === 'roas';
  
  // Calculate progress percentage
  let progressPercent: number;
  let targetValue = userGoal || benchmark.max;
  
  if (isROAS) {
    // For ROAS: higher is better
    // 0% = 0, 100% = at or above target (min benchmark or user goal)
    targetValue = userGoal || benchmark.min;
    progressPercent = targetValue > 0 ? Math.min((value / targetValue) * 100, 150) : 0;
  } else {
    // For cost KPIs: lower is better
    // 100% = at or below min benchmark, 0% = at double the max
    // We invert the scale: lower value = higher progress
    const maxThreshold = benchmark.max * 1.5;
    if (value <= benchmark.min) {
      progressPercent = 100;
    } else if (value >= maxThreshold) {
      progressPercent = 0;
    } else {
      // Linear interpolation between min and maxThreshold
      progressPercent = 100 - ((value - benchmark.min) / (maxThreshold - benchmark.min)) * 100;
    }
  }

  // Clamp between 0 and 100 for display
  const displayPercent = Math.max(0, Math.min(progressPercent, 100));

  // Determine color based on status
  let barColor = 'bg-green-500';
  if (isROAS) {
    if (value < benchmark.min * 0.7) barColor = 'bg-red-500';
    else if (value < benchmark.min) barColor = 'bg-amber-500';
  } else {
    if (value > benchmark.max * 1.3) barColor = 'bg-red-500';
    else if (value > benchmark.max) barColor = 'bg-amber-500';
  }

  // Calculate marker positions
  const benchmarkMinPos = isROAS 
    ? Math.min((benchmark.min / (targetValue * 1.5)) * 100, 100)
    : 100 - ((benchmark.min - benchmark.min) / (benchmark.max * 1.5 - benchmark.min)) * 100;
  
  const benchmarkMaxPos = isROAS
    ? Math.min((benchmark.max / (targetValue * 1.5)) * 100, 100)
    : 100 - ((benchmark.max - benchmark.min) / (benchmark.max * 1.5 - benchmark.min)) * 100;

  const goalPos = userGoal 
    ? (isROAS 
        ? Math.min((userGoal / (targetValue * 1.5)) * 100, 100)
        : 100 - ((userGoal - benchmark.min) / (benchmark.max * 1.5 - benchmark.min)) * 100)
    : null;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative w-full h-2 rounded-full bg-muted overflow-hidden">
        {/* Progress fill */}
        <div 
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${displayPercent}%` }}
        />
        
        {/* Goal marker */}
        {goalPos !== null && goalPos >= 0 && goalPos <= 100 && (
          <div 
            className="absolute top-0 w-0.5 h-full bg-foreground/50"
            style={{ left: `${goalPos}%` }}
          />
        )}
      </div>
    </div>
  );
}
