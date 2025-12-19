import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFloatingActionProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function MobileFloatingAction({ onClick, label = "New Ad", className }: MobileFloatingActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed right-4 bottom-20 z-40 md:hidden",
        "flex items-center justify-center gap-2",
        "h-14 min-w-14 px-4 rounded-full",
        "bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1",
        "text-white font-semibold text-sm",
        "shadow-lg shadow-lumi-pink-1/30",
        "active:scale-95 transition-transform",
        "touch-manipulation",
        className
      )}
    >
      <Sparkles className="h-5 w-5" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}
