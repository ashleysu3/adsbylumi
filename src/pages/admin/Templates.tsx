import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
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
import { LayoutTemplate, Plus, Edit, Trash2, Save, X, Zap, Target, DollarSign, Calendar, Link2, Layout, Users, GripVertical, Copy } from "lucide-react";
import { toast } from "sonner";

interface KPIBenchmark {
  min: number;
  max: number;
  unit: string;
}

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
  purpose?: string;
  kpi_priorities?: string[];
  journey_stages?: string[];
  kpi_benchmarks?: Record<string, KPIBenchmark>;
  sort_order?: number;
}

const KPI_OPTIONS = [
  { value: "cpc", label: "CPC (Cost Per Click)" },
  { value: "ctr", label: "CTR (Click-Through Rate)" },
  { value: "cpm", label: "CPM (Cost Per 1000 Impressions)" },
  { value: "cpl", label: "CPL (Cost Per Lead)" },
  { value: "cpp", label: "CPP (Cost Per Purchase)" },
  { value: "roas", label: "ROAS (Return On Ad Spend)" },
  { value: "frequency", label: "Frequency" },
  { value: "link_clicks", label: "Link Clicks" },
  { value: "video_views", label: "Video Views" },
  { value: "thruplay", label: "ThruPlay (Video)" },
];

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
  { value: "Conversations", label: "Conversations (Messages)" },
  { value: "2s ThruPlay", label: "2s ThruPlay (Video)" },
  { value: "Profile Visits", label: "Profile Visits" },
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
  const [formPurpose, setFormPurpose] = useState("");
  const [formKpiPriorities, setFormKpiPriorities] = useState<string[]>([]);
  const [formJourneyStages, setFormJourneyStages] = useState<string[]>(["grow", "nurture", "convert"]);
  const [formKpiBenchmarks, setFormKpiBenchmarks] = useState<Record<string, KPIBenchmark>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_templates")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      // Cast data to our interface since prepopulated_fields is typed as Json in Supabase
      setTemplates((data || []).map(t => ({
        ...t,
        prepopulated_fields: (t.prepopulated_fields || {}) as PrepopulatedFields,
        journey_stages: (t.journey_stages || ["grow", "nurture", "convert"]) as unknown as string[],
        kpi_benchmarks: (t.kpi_benchmarks || {}) as unknown as Record<string, KPIBenchmark>,
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
        purpose: formPurpose || null,
        kpi_priorities: formKpiPriorities as Json,
        journey_stages: formJourneyStages as unknown as Json,
        kpi_benchmarks: formKpiBenchmarks as unknown as Json,
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
    setFormPurpose(template.purpose || "");
    setFormKpiPriorities(template.kpi_priorities || []);
    setFormJourneyStages(template.journey_stages || ["grow", "nurture", "convert"]);
    setFormKpiBenchmarks(template.kpi_benchmarks || {});
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

  const handleDuplicate = async (template: CampaignTemplate) => {
    try {
      const maxSortOrder = Math.max(...templates.map(t => t.sort_order || 0), 0);
      const duplicateData = {
        name: `${template.name} (Copy)`,
        slug: `${template.slug}-copy-${Date.now()}`,
        description: template.description,
        long_description: template.long_description,
        icon: template.icon,
        objective: template.objective,
        optimization_event: template.optimization_event,
        audience_type: template.audience_type,
        campaign_structure: template.campaign_structure,
        budget_suggestion: template.budget_suggestion,
        use_case: template.use_case,
        strategy_template: template.strategy_template as Json,
        prepopulated_fields: template.prepopulated_fields as Json,
        purpose: template.purpose || null,
        kpi_priorities: (template.kpi_priorities || []) as Json,
        journey_stages: (template.journey_stages || ["grow", "nurture", "convert"]) as unknown as Json,
        kpi_benchmarks: (template.kpi_benchmarks || {}) as unknown as Json,
        active: false,
        sort_order: maxSortOrder + 1,
      };

      const { error } = await supabase
        .from("campaign_templates")
        .insert([duplicateData]);

      if (error) throw error;
      toast.success("Template duplicated!");
      fetchTemplates();
    } catch (error: any) {
      toast.error("Failed to duplicate template");
      console.error(error);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newTemplates = [...templates];
    const [removed] = newTemplates.splice(draggedIndex, 1);
    newTemplates.splice(dragOverIndex, 0, removed);

    // Update local state immediately for smooth UX
    setTemplates(newTemplates);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Persist new order to database
    try {
      const updates = newTemplates.map((t, index) => ({
        id: t.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("campaign_templates")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
      }
      toast.success("Order saved");
    } catch (error) {
      toast.error("Failed to save order");
      fetchTemplates(); // Revert on error
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
    setFormPurpose("");
    setFormKpiPriorities([]);
    setFormJourneyStages(["grow", "nurture", "convert"]);
    setFormKpiBenchmarks({});
  };

  const toggleJourneyStage = (stage: string) => {
    setFormJourneyStages(prev => {
      if (prev.includes(stage)) {
        return prev.filter(s => s !== stage);
      }
      return [...prev, stage];
    });
  };

  const updateKpiBenchmark = (kpi: string, field: keyof KPIBenchmark, value: number | string) => {
    setFormKpiBenchmarks(prev => ({
      ...prev,
      [kpi]: {
        ...prev[kpi],
        [field]: field === 'unit' ? value : Number(value),
      }
    }));
  };

  const getDefaultBenchmark = (kpi: string): KPIBenchmark => {
    const defaults: Record<string, KPIBenchmark> = {
      cpc: { min: 0.15, max: 0.50, unit: '$' },
      ctr: { min: 1.5, max: 4.0, unit: '%' },
      cpm: { min: 5, max: 15, unit: '$' },
      cpl: { min: 5, max: 35, unit: '$' },
      cpp: { min: 10, max: 50, unit: '$' },
      roas: { min: 2.0, max: 5.0, unit: 'x' },
      frequency: { min: 1, max: 3, unit: '' },
      link_clicks: { min: 100, max: 1000, unit: '' },
      video_views: { min: 1000, max: 10000, unit: '' },
      thruplay: { min: 0.02, max: 0.08, unit: '$' },
    };
    return defaults[kpi] || { min: 0, max: 100, unit: '' };
  };

  const toggleKpiPriority = (kpi: string) => {
    setFormKpiPriorities(prev => {
      if (prev.includes(kpi)) {
        return prev.filter(k => k !== kpi);
      }
      if (prev.length >= 3) {
        return prev; // Max 3 KPIs
      }
      return [...prev, kpi];
    });
  };

  const moveKpiUp = (index: number) => {
    if (index === 0) return;
    setFormKpiPriorities(prev => {
      const newArr = [...prev];
      [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
      return newArr;
    });
  };

  const moveKpiDown = (index: number) => {
    setFormKpiPriorities(prev => {
      if (index >= prev.length - 1) return prev;
      const newArr = [...prev];
      [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
      return newArr;
    });
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
        <AdminTabs />
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

                  {/* Section B2: Campaign Purpose & Performance Evaluation */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Campaign Purpose & Performance Evaluation
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Define what success looks like for this campaign type. The AI will use this to evaluate performance accurately.
                    </p>
                    
                    <div>
                      <Label>Campaign Purpose & Success Definition</Label>
                      <Textarea
                        value={formPurpose}
                        onChange={(e) => setFormPurpose(e.target.value)}
                        placeholder={`Example for a Traffic campaign:

This campaign is designed to drive traffic to existing content to increase visibility and warm up potential buyers.

SUCCESS LOOKS LIKE:
- Low cost per click (CPC) under $0.50
- High click-through rate (CTR) above 2%
- Growing engaged audience for future retargeting

THIS CAMPAIGN IS NOT FOR:
- Direct sales (don't evaluate ROAS)
- Lead generation (don't evaluate CPL)

EVALUATION PRIORITY:
1. CPC - Are clicks affordable?
2. CTR - Is content engaging?
3. Link Clicks - Are people taking action?`}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Be specific about what metrics matter and what metrics are NOT relevant for this campaign type.
                        The AI will reference this when giving performance feedback.
                      </p>
                    </div>

                    {/* Journey Stages Selection */}
                    <div className="space-y-3">
                      <Label>Customer Journey Stages to Evaluate</Label>
                      <p className="text-xs text-muted-foreground">
                        Select which stages of the customer journey are relevant for this campaign type.
                        Only selected stages will be shown in performance analysis.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <div 
                          onClick={() => toggleJourneyStage('grow')}
                          className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                            formJourneyStages.includes('grow') 
                              ? 'border-green-500 bg-green-50' 
                              : 'border-muted hover:border-green-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🌱</span>
                            <div>
                              <p className="font-medium text-sm">Grow</p>
                              <p className="text-xs text-muted-foreground">Awareness & reach</p>
                            </div>
                          </div>
                        </div>
                        <div 
                          onClick={() => toggleJourneyStage('nurture')}
                          className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                            formJourneyStages.includes('nurture') 
                              ? 'border-amber-500 bg-amber-50' 
                              : 'border-muted hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💜</span>
                            <div>
                              <p className="font-medium text-sm">Nurture</p>
                              <p className="text-xs text-muted-foreground">Engagement & trust</p>
                            </div>
                          </div>
                        </div>
                        <div 
                          onClick={() => toggleJourneyStage('convert')}
                          className={`cursor-pointer p-3 rounded-lg border-2 transition-all ${
                            formJourneyStages.includes('convert') 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-muted hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💰</span>
                            <div>
                              <p className="font-medium text-sm">Convert</p>
                              <p className="text-xs text-muted-foreground">Sales & leads</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Priority KPIs (select up to 3, in order of importance)</Label>
                      <div className="mt-2 space-y-2">
                        {/* Selected KPIs with order */}
                        {formKpiPriorities.length > 0 && (
                          <div className="space-y-1 mb-3">
                            <p className="text-xs text-muted-foreground">Selected (in order):</p>
                            {formKpiPriorities.map((kpi, idx) => {
                              const kpiOption = KPI_OPTIONS.find(k => k.value === kpi);
                              return (
                                <div key={kpi} className="flex items-center gap-2 bg-primary/10 rounded-md p-2">
                                  <Badge variant="outline" className="font-mono">{idx + 1}</Badge>
                                  <span className="flex-1 text-sm">{kpiOption?.label || kpi}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveKpiUp(idx)}
                                    disabled={idx === 0}
                                    className="h-6 w-6 p-0"
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveKpiDown(idx)}
                                    disabled={idx === formKpiPriorities.length - 1}
                                    className="h-6 w-6 p-0"
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleKpiPriority(kpi)}
                                    className="h-6 w-6 p-0 text-destructive"
                                  >
                                    ×
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Available KPIs */}
                        <div className="flex flex-wrap gap-2">
                          {KPI_OPTIONS.filter(k => !formKpiPriorities.includes(k.value)).map((kpi) => (
                            <Badge
                              key={kpi.value}
                              variant="outline"
                              className={`cursor-pointer hover:bg-primary/10 ${
                                formKpiPriorities.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={() => formKpiPriorities.length < 3 && toggleKpiPriority(kpi.value)}
                            >
                              + {kpi.label}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          These KPIs will be evaluated first and weighted most heavily in performance analysis.
                        </p>
                      </div>
                    </div>

                    {/* KPI Benchmarks Configuration */}
                    {formKpiPriorities.length > 0 && (
                      <div className="space-y-3">
                        <Label>KPI Benchmarks (optional)</Label>
                        <p className="text-xs text-muted-foreground">
                          Set custom benchmark ranges for each priority KPI. Leave empty to use defaults.
                        </p>
                        <div className="space-y-3">
                          {formKpiPriorities.map((kpi) => {
                            const kpiOption = KPI_OPTIONS.find(k => k.value === kpi);
                            const benchmark = formKpiBenchmarks[kpi] || getDefaultBenchmark(kpi);
                            return (
                              <div key={kpi} className="p-3 rounded-lg border bg-muted/30">
                                <p className="text-sm font-medium mb-2">{kpiOption?.label || kpi}</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Min (healthy)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={benchmark.min}
                                      onChange={(e) => updateKpiBenchmark(kpi, 'min', e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Max (attention)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={benchmark.max}
                                      onChange={(e) => updateKpiBenchmark(kpi, 'max', e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Unit</Label>
                                    <Select 
                                      value={benchmark.unit} 
                                      onValueChange={(v) => updateKpiBenchmark(kpi, 'unit', v)}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="$">$ (currency)</SelectItem>
                                        <SelectItem value="%">% (percent)</SelectItem>
                                        <SelectItem value="x">x (multiplier)</SelectItem>
                                        <SelectItem value="none">(none)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                        <Select value={formOptimizationEvent || undefined} onValueChange={setFormOptimizationEvent}>
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
            templates.map((template, index) => (
              <Card
                key={template.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`transition-all cursor-move ${
                  draggedIndex === index ? 'opacity-50 scale-[0.98]' : ''
                } ${dragOverIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {!template.active && <Badge variant="outline">Inactive</Badge>}
                          <Badge variant="secondary">{template.objective}</Badge>
                          <Badge variant="outline">{template.audience_type}</Badge>
                        </div>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)} title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(template)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)} title="Delete">
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