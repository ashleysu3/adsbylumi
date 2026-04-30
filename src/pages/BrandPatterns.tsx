import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Bar,
  BarChart,
  Legend,
} from 'recharts';
import { Trophy, AlertTriangle, Lightbulb, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useImpersonation } from '@/contexts/ImpersonationContext';

// ============================================================================
// BrandPatterns (Patch #22)
//
// Brand-level dashboard aggregating campaign retrospectives + active
// learnings + per-campaign performance into one "what's the story across
// all my campaigns" view.
//
// What's shown:
//   - Header: brand picker + total spend / campaigns / avg CPL across the
//     archived/retrospected campaigns.
//   - "What's worked" / "What hasn't" / "Recommendations" — top learnings
//     across ALL retrospectives, sorted by confidence + recency.
//   - Avg cost-per-result trend line across campaigns chronologically.
//   - Spend-vs-results bar chart per campaign.
//   - Table of all campaign retrospectives, click-through to the campaign.
// ============================================================================

interface Brand {
  id: string;
  name: string;
}

interface RetroSummary {
  workspace_id: string;
  workspace_name: string;
  generated_at: string | null;
  archived_at: string | null;
  total_spend: number;
  total_results: number;
  avg_cpl: number | null;
  duration_days: number | null;
  summary: string;
}

interface Learning {
  id: string;
  category: 'win' | 'miss' | 'recommendation';
  insight: string;
  supporting_data: string | null;
  confidence: 'high' | 'medium' | 'low';
  source_workspace_id: string | null;
  created_at: string;
}

interface EligibleCampaign {
  id: string;
  name: string;
  archived_at: string | null;
}

export default function BrandPatterns() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [retros, setRetros] = useState<RetroSummary[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [eligibleCampaigns, setEligibleCampaigns] = useState<EligibleCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { getEffectiveUserId, isImpersonating, impersonatedUser } = useImpersonation();

  // Load brand list (the EFFECTIVE user's brands — respects impersonation).
  useEffect(() => {
    (async () => {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .eq('user_id', effectiveUserId)
        .order('name');
      const list = (data as any[]) || [];
      setBrands(list);
      // Reset active brand when the effective user changes (e.g. impersonation toggled).
      setActiveBrandId(list.length > 0 ? list[0].id : null);
    })();
  }, [getEffectiveUserId, isImpersonating, impersonatedUser?.id]);

  // Load retrospectives + learnings for the active brand.
  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [retroRes, learningRes] = await Promise.all([
        supabase
          .from('campaign_workspaces')
          .select('id, name, offer_name, retrospective_json, retrospective_generated_at, archived_at')
          .eq('brand_id', activeBrandId)
          .not('retrospective_json', 'is', null)
          .order('archived_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('brand_learnings' as any)
          .select('id, category, insight, supporting_data, confidence, source_workspace_id, created_at')
          .eq('brand_id', activeBrandId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      const retroRows: RetroSummary[] = ((retroRes.data as any[]) || []).map(w => {
        const r = w.retrospective_json || {};
        const stats = r.stats || {};
        return {
          workspace_id: w.id,
          workspace_name: w.offer_name || w.name || 'Unnamed campaign',
          generated_at: w.retrospective_generated_at,
          archived_at: w.archived_at,
          total_spend: Number(stats.total_spend || 0),
          total_results: Number(stats.total_results || 0),
          avg_cpl: stats.avg_cpl != null ? Number(stats.avg_cpl) : null,
          duration_days: stats.duration_days != null ? Number(stats.duration_days) : null,
          summary: r.summary || '',
        };
      });

      setRetros(retroRows);
      setLearnings(((learningRes.data as any[]) || []) as Learning[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeBrandId]);

  const totals = useMemo(() => {
    const spend = retros.reduce((s, r) => s + r.total_spend, 0);
    const results = retros.reduce((s, r) => s + r.total_results, 0);
    const avgCpl = results > 0 ? spend / results : null;
    return { spend, results, avgCpl, count: retros.length };
  }, [retros]);

  const cplTrend = useMemo(() => {
    return [...retros]
      .filter(r => r.avg_cpl != null)
      .sort((a, b) => {
        const aT = a.archived_at ? new Date(a.archived_at).getTime() : 0;
        const bT = b.archived_at ? new Date(b.archived_at).getTime() : 0;
        return aT - bT;
      })
      .map((r, i) => ({
        idx: i + 1,
        name: r.workspace_name.slice(0, 18),
        cpl: r.avg_cpl,
        results: r.total_results,
        spend: r.total_spend,
      }));
  }, [retros]);

  const wins = learnings.filter(l => l.category === 'win');
  const misses = learnings.filter(l => l.category === 'miss');
  const recs = learnings.filter(l => l.category === 'recommendation');

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Patterns Across Your Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lumi's read on what works for this brand, pulled from every campaign retrospective.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Brand</Label>
            <Select value={activeBrandId ?? ''} onValueChange={setActiveBrandId}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select brand" /></SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <Card><CardContent className="p-12 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />Loading…
          </CardContent></Card>
        ) : retros.length === 0 ? (
          <Card><CardContent className="p-12 text-center space-y-2">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="font-semibold">No retrospectives yet for this brand</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Run a "Generate retrospective" on a few campaigns from Creative Studio to start building
              this view. Patterns get more useful with more data.
            </p>
          </CardContent></Card>
        ) : (
          <>
            {/* Top-level stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Campaigns reviewed" value={String(totals.count)} />
              <StatTile label="Total spend" value={fmtCurrency(totals.spend)} />
              <StatTile label="Total results" value={fmtNumber(totals.results)} />
              <StatTile label="Avg cost / result" value={totals.avgCpl != null ? fmtCurrency(totals.avgCpl) : '—'} />
            </div>

            {/* Cost-per-result trend */}
            {cplTrend.length >= 2 && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Avg cost per result over time</CardTitle>
                  <p className="text-xs text-muted-foreground">Each point is a campaign. Read left to right — older to newer.</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cplTrend} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                        <ChartTooltip
                          formatter={(value: any, name: any) => name === 'cpl' ? fmtCurrency(Number(value)) : value}
                          labelStyle={{ fontSize: 12 }}
                        />
                        <Line type="monotone" dataKey="cpl" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                        {totals.avgCpl != null && (
                          <ReferenceLine y={totals.avgCpl} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'avg', fontSize: 10, position: 'right' }} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Spend vs results bar chart */}
            {cplTrend.length > 0 && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Spend vs results, per campaign</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cplTrend} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <ChartTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="left" dataKey="spend" fill="#a78bfa" name="Spend" />
                        <Bar yAxisId="right" dataKey="results" fill="#10b981" name="Results" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Aggregated learnings */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  What Lumi knows
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Active insights pulled from every retrospective for this brand. Sorted by confidence.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <LearningGroup
                  title="What's worked"
                  icon={<Trophy className="h-3.5 w-3.5 text-emerald-600" />}
                  items={topByConfidence(wins, 8)}
                  accent="bg-emerald-500/5 border-emerald-500/30"
                  emptyText="No wins extracted yet."
                />
                <LearningGroup
                  title="What hasn't"
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                  items={topByConfidence(misses, 8)}
                  accent="bg-amber-500/5 border-amber-500/30"
                  emptyText="No misses extracted yet."
                />
                <LearningGroup
                  title="Recommendations carrying forward"
                  icon={<Lightbulb className="h-3.5 w-3.5 text-primary" />}
                  items={topByConfidence(recs, 8)}
                  accent="bg-primary/5 border-primary/30"
                  emptyText="No recommendations extracted yet."
                />
              </CardContent>
            </Card>

            {/* Per-campaign list */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Campaigns reviewed ({retros.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {retros.map(r => (
                  <div key={r.workspace_id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{r.workspace_name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{r.summary}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{r.avg_cpl != null ? fmtCurrency(r.avg_cpl) : '—'}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">avg cost / result</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-1">
                      <span>Spend: {fmtCurrency(r.total_spend)}</span>
                      <span>•</span>
                      <span>{fmtNumber(r.total_results)} results</span>
                      <span>•</span>
                      <span>{r.duration_days != null ? `${r.duration_days}d` : '—'}</span>
                      <span>•</span>
                      <span>Reviewed {r.generated_at ? new Date(r.generated_at).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function LearningGroup({ title, icon, items, accent, emptyText }: {
  title: string;
  icon: React.ReactNode;
  items: Learning[];
  accent: string;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className={cn('rounded-md border p-2.5', accent)}>
              <p className="text-sm font-medium">{item.insight}</p>
              {item.supporting_data && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.supporting_data}</p>
              )}
              <Badge variant="outline" className="text-[10px] capitalize mt-1.5">{item.confidence} confidence</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function topByConfidence(arr: Learning[], n: number): Learning[] {
  const rank = (c: string) => c === 'high' ? 3 : c === 'medium' ? 2 : 1;
  return [...arr]
    .sort((a, b) => rank(b.confidence) - rank(a.confidence) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    .slice(0, n);
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtNumber(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}
