import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lightbulb, Wand2, Brain, PenTool, Target } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface GeneratingModalProps {
  isOpen: boolean;
  title?: string;
  steps?: string[];
}

const defaultSteps = [
  "Analyzing your brand psychology...",
  "Crafting hook variations...",
  "Writing compelling scripts...",
  "Generating ad copy...",
  "Building your creative mix...",
  "Finalizing production notes..."
];

const icons = [Brain, Lightbulb, PenTool, Wand2, Target, Sparkles];

export function GeneratingModal({ 
  isOpen, 
  title = "Generating Creative Assets",
  steps = defaultSteps 
}: GeneratingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    // Cycle through steps
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    // Animate progress (fake progress that slows down near end)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev + 0.1;
        if (prev >= 70) return prev + 0.3;
        if (prev >= 50) return prev + 0.5;
        return prev + 1;
      });
    }, 100);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isOpen, steps.length]);

  const CurrentIcon = icons[currentStep % icons.length];

  return (
    <Dialog open={isOpen}>
      <DialogContent 
        className="sm:max-w-md border-0 bg-gradient-to-br from-background via-background to-muted/30 shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center py-8 px-4">
          {/* Animated Icon Container */}
          <div className="relative mb-8">
            {/* Outer rotating ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary/20"
              style={{ width: 120, height: 120, margin: -10 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Inner pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary/10"
              style={{ width: 100, height: 100 }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Icon container */}
            <motion.div
              className="relative flex items-center justify-center w-[100px] h-[100px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ scale: 0, rotate: -180, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 180, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "backOut" }}
                >
                  <CurrentIcon className="h-10 w-10 text-primary" />
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary/40"
                style={{
                  left: 50 + Math.cos((i * Math.PI * 2) / 6) * 55,
                  top: 50 + Math.sin((i * Math.PI * 2) / 6) * 55,
                }}
                animate={{
                  scale: [0.5, 1, 0.5],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Title */}
          <motion.h2 
            className="text-xl font-semibold mb-2 text-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {title}
          </motion.h2>

          {/* Current Step Text */}
          <div className="h-6 mb-6 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentStep}
                className="text-sm text-muted-foreground text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {steps[currentStep]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-xs">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 95)}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              This may take 30-60 seconds
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1.5 mt-6">
            {steps.map((_, i) => (
              <motion.div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                animate={i === currentStep ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5 }}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
