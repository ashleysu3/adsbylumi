import { useState } from "react";
import { ChevronDown, Target, X } from "lucide-react";
import { OBJECTIVE_PLAIN, type KitStrategy } from "./types";

// The strategy overview — "exactly what LUMI would set up in Ads Manager."
// `compact` is the onboarding strip (one-line reassurance while the kit
// builds); `full` is the kit-page card with per-campaign settings shown as
// plain-English label + raw Ads Manager value pairs.
export function GamePlanCard({
  strategy,
  variant = "full",
}: {
  strategy: KitStrategy | (Record<string, any> & { name?: string; description?: string });
  variant?: "compact" | "full";
}) {
  const [expanded, setExpanded] = useState(false);
  if (!strategy) return null;
  const s: any = strategy;
  const title = s.title || s.personalized_title || s.name || "Your game plan";
  const intro = s.intro || s.personalized_intro || s.description || null;
  const campaigns = Array.isArray(s.campaigns) ? s.campaigns : [];

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-left rounded-2xl border bg-muted/30 p-4 animate-fade-in hover:bg-muted/50 transition-colors group"
          aria-label="Open your full game plan"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl bg-background border">
              <Target className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Your game plan is ready
              </div>
              <div className="text-sm font-semibold text-foreground mt-0.5 truncate">{title}</div>
              {intro && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{intro}</p>}
            </div>
            <div className="mt-2 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </button>

        {expanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border bg-background p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Close game plan"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="pr-8">
                <h2 className="font-display text-xl sm:text-2xl mb-1">{title}</h2>
                {intro && <p className="text-sm text-muted-foreground mb-4">{intro}</p>}
                <p className="text-xs text-muted-foreground mb-5">
                  These are the exact settings LUMI sets up in Ads Manager — check our work, or never open it at all.
                </p>
                <div className="space-y-3">
                  {campaigns.map((c: any, i: number) => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <p className="font-semibold text-sm mb-2">{c.name || `Campaign ${i + 1}`}</p>
                      <div className="space-y-1.5 text-sm">
                        {c.objective && (
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <span className="text-muted-foreground">
                              {OBJECTIVE_PLAIN[c.objective] || "Campaign objective"}
                            </span>
                            <code className="text-[11px] bg-muted rounded px-2 py-0.5">{c.objective}</code>
                          </div>
                        )}
                        {c.audience && (
                          <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <span className="text-muted-foreground">Who sees it</span>
                            <span className="text-right font-medium max-w-[60%]">{c.audience}</span>
                          </div>
                        )}
                        {c.creative_brief && (
                          <p className="text-xs text-muted-foreground pt-2 border-t border-border/60 mt-1">
                            {c.creative_brief}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }


  if (!campaigns.length) return null;
  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl text-center mb-2">{title}</h2>
      {intro && (
        <p className="text-sm text-muted-foreground text-center mb-3 max-w-xl mx-auto">{intro}</p>
      )}
      <p className="text-xs text-muted-foreground text-center mb-8">
        These are the exact settings LUMI sets up in Ads Manager — check our work, or never open it at all.
      </p>
      <div className="space-y-4">
        {campaigns.map((c: any, i: number) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold text-sm mb-3">{c.name || `Campaign ${i + 1}`}</p>
            <div className="space-y-2 text-sm">
              {c.objective && (
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-muted-foreground">
                    {OBJECTIVE_PLAIN[c.objective] || "Campaign objective"}
                  </span>
                  <code className="text-[11px] bg-muted rounded px-2 py-0.5">{c.objective}</code>
                </div>
              )}
              {c.audience && (
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-muted-foreground">Who sees it</span>
                  <span className="text-right font-medium max-w-[60%]">{c.audience}</span>
                </div>
              )}
              {c.creative_brief && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-border/60 mt-2">
                  {c.creative_brief}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
