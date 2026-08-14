import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2, CheckCircle2, Sparkles, ArrowRight, ArrowLeft, Package } from 'lucide-react';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  createdTime: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  alreadyImported: boolean;
}

interface ImportedCampaign {
  id: string;
  name: string;
  workspaceId: string;
}

// ── What LUMI needs to grade an imported campaign ──────────────────────────
// Each goal maps onto the same KPI vocabulary the performance engine already
// uses for LUMI-built campaigns, so imported ads get identical status logic,
// weekly reports, and next-step recommendations.
type GoalKey = 'leads' | 'sales' | 'calls' | 'traffic' | 'awareness';

const GOAL_CONFIG: Record<
  GoalKey,
  {
    label: string;
    kpi: string;
    kpiLabel: string;
    goalType: 'less_than' | 'greater_than';
    targetLabel: string;
    targetHint: string;
    defaultThreshold: number;
    prefix?: string;
    suffix?: string;
  }
> = {
  leads: {
    label: 'Leads / signups',
    kpi: 'cpl',
    kpiLabel: 'Cost per Lead',
    goalType: 'less_than',
    targetLabel: 'A good cost per lead is under',
    targetHint: "What you're happy to pay for one lead.",
    defaultThreshold: 20,
    prefix: '$',
  },
  sales: {
    label: 'Sales / purchases',
    kpi: 'roas',
    kpiLabel: 'Return on Ad Spend',
    goalType: 'greater_than',
    targetLabel: 'A good return on ad spend is at least',
    targetHint: 'Revenue per $1 spent. 2 means $2 back for every $1 in.',
    defaultThreshold: 2,
    suffix: 'x',
  },
  calls: {
    label: 'Booked calls',
    kpi: 'cpl',
    kpiLabel: 'Cost per Booked Call',
    goalType: 'less_than',
    targetLabel: 'A good cost per booked call is under',
    targetHint: "What one call on your calendar is worth to you.",
    defaultThreshold: 60,
    prefix: '$',
  },
  traffic: {
    label: 'Traffic to my page',
    kpi: 'cpc',
    kpiLabel: 'Cost per Click',
    goalType: 'less_than',
    targetLabel: 'A good cost per click is under',
    targetHint: 'Most brands land between $0.50 and $2.00.',
    defaultThreshold: 1.5,
    prefix: '$',
  },
  awareness: {
    label: 'Awareness / reach',
    kpi: 'cpm',
    kpiLabel: 'Cost per 1000 Impressions',
    goalType: 'less_than',
    targetLabel: 'A good cost per 1,000 impressions is under',
    targetHint: 'Typical range is $8 to $25 depending on audience.',
    defaultThreshold: 20,
    prefix: '$',
  },
};

type FunnelStage = 'cold' | 'warm' | 'retargeting';

interface GoalAnswers {
  goal: GoalKey;
  landingUrl: string;
  threshold: string;
  funnelStage: FunnelStage;
  dailyBudget: string;
}

const guessGoal = (objective?: string): GoalKey => {
  const o = (objective || '').toUpperCase();
  if (o.includes('LEAD')) return 'leads';
  if (o.includes('SALES') || o.includes('CONVERSION') || o.includes('CATALOG')) return 'sales';
  if (o.includes('TRAFFIC') || o.includes('LINK_CLICKS')) return 'traffic';
  if (o.includes('AWARENESS') || o.includes('REACH') || o.includes('VIDEO') || o.includes('ENGAGEMENT'))
    return 'awareness';
  return 'leads';
};

const guessFunnelStage = (objective?: string): FunnelStage => {
  const o = (objective || '').toUpperCase();
  if (o.includes('AWARENESS') || o.includes('REACH') || o.includes('VIDEO')) return 'cold';
  if (o.includes('SALES') || o.includes('CONVERSION')) return 'warm';
  return 'cold';
};

// Meta reports budgets in minor units (cents)
const centsToDollars = (v?: string) => {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n / 100));
};

interface ImportCampaignsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  metaAccountId: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  onImportComplete: () => void;
}

/** Two-step progress chips shown at the top of both import screens. */
function ImportSteps({ current }: { current: 1 | 2 }) {
  const steps: { n: 1 | 2; label: string }[] = [
    { n: 1, label: "Pick campaigns" },
    { n: 2, label: "Set the goal" },
  ];
  return (
    <div className="flex items-center gap-2 pb-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div
            className={
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (current === s.n
                ? "bg-primary/10 text-primary"
                : current > s.n
                  ? "text-foreground"
                  : "text-muted-foreground")
            }
          >
            <span
              className={
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold " +
                (current >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
              }
            >
              {s.n}
            </span>
            {s.label}
          </div>
          {i === 0 && <span className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

export function ImportCampaignsModal({

  open,
  onOpenChange,
  brandId,
  metaAccountId,
  dateRangeStart,
  dateRangeEnd,
  onImportComplete,
}: ImportCampaignsModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Two-step flow: pick campaigns → tell LUMI what "good" looks like
  const [step, setStep] = useState<1 | 2>(1);
  const [answers, setAnswers] = useState<Record<string, GoalAnswers>>({});

  // Post-import state
  const [importedCampaigns, setImportedCampaigns] = useState<ImportedCampaign[]>([]);
  const [showSuccessView, setShowSuccessView] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      fetchCampaigns();
    }
  }, [open, brandId, metaAccountId, dateRangeStart, dateRangeEnd]);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());

    try {
      // Get existing campaign IDs from workspaces
      const { data: existingWorkspaces } = await supabase
        .from('campaign_workspaces')
        .select('meta_campaign_ids')
        .eq('brand_id', brandId);

      const existingCampaignIds = (existingWorkspaces || [])
        .map((w) => (w.meta_campaign_ids as any)?.campaignId)
        .filter(Boolean);

      // Get meta token via SECURITY DEFINER RPC (never read from the table directly)
      const { data: metaToken, error: brandError } = await supabase
        .rpc('get_meta_token', { p_brand_id: brandId });

      if (brandError || !metaToken) {
        throw new Error('Failed to retrieve Meta access token');
      }

      // Fetch campaigns from Meta
      const { data, error: fetchError } = await supabase.functions.invoke('fetch-meta-campaigns', {
        body: {
          metaAccountId,
          metaAccessToken: metaToken,
          dateRangeStart,
          dateRangeEnd,
          existingCampaignIds,
        },
      });

      if (fetchError || !data?.success) {
        throw new Error(data?.error || fetchError?.message || 'Failed to fetch campaigns');
      }

      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (campaignId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const selectableCampaigns = campaigns.filter((c) => !c.alreadyImported);
    setSelectedIds(new Set(selectableCampaigns.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedCampaigns = campaigns.filter((c) => selectedIds.has(c.id));

  // Prefill the questions from what Meta already tells us about the campaign.
  const goToQuestions = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const c of selectedCampaigns) {
        if (next[c.id]) continue;
        const goal = guessGoal(c.objective);
        next[c.id] = {
          goal,
          landingUrl: '',
          threshold: String(GOAL_CONFIG[goal].defaultThreshold),
          funnelStage: guessFunnelStage(c.objective),
          dailyBudget: centsToDollars(c.dailyBudget),
        };
      }
      return next;
    });
    setStep(2);
  };

  const updateAnswer = (id: string, patch: Partial<GoalAnswers>) => {
    setAnswers((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const merged = { ...current, ...patch };
      // Switching the goal resets the target to that goal's sensible default
      if (patch.goal && patch.goal !== current.goal) {
        merged.threshold = String(GOAL_CONFIG[patch.goal].defaultThreshold);
      }
      return { ...prev, [id]: merged };
    });
  };

  // Persist the answers as real campaign goals so the performance engine grades
  // imported campaigns exactly like LUMI-built ones.
  const saveGoals = async (imported: ImportedCampaign[]) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    for (const c of imported) {
      const a = answers[c.id];
      if (!a || !c.workspaceId) continue;
      const cfg = GOAL_CONFIG[a.goal];
      const threshold = Number(a.threshold);

      try {
        await supabase.from('campaign_goals').insert({
          workspace_id: c.workspaceId,
          brand_id: brandId,
          created_by: userId,
          primary_kpi: cfg.kpi,
          primary_kpi_label: cfg.kpiLabel,
          primary_kpi_goal_type: cfg.goalType,
          primary_kpi_threshold: Number.isFinite(threshold) ? threshold : cfg.defaultThreshold,
          auto_suggested: false,
        });

        const patch: Record<string, any> = {
          final_answers: {
            imported_from_meta: true,
            goal: a.goal,
            funnel_stage: a.funnelStage,
            daily_budget: a.dailyBudget ? Number(a.dailyBudget) : null,
            landing_url: a.landingUrl || null,
          },
        };
        if (a.landingUrl) patch.offer_url = a.landingUrl;

        await supabase.from('campaign_workspaces').update(patch).eq('id', c.workspaceId);

        // Pull numbers right away so the card isn't empty on arrival
        supabase.functions
          .invoke('fetch-meta-performance', { body: { workspaceId: c.workspaceId } })
          .catch(() => {});
      } catch (e) {
        console.warn('[ImportCampaignsModal] failed to save goal for', c.workspaceId, e);
      }
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setImporting(true);

    try {
      // Get meta token via SECURITY DEFINER RPC
      const { data: metaToken, error: brandError } = await supabase
        .rpc('get_meta_token', { p_brand_id: brandId });

      if (brandError || !metaToken) {
        throw new Error('Failed to retrieve Meta access token');
      }

      const { data, error: syncError } = await supabase.functions.invoke('sync-meta-campaigns', {
        body: {
          brandId,
          metaAccountId,
          metaAccessToken: metaToken,
          campaignIds: Array.from(selectedIds),
        },
      });

      if (syncError || !data?.success) {
        throw new Error(data?.error || syncError?.message || 'Failed to import campaigns');
      }

      // Store imported campaigns for success view
      const imported: ImportedCampaign[] = (data.campaigns || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        workspaceId: c.workspaceId,
      }));

      await saveGoals(imported);

      setImportedCampaigns(imported);
      setShowSuccessView(true);

      toast.success(`Successfully imported ${data.synced} campaign${data.synced !== 1 ? 's' : ''}`);
    } catch (err: any) {
      console.error('Error importing campaigns:', err);
      toast.error(err.message || 'Failed to import campaigns');
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">Active</Badge>;
      case 'PAUSED':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Paused</Badge>;
      case 'ARCHIVED':
        return <Badge variant="outline" className="text-muted-foreground">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectableCampaigns = campaigns.filter((c) => !c.alreadyImported);
  const allSelected = selectableCampaigns.length > 0 && selectedIds.size === selectableCampaigns.length;

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close
    setTimeout(() => {
      setShowSuccessView(false);
      setImportedCampaigns([]);
      setStep(1);
    }, 300);
    onImportComplete();
  };

  const handleLinkOffers = () => {
    handleClose();
    // Navigate to first imported campaign to link offer
    if (importedCampaigns.length > 0) {
      navigate(`/data?workspace=${importedCampaigns[0].workspaceId}`);
    }
  };

  // Success View - shown after import
  if (showSuccessView) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-y-auto">
          <div className="text-center py-2 space-y-4">
            {/* Success Animation */}
            <div className="relative mx-auto w-14 h-14">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-100 to-green-50 animate-pulse" />
              <div className="absolute inset-1.5 rounded-full bg-white flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-foreground">
                Campaigns Imported! 🎉
              </h2>
              <p className="text-muted-foreground text-sm">
                {importedCampaigns.length} campaign{importedCampaigns.length !== 1 ? 's' : ''} successfully imported — LUMI is pulling their numbers now.
              </p>
            </div>

            {/* Next Step Prompt */}
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
              <div className="flex items-center gap-2 justify-center">
                <Sparkles className="h-5 w-5 text-primary animate-sparkle-pulse" />
                <span className="font-medium text-sm">One more step!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Link an offer to each campaign to unlock creative generation and production workflows.
              </p>
            </div>

            {/* Imported Campaigns List */}
            {importedCampaigns.length > 0 && (
              <div className="space-y-2 text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Imported campaigns
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importedCampaigns.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30">
                      <Package className="h-4 w-4 text-amber-500" />
                      <span className="truncate">{c.name}</span>
                      <Badge variant="outline" className="text-xs ml-auto shrink-0 bg-amber-50 text-amber-700 border-amber-200">
                        Needs Offer
                      </Badge>
                    </div>
                  ))}
                  {importedCampaigns.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{importedCampaigns.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleLinkOffers} className="w-full">
                <Package className="h-4 w-4 mr-2" />
                Link Offers Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="ghost" onClick={handleClose} className="w-full text-muted-foreground">
                I'll do it later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── STEP 2 — what does "good" look like for each campaign ────────────────
  if (step === 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Tell LUMI what "good" looks like
            </DialogTitle>
            <DialogDescription>
              A few quick answers per campaign so LUMI can judge performance instead of just reporting it.
            </DialogDescription>
          </DialogHeader>

          <ImportSteps current={2} />



          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {selectedCampaigns.map((c) => {
                const a = answers[c.id];
                if (!a) return null;
                const cfg = GOAL_CONFIG[a.goal];
                return (
                  <div key={c.id} className="rounded-xl border bg-card/60 p-4 space-y-3">
                    <p className="font-medium text-sm truncate">{c.name}</p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">What is this campaign for?</Label>
                        <Select value={a.goal} onValueChange={(v) => updateAnswer(c.id, { goal: v as GoalKey })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(GOAL_CONFIG) as GoalKey[]).map((k) => (
                              <SelectItem key={k} value={k}>{GOAL_CONFIG[k].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Who is it reaching?</Label>
                        <Select
                          value={a.funnelStage}
                          onValueChange={(v) => updateAnswer(c.id, { funnelStage: v as FunnelStage })}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cold">Cold — brand new people</SelectItem>
                            <SelectItem value="warm">Warm — already engaged</SelectItem>
                            <SelectItem value="retargeting">Retargeting — visited or clicked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">{cfg.targetLabel}</Label>
                      <div className="flex items-center gap-2">
                        {cfg.prefix && <span className="text-sm text-muted-foreground">{cfg.prefix}</span>}
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-9 w-32"
                          value={a.threshold}
                          onChange={(e) => updateAnswer(c.id, { threshold: e.target.value })}
                        />
                        {cfg.suffix && <span className="text-sm text-muted-foreground">{cfg.suffix}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{cfg.targetHint}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Where does it send people?</Label>
                        <Input
                          className="h-9"
                          placeholder="yourbrand.com/offer"
                          value={a.landingUrl}
                          onChange={(e) => updateAnswer(c.id, { landingUrl: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Daily budget</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            className="h-9"
                            placeholder="25"
                            value={a.dailyBudget}
                            onChange={(e) => updateAnswer(c.id, { dailyBudget: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={importing}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${selectedIds.size} campaign${selectedIds.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── STEP 1 — pick campaigns ──────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Import from Ads Manager
          </DialogTitle>
          <DialogDescription>
            {dateRangeStart && dateRangeEnd 
              ? `Showing campaigns with activity from ${dateRangeStart} to ${dateRangeEnd}`
              : 'Select campaigns to import and track'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-10 flex-1 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchCampaigns}>
                Try Again
              </Button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                {dateRangeStart ? 'No campaigns with activity in the selected date range' : 'No campaigns found in your ad account'}
              </p>
            </div>
          ) : (
            <>
              {/* Select All / Deselect All */}
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => (allSelected ? deselectAll() : selectAll())}
                    disabled={selectableCampaigns.length === 0}
                  />
                  <span className="text-sm text-muted-foreground">
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
              </div>

              {/* Campaign List */}
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2 py-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        campaign.alreadyImported
                          ? 'bg-muted/30 opacity-60'
                          : selectedIds.has(campaign.id)
                          ? 'bg-primary/5 border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      {campaign.alreadyImported ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <Checkbox
                          checked={selectedIds.has(campaign.id)}
                          onCheckedChange={() => toggleSelection(campaign.id)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.objective?.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {campaign.alreadyImported ? (
                          <Badge variant="outline" className="text-xs">Imported</Badge>
                        ) : (
                          getStatusBadge(campaign.status)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={goToQuestions} disabled={selectedIds.size === 0}>
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
