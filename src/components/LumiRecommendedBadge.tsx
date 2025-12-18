import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LumiRecommendedBadgeProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
}

export function LumiRecommendedBadge({
  label = "Recommended",
  size = "md",
  className,
  showIcon = true,
}: LumiRecommendedBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold text-white rounded-full",
        "bg-gradient-lumi shadow-glow",
        "animate-sparkle-pulse",
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <Sparkles className={cn(iconSizes[size], "animate-sparkle")} />
      )}
      {label}
    </span>
  );
}
