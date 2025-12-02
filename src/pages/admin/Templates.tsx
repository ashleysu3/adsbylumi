import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LayoutTemplate, Plus, Edit, Trash2, Save, X, Zap, Target, DollarSign, Calendar, Link2, Layout, Users } from "lucide-react";
import { toast } from "sonner";

interface CampaignTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  long_description: string;
  icon: string;
  objective: string;
  optimization_event: string | null;
  audience_type: string;
  campaign_structure: string;
  budget_suggestion: string | null;
  use_case: string;
  strategy_template: any;
  prepopulated_fields: PrepopulatedFields;
  active: boolean;
  created_at: string;
}

interface PrepopulatedFields {
  budget?: { value?: number; skip?: boolean };
  startDate?: { value?: string; skip?: boolean };
  endDate?: { value?: string | null; skip?: boolean };
  metaAdvantage?: { value?: boolean; skip?: boolean };
  placements?: { value?: string; skip?: boolean };
  optimizationEvent?: { value?: string; skip?: boolean };
  warmRetargeting?: { value?: boolean; skip?: boolean };
  campaignName?: { value?: string; skip?: boolean };
  finalUrl?: { value?: string; skip?: boolean };
}

const iconOptions = [
  { value: "DollarSign", label: "Dollar Sign" },
  { value: "Zap", label: "Zap/Lightning" },
  { value: "Target", label: "Target" },
  { value: "Users", label: "Users" },
  { value: "TrendingUp", label: "Trending Up" },
  { value: "Megaphone", label: "Megaphone" },
  { value: "Gift", label: "Gift" },
  { value: "Star", label: "Star" },
];

const objectiveOptions = [
  { value: "Sales", label: "Sales" },
  { value: "Leads", label: "Leads" },
  { value: "Traffic", label: "Traffic" },
  { value: "Awareness", label: "Awareness" },
  { value: "Engagement", label: "Engagement" },
];

const optimizationEventOptions = [
  { value: "Purchase", label: "Purchase" },
  { value: "Lead", label: "Lead" },
  { value: "AddToCart", label: "Add to Cart" },
  { value: "InitiateCheckout", label: "Initiate Checkout" },
  { value: "ViewContent", label: "View Content" },
  { value: "LinkClick", label: "Link Click" },
];

const audienceTypeOptions = [
  { value: "Cold/Broad", label: "Cold/Broad" },
  { value: "Cold/Interest", label: "Cold/Interest" },
  { value: "Warm/Engaged", label: "Warm/Engaged" },
  { value: "Hot/Retargeting", label: "Hot/Retargeting" },
];

const placementOptions = [
  { value: "Advantage+", label: "Advantage+ (Recommended)" },
  { value: "Manual", label: "Manual" },
  { value: "Feeds Only", label: "Feeds Only" },
  { value: "Stories & Reels", label: "Stories & Reels" },
];

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLongDescription, setFormLongDescription] = useState("");
  const [formIcon, setFormIcon] = useState("DollarSign");
  const [formObjective, setFormObjective] = useState("Sales");
  const [formOptimizationEvent, setFormOptimizationEvent] = useState<string>("");
  const [formAudienceType, setFormAudienceType] = useState("Cold/Broad");
  const [formCampaignStructure, setFormCampaignStructure] = useState("");
  const [formBudgetSuggestion, setFormBudgetSuggestion] = useState("");
  const [formUseCase, setFormUseCase] = useState("");
  const [formStrategyTemplate, setFormStrategyTemplate] = useState("{}");
  const [formPrepopulated, setFormPrepopulated] = useState<PrepopulatedFields>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      // Cast data to our interface since prepopulated_fields is typed as Json in Supabase
      setTemplates((data || []).map(t => ({
        ...t,
        prepopulated_fields: (t.prepopulated_fields || {}) as PrepopulatedFields
      })) as CampaignTemplate[]);
    } catch (error: any) {
      toast.error("Failed to load templates");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingTemplate) {
      setFormSlug(generateSlug(name));
    }
  };

  const handleSave = async () => {
    if (!formName || !formSlug || !formDescription || !formObjective) {
      toast.error("Please fill in all required fields");
      return;
    }

    let strategyTemplate = {};
    try {
      strategyTemplate = JSON.parse(formStrategyTemplate);
    } catch (e) {
      toast.error("Invalid JSON in strategy template");
      return;
    }

    try {
      const templateData = {
        name: formName,
        slug: formSlug,
        description: formDescription,
        long_description: formLongDescription || formDescription,
        icon: formIcon,
        objective: formObjective,
        optimization_event: formOptimizationEvent || null,
        audience_type: formAudienceType,
        campaign_structure: formCampaignStructure || "ABO",
        budget_suggestion: formBudgetSuggestion || null,
        use_case: formUseCase,
        strategy_template: strategyTemplate as Json,
        prepopulated_fields: formPrepopulated as Json,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("campaign_templates")
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template updated!");
      } else {
        const { error } = await supabase
          .from("campaign_templates")
          .insert([templateData]);

        if (error) throw error;
        toast.success("Template created!");
      }

      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
      console.error(error);
    }
  };

  const handleEdit = (template: CampaignTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormSlug(template.slug);
    setFormDescription(template.description);
    setFormLongDescription(template.long_description);
    setFormIcon(template.icon);
    setFormObjective(template.objective);
    setFormOptimizationEvent(template.optimization_event || "");
    setFormAudienceType(template.audience_type);
    setFormCampaignStructure(template.campaign_structure);
    setFormBudgetSuggestion(template.budget_suggestion || "");
    setFormUseCase(template.use_case);
    setFormStrategyTemplate(JSON.stringify(template.strategy_template, null, 2));
    setFormPrepopulated(template.prepopulated_fields || {});
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const { error } = await supabase
        .from("campaign_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template deleted");
      fetchTemplates();
    } catch (error: any) {
      toast.error("Failed to delete template");
      console.error(error);
    }
  };

  const toggleActive = async (template: CampaignTemplate) => {
    try {
      const { error } = await supabase
        .from("campaign_templates")
        .update({ active: !template.active })
        .eq("id", template.id);

      if (error) throw error;
      toast.success(template.active ? "Template deactivated" : "Template activated");
      fetchTemplates();
    } catch (error: any) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormLongDescription("");
    setFormIcon("DollarSign");
    setFormObjective("Sales");
    setFormOptimizationEvent("");
    setFormAudienceType("Cold/Broad");
    setFormCampaignStructure("");
    setFormBudgetSuggestion("");
    setFormUseCase("");
    setFormStrategyTemplate("{}");
    setFormPrepopulated({});
  };

  const updatePrepopField = (field: keyof PrepopulatedFields, key: "value" | "skip", val: any) => {
    setFormPrepopulated((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [key]: val,
      },
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Campaign Templates</h1>
            <p className="text-muted-foreground mt-2">
              Configure campaign types and pre-populated settings
            </p>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit" : "Create"} Campaign Template</DialogTitle>
                <DialogDescription>
                  Define campaign settings and which questions to skip or pre-fill
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6">
                  {/* Section A: Identity */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4" />
                      Template Identity
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          value={formName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="e.g., Low Ticket Product Sales"
                        />
                      </div>
                      <div>
                        <Label>Slug *</Label>
                        <Input
                          value={formSlug}
                          onChange={(e) => setFormSlug(e.target.value)}
                          placeholder="low-ticket-sales"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Icon</Label>
                        <Select value={formIcon} onValueChange={setFormIcon}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {iconOptions.map((icon) => (
                              <SelectItem key={icon.value} value={icon.value}>
                                {icon.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Budget Suggestion</Label>
                        <Input
                          value={formBudgetSuggestion}
                          onChange={(e) => setFormBudgetSuggestion(e.target.value)}
                          placeholder="e.g., $20-50/day"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Short Description *</Label>
                      <Input
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Brief description shown in template selection"
                      />
                    </div>
                    <div>
                      <Label>Long Description</Label>
                      <Textarea
                        value={formLongDescription}
                        onChange={(e) => setFormLongDescription(e.target.value)}
                        placeholder="Detailed explanation of when to use this template"
                        rows={3}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Section B: AI Context */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      AI Recommendation Context
                    </h3>
                    <div>
                      <Label>Use Case *</Label>
                      <Textarea
                        value={formUseCase}
                        onChange={(e) => setFormUseCase(e.target.value)}
                        placeholder="Describe when AI should recommend this template (e.g., '$7–$47 offers, digital products under $50, testing sales angles')"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This helps AI know when to recommend this campaign type
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Section C: Campaign Configuration */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Campaign Configuration
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Objective *</Label>
                        <Select value={formObjective} onValueChange={setFormObjective}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {objectiveOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Optimization Event</Label>
                        <Select value={formOptimizationEvent} onValueChange={setFormOptimizationEvent}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event" />
                          </SelectTrigger>
                          <SelectContent>
                            {optimizationEventOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Audience Type *</Label>
                        <Select value={formAudienceType} onValueChange={setFormAudienceType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {audienceTypeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Campaign Structure</Label>
                        <Input
                          value={formCampaignStructure}
                          onChange={(e) => setFormCampaignStructure(e.target.value)}
                          placeholder="e.g., ABO, CBO"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Section D: Pre-Populated Defaults */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Pre-Populated Defaults
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Toggle "Skip" to auto-fill and not ask the user. Leave unchecked to show the question with AI recommendation.
                    </p>

                    <Accordion type="multiple" className="w-full">
                      {/* Budget */}
                      <AccordionItem value="budget">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Daily Budget
                            {formPrepopulated.budget?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question</Label>
                              <Switch
                                checked={formPrepopulated.budget?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("budget", "skip", v)}
                              />
                            </div>
                            <div>
                              <Label>Default Value ($)</Label>
                              <Input
                                type="number"
                                value={formPrepopulated.budget?.value || ""}
                                onChange={(e) => updatePrepopField("budget", "value", parseInt(e.target.value) || undefined)}
                                placeholder="25"
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* End Date */}
                      <AccordionItem value="endDate">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            End Date
                            {formPrepopulated.endDate?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question</Label>
                              <Switch
                                checked={formPrepopulated.endDate?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("endDate", "skip", v)}
                              />
                            </div>
                            <div>
                              <Label>Default</Label>
                              <Select
                                value={formPrepopulated.endDate?.value === null ? "continuous" : formPrepopulated.endDate?.value || ""}
                                onValueChange={(v) => updatePrepopField("endDate", "value", v === "continuous" ? null : v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select default" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="continuous">Continuous (no end date)</SelectItem>
                                  <SelectItem value="7days">7 days</SelectItem>
                                  <SelectItem value="30days">30 days</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Meta Advantage+ */}
                      <AccordionItem value="metaAdvantage">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Meta Advantage+ Creative
                            {formPrepopulated.metaAdvantage?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question</Label>
                              <Switch
                                checked={formPrepopulated.metaAdvantage?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("metaAdvantage", "skip", v)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Default: Enabled</Label>
                              <Switch
                                checked={formPrepopulated.metaAdvantage?.value || false}
                                onCheckedChange={(v) => updatePrepopField("metaAdvantage", "value", v)}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Placements */}
                      <AccordionItem value="placements">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Layout className="h-4 w-4" />
                            Placements
                            {formPrepopulated.placements?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question</Label>
                              <Switch
                                checked={formPrepopulated.placements?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("placements", "skip", v)}
                              />
                            </div>
                            <div>
                              <Label>Default</Label>
                              <Select
                                value={formPrepopulated.placements?.value || ""}
                                onValueChange={(v) => updatePrepopField("placements", "value", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select default" />
                                </SelectTrigger>
                                <SelectContent>
                                  {placementOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Optimization Event */}
                      <AccordionItem value="optimizationEvent">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Optimization Event
                            {formPrepopulated.optimizationEvent?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question</Label>
                              <Switch
                                checked={formPrepopulated.optimizationEvent?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("optimizationEvent", "skip", v)}
                              />
                            </div>
                            <div>
                              <Label>Default</Label>
                              <Select
                                value={formPrepopulated.optimizationEvent?.value || ""}
                                onValueChange={(v) => updatePrepopField("optimizationEvent", "value", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select default" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PURCHASE">Purchase</SelectItem>
                                  <SelectItem value="LEAD_GENERATION">Lead</SelectItem>
                                  <SelectItem value="LINK_CLICKS">Link Clicks</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Warm Retargeting */}
                      <AccordionItem value="warmRetargeting">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Warm Retargeting
                            {formPrepopulated.warmRetargeting?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question</Label>
                              <Switch
                                checked={formPrepopulated.warmRetargeting?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("warmRetargeting", "skip", v)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Default: Include Warm Audience</Label>
                              <Switch
                                checked={formPrepopulated.warmRetargeting?.value || false}
                                onCheckedChange={(v) => updatePrepopField("warmRetargeting", "value", v)}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Final URL */}
                      <AccordionItem value="finalUrl">
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4" />
                            Landing Page URL
                            {formPrepopulated.finalUrl?.skip && (
                              <Badge variant="secondary" className="ml-2">Skip</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <Label>Skip this question (use offer URL)</Label>
                              <Switch
                                checked={formPrepopulated.finalUrl?.skip || false}
                                onCheckedChange={(v) => updatePrepopField("finalUrl", "skip", v)}
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>

                  <Separator />

                  {/* Section E: Strategy Template JSON */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Advanced: Strategy Template (JSON)</h3>
                    <Textarea
                      value={formStrategyTemplate}
                      onChange={(e) => setFormStrategyTemplate(e.target.value)}
                      placeholder="{}"
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional JSON for kpi_benchmarks, messaging_framework, creative_mix, etc.
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates List */}
        <div className="grid gap-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No campaign templates yet</p>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {!template.active && <Badge variant="outline">Inactive</Badge>}
                        <Badge variant="secondary">{template.objective}</Badge>
                        <Badge variant="outline">{template.audience_type}</Badge>
                      </div>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {template.optimization_event && (
                      <Badge variant="outline">Optimize: {template.optimization_event}</Badge>
                    )}
                    {template.budget_suggestion && (
                      <Badge variant="outline">Budget: {template.budget_suggestion}</Badge>
                    )}
                    {Object.entries(template.prepopulated_fields || {}).filter(([_, v]: [string, any]) => v?.skip).length > 0 && (
                      <Badge variant="secondary">
                        {Object.entries(template.prepopulated_fields || {}).filter(([_, v]: [string, any]) => v?.skip).length} pre-filled
                      </Badge>
                    )}
                  </div>
                  {template.use_case && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Use case:</strong> {template.use_case}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Slug: {template.slug}
                    </span>
                    <Button
                      variant={template.active ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleActive(template)}
                    >
                      {template.active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}