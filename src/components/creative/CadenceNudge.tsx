// Creative cadence nudge — surfaces the active brand's archetype cadence
// inside Creative Studio. Two reads:
//   (1) Suggested test size      — "Ship N–M angles per test"
//   (2) Time-to-refresh state    — based on the most recent rotation log
//
// When a refresh is due, the CTA routes the user into the same execution
// paths we already have: bench rotation (if there's a workspace + bench
// items) or the creative flow (always available).

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, RefreshCw, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getArchetypeCadence,
  getRefreshStatus,
  getTestSizeSuggestion,
} from "@/lib/business-archetypes";

interface CadenceNudgeProps {
  brandId: string | null | undefined;
  archetypeSlug: string | null | undefined;
  workspaceId?: string | null;
  /** Optional: jump straight into a new test cycle inside Studio. */
  onStartTest?: () => void;
  /** Optional: jump to bench / rotate flow. Defaults to /creative?refresh=true. */
  onRefresh?: () => void;
}

export function CadenceNudge({
  brandId,
  archetypeSlug,
  workspaceId,
  onStartTest,
  onRefresh,
}: CadenceNudgeProps) {
  const cadence = getArchetypeCadence(archetypeSlug);
  const testSize = getTestSizeSuggestion(archetypeSlug);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!brandId) {
        setLoaded(true);
        return;
      }
      try {
        // Most recent rotation/refresh signal for the brand. We treat any
        // entry in creative_rotation_log as a refresh event.
        let q = supabase
          .from("creative_rotation_log")
          .select("created_at")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (workspaceId) q = q.eq("workspace_id", workspaceId);
        const { data } = await q.maybeSingle();
        if (!cancelled) {
          setLastRefreshAt(data?.created_at ?? null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [brandId, workspaceId]);

  const status = useMemo(
    () => getRefreshStatus(archetypeSlug, lastRefreshAt),
    [archetypeSlug, lastRefreshAt],
  );

  if (!cadence || !testSize) return null;

  const needsRefresh =
    status.state === "overdue" ||
    status.state === "due-soon" ||
    status.state === "never-refreshed";

  const tone =
    status.state === "overdue"
      ? "border-orange-200 bg-orange-50/60"
      : status.state === "due-soon"
        ? "border-amber-200 bg-amber-50/60"
        : "border-border bg-card";

  const handleRefresh = () => {
    if (onRefresh) return onRefresh();
    // Same execution path as the existing fatigue nudge.
    const url = workspaceId
      ? `/creative?workspace=${workspaceId}&refresh=true`
      : `/creative?refresh=true`;
    window.location.href = url;
  };

  return (
    <Card className={`rounded-2xl p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {needsRefresh ? (
            <RefreshCw className="h-4 w-4 text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Creative cadence</span>
            <Badge variant="outline" className="text-xs">
              {cadence.rotationPace}
            </Badge>
            {loaded && status.state === "overdue" && (
              <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                Refresh overdue · {status.daysOverdue}d past
              </Badge>
            )}
            {loaded && status.state === "due-soon" && (
              <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                Refresh due in ~{status.daysUntilDue}d
              </Badge>
            )}
            {loaded && status.state === "fresh" && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Fresh · refresh in ~{status.daysUntilDue}d
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{testSize.label}.</span>{" "}
            {status.state === "no-archetype" ? cadence.tip : status.tip}
          </p>

          {cadence.narrativeArc && (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-xs text-muted-foreground">
              {cadence.narrativeArc.map((line) => (
                <li key={line} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary/50" />
                  {line}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {onStartTest && (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={onStartTest}>
                <Sparkles className="h-4 w-4 mr-2" />
                Start test ({testSize.min}–{testSize.max} angles)
              </Button>
            )}
            {needsRefresh && (
              <Button size="sm" className="rounded-xl" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh creative
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
