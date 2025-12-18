import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LumiCharacter } from "./LumiCharacter";

export interface LumiRecommendation {
  id: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface LumiRecommendPopupProps {
  recommendation: LumiRecommendation | null;
  className?: string;
}

export function LumiRecommendPopup({ recommendation, className }: LumiRecommendPopupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentRecommendationId, setCurrentRecommendationId] = useState<string | null>(null);

  // Reset dismissed state when recommendation changes
  useEffect(() => {
    if (recommendation && recommendation.id !== currentRecommendationId) {
      setIsDismissed(false);
      setIsExpanded(true);
      setCurrentRecommendationId(recommendation.id);
      
      // Auto-collapse after 8 seconds
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [recommendation, currentRecommendationId]);

  if (!recommendation) return null;

  const handleDismiss = () => {
    setIsExpanded(false);
    setIsDismissed(true);
  };

  const handleAction = () => {
    recommendation.onAction?.();
    setIsExpanded(false);
    setIsDismissed(true);
  };

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      <AnimatePresence mode="wait">
        {isExpanded && !isDismissed ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Card variant="gradient" className="w-80 shadow-glow overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between p-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <LumiCharacter size="sm" state="idle" glow />
                  </div>
                  <span className="text-sm font-semibold text-gradient-lumi">
                    {recommendation.title}
                  </span>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="px-4 pb-4 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {recommendation.message}
                </p>
                
                {recommendation.actionLabel && recommendation.onAction && (
                  <Button
                    onClick={handleAction}
                    variant="lumi"
                    size="sm"
                    className="w-full group"
                  >
                    {recommendation.actionLabel}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              "relative w-14 h-14 rounded-full",
              "bg-gradient-lumi shadow-glow",
              "flex items-center justify-center",
              "transition-shadow duration-300",
              "hover:shadow-[0_0_30px_rgba(234,88,12,0.4)]"
            )}
          >
            {/* Subtle pulse animation ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-lumi"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            
            <Sparkles className="h-6 w-6 text-white animate-sparkle" />
            
            {/* Notification dot when collapsed with recommendation */}
            {isDismissed && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-lumi-orange-1 rounded-full border-2 border-background animate-pulse" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Context for managing recommendations across the app
import { createContext, useContext, ReactNode } from "react";

interface LumiRecommendContextType {
  recommendation: LumiRecommendation | null;
  setRecommendation: (rec: LumiRecommendation | null) => void;
  clearRecommendation: () => void;
}

const LumiRecommendContext = createContext<LumiRecommendContextType | undefined>(undefined);

export function LumiRecommendProvider({ children }: { children: ReactNode }) {
  const [recommendation, setRecommendationState] = useState<LumiRecommendation | null>(null);

  const setRecommendation = (rec: LumiRecommendation | null) => {
    setRecommendationState(rec);
  };

  const clearRecommendation = () => {
    setRecommendationState(null);
  };

  return (
    <LumiRecommendContext.Provider value={{ recommendation, setRecommendation, clearRecommendation }}>
      {children}
      <LumiRecommendPopup recommendation={recommendation} />
    </LumiRecommendContext.Provider>
  );
}

export function useLumiRecommend() {
  const context = useContext(LumiRecommendContext);
  if (context === undefined) {
    throw new Error("useLumiRecommend must be used within a LumiRecommendProvider");
  }
  return context;
}
