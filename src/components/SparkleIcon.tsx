import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface SparkleIconProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  state?: "idle" | "talking" | "thinking" | "loading";
  glow?: boolean;
  className?: string;
}

export function SparkleIcon({ size = "md", state = "idle", glow = false, className }: SparkleIconProps) {
  const sizeClasses = {
    xs: "w-5 h-5",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const iconSizeClasses = {
    xs: "w-3 h-3",
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
    xl: "w-14 h-14",
  };

  const animationClass = {
    idle: "",
    talking: "animate-pulse",
    thinking: "animate-spin",
    loading: "animate-pulse",
  };

  return (
    <div className={cn(
      "relative flex items-center justify-center rounded-full bg-gradient-to-br from-lumi-yellow via-lumi-orange-2 to-lumi-orange-3",
      sizeClasses[size],
      className
    )}>
      {/* Glow effect */}
      {glow && (
        <div className="absolute inset-0 rounded-full bg-lumi-orange-2/40 blur-md animate-pulse" />
      )}
      
      {/* Main sparkle icon */}
      <Sparkles 
        className={cn(
          "text-white drop-shadow-sm relative z-10",
          iconSizeClasses[size],
          animationClass[state]
        )} 
      />
      
      {/* Sparkle effects when talking or loading */}
      {(state === "talking" || state === "loading") && (
        <>
          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-ping" />
          <div className="absolute -bottom-0.5 -left-0.5 w-1 h-1 bg-lumi-yellow rounded-full animate-ping delay-150" />
        </>
      )}
    </div>
  );
}

// Keep backward compatibility - export as LumiCharacter alias
export { SparkleIcon as LumiCharacter };
