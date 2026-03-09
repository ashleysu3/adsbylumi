import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wraps page content and overlays an upgrade prompt when the user has no active subscription.
 * Children are still rendered (soft paywall) but interactive elements are muted.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { isSubscribed, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading || isSubscribed) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Upgrade banner pinned to top */}
      <SubscriptionBanner />
      {/* Content rendered but with interaction overlay on key areas */}
      <div className="pointer-events-auto">
        {children}
      </div>
    </div>
  );
}

export function SubscriptionBanner() {
  const { isSubscribed, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading || isSubscribed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-gradient-to-r from-primary/90 to-primary px-4 py-3 text-primary-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">
          Activate your subscription to unlock all features.{" "}
          <span className="hidden sm:inline">You're viewing in preview mode.</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 font-semibold"
        onClick={() => navigate("/pricing")}
      >
        Choose a Plan
      </Button>
    </div>
  );
}

/**
 * Wrap any feature button/section that should be locked for free users.
 * Shows a lock overlay + tooltip on hover.
 */
export function LockedFeature({
  children,
  label = "Upgrade to unlock",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const { isSubscribed, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading || isSubscribed) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn("group relative cursor-pointer", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate("/auth");
      }}
    >
      <div className="pointer-events-none select-none opacity-50 blur-[1px] transition-all">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
        <div className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md">
          <Lock className="h-3 w-3" />
          {label}
        </div>
      </div>
    </div>
  );
}
