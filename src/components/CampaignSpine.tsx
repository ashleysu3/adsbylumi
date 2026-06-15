import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignSpineProps {
  currentStep: 1 | 2 | 3 | 4;
  className?: string;
}

const STEPS = [
  { num: 1, label: "Strategy", path: "/strategy" },
  { num: 2, label: "Creative", path: "/creative" },
  { num: 3, label: "Launch", path: "/launch" },
  { num: 4, label: "Optimize", path: "/performance" },
] as const;

export function CampaignSpine({ currentStep, className }: CampaignSpineProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Campaign workflow"
      className={cn(
        "w-full mb-6 px-1 py-3 rounded-xl bg-card/40 border border-border/60",
        className,
      )}
    >
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, idx) => {
          const isDone = step.num < currentStep;
          const isCurrent = step.num === currentStep;
          const isFuture = step.num > currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <li
              key={step.num}
              className="flex items-center flex-1 min-w-0 last:flex-none"
            >
              <button
                type="button"
                onClick={() => navigate(step.path)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "group flex items-center gap-2 min-w-0 rounded-full transition-opacity",
                  isFuture && "opacity-60 hover:opacity-100",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                    isDone &&
                      "bg-emerald-500 text-white ring-2 ring-emerald-500/20",
                    isCurrent &&
                      "bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-md shadow-lumi-pink-1/30 ring-2 ring-lumi-pink-1/30",
                    isFuture &&
                      "bg-muted text-muted-foreground border border-border",
                  )}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    step.num
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm truncate hidden sm:inline",
                    isCurrent && "font-semibold text-foreground",
                    isDone && "text-foreground",
                    isFuture && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-2 h-px flex-1 transition-colors",
                    isDone ? "bg-emerald-500/60" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default CampaignSpine;
