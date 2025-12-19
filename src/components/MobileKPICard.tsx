import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileKPICardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: ReactNode;
  status?: "good" | "warning" | "bad" | "neutral";
  onClick?: () => void;
}

export function MobileKPICard({
  label,
  value,
  trend,
  trendValue,
  icon,
  status = "neutral",
  onClick,
}: MobileKPICardProps) {
  const statusColors = {
    good: "bg-green-500/10 border-green-500/30",
    warning: "bg-yellow-500/10 border-yellow-500/30",
    bad: "bg-red-500/10 border-red-500/30",
    neutral: "bg-card border-border",
  };

  const trendColors = {
    up: "text-green-600",
    down: "text-red-500",
    neutral: "text-muted-foreground",
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <button
      onClick={onClick}
      className={cn(
        "kpi-card-mobile border touch-target w-full",
        statusColors[status],
        onClick && "active:scale-[0.98] transition-transform cursor-pointer"
      )}
    >
      {icon && (
        <div className="mb-2 text-muted-foreground">
          {icon}
        </div>
      )}
      
      <div className="text-2xl font-bold font-display text-foreground">
        {value}
      </div>
      
      <div className="text-xs text-muted-foreground font-medium mt-1">
        {label}
      </div>
      
      {trend && trendValue && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs", trendColors[trend])}>
          <TrendIcon className="h-3 w-3" />
          <span>{trendValue}</span>
        </div>
      )}
    </button>
  );
}

interface MobileKPIGridProps {
  children: ReactNode;
  className?: string;
}

export function MobileKPIGrid({ children, className }: MobileKPIGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {children}
    </div>
  );
}

interface MobileKPISwipeProps {
  children: ReactNode;
  className?: string;
}

export function MobileKPISwipe({ children, className }: MobileKPISwipeProps) {
  return (
    <div className={cn("swipe-container -mx-4 px-4", className)}>
      {children}
    </div>
  );
}
