import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LumiTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
}

export function LumiTooltip({
  children,
  content,
  side = "top",
  align = "center",
  delayDuration = 200,
  className,
}: LumiTooltipProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        variant="gradient"
        side={side}
        align={align}
        className={cn("font-medium", className)}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

// Simple text-only version for common use cases
export function LumiTooltipSimple({
  children,
  text,
  side = "top",
}: {
  children: React.ReactNode;
  text: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <LumiTooltip content={text} side={side}>
      {children}
    </LumiTooltip>
  );
}
