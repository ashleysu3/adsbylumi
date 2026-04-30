import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Plus, Loader2, Calendar, RefreshCcw, TrendingUp, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampaignRetrospective, type CampaignRetrospectiveJSON } from '@/components/creative/CampaignRetrospective';

// ============================================================================
// Retrospectives (Patch #23)
//
// The hub for everything campaign-retrospective. Lists past retrospectives
// at the top, "Create retrospective" button opens a tray with date-range
// selector + Meta campaigns active in that window. User picks one →
// retrospective generates → row appears in the list.
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
  summary: string;
  retrospective_json: CampaignRetrospectiveJSON | null;
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

const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
];

export default function Retrospectives() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const [retros, setRetros] = useState<RetroRow[]>([]);
  const [loadingRetros, setLoadingRetros] = useState(false);

  // Tray state
  const [trayOpen, setTrayOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [campaigns, setCampaigns] = useState<MetaCampaign[] | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Selected retro for viewing
  const [selectedRetro, setSelectedRetro] = useState<RetroRow | null>(null);

  // Load brands + auto-select first.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('brands')
        .select('id, name, meta_account_id')
        .eq('user_id', user.id)
        .order('name');
      const list = (data as any[]) || [];
      setBrands(list);
      if (list.length > 0) setActiveBrandId(list[0].id);
    })();
  }, []);

  // Load retrospectives whenever brand changes.
  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    (async () => {
      setLoadingRetros(true);
      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select('id, name, offer_name, retrospective_json, retrospective_generated_at')
        .eq('brand_id', activeBrandId)
        .not('retrospective_json', 'is', null)
        .order('retrospective_generated_at', { ascending: false, nullsFirst: false });
      if (cancelled) return;
      if (!error && data) {
        const rows: RetroRow[] = (data as any[]).map(w => {
          const r = w.retrospective_json || {};
          const stats = r.stats || {};
          return {
            workspace_id: w.id,
            workspace_name: w.offer_name || w.name || 'Unnamed campaign',
            generated_at: w.retrospective_generated_at || r.generated_at,
            total_spend: Number(stats.total_spend || 0),
            total_results: Number(stats.total_results || 0),
            avg_cpl: stats.avg_cpl != null ? Number(stats.avg_cpl) : null,
            summary: r.summary || '',
            retrospective_json: w.retrospective_json as CampaignRetrospectiveJSON | null,
          };
        });
        setRetros(rows);
      }
      setLoadingRetros(false);
    })();
    return () => { cancelled = true; };
  }, [activeBrandId]);

  const activeBrand = useMemo(
    () => brands.find(b => b.id === activeBrandId) || null,
    [brands, activeBrandId],
  );

  // Pull campaigns when the tray opens or the range changes.
  const loadCampaigns = async (days: number) => {
    if (!activeBrandId) return;
    setLoadingCampaigns(true);
    setCampaigns(null);
    try {
      const today = new Date();
      const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('list-campaigns-for-retrospective', {
        body: {
          brandId: activeBrandId,
          startDate: fmt(start),
          endDate: fmt(today),
        },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success) throw new Error(data?.error || 'Could not load campaigns');
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      console.error('list campaigns failed:', err);
      toast.error('Could not load campaigns', {
        description: err?.message || 'Check that this brand is connected to Meta.',
      });
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

  const handleGenerate = async (c: MetaCampaign) => {
    if (!activeBrandId) return;
    setGeneratingId(c.metaCampaignId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-retrospective', {
        body: { brandId: activeBrandId, metaCampaignId: c.metaCampaignId },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success) throw new Error(data?.error || 'No retrospective returned');
      toast.success(`Retrospective ready: ${c.name}`);
      setTrayOpen(false);
      // Refresh the retrospectives list.
      setActiveBrandId(id => id); // bump effect
      // Also push the new row into the existing list immediately so the
      // user sees it without waiting for the requery.
      const r = data.retrospective;
      const stats = r?.stats || {};
      setRetros(prev => [
        {
          workspace_id: data.workspaceId,
          workspace_name: c.name,
          generated_at: r?.generated_at || new Date().toISOString(),
          total_spend: Number(stats.total_spend || 0),
          total_results: Number(stats.total_results || 0),
          avg_cpl: stats.avg_cpl != null ? Number(stats.avg_cpl) : null,
          summary: r?.summary || '',
          retrospective_json: r as CampaignRetrospectiveJSON | null,
        },
        ...prev.filter(x => x.workspace_id !== data.workspaceId),
      ]);
    } catch (err: any) {
      console.error('retrospective failed:', err);
      toast.error('Could not generate retrospective: ' + (err?.message || 'unknown'));
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
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
            {brands.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <Select value={activeBrandId ?? ''} onValueChange={setActiveBrandId}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="lumi" className="gap-1.5" onClick={handleOpenTray}>
              <Plus className="h-4 w-4" />
              Create retrospective
            </Button>
          </div>
        </div>

        {/* Existing retrospectives */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Past retrospectives ({retros.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            {loadingRetros ? (
              <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />Loading…
              </div>
            ) : retros.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="font-semibold">No retrospectives yet for this brand</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Click "Create retrospective" above to pick a campaign and pull a post-mortem.
                </p>
              </div>
            ) : (
              retros.map(r => (
                <div key={r.workspace_id} className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.workspace_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.summary}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-2">
                        <span>Spend: {fmtCurrency(r.total_spend)}</span>
                        <span>•</span>
                        <span>{fmtNumber(r.total_results)} results</span>
                        {r.avg_cpl != null && <><span>•</span><span>{fmtCurrency(r.avg_cpl)} avg / result</span></>}
                        <span>•</span>
                        <span>Reviewed {new Date(r.generated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0"
                      onClick={() => setSelectedRetro(r)}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tray */}
      <Sheet open={trayOpen} onOpenChange={setTrayOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pick a campaign to retro</SheetTitle>
            <SheetDescription>
              Lumi pulls Meta campaigns with spend in your selected window. Click one to generate the
              post-mortem — usually finishes in 5–15 seconds.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Time frame
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
                        <span>{fmtNumber(c.results)} results</span>
                        {c.cpl != null && <><span>•</span><span>{fmtCurrency(c.cpl)} / result</span></>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="lumi"
                      className="gap-1.5 shrink-0"
                      onClick={() => handleGenerate(c)}
                      disabled={generatingId === c.metaCampaignId}
                    >
                      {generatingId === c.metaCampaignId
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : c.hasRetrospective ? <RefreshCcw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generatingId === c.metaCampaignId
                        ? 'Generating…'
                        : c.hasRetrospective ? 'Re-run' : 'Retro'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtNumber(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}
