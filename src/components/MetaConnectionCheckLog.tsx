import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  History,
  Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { MetaCheckItem } from "@/lib/log-meta-check";

interface CheckLogRow {
  id: string;
  created_at: string;
  check_type: string;
  outcome: string;
  summary: string | null;
  checks_performed: MetaCheckItem[];
  details: Record<string, unknown>;
}

interface Props {
  brandId: string;
  /** Bumped by parent after a new check runs so we re-fetch */
  refreshKey?: number;
}

const TYPE_LABELS: Record<string, string> = {
  auto_test: "Auto test",
  manual_test: "Manual test",
  refresh: "Token refresh",
  diagnostic: "Diagnostic",
  disconnect: "Disconnect",
};

function outcomeStyle(outcome: string) {
  if (outcome === "success") {
    return {
      Icon: CheckCircle,
      cls: "text-green-600",
      badge: "bg-green-500/10 text-green-600 border-green-500/30",
      label: "Success",
    };
  }
  if (outcome === "warning") {
    return {
      Icon: AlertTriangle,
      cls: "text-amber-600",
      badge: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      label: "Warning",
    };
  }
  return {
    Icon: XCircle,
    cls: "text-destructive",
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    label: "Error",
  };
}

function checkItemDot(status: MetaCheckItem["status"]) {
  switch (status) {
    case "pass":
      return "bg-green-500";
    case "warn":
      return "bg-amber-500";
    case "fail":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/40";
  }
}

export function MetaConnectionCheckLog({ brandId, refreshKey }: Props) {
  const [rows, setRows] = useState<CheckLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchLog = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meta_connection_checks" as any)
        .select("id,created_at,check_type,outcome,summary,checks_performed,details")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setRows((data as unknown as CheckLogRow[]) || []);
    } catch (err) {
      console.warn("Failed to load Meta connection check log", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, refreshKey]);

  const handleClear = async () => {
    if (!brandId) return;
    if (!confirm("Clear the Meta connection check log for this brand?")) return;
    setClearing(true);
    try {
      const { error } = await supabase
        .from("meta_connection_checks" as any)
        .delete()
        .eq("brand_id", brandId);
      if (error) throw error;
      setRows([]);
      toast.success("Connection log cleared");
    } catch (err: any) {
      toast.error("Couldn't clear log", { description: err?.message });
    } finally {
      setClearing(false);
    }
  };

  const handleCopy = (row: CheckLogRow) => {
    const payload = {
      timestamp: row.created_at,
      type: row.check_type,
      outcome: row.outcome,
      summary: row.summary,
      checks: row.checks_performed,
      details: row.details,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Copied to clipboard");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Connection Check Log
            </CardTitle>
            <CardDescription className="mt-1">
              Recent automatic and manual checks against your Meta connection — useful
              for spotting exactly when something started failing.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLog}
              disabled={loading}
              aria-label="Refresh log"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {rows.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={clearing}
                aria-label="Clear log"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Loading log…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
            No checks logged yet. Run a connection test to start building history.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {rows.map((row) => {
              const style = outcomeStyle(row.outcome);
              const isOpen = openId === row.id;
              const created = new Date(row.created_at);
              const checks = Array.isArray(row.checks_performed)
                ? row.checks_performed
                : [];
              return (
                <li key={row.id}>
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(o) => setOpenId(o ? row.id : null)}
                  >
                    <CollapsibleTrigger className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors flex items-start gap-3">
                      <style.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.cls}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {TYPE_LABELS[row.check_type] || row.check_type}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-1.5 h-4 ${style.badge}`}
                          >
                            {style.label}
                          </Badge>
                          <span
                            className="text-[11px] text-muted-foreground"
                            title={format(created, "PPpp")}
                          >
                            {formatDistanceToNow(created, { addSuffix: true })}
                          </span>
                        </div>
                        {row.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {row.summary}
                          </p>
                        )}
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 pt-1 bg-muted/20">
                      <div className="text-[11px] text-muted-foreground mb-2">
                        {format(created, "PPpp")}
                      </div>
                      {checks.length > 0 && (
                        <div className="space-y-1 mb-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Checks performed
                          </p>
                          <ul className="space-y-1">
                            {checks.map((c, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-xs"
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${checkItemDot(
                                    c.status
                                  )}`}
                                />
                                <div className="min-w-0">
                                  <span className="font-medium">{c.label}</span>
                                  {c.note && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      — {c.note}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {row.details && Object.keys(row.details).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Raw details
                          </summary>
                          <pre className="mt-1 p-2 rounded bg-background border text-[10px] overflow-x-auto max-h-40">
                            {JSON.stringify(row.details, null, 2)}
                          </pre>
                        </details>
                      )}
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => handleCopy(row)}
                        >
                          <Copy className="h-3 w-3" />
                          Copy entry
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
