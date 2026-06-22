import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, ShieldAlert, ShieldCheck, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Severity = "likely_rejection" | "possible_flag" | "low_risk";
type Finding = { phrase: string; category: string; severity: Severity; rewrite: string };
type RevisedCopy = { headline?: string; primary_text?: string; description?: string };

interface PolicyCheckBadgeProps {
  workspaceId: string;
  item: any; // production item (with id + finalCopy / final_copy)
  niche?: string;
  onApplied?: (updatedItem: any) => void;
  className?: string;
}

type CopyShape = { headline: string; primary_text: string; description: string };

function readCopy(item: any): CopyShape {
  const fc = item?.finalCopy || item?.final_copy || {};
  return {
    headline: fc.headline || "",
    primary_text: fc.primaryText || fc.primary_text || "",
    description: fc.description || "",
  };
}

function detectField(phrase: string, copy: CopyShape): keyof CopyShape | null {
  const p = (phrase || "").toLowerCase();
  if (!p) return null;
  if (copy.headline?.toLowerCase().includes(p)) return "headline";
  if (copy.primary_text?.toLowerCase().includes(p)) return "primary_text";
  if (copy.description?.toLowerCase().includes(p)) return "description";
  return null;
}

export function PolicyCheckBadge({ workspaceId, item, niche, onApplied, className }: PolicyCheckBadgeProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    overall: "cleared" | "needs_review";
    niche_flag: string | null;
    findings: Finding[];
    revised_copy: RevisedCopy;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const copy = readCopy(item);
  const hasCopy = !!(copy.headline || copy.primary_text || copy.description);

  const run = useCallback(async () => {
    if (!hasCopy) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("check-ad-compliance", {
        body: { copy, niche, platforms: ["meta"] },
      });
      if (invokeErr) throw invokeErr;
      if (!data || data.error) throw new Error(data?.error || "Policy check failed");
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Check failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.headline, copy.primary_text, copy.description, niche, hasCopy]);

  useEffect(() => {
    run();
  }, [run]);

  const persistCopy = async (next: CopyShape) => {
    const { data: ws, error: readErr } = await supabase
      .from("campaign_workspaces")
      .select("production_items")
      .eq("id", workspaceId)
      .maybeSingle();
    if (readErr || !ws) throw readErr || new Error("Workspace not found");
    const items = (ws.production_items as any[]) || [];
    const newFinal = {
      headline: next.headline,
      primaryText: next.primary_text,
      primary_text: next.primary_text,
      description: next.description,
      cta: (item?.finalCopy?.cta || item?.final_copy?.cta || "Learn More"),
    };
    const updated = items.map((pi: any) =>
      pi.id === item.id ? { ...pi, finalCopy: newFinal, final_copy: newFinal } : pi
    );
    const { error: writeErr } = await supabase
      .from("campaign_workspaces")
      .update({ production_items: updated as any, updated_at: new Date().toISOString() })
      .eq("id", workspaceId)
      .select()
      .single();
    if (writeErr) throw writeErr;
    onApplied?.({ ...item, finalCopy: newFinal, final_copy: newFinal });
  };

  const applyFinding = async (f: Finding, idx: number) => {
    const current = readCopy(item);
    const field = detectField(f.phrase, current);
    if (!field) {
      toast.error("Couldn't locate that phrase in the current copy.");
      return;
    }
    setApplying(`f-${idx}`);
    try {
      const re = new RegExp(f.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const updatedField = current[field].replace(re, f.rewrite);
      await persistCopy({ ...current, [field]: updatedField });
      toast.success("Rewrite applied");
      // Re-run check so badge reflects new state
      run();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't apply rewrite");
    } finally {
      setApplying(null);
    }
  };

  const applyAll = async () => {
    if (!result?.revised_copy) return;
    setApplying("all");
    try {
      const current = readCopy(item);
      await persistCopy({
        headline: result.revised_copy.headline ?? current.headline,
        primary_text: result.revised_copy.primary_text ?? current.primary_text,
        description: result.revised_copy.description ?? current.description,
      });
      toast.success("All rewrites applied");
      run();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't apply rewrites");
    } finally {
      setApplying(null);
    }
  };

  if (!hasCopy) return null;

  const issueCount = result?.findings?.length || 0;
  const cleared = result?.overall === "cleared";

  let badge: React.ReactNode;
  if (loading && !result) {
    badge = (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Policy check…
      </Badge>
    );
  } else if (error) {
    badge = (
      <Badge variant="outline" className="gap-1 text-muted-foreground border-dashed">
        <AlertCircle className="h-3 w-3" />
        Policy check failed
      </Badge>
    );
  } else if (cleared) {
    badge = (
      <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/20">
        <ShieldCheck className="h-3 w-3" />
        Cleared
      </Badge>
    );
  } else if (result) {
    badge = (
      <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">
        <ShieldAlert className="h-3 w-3" />
        {issueCount} issue{issueCount === 1 ? "" : "s"} — review
      </Badge>
    );
  } else {
    badge = (
      <Badge variant="outline" className="gap-1">
        <Shield className="h-3 w-3" />
        Policy check
      </Badge>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`inline-flex items-center ${className || ""}`}
        onClick={() => setOpen(true)}
        title="Policy check"
      >
        {badge}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Ad Policy Check
            </DialogTitle>
            <DialogDescription>
              {result?.niche_flag
                ? `Sensitive niche detected: ${result.niche_flag}. `
                : ""}
              {cleared
                ? "No policy issues detected."
                : `Review ${issueCount} potential issue${issueCount === 1 ? "" : "s"} below.`}
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking…
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive py-2">{error}</div>
          )}

          {!loading && !error && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {(result?.findings || []).map((f, idx) => {
                const sevColor =
                  f.severity === "likely_rejection"
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : f.severity === "possible_flag"
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                    : "bg-muted text-muted-foreground border-border";
                return (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium break-words">"{f.phrase}"</div>
                      <Badge variant="outline" className={`text-xs ${sevColor} whitespace-nowrap`}>
                        {f.severity.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{f.category}</div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Rewrite: </span>
                      <span className="font-medium">{f.rewrite}</span>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyFinding(f, idx)}
                        disabled={applying !== null}
                      >
                        {applying === `f-${idx}` ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Apply rewrite
                      </Button>
                    </div>
                  </div>
                );
              })}
              {result && (result.findings?.length || 0) === 0 && (
                <div className="text-sm text-muted-foreground py-2">
                  Your copy looks clear of common policy traps.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={run} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              Re-check
            </Button>
            {result && (result.findings?.length || 0) > 0 && (
              <Button size="sm" onClick={applyAll} disabled={applying !== null}>
                {applying === "all" ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Apply all rewrites
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
