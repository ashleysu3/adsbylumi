import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuidedTourProps {
  targetSelector: string;
  title: string;
  description: string;
  onClose: () => void;
  position?: "top" | "bottom" | "left" | "right";
}

export function GuidedTour({ 
  targetSelector, 
  title, 
  description, 
  onClose,
  position = "bottom" 
}: GuidedTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Find and highlight the target element
    const findAndHighlight = () => {
      const element = document.querySelector(targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll element into view smoothly
        element.scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });

        // Add pulse animation to target
        element.classList.add("animate-pulse");
        
        // Show tour after scroll
        timeoutRef.current = setTimeout(() => {
          setIsVisible(true);
        }, 800);

        return () => {
          element.classList.remove("animate-pulse");
        };
      }
    };

    // Try to find element immediately and after a delay (for dynamic content)
    findAndHighlight();
    const delayedTimeout = setTimeout(findAndHighlight, 500);

    return () => {
      clearTimeout(delayedTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [targetSelector]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!targetRect || !isVisible) return null;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    const padding = 20;
    const arrowSize = 12;
    
    switch (position) {
      case "top":
        return {
          left: targetRect.left + targetRect.width / 2,
          top: targetRect.top - padding,
          transform: "translate(-50%, -100%)"
        };
      case "bottom":
        return {
          left: targetRect.left + targetRect.width / 2,
          top: targetRect.bottom + padding,
          transform: "translate(-50%, 0)"
        };
      case "left":
        return {
          left: targetRect.left - padding,
          top: targetRect.top + targetRect.height / 2,
          transform: "translate(-100%, -50%)"
        };
      case "right":
        return {
          left: targetRect.right + padding,
          top: targetRect.top + targetRect.height / 2,
          transform: "translate(0, -50%)"
        };
    }
  };

  const getArrowIcon = () => {
    switch (position) {
      case "top": return ArrowDown;
      case "bottom": return ArrowUp;
      case "left": return ArrowRight;
      case "right": return ArrowLeft;
    }
  };

  const ArrowIcon = getArrowIcon();
  const tooltipPosition = getTooltipPosition();

  return createPortal(
    <>
      {/* Overlay with spotlight effect */}
      <div 
        className="fixed inset-0 z-[100] animate-fade-in"
        style={{
          background: `radial-gradient(
            circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
            transparent ${Math.max(targetRect.width, targetRect.height)}px,
            rgba(0, 0, 0, 0.7) ${Math.max(targetRect.width, targetRect.height) + 100}px
          )`
        }}
        onClick={handleClose}
      />

      {/* Highlight border around target */}
      <div
        className="fixed z-[101] pointer-events-none animate-scale-in"
        style={{
          left: targetRect.left - 8,
          top: targetRect.top - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          border: "3px solid hsl(var(--primary))",
          borderRadius: "12px",
          boxShadow: "0 0 0 4px hsl(var(--primary) / 0.2), 0 0 40px hsl(var(--primary) / 0.5)",
          transition: "all 0.3s ease-out"
        }}
      />

      {/* Tooltip Card */}
      <Card
        className="fixed z-[102] max-w-sm shadow-2xl border-2 animate-scale-in"
        style={{
          left: tooltipPosition.left,
          top: tooltipPosition.top,
          transform: tooltipPosition.transform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          {/* Arrow indicator */}
          <div className="flex items-center gap-2 text-primary">
            <ArrowIcon className="h-5 w-5 animate-bounce" />
            <span className="text-sm font-semibold">Action needed here</span>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {/* Close button */}
          <div className="flex justify-end">
            <Button
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="hover-scale"
            >
              <X className="h-4 w-4 mr-2" />
              Got it
            </Button>
          </div>
        </div>

        {/* Pulsing indicator dots */}
        <div 
          className="absolute w-3 h-3 bg-primary rounded-full animate-ping"
          style={{
            [position === "top" ? "bottom" : position === "bottom" ? "top" : position === "left" ? "right" : "left"]: "-6px",
            [position === "left" || position === "right" ? "top" : "left"]: "50%",
            transform: position === "left" || position === "right" ? "translateY(-50%)" : "translateX(-50%)"
          }}
        />
      </Card>
    </>,
    document.body
  );
}