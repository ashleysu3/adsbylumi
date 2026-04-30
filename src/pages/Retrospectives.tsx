import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Bar, BarChart, Legend,
} from 'recharts';
import {
  Sparkles, Plus, Loader2, Calendar, ExternalLink, RefreshCcw,
  CheckCircle2, XCircle, Target, AlertTriangle, Lightbulb, Trophy, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RetrospectiveSetupDialog, type RetroSetupResult } from '@/components/creative/RetrospectiveSetupDialog';
import { useBrand } from '@/contexts/BrandContext';

// ============================================================================
// Retrospectives (Patch #24 — merged page)
//
// Single hub for both per-campaign retros AND brand-wide patterns. Tabs:
//   - "Per campaign" — list of past retros + Create button + tray of Meta
//                       campaigns. Goal-aware setup dialog before generating.
//   - "Patterns"     — aggregate trends across all retros: CPL trend chart,
//                       spend vs results bars, top accumulated learnings.
//
// Replaces the separate /retrospectives + /brand/patterns pages.
// ============================================================================

interface Brand {
  id: string;
  name: string;
  meta_account_id: string | null;
}

interface RetroRow {
  workspace_id: string;
  workspace_name: string;
  generated_at: string;
  total_spend: number;
  total_results: number;
  avg_cpl: number | null;
  duration_days: number | null;
  summary: string;
  goal_label: string | null;
  goal_threshold: number | null;
  goal_unit: string | null;
  goal_direction: 'less_than' | 'greater_than' | null;
  goal_actual: number | null;
  goal_hit: boolean | null;
  data_quality: 'high' | 'medium' | 'low' | 'insufficient' | null;
}

interface MetaCampaign {
  metaCampaignId: string;
  name: string;
  status: string;
  objective: string | null;
  spend: number;
  results: number;
  cpl: number | null;
  hasWorkspace: boolean;
  workspaceId: string | null;
  hasRetrospective: boolean;
}

interface Learning {
  id: string;
  category: 'win' | 'miss' | 'recommendation';
  insight: string;
  supporting_data: string | null;
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
}

const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
];

export default function Retrospectives() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const activeBrandId = activeBrand?.id ?? null;

  const [retros, setRetros] = useState<RetroRow[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Tray (campaign picker) state
  const [trayOpen, setTrayOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [campaigns, setCampaigns] = useState<MetaCampaign[] | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Setup dialog (goal + window)
  const [setupCampaign, setSetupCampaign] = useState<MetaCampaign | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Past retros + brand learnings, both for the active brand.
  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      const [retroRes, learningRes] = await Promise.all([
        supabase
          .from('campaign_workspaces')
          .select('id, name, offer_name, retrospective_json, retrospective_generated_at')
          .eq('brand_id', activeBrandId)
          .not('retrospective_json', 'is', null)
          .order('retrospective_generated_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('brand_learnings' as any)
          .select('id, category, insight, supporting_data, confidence, created_at')
          .eq('brand_id', activeBrandId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (!retroRes.error && retroRes.data) {
        const rows: RetroRow[] = (retroRes.data as any[]).map(w => {
          const r = w.retrospective_json || {};
          const stats = r.stats || {};
          return {
            workspace_id: w.id,
            workspace_name: w.offer_name || w.name || 'Unnamed campaign',
            generated_at: w.retrospective_generated_at || r.generated_at,
            total_spend: Number(stats.total_spend || 0),
            total_results: Number(stats.total_results || 0),
            avg_cpl: stats.avg_cpl != null ? Number(stats.avg_cpl) : null,
            duration_days: stats.duration_days != null ? Number(stats.duration_days) : null,
            summary: r.summary || '',
            goal_label: stats.goal_label ?? null,
            goal_threshold: stats.goal_threshold != null ? Number(stats.goal_threshold) : null,
            goal_unit: stats.goal_unit ?? null,
            goal_direction: stats.goal_direction ?? null,
            goal_actual: stats.goal_actual != null ? Number(stats.goal_actual) : null,
            goal_hit: stats.goal_hit ?? null,
            data_quality: r.data_quality ?? null,
          };
        });
        setRetros(rows);
      }
      if (!learningRes.error && learningRes.data) {
        setLearnings((learningRes.data as any[]) as Learning[]);
      }
      setLoadingData(false);
    })();
    return () => { cancelled = true; };
  }, [activeBrandId]);

  // activeBrand provided by BrandContext above

  const loadCampaigns = async (days: number) => {
    if (!activeBrandId) return;
    setLoadingCampaigns(true);
    setCampaigns(null);
    try {
      const today = new Date();
      const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('list-campaigns-for-retrospective', {
        body: { brandId: activeBrandId, startDate: fmt(start), endDate: fmt(today) },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success) throw new Error(data?.error || 'Could not load campaigns');
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      toast.error('Could not load campaigns', { description: err?.message });
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleOpenTray = () => {
    if (!activeBrand?.meta_account_id) {
      toast.error('Connect this brand to Meta first to pull campaigns.');
      return;
    }
    setTrayOpen(true);
    loadCampaigns(rangeDays);
  };

  const handleRangeChange = (val: string) => {
    const n = parseInt(val, 10);
    setRangeDays(n);
    loadCampaigns(n);
  };

  const handlePickCampaign = (c: MetaCampaign) => {
    setSetupCampaign(c);
  };

  const handleConfirmSetup = async (result: RetroSetupResult) => {
    if (!activeBrandId || !setupCampaign) return;
    setGeneratingId(setupCampaign.metaCampaignId);
    setSetupCampaign(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-retrospective', {
        body: {
          brandId: activeBrandId,
          metaCampaignId: setupCampaign.metaCampaignId,
          goalOverride: result.goalOverride,
          dateRange: result.dateRange,
        },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success) throw new Error(data?.error || 'No retrospective returned');

      toast.success(`Retrospective ready: ${setupCampaign.name}`);
      setTrayOpen(false);

      // Reload retros + learnings (state below appends the new one).
      const r = data.retrospective;
      const stats = r?.stats || {};
      setRetros(prev => [
        {
          workspace_id: data.workspaceId,
          workspace_name: setupCampaign.name,
          generated_at: r?.generated_at || new Date().toISOString(),
          total_spend: Number(stats.total_spend || 0),
          total_results: Number(stats.total_results || 0),
          avg_cpl: stats.avg_cpl != null ? Number(stats.avg_cpl) : null,
          duration_days: stats.duration_days != null ? Number(stats.duration_days) : null,
          summary: r?.summary || '',
          goal_label: stats.goal_label ?? null,
          goal_threshold: stats.goal_threshold != null ? Number(stats.goal_threshold) : null,
          goal_unit: stats.goal_unit ?? null,
          goal_direction: stats.goal_direction ?? null,
          goal_actual: stats.goal_actual != null ? Number(stats.goal_actual) : null,
          goal_hit: stats.goal_hit ?? null,
          data_quality: r?.data_quality ?? null,
        },
        ...prev.filter(x => x.workspace_id !== data.workspaceId),
      ]);
    } catch (err: any) {
      toast.error('Could not generate retrospective: ' + (err?.message || 'unknown'));
    } finally {
      setGeneratingId(null);
    }
  };

  // ----- Patterns calculations -----
  const patternStats = useMemo(() => {
    const spend = retros.reduce((s, r) => s + r.total_spend, 0);
    const results = retros.reduce((s, r) => s + r.total_results, 0);
    const avgCpl = results > 0 ? spend / results : null;
    return { spend, results, avgCpl, count: retros.length };
  }, [retros]);

  const cplTrend = useMemo(() => {
    return [...retros]
      .filter(r => r.avg_cpl != null)
      .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime())
      .map(r => ({
        name: r.workspace_name.slice(0, 18),
        cpl: r.avg_cpl,
        spend: r.total_spend,
        results: r.total_results,
      }));
  }, [retros]);

  const wins = learnings.filter(l => l.category === 'win');
  const misses = learnings.filter(l => l.category === 'miss');
  const recs = learnings.filter(l => l.category === 'recommendation');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              Campaign Retrospectives
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lumi's post-mortem on past campaigns. Pull data from any campaign that ran in your Meta account
              — even if you didn't build it in LUMI.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <Button variant="lumi" className="gap-1.5" onClick={handleOpenTray}>
              <Plus className="h-4 w-4" />
              Create retrospective
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="per-campaign" className="space-y-4">
          <TabsList>
            <TabsTrigger value="per-campaign" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Per campaign ({retros.length})
            </TabsTrigger>
            <TabsTrigger value="patterns" className="gap-1.5" disabled={retros.length < 1}>
              <TrendingUp className="h-3.5 w-3.5" />
              Patterns across campaigns
            </TabsTrigger>
          </TabsList>

          {/* Per-campaign tab */}
          <TabsContent value="per-campaign" className="space-y-2">
            {loadingData ? (
              <div className="p-12 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />Loading…
              </div>
            ) : retros.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center space-y-2">
                  <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="font-semibold">No retrospectives yet for this brand</p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Click "Create retrospective" above to pick a campaign and pull a goal-anchored post-mortem.
                  </p>
                </CardContent>
              </Card>
            ) : (
              retros.map(r => <RetroRowCard key={r.workspace_id} row={r} onOpen={() => navigate(`/creative-studio?workspace=${r.workspace_id}`)} />)
            )}
          </TabsContent>

          {/* Patterns tab */}
          <TabsContent value="patterns" className="space-y-4">
            {retros.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Run at least one retrospective to start populating this view.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile label="Campaigns reviewed" value={String(patternStats.count)} />
                  <StatTile label="Total spend" value={fmtCurrency(patternStats.spend)} />
                  <StatTile label="Total results" value={fmtNumber(patternStats.results)} />
                  <StatTile label="Avg cost / result" value={patternStats.avgCpl != null ? fmtCurrency(patternStats.avgCpl) : '—'} />
                </div>

                {cplTrend.length >= 2 && (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">Cost per result over time</CardTitle>
                      <p className="text-xs text-muted-foreground">Each point is a campaign. Read left to right — older to newer.</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cplTrend} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                            <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                            <ChartTooltip formatter={(value: any, name: any) => name === 'cpl' ? fmtCurrency(Number(value)) : value} />
                            <Line type="monotone" dataKey="cpl" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                            {patternStats.avgCpl != null && (
                              <ReferenceLine y={patternStats.avgCpl} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'avg', fontSize: 10, position: 'right' }} />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {cplTrend.length >= 1 && (
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

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      What Lumi knows
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Aggregated insights from every retrospective for this brand.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <LearningGroup title="What's worked" icon={<Trophy className="h-3.5 w-3.5 text-emerald-600" />}
                      items={topByConfidence(wins, 6)} accent="bg-emerald-500/5 border-emerald-500/30"
                      emptyText="No wins extracted yet." />
                    <LearningGroup title="What hasn't" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      items={topByConfidence(misses, 6)} accent="bg-amber-500/5 border-amber-500/30"
                      emptyText="No misses extracted yet." />
                    <LearningGroup title="Recommendations carrying forward" icon={<Lightbulb className="h-3.5 w-3.5 text-primary" />}
                      items={topByConfidence(recs, 8)} accent="bg-primary/5 border-primary/30"
                      emptyText="No recommendations extracted yet." />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Tray (campaign picker) */}
      <Sheet open={trayOpen} onOpenChange={setTrayOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pick a campaign to retro</SheetTitle>
            <SheetDescription>
              Lumi pulls Meta campaigns with spend in your selected window. Click one — you'll confirm the goal and time-window before generating.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Filter by activity in
              </Label>
              <Select value={String(rangeDays)} onValueChange={handleRangeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map(o => (
                    <SelectItem key={o.days} value={String(o.days)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-1">
              {loadingCampaigns && (
                <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />Pulling from Meta…
                </div>
              )}
              {!loadingCampaigns && campaigns?.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                  No campaigns with spend in the last {rangeDays} days. Try a longer window.
                </div>
              )}
              {!loadingCampaigns && campaigns?.map(c => (
                <div key={c.metaCampaignId} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                        {c.objective && <Badge variant="outline" className="text-[10px]">{c.objective}</Badge>}
                        {c.hasRetrospective && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                            Already reviewed
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-1.5">
                        <span>Spend: {fmtCurrency(c.spend)}</span>
                        <span>•</span>
                        <span>{fmtNumber(c.results)} {kpiResultsLabel((c as any).kpi)}</span>
                        {c.cpl != null && (
                          <>
                            <span>•</span>
                            <span>{formatKpiValue(c.cpl, (c as any).kpiUnit || '$')} / {kpiSingularLabel((c as any).kpi)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm" variant="lumi"
                      className="gap-1.5 shrink-0"
                      onClick={() => handlePickCampaign(c)}
                      disabled={generatingId === c.metaCampaignId}
                    >
                      {generatingId === c.metaCampaignId
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : c.hasRetrospective ? <RefreshCcw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generatingId === c.metaCampaignId ? 'Generating…'
                        : c.hasRetrospective ? 'Re-run' : 'Retro'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Setup dialog */}
      {setupCampaign && activeBrandId && (
        <RetrospectiveSetupDialog
          open={!!setupCampaign}
          onOpenChange={o => !o && setSetupCampaign(null)}
          campaign={setupCampaign}
          workspaceId={setupCampaign.workspaceId}
          brandId={activeBrandId}
          onConfirm={handleConfirmSetup}
        />
      )}
    </DashboardLayout>
  );
}

function RetroRowCard({ row, onOpen }: { row: RetroRow; onOpen: () => void }) {
  const goalSet = row.goal_threshold != null;
  const hit = row.goal_hit;
  const insufficient = row.data_quality === 'insufficient';
  const lowQuality = row.data_quality === 'low';

  const goalArrow = row.goal_direction === 'greater_than' ? '≥' : '≤';
  const goalUnit = row.goal_unit || '';
  const goalStr = goalSet ? `${goalArrow} ${formatValue(row.goal_threshold!, goalUnit)}` : null;
  const actualStr = row.goal_actual != null ? formatValue(row.goal_actual, goalUnit) : null;

  return (
    <Card className={cn(
      'rounded-xl border transition-colors',
      insufficient && 'border-destructive/30 bg-destructive/5',
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{row.workspace_name}</p>
              {goalSet && (
                hit
                  ? <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Goal hit</Badge>
                  : <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 gap-1"><XCircle className="h-3 w-3" />Goal missed</Badge>
              )}
              {!goalSet && (
                <Badge variant="outline" className="text-[10px]">No goal set</Badge>
              )}
              {insufficient && (
                <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Insufficient data</Badge>
              )}
              {lowQuality && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">Limited data</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{row.summary}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {goalStr && (
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  {row.goal_label}: {goalStr}
                  {actualStr && <> → <span className={hit ? 'text-emerald-700' : 'text-destructive'}>{actualStr}</span></>}
                </span>
              )}
              <span>Spend: {fmtCurrency(row.total_spend)}</span>
              <span>•</span>
              <span>{fmtNumber(row.total_results)} results</span>
              {row.duration_days != null && <><span>•</span><span>{row.duration_days}d</span></>}
              <span>•</span>
              <span>Reviewed {new Date(row.generated_at).toLocaleDateString()}</span>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={onOpen}>
            <ExternalLink className="h-3 w-3" />Open
          </Button>
        </div>
      </CardContent>
    </Card>
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

function formatValue(n: number, unit: string): string {
  if (unit === '$') return `$${n.toFixed(2)}`;
  if (unit === 'x') return `${n.toFixed(2)}x`;
  if (unit === '%') return `${n.toFixed(2)}%`;
  return String(n);
}
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtNumber(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}
function kpiResultsLabel(kpi?: string): string {
  switch (kpi) {
    case 'cpl': return 'leads';
    case 'cpp': return 'purchases';
    case 'cpc': return 'clicks';
    case 'cpm': return 'impressions';
    case 'ctr': return 'clicks';
    case 'roas': return 'purchases';
    case 'costPerThruPlay': return 'thruplays';
    default: return 'results';
  }
}
function kpiSingularLabel(kpi?: string): string {
  switch (kpi) {
    case 'cpl': return 'lead';
    case 'cpp': return 'purchase';
    case 'cpc': return 'click';
    case 'cpm': return '1k impressions';
    case 'ctr': return 'click';
    case 'roas': return 'ROAS';
    case 'costPerThruPlay': return 'thruplay';
    default: return 'result';
  }
}
function formatKpiValue(n: number, unit: string): string {
  if (unit === '$') return `$${n.toFixed(2)}`;
  if (unit === 'x') return `${n.toFixed(2)}x`;
  if (unit === '%') return `${n.toFixed(2)}%`;
  return String(n);
}
