import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, RefreshCw, Sparkles, Headphones, Clock,
  Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DiagnosticItem {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fix?: string;
  fixUrl?: string;
  fixTime?: string;
  steps?: string[];
}

export interface DiagnosticResult {
  diagnostics: DiagnosticItem[];
  score: { passed: number; total: number };
}

interface MetaSetupDiagnosticProps {
  result: DiagnosticResult;
  brandId: string;
  onRecheck?: () => void;
  rechecking?: boolean;
  onAskLumi?: () => void;
  recheckCount?: number;
}

const statusIcon = (status: DiagnosticItem["status"]) => {
  switch (status) {
    case "pass":
      return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "fail":
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
};

export function MetaSetupDiagnostic({
  result,
  brandId,
  onRecheck,
  rechecking,
  onAskLumi,
  recheckCount = 0,
}: MetaSetupDiagnosticProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { diagnostics, score } = result;
  const allPassing = score.passed === score.total;
  const failCount = diagnostics.filter((d) => d.status === "fail").length;
  const warnCount = diagnostics.filter((d) => d.status === "warn").length;
  const showBookingFallback = recheckCount >= 2 || failCount >= 3;

  return (
    <Card variant="gradient" className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-5 w-5" />
            Setup Health Check
          </CardTitle>
          <Badge
            variant={allPassing ? "default" : failCount > 0 ? "destructive" : "secondary"}
            className={cn(
              allPassing && "bg-green-500/10 text-green-600 border-green-500/30",
              failCount === 0 && warnCount > 0 && "bg-amber-500/10 text-amber-600 border-amber-500/30"
            )}
          >
            {score.passed}/{score.total} Ready
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {allPassing
            ? "Everything looks great! Your Meta Business setup is ready to go."
            : "Here's what we found. Fix any issues below to get your ads running smoothly."}
        </p>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {diagnostics.map((item) => {
          const isExpanded = expandedItems.has(item.key);
          const hasFixContent = item.fix || item.steps?.length;

          return (
            <div
              key={item.key}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                item.status === "pass" && "border-green-500/20 bg-green-500/5",
                item.status === "warn" && "border-amber-500/20 bg-amber-500/5",
                item.status === "fail" && "border-destructive/20 bg-destructive/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{statusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.fixTime && item.status !== "pass" && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {item.fixTime}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>

                  {hasFixContent && item.status !== "pass" && (
                    <Collapsible open={isExpanded} onOpenChange={() => toggleItem(item.key)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto py-1 px-0 text-xs text-primary hover:text-primary/80 mt-1.5 gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Hide steps <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              How to fix <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2">
                          {item.fix && (
                            <p className="text-xs text-muted-foreground">{item.fix}</p>
                          )}
                          {item.steps && item.steps.length > 0 && (
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                              {item.steps.map((step, idx) => (
                                <li key={idx} className="leading-relaxed">{step}</li>
                              ))}
                            </ol>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.fixUrl && (
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                                <a href={item.fixUrl} target="_blank" rel="noopener noreferrer">
                                  Open in Meta <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Action Row */}
        <div className="flex flex-wrap gap-2 pt-3">
          {onRecheck && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecheck}
              disabled={rechecking}
              className="gap-1.5"
            >
              {rechecking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {rechecking ? "Checking..." : "Re-check"}
            </Button>
          )}
          {onAskLumi && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAskLumi}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Lumi for help
            </Button>
          )}
        </div>

        {/* Booking Fallback */}
        {showBookingFallback && (
          <div className="mt-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Headphones className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Need hands-on help?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Some setups need a quick walkthrough. Our team can help you get everything connected in about 15 minutes.
                </p>
                <Button
                  variant="lumi"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => {
                    // Submit a help ticket through the bug report system
                    const diagnosticSummary = diagnostics
                      .filter((d) => d.status !== "pass")
                      .map((d) => `${d.label}: ${d.message}`)
                      .join("\n");
                    
                    supabase.functions
                      .invoke("send-bug-report", {
                        body: {
                          details: `Setup Help Request\n\nDiagnostic Results:\n${diagnosticSummary}`,
                          context: "setup_help",
                          currentPage: "/meta-settings",
                          currentUrl: window.location.href,
                          userAgent: navigator.userAgent,
                        },
                      })
                      .then(() => {
                        toast.success("Help request submitted! Our team will reach out soon.");
                      })
                      .catch(() => {
                        toast.error("Failed to submit request. Please try again.");
                      });
                  }}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Request Setup Help
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
