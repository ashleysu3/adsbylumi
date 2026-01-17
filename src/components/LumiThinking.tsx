import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Standard loading copy pool - approved microcopy
const STANDARD_COPY = [
  // Brand anchor - should appear first
  "This is where Lumi does the thinking.",
  // Orientation / Entry
  "Getting oriented…",
  "Taking a look at the big picture.",
  // Strategy & Decision-Making
  "Choosing the smartest place to start.",
  "Making the strategic call.",
  // Offer & Structure Alignment
  "Matching your offer with the right approach.",
  "Setting this up the smart way.",
  // Angle & Creative Preparation
  "Finding the strongest angle to lead with.",
  "Lining up your creative options.",
  "Making this easy to execute.",
  // Reassurance
  "You don't need to do anything yet.",
  "Hang tight—we've got this.",
];

// Long-load fallback copy
const LONG_LOAD_COPY = [
  "This beats staring at Ads Manager.",
  "Good strategy takes a second.",
  "Still working—still intentional.",
];

interface LumiThinkingProps {
  isOpen: boolean;
  /** Optional context-specific copy to use instead of standard pool */
  customCopy?: string[];
  /** Whether this is a modal overlay or inline element */
  variant?: "modal" | "inline" | "fullpage";
  className?: string;
}

export function LumiThinking({ 
  isOpen, 
  customCopy,
  variant = "modal",
  className 
}: LumiThinkingProps) {
  const [currentCopyIndex, setCurrentCopyIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLongLoad, setIsLongLoad] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  
  const copyPool = customCopy || STANDARD_COPY;
  const activeCopy = isLongLoad ? LONG_LOAD_COPY : copyPool;
  
  useEffect(() => {
    if (!isOpen) {
      setCurrentCopyIndex(0);
      setProgress(0);
      setIsLongLoad(false);
      startTimeRef.current = Date.now();
      return;
    }

    startTimeRef.current = Date.now();

    // Rotate copy every 4.5 seconds - calm, unhurried pace
    const copyInterval = setInterval(() => {
      setCurrentCopyIndex((prev) => (prev + 1) % activeCopy.length);
    }, 4500);

    // Smooth, unhurried progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Very slow, calm progression
        if (prev >= 85) return prev + 0.05;
        if (prev >= 60) return prev + 0.15;
        if (prev >= 30) return prev + 0.25;
        return prev + 0.4;
      });
    }, 100);

    // Check for long load (>30 seconds)
    const longLoadCheck = setInterval(() => {
      if (Date.now() - startTimeRef.current > 30000) {
        setIsLongLoad(true);
        setCurrentCopyIndex(0);
      }
    }, 5000);

    return () => {
      clearInterval(copyInterval);
      clearInterval(progressInterval);
      clearInterval(longLoadCheck);
    };
  }, [isOpen, activeCopy.length]);

  // Reset copy index when switching between normal and long-load
  useEffect(() => {
    setCurrentCopyIndex(0);
  }, [isLongLoad]);

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center w-full",
      variant === "inline" ? "py-4" : "py-8 px-6",
      className
    )}>
      {/* Progress Bar - simple, horizontal, no percentage */}
      <div className="w-full max-w-sm mb-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 92)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Rotating microcopy - single line */}
      <div className="h-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${isLongLoad}-${currentCopyIndex}`}
            className="text-sm text-muted-foreground text-center font-medium"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {activeCopy[currentCopyIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <Dialog open={isOpen}>
        <DialogContent 
          className="sm:max-w-md border-0 bg-background shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === "fullpage") {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="w-full max-w-md">
          {content}
        </div>
      </div>
    );
  }

  // Inline variant
  if (!isOpen) return null;
  return content;
}

// Convenience exports for different contexts
export function LumiThinkingModal(props: Omit<LumiThinkingProps, "variant">) {
  return <LumiThinking {...props} variant="modal" />;
}

export function LumiThinkingInline(props: Omit<LumiThinkingProps, "variant">) {
  return <LumiThinking {...props} variant="inline" />;
}

export function LumiThinkingFullpage(props: Omit<LumiThinkingProps, "variant">) {
  return <LumiThinking {...props} variant="fullpage" />;
}
