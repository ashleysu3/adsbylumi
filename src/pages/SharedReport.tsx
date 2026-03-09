import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function formatKpiValue(value: number, kpi: string) {
  if (['cpl', 'cpc', 'cplpv', 'cppv', 'cp2sc', 'cpm'].includes(kpi)) return `$${value.toFixed(2)}`;
  if (kpi === 'roas') return `${value.toFixed(1)}x`;
  if (kpi === 'ctr') return `${(value * 100).toFixed(1)}%`;
  return String(Math.round(value));
}

export default function SharedReport() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    supabase.functions.invoke('get-shared-report', {
      body: { shareToken },
    }).then(({ data, error: err }) => {
      if (err || !data?.report) {
        setError('This report link is no longer valid.');
      } else {
        setReport(data.report);
      }
      setLoading(false);
    });
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Report Not Found</h1>
          <p className="text-muted-foreground">{error || 'This report link is no longer valid.'}</p>
        </div>
      </div>
    );
  }

  const reportData = (report.report_data || []) as any[];
  const summary = (report.summary || {}) as any;

  const configuredCampaigns = reportData
    .filter(c => c.has_goals && !['unconfigured', 'error', 'no_data'].includes(c.status))
    .sort((a, b) => {
      const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

  const statusDotClass = (status: string) => {
    if (status === 'green') return 'bg-green-500';
    if (status === 'yellow') return 'bg-amber-400';
    if (status === 'red') return 'bg-red-500';
    return 'bg-muted-foreground/30';
  };

  const kpiStatusIcon = (value: number, threshold: number, goalType: string) => {
    const met = goalType === 'less_than' ? value <= threshold : value >= threshold;
    const close = goalType === 'less_than' ? value <= threshold * 1.25 : value >= threshold * 0.75;
    if (met) return '✅';
    if (close) return '🟡';
    return '🔴';
  };

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 print:mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{report.brand_name}</h1>
            <p className="text-muted-foreground text-sm">
              Ad Performance Review · {report.date_range_start} – {report.date_range_end}
            </p>
          </div>
          <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print / Save as PDF
          </Button>
        </div>

        {/* Summary */}
        <Card className="mb-6 print:border print:shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <span>🟢 {summary.green || 0} on track</span>
              <span>🟡 {summary.yellow || 0} need attention</span>
              <span>🔴 {summary.red || 0} need action</span>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Cards */}
        <div className="space-y-4">
          {configuredCampaigns.map((c, i) => (
            <Card key={i} className="print:break-inside-avoid print:border print:shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${statusDotClass(c.status)}`} />
                  <CardTitle className="text-lg">{c.workspace_name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.goals && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{c.goals.primary_kpi_label}</span>
                      <span>
                        <span className="font-semibold">{formatKpiValue(c.primary_kpi_value, c.goals.primary_kpi)}</span>
                        <span className="text-muted-foreground ml-2">
                          Goal: {c.goals.primary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.primary_kpi_threshold, c.goals.primary_kpi)}
                        </span>
                        <span className="ml-2">{kpiStatusIcon(c.primary_kpi_value, c.goals.primary_kpi_threshold, c.goals.primary_kpi_goal_type)}</span>
                      </span>
                    </div>
                    {c.goals.secondary_kpi && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{c.goals.secondary_kpi_label}</span>
                        <span>
                          <span className="font-semibold">{formatKpiValue(c.secondary_kpi_value || 0, c.goals.secondary_kpi)}</span>
                          <span className="text-muted-foreground ml-2">
                            Goal: {c.goals.secondary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.secondary_kpi_threshold, c.goals.secondary_kpi)}
                          </span>
                          <span className="ml-2">{kpiStatusIcon(c.secondary_kpi_value || 0, c.goals.secondary_kpi_threshold, c.goals.secondary_kpi_goal_type)}</span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Frequency</span>
                      <span>
                        <span className="font-semibold">{c.metrics?.frequency?.toFixed(1) || '0'}</span>
                        <span className="text-muted-foreground ml-2">Goal: &lt;{c.goals.frequency_threshold || 4}</span>
                        <span className="ml-2">{(c.metrics?.frequency || 0) < (c.goals.frequency_threshold || 4) ? '✅' : '⚠️'}</span>
                      </span>
                    </div>
                  </div>
                )}

                {c.recommendations?.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">RECOMMENDATIONS</div>
                    {c.recommendations.map((r: any, ri: number) => (
                      <div key={ri} className="text-sm flex gap-2 mb-1">
                        <span>{r.icon}</span>
                        <span>{r.action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {c.budget_hogs?.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    {c.budget_hogs.map((h: any, hi: number) => (
                      <div key={hi} className="text-sm text-amber-800 dark:text-amber-200">
                        ⚠️ "{h.name}" at ${h.costPerResult.toFixed(2)} CPR
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-8 print:mt-4">
          Powered by LUMI
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
          .print\\:border { border: 1px solid #eee; }
          .print\\:shadow-none { box-shadow: none; }
          .print\\:bg-white { background: white; }
          .print\\:mb-4 { margin-bottom: 1rem; }
          .print\\:mt-4 { margin-top: 1rem; }
        }
      `}</style>
    </div>
  );
}
