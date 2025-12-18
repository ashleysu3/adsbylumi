import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LumiRecommendedBadgeProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
  /** Short reason shown in tooltip on hover */
  reason?: string;
  /** Detailed explanation shown in popover on click */
  details?: string;
}

export function LumiRecommendedBadge({
  label = "Recommended",
  size = "md",
  className,
  showIcon = true,
  reason,
  details,
}: LumiRecommendedBadgeProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

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

  const badgeContent = (
    <span
      className={cn(
        "inline-flex items-center font-semibold text-white rounded-full",
        "bg-gradient-lumi shadow-glow",
        "animate-sparkle-pulse",
        details && "cursor-pointer",
        sizeClasses[size],
        className
      )}
      onClick={details ? () => setPopoverOpen(true) : undefined}
    >
      {showIcon && (
        <Sparkles className={cn(iconSizes[size], "animate-sparkle")} />
      )}
      {label}
    </span>
  );

  // If we have details, wrap in popover
  const badgeWithPopover = details ? (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        {badgeContent}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Why Lumi recommends this</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {details}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ) : badgeContent;

  // If we have a reason, wrap in tooltip
  if (reason) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeWithPopover}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{reason}</p>
            {details && (
              <p className="text-xs text-muted-foreground mt-1">Click for more details</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeWithPopover;
}
