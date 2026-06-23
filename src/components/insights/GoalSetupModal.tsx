import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Sparkles, ChevronRight, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";
import { KPI_OPTIONS, suggestGoals } from "@/lib/goal-suggestions";

interface CampaignForGoals {
  id: string;
  name: string;
  brandId?: string;
  offerPrice?: string | null;
  templateSlug?: string | null;
  // Brand's business-model archetype — when present, drives KPI pre-fill
  // ahead of the generic price/template-based rules.
  archetypeSlug?: string | null;
}

interface GoalSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: CampaignForGoals[];
  onGoalsSaved: () => void;
}

interface KpiRow {
  kpi: string;
  threshold: string;
}

interface CampaignForm {
  primary: KpiRow;
  secondary?: KpiRow;
  tertiary?: KpiRow;
}

function prefix(kpi: string) {
  if (!kpi) return "";
  if (["roas", "ctr", "purchases"].includes(kpi)) return "";
  return "$";
}
function suffix(kpi: string) {
  if (kpi === "roas") return "x";
  if (kpi === "ctr") return "%";
  return "";
}

export function GoalSetupModal({ open, onOpenChange, campaigns, onGoalsSaved }: GoalSetupModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [forms, setForms] = useState<Record<string, CampaignForm>>({});

  const currentCampaign = campaigns[currentIndex];
  const suggestion = currentCampaign
    ? suggestGoals(
        currentCampaign.offerPrice || null,
        currentCampaign.templateSlug || null,
        currentCampaign.archetypeSlug || null,
      )
    : null;

  useEffect(() => {
    if (!currentCampaign || forms[currentCampaign.id]) return;
    if (suggestion) {
      setForms(prev => ({
        ...prev,
        [currentCampaign.id]: {
          primary: { kpi: suggestion.primary.kpi, threshold: String(suggestion.primary.threshold) },
          secondary: suggestion.secondary
            ? { kpi: suggestion.secondary.kpi, threshold: String(suggestion.secondary.threshold) }
            : undefined,
        },
      }));
    }
  }, [currentIndex, currentCampaign?.id]);

  const currentForm = currentCampaign ? forms[currentCampaign.id] : null;

  const updateRow = (slot: "primary" | "secondary" | "tertiary", patch: Partial<KpiRow>) => {
    if (!currentCampaign) return;
    setForms(prev => {
      const existing = prev[currentCampaign.id] || { primary: { kpi: "", threshold: "" } };
      const merged = { ...(existing[slot] || { kpi: "", threshold: "" }), ...patch };
      return { ...prev, [currentCampaign.id]: { ...existing, [slot]: merged } };
    });
  };
  const removeRow = (slot: "secondary" | "tertiary") => {
    if (!currentCampaign) return;
    setForms(prev => {
      const existing = prev[currentCampaign.id];
      if (!existing) return prev;
      const next = { ...existing };
      delete next[slot];
      return { ...prev, [currentCampaign.id]: next };
    });
  };
  const addRow = (slot: "secondary" | "tertiary") => updateRow(slot, { kpi: "", threshold: "" });

  const handleSaveGoal = async () => {
    if (!currentCampaign || !currentForm?.primary?.kpi || !currentForm?.primary?.threshold) {
      toast.error("Please set your primary KPI and target value");
      return;
    }
    // Validate optional rows: if added, must be filled.
    for (const slot of ["secondary", "tertiary"] as const) {
      const r = currentForm[slot];
      if (r && (!r.kpi || !r.threshold)) {
        toast.error(`Finish your ${slot} KPI or remove it`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const buildSlot = (r: KpiRow | undefined) => {
        if (!r?.kpi || !r?.threshold) return { kpi: null, label: null, goalType: null, threshold: null };
        const opt = KPI_OPTIONS.find(o => o.value === r.kpi);
        return {
          kpi: r.kpi,
          label: opt?.label || r.kpi,
          goalType: opt?.goalType || "less_than",
          threshold: parseFloat(r.threshold),
        };
      };

      const p = buildSlot(currentForm.primary);
      const s = buildSlot(currentForm.secondary);
      const t = buildSlot(currentForm.tertiary);

      const goalData: any = {
        workspace_id: currentCampaign.id,
        brand_id: currentCampaign.brandId,
        created_by: user.id,
        primary_kpi: p.kpi,
        primary_kpi_label: p.label,
        primary_kpi_goal_type: p.goalType,
        primary_kpi_threshold: p.threshold,
        secondary_kpi: s.kpi,
        secondary_kpi_label: s.label,
        secondary_kpi_goal_type: s.goalType,
        secondary_kpi_threshold: s.threshold,
        tertiary_kpi: t.kpi,
        tertiary_kpi_label: t.label,
        tertiary_kpi_goal_type: t.goalType,
        tertiary_kpi_threshold: t.threshold,
        check_frequency_at: "campaign",
        frequency_threshold: 4,
        auto_suggested: false,
      };

      const { error } = await supabase
        .from("campaign_goals")
        .upsert(goalData, { onConflict: "workspace_id" });
      if (error) throw error;

      setCompletedIds(prev => new Set([...prev, currentCampaign.id]));

      if (currentIndex < campaigns.length - 1) {
        setCurrentIndex(prev => prev + 1);
        toast.success(`Goals set for "${currentCampaign.name}"!`);
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
    setForms(prev => ({
      ...prev,
      [currentCampaign.id]: {
        primary: { kpi: suggestion.primary.kpi, threshold: String(suggestion.primary.threshold) },
        secondary: suggestion.secondary
          ? { kpi: suggestion.secondary.kpi, threshold: String(suggestion.secondary.threshold) }
          : undefined,
      },
    }));
  };

  if (!currentCampaign) return null;

  const renderRow = (slot: "primary" | "secondary" | "tertiary", row: KpiRow | undefined, requiredLabel: string) => {
    const isOptional = slot !== "primary";
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-foreground">{requiredLabel}</Label>
          {isOptional && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => removeRow(slot as "secondary" | "tertiary")}
            >
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-3">
            <Select
              value={row?.kpi || ""}
              onValueChange={val => updateRow(slot, { kpi: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a KPI..." />
              </SelectTrigger>
              <SelectContent>
                {KPI_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 relative">
            {row?.kpi && prefix(row.kpi) && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix(row.kpi)}</span>
            )}
            <Input
              type="number"
              step="any"
              className={row?.kpi && prefix(row.kpi) ? "pl-7" : ""}
              value={row?.threshold || ""}
              onChange={e => updateRow(slot, { threshold: e.target.value })}
              placeholder="Target"
            />
            {row?.kpi && suffix(row.kpi) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix(row.kpi)}</span>
            )}
          </div>
        </div>
        {row?.kpi && (
          <p className="text-[11px] text-muted-foreground">
            Goal: {KPI_OPTIONS.find(o => o.value === row.kpi)?.goalType === "greater_than" ? "greater than" : "less than"} target.
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <img src={lumiLogo} className="h-5 w-5" alt="" />
            <DialogTitle className="text-lg font-display">Set Your Campaign Goals</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Pick a primary KPI (required) and up to two more to keep an eye on.
          </DialogDescription>
        </DialogHeader>

        {campaigns.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            {campaigns.map((c, i) => (
              <div
                key={c.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  completedIds.has(c.id) ? "bg-green-500" : i === currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {currentIndex + 1} of {campaigns.length}
            </span>
          </div>
        )}

        <div className="pt-1">
          <p className="text-sm font-medium text-foreground truncate">{currentCampaign.name}</p>
        </div>

        {suggestion && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">LUMI's Suggestion</span>
              </div>
              <p className="text-xs text-muted-foreground">{suggestion.note}</p>
              <Button variant="outline" size="sm" className="text-xs rounded-xl gap-1" onClick={handleApplySuggestion}>
                <Check className="h-3 w-3" /> Use This
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {renderRow("primary", currentForm?.primary, "Primary KPI (required)")}
          {currentForm?.secondary !== undefined
            ? renderRow("secondary", currentForm.secondary, "Secondary KPI")
            : (
              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => addRow("secondary")}>
                <Plus className="h-3.5 w-3.5" /> Add a secondary KPI
              </Button>
            )}
          {currentForm?.secondary !== undefined && (
            currentForm?.tertiary !== undefined
              ? renderRow("tertiary", currentForm.tertiary, "Tertiary KPI")
              : (
                <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => addRow("tertiary")}>
                  <Plus className="h-3.5 w-3.5" /> Add a third KPI
                </Button>
              )
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          {campaigns.length > 1 && currentIndex > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setCurrentIndex(prev => prev - 1)}>
              Back
            </Button>
          ) : <div />}

          <Button
            onClick={handleSaveGoal}
            disabled={saving || !currentForm?.primary?.kpi || !currentForm?.primary?.threshold}
            className="gap-1.5 rounded-xl"
          >
            <Target className="h-4 w-4" />
            {saving ? "Saving..." :
              currentIndex < campaigns.length - 1 ? "Save & Next" : "Save & View Results"}
            {currentIndex < campaigns.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
