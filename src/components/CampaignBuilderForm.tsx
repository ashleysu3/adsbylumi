import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { detectLocationBusiness } from "@/lib/detect-location-business";
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
  ImagePlus,
  MapPin,
  Calendar,
  Plus,
  X,
} from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { ExistingPostPicker, type SelectedPost } from "@/components/ExistingPostPicker";

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

  // Check if template uses location targeting
  const templateStrategy = template?.strategy_template as any;
  const usesLocationTargeting = templateStrategy?.location_type === "radius" || templateStrategy?.location_type === "places";
  const defaultRadius = templateStrategy?.default_radius || 15;

  const [budget, setBudget] = useState(answers.budget || 30);
  const [launchActive, setLaunchActive] = useState(answers.launchActive ?? true);
  const [includeExistingPosts, setIncludeExistingPosts] = useState(
    (answers.additionalPosts?.length || 0) > 0
  );
  const [additionalPosts, setAdditionalPosts] = useState<SelectedPost[]>(
    answers.additionalPosts || []
  );

  // Location targeting state
  const [locationAddresses, setLocationAddresses] = useState<string[]>(
    answers.locationTargeting?.addresses || [""]
  );
  const [locationRadius, setLocationRadius] = useState(
    answers.locationTargeting?.radius || defaultRadius
  );

  // Ad scheduling state
  const [hasEndDate, setHasEndDate] = useState(!!answers.endDate);
  const [endDate, setEndDate] = useState(answers.endDate || "");
  const [startDate, setStartDate] = useState(
    answers.startDate || new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );

  const { activeBrand } = useBrand();
  const hasInstagram = !!activeBrand?.meta_account_id && !!(workspace?.brands?.instagram_account_id);

  // Sync answers on change
  useEffect(() => {
    const newAnswers = {
      ...answers,
      objective: defaultObjective,
      budget,
      creativeType: defaultCreativeType,
      audience: defaultAudience,
      startDate,
      launchActive,
      budgetType: "daily",
      metaAdvantage: true,
      placements: "Advantage+",
      
      ...(isSocialGrowth && { socialGrowth: true, selectedPosts }),
      additionalPosts: includeExistingPosts ? additionalPosts : [],
      // Location targeting
      ...(usesLocationTargeting && {
        locationTargeting: {
          addresses: locationAddresses.filter(a => a.trim()),
          radius: locationRadius,
        },
      }),
      // End date — only include if user explicitly set one
      ...(hasEndDate && endDate ? { endDate } : {}),
    };
    onAnswerUpdate(newAnswers);
  }, [budget, launchActive, additionalPosts, includeExistingPosts, locationAddresses, locationRadius, hasEndDate, endDate, startDate]);

  const objectiveLabel = OBJECTIVE_LABELS[defaultObjective] || defaultObjective;

  const addLocationAddress = () => {
    setLocationAddresses([...locationAddresses, ""]);
  };

  const removeLocationAddress = (index: number) => {
    setLocationAddresses(locationAddresses.filter((_, i) => i !== index));
  };

  const updateLocationAddress = (index: number, value: string) => {
    const updated = [...locationAddresses];
    updated[index] = value;
    setLocationAddresses(updated);
  };

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

          {/* Lumi budget recommendation */}
          {template?.budget_suggestion && (
            <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">Lumi's recommendation: {template.budget_suggestion}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.objective === "OUTCOME_SALES" || template.objective === "sales"
                      ? "Sales campaigns need enough budget for Meta to find buyers. Too low and you'll stay stuck in the learning phase."
                      : template.objective === "OUTCOME_LEADS" || template.objective === "leads"
                      ? "Lead campaigns need enough daily spend to exit Meta's learning phase — usually 1–2x your target cost per lead."
                      : template.objective === "OUTCOME_TRAFFIC" || template.objective === "traffic"
                      ? "Traffic campaigns are cost-efficient, but still need enough budget for Meta to optimize delivery."
                      : "This budget range gives Meta enough data to optimize your results without overspending while you learn what works."}
                  </p>
                </div>
              </div>
            </div>
          )}

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

      {/* Location Targeting — only for templates that need it */}
      {usesLocationTargeting && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Location Targeting</p>
                <p className="text-xs text-muted-foreground">
                  {templateStrategy?.location_type === "places"
                    ? "Target specific locations like events, venues, or high-traffic areas"
                    : "Target customers near your business location"}
                </p>
              </div>
            </div>

            {/* Address inputs */}
            <div className="space-y-2">
              {locationAddresses.map((address, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={
                      templateStrategy?.location_type === "places"
                        ? "e.g., Convention Center, 123 Main St, City, State"
                        : "Enter your business address"
                    }
                    value={address}
                    onChange={(e) => updateLocationAddress(index, e.target.value)}
                    className="flex-1"
                  />
                  {locationAddresses.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLocationAddress(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addLocationAddress}
                className="w-full gap-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add another location
              </Button>
            </div>

            {/* Radius slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Targeting radius</span>
                <span className="text-sm font-bold text-primary">{locationRadius} miles</span>
              </div>
              <Slider
                value={[locationRadius]}
                onValueChange={([v]) => setLocationRadius(v)}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 mi</span>
                <span>50 mi</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ad Schedule */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {hasEndDate ? "Scheduled Campaign" : "Run Continuously"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasEndDate
                    ? "Campaign will stop on the selected end date"
                    : "Recommended — runs until you decide to stop it"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="end-date-toggle" className="text-xs text-muted-foreground">
                Set end date
              </Label>
              <Switch
                id="end-date-toggle"
                checked={hasEndDate}
                onCheckedChange={(checked) => {
                  setHasEndDate(checked);
                  if (!checked) setEndDate("");
                }}
              />
            </div>
          </div>

          {hasEndDate && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Include Existing Posts — only if Instagram connected and NOT a social growth campaign */}
      {hasInstagram && !isSocialGrowth && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-500/10">
                  <ImagePlus className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <Label htmlFor="existing-posts-toggle" className="font-semibold text-sm cursor-pointer">
                    Include existing posts?
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add Instagram posts as additional ads
                  </p>
                </div>
              </div>
              <Switch
                id="existing-posts-toggle"
                checked={includeExistingPosts}
                onCheckedChange={(checked) => {
                  setIncludeExistingPosts(checked);
                  if (!checked) setAdditionalPosts([]);
                }}
              />
            </div>
            {includeExistingPosts && workspace?.brands?.instagram_account_id && (
              <ExistingPostPicker
                brandId={workspace.brands.id || workspace.brand_id}
                instagramAccountId={workspace.brands.instagram_account_id}
                selectedPosts={additionalPosts}
                onSelectionChange={setAdditionalPosts}
              />
            )}
          </CardContent>
        </Card>
      )}

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
          {!launchActive && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                Advanced users only
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                You'll need to manually turn on your ads inside Meta Ads Manager. Most users should launch active and let Lumi handle it.
              </p>
            </div>
          )}
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
              {usesLocationTargeting ? "Radius-based location targeting" : "Broad audience targeting"}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Advantage+ creative optimization
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Advantage+ placements
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Personalized destinations disabled
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {hasEndDate ? "Scheduled with end date" : "Ongoing campaign (no end date)"}
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
                value={
                  usesLocationTargeting
                    ? `Location-based (${locationRadius} mi radius)`
                    : defaultAudience === "broad"
                    ? "Broad (recommended)"
                    : defaultAudience
                }
              />
              <LumiSettingRow
                icon={<Layers className="h-4 w-4" />}
                label="Placements"
                value="Advantage+ (all placements)"
              />
              <LumiSettingRow
                icon={<Calendar className="h-4 w-4" />}
                label="Schedule"
                value={hasEndDate && endDate ? `${startDate} → ${endDate}` : "Ongoing (no end date)"}
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
