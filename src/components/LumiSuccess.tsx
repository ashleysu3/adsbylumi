import { cn } from "@/lib/utils";
import { SparkleIcon } from "./SparkleIcon";
import { CheckCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface LumiSuccessProps {
  title?: string;
  message?: string;
  show?: boolean;
  onComplete?: () => void;
  className?: string;
}

export function LumiSuccess({ 
  title = "Nice work! ✨", 
  message = "Your changes have been saved.",
  show = true,
  onComplete,
  className 
}: LumiSuccessProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className={cn(
      "fixed inset-0 flex items-center justify-center z-50 pointer-events-none",
      className
    )}>
      <div className="relative animate-fade-in">
        {/* Background glow */}
        <div className="absolute inset-0 -m-8 bg-lumi-yellow/20 rounded-full blur-3xl animate-pulse" />
        
        {/* Success card */}
        <div className="relative bg-card border-2 border-primary/30 rounded-2xl p-8 shadow-glow lumi-success-glow max-w-sm text-center">
          {/* Sparkles */}
          <Sparkles className="absolute -top-3 -left-3 w-6 h-6 text-lumi-yellow animate-bounce" />
          <Sparkles className="absolute -top-2 -right-4 w-5 h-5 text-lumi-orange-2 animate-bounce delay-100" />
          <Sparkles className="absolute -bottom-2 -right-2 w-4 h-4 text-lumi-orange-3 animate-bounce delay-200" />
          
          {/* Lumi with success check */}
          <div className="relative mb-4 flex justify-center">
            <SparkleIcon size="lg" state="talking" glow />
            <div className="absolute -bottom-1 -right-2 bg-green-500 rounded-full p-1 shadow-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}

// Toast-style success notification
export function LumiSuccessToast({ 
  message = "Done! ✨",
  className 
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 bg-card border border-primary/30 rounded-xl px-4 py-3 shadow-glow",
      className
    )}>
      <div className="relative">
        <SparkleIcon size="xs" state="talking" glow />
      </div>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
