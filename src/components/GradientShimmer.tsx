import { cn } from "@/lib/utils";

interface GradientShimmerProps {
  className?: string;
}

// Basic shimmer skeleton
export function GradientShimmer({ className }: GradientShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-lumi-orange-1/20 before:to-transparent",
        "before:animate-shimmer",
        className
      )}
    />
  );
}

// Card shimmer skeleton
export function CardShimmer({ className }: GradientShimmerProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card p-6 space-y-4",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <GradientShimmer className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <GradientShimmer className="h-4 w-3/4" />
          <GradientShimmer className="h-3 w-1/2" />
        </div>
      </div>
      <GradientShimmer className="h-24 w-full" />
      <div className="flex gap-2">
        <GradientShimmer className="h-8 w-20 rounded-full" />
        <GradientShimmer className="h-8 w-24 rounded-full" />
      </div>
    </div>
  );
}

// Text line shimmer
export function TextShimmer({ 
  lines = 3, 
  className 
}: GradientShimmerProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <GradientShimmer
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

// Button shimmer
export function ButtonShimmer({ className }: GradientShimmerProps) {
  return (
    <GradientShimmer className={cn("h-10 w-32 rounded-full", className)} />
  );
}

// Avatar shimmer
export function AvatarShimmer({ 
  size = "md",
  className 
}: GradientShimmerProps & { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <GradientShimmer 
      className={cn("rounded-full", sizeClasses[size], className)} 
    />
  );
}

// Grid shimmer for creative/campaign cards
export function GridShimmer({ 
  count = 6,
  className 
}: GradientShimmerProps & { count?: number }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardShimmer key={i} />
      ))}
    </div>
  );
}

// Table row shimmer
export function TableRowShimmer({ 
  columns = 4,
  className 
}: GradientShimmerProps & { columns?: number }) {
  return (
    <div className={cn("flex items-center gap-4 p-4 border-b border-border/30", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <GradientShimmer
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-32" : "flex-1"
          )}
        />
      ))}
    </div>
  );
}

// Full page loading state
export function PageShimmer({ className }: GradientShimmerProps) {
  return (
    <div className={cn("space-y-8 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <GradientShimmer className="h-8 w-48" />
          <GradientShimmer className="h-4 w-64" />
        </div>
        <ButtonShimmer />
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-6">
            <GradientShimmer className="h-4 w-24 mb-2" />
            <GradientShimmer className="h-8 w-16" />
          </div>
        ))}
      </div>
      
      {/* Main content */}
      <GridShimmer count={6} />
    </div>
  );
}
