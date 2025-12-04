import { cn } from "@/lib/utils";
import { LumiCharacter } from "./LumiCharacter";

interface LumiLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

export function LumiLoader({ size = "md", message, className }: LumiLoaderProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        {/* Outer glow ring */}
        <div className={cn(
          "absolute inset-0 rounded-full bg-lumi-yellow/30 blur-xl animate-pulse",
          sizeClasses[size]
        )} />
        
        {/* Pulsing ring */}
        <div className={cn(
          "absolute inset-0 rounded-full border-2 border-lumi-orange-2/40 animate-ping",
          sizeClasses[size]
        )} />
        
        {/* Lumi character */}
        <LumiCharacter 
          size={size === "sm" ? "sm" : size === "md" ? "md" : "xl"} 
          state="loading" 
          glow 
        />
      </div>
      
      {message && (
        <p className={cn(
          "text-muted-foreground animate-pulse font-medium",
          textSizeClasses[size]
        )}>
          {message}
        </p>
      )}
    </div>
  );
}

// Full page loader variant
export function LumiPageLoader({ message = "Lumi is thinking..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <LumiLoader size="lg" message={message} />
    </div>
  );
}

// Inline loader for buttons/cards
export function LumiInlineLoader({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div className="w-5 h-5 relative">
        <div className="absolute inset-0 rounded-full bg-lumi-yellow/30 blur-sm animate-pulse" />
        <LumiCharacter size="xs" state="loading" />
      </div>
    </div>
  );
}
