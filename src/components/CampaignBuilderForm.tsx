import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DollarSign,
  ChevronDown,
  Sparkles,
  Target,
  Users,
  Layers,
  Play,
  Pause,
  ShieldCheck,
  Instagram,
} from "lucide-react";

interface CampaignBuilderFormProps {
  workspace: any;
  answers: any;
  onAnswerUpdate: (answers: any) => void;
  onComplete: () => void;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: "Sales",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_AWARENESS: "Awareness",
  sales: "Sales",
  leads: "Leads",
  traffic: "Traffic",
  awareness: "Awareness",
};

const BUDGET_PRESETS = [
  { value: 20, label: "$20" },
  { value: 50, label: "$50" },
  { value: 100, label: "$100" },
];

export function CampaignBuilderForm({
  workspace,
  answers,
  onAnswerUpdate,
  onComplete,
}: CampaignBuilderFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Derive defaults from strategy template & workspace
  const template = workspace.campaign_templates;
  const strategyJson = workspace.strategy_json as any;
  const isSocialGrowth = !!(workspace?.creative_json as any)?.socialGrowth;
  const selectedPosts = isSocialGrowth ? ((workspace?.creative_json as any)?.selectedPosts || []) : [];

  const defaultObjective = template?.objective || strategyJson?.objective || "leads";
  const defaultAudience = template?.audience_type || "broad";
  const defaultCreativeType = isSocialGrowth ? "existing_posts" : (strategyJson?.creativeType || "video");

  const [budget, setBudget] = useState(answers.budget || 30);
  const [launchActive, setLaunchActive] = useState(answers.launchActive ?? false);

  // Sync answers on change
  useEffect(() => {
    const newAnswers = {
      ...answers,
      objective: defaultObjective,
      budget,
      creativeType: defaultCreativeType,
      audience: defaultAudience,
      startDate: answers.startDate || new Date(Date.now() + 86400000).toISOString().split("T")[0],
      launchActive,
      budgetType: "daily",
      metaAdvantage: true,
      placements: "Advantage+",
      warmRetargeting: false,
      ...(isSocialGrowth && { socialGrowth: true, selectedPosts }),
    };
    onAnswerUpdate(newAnswers);
  }, [budget, launchActive]);

  const objectiveLabel = OBJECTIVE_LABELS[defaultObjective] || defaultObjective;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Budget — the main input */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold">Set your daily budget</h2>
            <p className="text-sm text-muted-foreground">
              Lumi has configured everything else based on your strategy
            </p>
          </div>

          {/* Budget Display */}
          <div className="text-center">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-4xl font-bold">${budget}</span>
              <span className="text-muted-foreground text-sm">/day</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ~${(budget * 30).toLocaleString()}/month
            </p>
          </div>

          {/* Budget Slider */}
          <div className="px-2">
            <Slider
              value={[budget]}
              onValueChange={([v]) => setBudget(v)}
              min={5}
              max={500}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>$5</span>
              <span>$500</span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex justify-center gap-2">
            {BUDGET_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={budget === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => setBudget(preset.value)}
                className="text-xs"
              >
                {preset.label}/day
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Launch Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {launchActive ? (
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Play className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Pause className="h-5 w-5 text-amber-500" />
                </div>
              )}
              <div>
                <Label htmlFor="launch-toggle" className="font-semibold text-sm cursor-pointer">
                  {launchActive ? "Launch Active" : "Launch Paused"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {launchActive
                    ? "Ads go live after Meta approval (~15 min)"
                    : "Create campaign paused — activate later"}
                </p>
              </div>
            </div>
            <Switch
              id="launch-toggle"
              checked={launchActive}
              onCheckedChange={setLaunchActive}
            />
          </div>
        </CardContent>
      </Card>

      {/* Best Practices Applied */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-green-800 dark:text-green-300">
                Best practices applied
              </p>
              <p className="text-xs text-green-700 dark:text-green-400/80">
                Meta's recommended settings for best results
              </p>
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-green-700 dark:text-green-400/80">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Broad audience targeting
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Advantage+ creative optimization
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Advantage+ placements
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expandable: See what Lumi chose */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full p-3 rounded-xl border bg-card text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>See what Lumi chose</span>
            <ChevronDown
              className={`h-4 w-4 ml-auto transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <LumiSettingRow
                icon={<Target className="h-4 w-4" />}
                label="Objective"
                value={objectiveLabel}
              />
              <LumiSettingRow
                icon={<Users className="h-4 w-4" />}
                label="Audience"
                value={defaultAudience === "broad" ? "Broad (recommended)" : defaultAudience}
              />
              <LumiSettingRow
                icon={<Layers className="h-4 w-4" />}
                label="Placements"
                value="Advantage+ (all placements)"
              />
              {isSocialGrowth ? (
                <LumiSettingRow
                  icon={<Instagram className="h-4 w-4" />}
                  label="Creative"
                  value={`${selectedPosts.length} Instagram post${selectedPosts.length !== 1 ? "s" : ""}`}
                />
              ) : (
                <LumiSettingRow
                  icon={<Layers className="h-4 w-4" />}
                  label="Creative Type"
                  value={defaultCreativeType === "video" ? "Video (recommended)" : defaultCreativeType}
                />
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Continue Button */}
      <Button onClick={onComplete} className="w-full gap-2" size="lg">
        <Sparkles className="h-4 w-4" />
        Review Campaign
      </Button>
    </div>
  );
}

function LumiSettingRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-primary/30 text-primary">
          <Sparkles className="h-2.5 w-2.5" />
          Lumi
        </Badge>
      </div>
    </div>
  );
}
