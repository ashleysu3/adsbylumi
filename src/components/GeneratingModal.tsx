import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import lumiLogo from "@/assets/lumi-logo.png";

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

export function GeneratingModal({ 
  isOpen, 
  title = "Lumi is creating...",
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

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 3000);

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

  return (
    <Dialog open={isOpen}>
      <DialogContent 
        className="sm:max-w-md border-0 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Gradient orbs behind content */}
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          <motion.div
            className="absolute top-[-40%] left-[-30%] w-[80%] h-[80%] rounded-full bg-lumi-orange-1/15 blur-[80px]"
            animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[-40%] right-[-30%] w-[70%] h-[70%] rounded-full bg-lumi-purple-1/15 blur-[70px]"
            animate={{ x: [0, -25, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-[20%] right-[10%] w-[50%] h-[50%] rounded-full bg-lumi-pink-1/10 blur-[60px]"
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 px-4">
          {/* Lumi Logo with glow */}
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 blur-2xl opacity-40"
              style={{
                background: "linear-gradient(135deg, hsl(var(--lumi-orange-1)), hsl(var(--lumi-pink-1)), hsl(var(--lumi-purple-1)), hsl(var(--lumi-blue-1)))",
              }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Sparkle accents */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute w-2.5 h-2.5"
                style={{
                  top: [-8, 20, 40][i],
                  left: [60, -12, 65][i],
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
              >
                <svg viewBox="0 0 24 24" fill="none" className={`w-full h-full ${
                  ["text-lumi-orange-1", "text-lumi-pink-1", "text-lumi-blue-1"][i]
                }`}>
                  <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill="currentColor" />
                </svg>
              </motion.div>
            ))}

            <motion.img
              src={lumiLogo}
              alt="Lumi"
              className="h-20 w-auto relative z-10"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
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

          {/* Progress Bar with gradient */}
          <div className="w-full max-w-xs">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, hsl(var(--lumi-orange-1)), hsl(var(--lumi-pink-1)), hsl(var(--lumi-purple-1)))",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 95)}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              This may take 30-60 seconds
            </p>
          </div>

          {/* Dot indicators matching SplashScreen */}
          <div className="flex items-center gap-1.5 mt-6">
            <motion.div
              className="w-2 h-2 rounded-full bg-lumi-orange-1"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="w-2 h-2 rounded-full bg-lumi-pink-1"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="w-2 h-2 rounded-full bg-lumi-purple-1"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
            />
            <motion.div
              className="w-2 h-2 rounded-full bg-lumi-blue-1"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.6 }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
