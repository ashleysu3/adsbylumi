import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const STATUS_CONFIG = {
  idle: {
    icon: Cloud,
    label: "Auto-save on",
    color: "text-muted-foreground",
  },
  saving: {
    icon: Loader2,
    label: "Saving...",
    color: "text-primary",
  },
  saved: {
    icon: Check,
    label: "Saved",
    color: "text-green-500",
  },
  error: {
    icon: CloudOff,
    label: "Save failed",
    color: "text-destructive",
  },
};

export function AutoSaveIndicator({ 
  status, 
  className, 
  showLabel = true,
  size = "sm" 
}: AutoSaveIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "flex items-center gap-1.5",
          config.color,
          className
        )}
      >
        <Icon 
          className={cn(
            iconSize,
            status === "saving" && "animate-spin"
          )} 
        />
        {showLabel && (
          <span className={cn(textSize, "font-medium")}>
            {config.label}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to manage auto-save state with debouncing
export function useAutoSave(
  saveFn: () => Promise<void>,
  dependencies: any[],
  debounceMs: number = 2000
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const save = useCallback(async () => {
    setStatus("saving");
    try {
      await saveFn();
      setStatus("saved");
      setLastSaved(new Date());
      
      // Reset to idle after showing "saved" for 2s
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setStatus("error");
      
      // Reset to idle after showing error for 3s
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    }
  }, [saveFn]);

  // Debounced auto-save when dependencies change
  useEffect(() => {
    // Skip if dependencies are empty/initial
    const hasValidDeps = dependencies.some(dep => 
      dep !== null && dep !== undefined && dep !== "" && 
      (Array.isArray(dep) ? dep.length > 0 : true)
    );
    
    if (!hasValidDeps) return;

    const timer = setTimeout(() => {
      save();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, dependencies);

  return { status, lastSaved, save };
}
