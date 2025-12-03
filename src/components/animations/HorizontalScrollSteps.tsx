import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Step {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  description: string;
  content: React.ReactNode;
}

interface HorizontalScrollStepsProps {
  steps: Step[];
}

export const HorizontalScrollSteps = ({ steps }: HorizontalScrollStepsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${(steps.length - 1) * 100}%`]);
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section 
      ref={containerRef} 
      className="relative bg-muted/30"
      style={{ height: `${steps.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-border z-20">
          <motion.div 
            className="h-full bg-primary"
            style={{ width: progressWidth }}
          />
        </div>

        {/* Step indicators */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {steps.map((_, index) => {
            const stepProgress = useTransform(
              scrollYProgress,
              [index / steps.length, (index + 0.5) / steps.length],
              [0, 1]
            );
            return (
              <motion.div
                key={index}
                className="relative"
              >
                <div className="w-10 h-10 rounded-full border-2 border-border bg-background flex items-center justify-center text-sm font-semibold">
                  {index + 1}
                </div>
                <motion.div
                  className="absolute inset-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground"
                  style={{ opacity: stepProgress }}
                >
                  {index + 1}
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Horizontal scrolling container */}
        <motion.div 
          className="flex h-full pt-24"
          style={{ x }}
        >
          {steps.map((step, index) => {
            const stepStart = index / steps.length;
            const stepEnd = (index + 1) / steps.length;
            const stepMid = (stepStart + stepEnd) / 2;
            
            const opacity = useTransform(
              scrollYProgress,
              [stepStart, stepStart + 0.05, stepMid, stepEnd - 0.05, stepEnd],
              [0, 1, 1, 1, index === steps.length - 1 ? 1 : 0]
            );
            
            const scale = useTransform(
              scrollYProgress,
              [stepStart, stepStart + 0.1, stepMid, stepEnd - 0.1, stepEnd],
              [0.8, 1, 1, 1, index === steps.length - 1 ? 1 : 0.8]
            );
            
            const y = useTransform(
              scrollYProgress,
              [stepStart, stepStart + 0.1, stepMid],
              [50, 0, 0]
            );

            return (
              <motion.div
                key={index}
                className="min-w-full h-full flex items-center justify-center px-4 md:px-8"
                style={{ opacity }}
              >
                <motion.div 
                  className="max-w-4xl w-full"
                  style={{ scale, y }}
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <motion.div 
                      className="flex-shrink-0"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl">
                        {step.emoji}
                      </div>
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="font-display text-3xl md:text-4xl mb-4">{step.title}</h3>
                      <p className="text-lg text-muted-foreground mb-6">{step.description}</p>
                      <div className="bg-background/50 backdrop-blur-sm rounded-xl p-6 border border-border">
                        {step.content}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Scroll hint */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-muted-foreground flex items-center gap-2"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span>Scroll to explore</span>
          <motion.span
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            →
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
};
