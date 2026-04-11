import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Sparkles, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";

const KPI_OPTIONS = [
  { value: 'cplpv', label: 'Cost per Landing Page View (CPLPV)', goalType: 'less_than' },
  { value: 'cpc', label: 'Cost per Click (CPC)', goalType: 'less_than' },
  { value: 'cpl', label: 'Cost per Lead (CPL)', goalType: 'less_than' },
  { value: 'cppv', label: 'Cost per Profile Visit (CPPV)', goalType: 'less_than' },
  { value: 'cp2sc', label: 'Cost per 2-Sec View (CP2SC)', goalType: 'less_than' },
  { value: 'roas', label: 'Return on Ad Spend (ROAS)', goalType: 'greater_than' },
  { value: 'ctr', label: 'Click-Through Rate (CTR)', goalType: 'greater_than' },
  { value: 'cpm', label: 'Cost per 1,000 Impressions (CPM)', goalType: 'less_than' },
  { value: 'purchases', label: 'Purchases (weekly count)', goalType: 'greater_than' },
];

function suggestGoals(offerPrice: string | null, templateSlug: string | null) {
  const price = parseFloat((offerPrice || '0').replace(/[^0-9.]/g, ''));
  const slug = templateSlug || '';

  if (slug.includes('video-views')) return {
    primary: { kpi: 'cp2sc', threshold: 0.01, label: 'Cost per 2-Sec View', goalType: 'less_than' },
    secondary: null,
    note: 'Video view campaigns are about reach and warm-up. Keep cost per view low.'
  };
  if (slug.includes('webinar') || slug.includes('challenge')) return {
    primary: { kpi: 'cpl', threshold: 18, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Multi-day challenges and webinars have a higher ask — CPL naturally runs higher.'
  };
  if (slug.includes('discovery') || slug.includes('booking')) return {
    primary: { kpi: 'cpl', threshold: 50, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Discovery call campaigns vary. Set CPL at roughly 10–20% of your offer value.'
  };
  if (slug.includes('lead') && price === 0) return {
    primary: { kpi: 'cpl', threshold: 5, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Free lead magnets typically convert well. If CPL climbs above $8, investigate your creative.'
  };
  if (price > 0 && price <= 50) return {
    primary: { kpi: 'cpl', threshold: Math.round(price * 0.3), label: 'Cost per Lead', goalType: 'less_than' },
    secondary: { kpi: 'roas', threshold: 1.5, label: 'ROAS', goalType: 'greater_than' },
    note: `For a $${price} offer, aim for CPL under $${Math.round(price * 0.3)} and ROAS above 1.5x.`
  };
  if (price > 50 && price <= 500) return {
    primary: { kpi: 'cpl', threshold: Math.round(price * 0.15), label: 'Cost per Lead', goalType: 'less_than' },
    secondary: { kpi: 'roas', threshold: 2, label: 'ROAS', goalType: 'greater_than' },
    note: `For a $${price} offer, CPL under $${Math.round(price * 0.15)} keeps acquisition cost healthy.`
  };
  if (price > 500) return {
    primary: { kpi: 'cpl', threshold: Math.round(price * 0.10), label: 'Cost per Lead', goalType: 'less_than' },
    secondary: { kpi: 'roas', threshold: 2, label: 'ROAS', goalType: 'greater_than' },
    note: `High-ticket offers can sustain higher CPL. Up to $${Math.round(price * 0.10)} per lead can still be profitable.`
  };
  return {
    primary: { kpi: 'cpl', threshold: 20, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Starting point suggestion — adjust based on your actual margins and conversion rates.'
  };
}

interface CampaignForGoals {
  id: string;
  name: string;
  brandId?: string;
  offerPrice?: string | null;
  templateSlug?: string | null;
}

interface GoalSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: CampaignForGoals[];
  onGoalsSaved: () => void;
}

export function GoalSetupModal({ open, onOpenChange, campaigns, onGoalsSaved }: GoalSetupModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [goalForms, setGoalForms] = useState<Record<string, { kpi: string; threshold: string }>>({});

  const currentCampaign = campaigns[currentIndex];
  const suggestion = currentCampaign ? suggestGoals(currentCampaign.offerPrice || null, currentCampaign.templateSlug || null) : null;

  // Initialize form with suggestion when campaign changes
  useEffect(() => {
    if (!currentCampaign || goalForms[currentCampaign.id]) return;
    if (suggestion) {
      setGoalForms(prev => ({
        ...prev,
        [currentCampaign.id]: {
          kpi: suggestion.primary.kpi,
          threshold: String(suggestion.primary.threshold),
        }
      }));
    }
  }, [currentIndex, currentCampaign?.id]);

  const currentForm = currentCampaign ? goalForms[currentCampaign.id] : null;

  const handleSaveGoal = async () => {
    if (!currentCampaign || !currentForm?.kpi || !currentForm?.threshold) {
      toast.error("Please set a KPI and target value");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const kpiOption = KPI_OPTIONS.find(o => o.value === currentForm.kpi);

      const goalData = {
        workspace_id: currentCampaign.id,
        brand_id: currentCampaign.brandId,
        created_by: user.id,
        primary_kpi: currentForm.kpi,
        primary_kpi_label: kpiOption?.label || currentForm.kpi,
        primary_kpi_goal_type: kpiOption?.goalType || 'less_than',
        primary_kpi_threshold: parseFloat(currentForm.threshold),
        check_frequency_at: 'campaign',
        frequency_threshold: 4,
      };

      // Use upsert to handle cases where a goal already exists for this workspace
      const { error } = await supabase
        .from('campaign_goals')
        .upsert(goalData, { onConflict: 'workspace_id' });
      if (error) {
        console.error('Goal save error details:', JSON.stringify(error));
        throw error;
      }

      setCompletedIds(prev => new Set([...prev, currentCampaign.id]));

      if (currentIndex < campaigns.length - 1) {
        setCurrentIndex(prev => prev + 1);
        toast.success(`Goal set for "${currentCampaign.name}"!`);
      } else {
        toast.success("All campaign goals are set! 🎉");
        onGoalsSaved();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving goal:", error);
      toast.error(error.message || "Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  const handleApplySuggestion = () => {
    if (!currentCampaign || !suggestion) return;
    setGoalForms(prev => ({
      ...prev,
      [currentCampaign.id]: {
        kpi: suggestion.primary.kpi,
        threshold: String(suggestion.primary.threshold),
      }
    }));
  };

  const getThresholdPrefix = (kpi: string) => {
    if (kpi === 'roas') return '';
    if (kpi === 'ctr') return '';
    return '$';
  };

  const getThresholdSuffix = (kpi: string) => {
    if (kpi === 'roas') return 'x';
    if (kpi === 'ctr') return '%';
    return '';
  };

  if (!currentCampaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <img src={lumiLogo} className="h-5 w-5" alt="" />
            <DialogTitle className="text-lg font-display">Set Your Campaign Goals</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            LUMI needs performance targets to track your results. Set a goal for each live campaign.
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {campaigns.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            {campaigns.map((c, i) => (
              <div
                key={c.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  completedIds.has(c.id) ? 'bg-green-500' :
                  i === currentIndex ? 'bg-primary' :
                  'bg-muted'
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {currentIndex + 1} of {campaigns.length}
            </span>
          </div>
        )}

        {/* Campaign name */}
        <div className="pt-2">
          <p className="text-sm font-medium text-foreground truncate">{currentCampaign.name}</p>
        </div>

        {/* LUMI suggestion card */}
        {suggestion && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">LUMI's Suggestion</span>
              </div>
              <p className="text-xs text-muted-foreground">{suggestion.note}</p>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{suggestion.primary.label}</span>
                  <span className="text-muted-foreground"> — {suggestion.primary.goalType === 'less_than' ? 'under' : 'over'} </span>
                  <span className="font-semibold">
                    {getThresholdPrefix(suggestion.primary.kpi)}{suggestion.primary.threshold}{getThresholdSuffix(suggestion.primary.kpi)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl gap-1"
                  onClick={handleApplySuggestion}
                >
                  <Check className="h-3 w-3" />
                  Use This
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goal form */}
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs text-muted-foreground">Primary KPI</Label>
            <Select
              value={currentForm?.kpi || ''}
              onValueChange={(val) => setGoalForms(prev => ({
                ...prev,
                [currentCampaign.id]: { ...prev[currentCampaign.id], kpi: val }
              }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a KPI..." />
              </SelectTrigger>
              <SelectContent>
                {KPI_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">
              Target ({KPI_OPTIONS.find(o => o.value === currentForm?.kpi)?.goalType === 'greater_than' ? 'greater than' : 'less than'})
            </Label>
            <div className="relative mt-1">
              {currentForm?.kpi && !['roas', 'ctr', 'purchases'].includes(currentForm.kpi) && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              )}
              <Input
                type="number"
                step="any"
                className={currentForm?.kpi && !['roas', 'ctr', 'purchases'].includes(currentForm.kpi) ? 'pl-7' : ''}
                value={currentForm?.threshold || ''}
                onChange={(e) => setGoalForms(prev => ({
                  ...prev,
                  [currentCampaign.id]: { ...prev[currentCampaign.id], threshold: e.target.value }
                }))}
                placeholder="Enter target value"
              />
              {currentForm?.kpi === 'roas' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">x</span>
              )}
              {currentForm?.kpi === 'ctr' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {campaigns.length > 1 && currentIndex > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setCurrentIndex(prev => prev - 1)}>
              Back
            </Button>
          ) : <div />}

          <Button
            onClick={handleSaveGoal}
            disabled={saving || !currentForm?.kpi || !currentForm?.threshold}
            className="gap-1.5 rounded-xl"
          >
            <Target className="h-4 w-4" />
            {saving ? 'Saving...' :
              currentIndex < campaigns.length - 1 ? 'Save & Next' : 'Save & View Results'}
            {currentIndex < campaigns.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
