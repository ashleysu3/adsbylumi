import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, 
  Play, 
  PenTool, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  FileText,
  Image,
  Video,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Pencil,
  Check,
  X,
  Lightbulb,
  Package,
  Target
} from "lucide-react";
import { getStatusLabel } from "@/lib/campaign-status-labels";
import { toast } from "sonner";
import { CreativeFlowModal } from "@/components/creative/CreativeFlowModal";
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
    note: `High-ticket offers can sustain higher CPL. Up to $${Math.round(price * 0.10)} per lead can still be profitable depending on your close rate.`
  };
  return {
    primary: { kpi: 'cpl', threshold: 20, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Starting point suggestion — adjust based on your actual margins and conversion rates.'
  };
}

interface CampaignDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
  onUpdate?: () => void;
  // When provided, used instead of navigating away for live/completed campaigns.
  // Lets parent route to its in-page campaign detail view (avoids reloading /data).
  onViewResults?: (campaignId: string) => void;
}

interface WorkspaceData {
  id: string;
  name: string;
  progress_status: string;
  offer_name: string | null;
  offer_url: string | null;
  offer_price: string | null;
  creative_json: any;
  selected_copy: any;
  production_checklist: any;
  meta_campaign_status: string | null;
  created_at: string;
  updated_at: string;
  template_id: string | null;
  brand_id: string;
  campaign_templates?: { slug: string; name: string } | null;
}

interface GoalsData {
  id: string;
  primary_kpi: string;
  primary_kpi_label: string;
  primary_kpi_goal_type: string;
  primary_kpi_threshold: number;
  secondary_kpi: string | null;
  secondary_kpi_label: string | null;
  secondary_kpi_goal_type: string | null;
  secondary_kpi_threshold: number | null;
  frequency_threshold: number | null;
  check_frequency_at: string | null;
}

export function CampaignDetailDrawer({ open, onOpenChange, campaignId, onUpdate, onViewResults }: CampaignDetailDrawerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  
  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingOffer, setIsEditingOffer] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOfferName, setEditOfferName] = useState("");
  const [editOfferUrl, setEditOfferUrl] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Creative flow modal
  const [showCreativeModal, setShowCreativeModal] = useState(false);

  // Goals state
  const [existingGoals, setExistingGoals] = useState<GoalsData | null>(null);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalForm, setGoalForm] = useState({
    primary_kpi: '',
    primary_kpi_threshold: '',
    secondary_kpi: '',
    secondary_kpi_threshold: '',
    frequency_threshold: '4',
    show_secondary: false,
  });
  const [goalsSaving, setGoalsSaving] = useState(false);

  useEffect(() => {
    if (open && campaignId) {
      fetchWorkspace();
      fetchGoals();
    }
    if (!open) {
      setIsEditingName(false);
      setIsEditingOffer(false);
      setIsEditingGoals(false);
    }
  }, [open, campaignId]);

  const fetchWorkspace = async () => {
    if (!campaignId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*, campaign_templates(slug, name)")
        .eq("id", campaignId)
        .single();

      if (error) throw error;
      setWorkspace(data as any);
      setEditName(data.name);
      setEditOfferName(data.offer_name || "");
      setEditOfferUrl(data.offer_url || "");
    } catch (error) {
      console.error("Error fetching workspace:", error);
      toast.error("Failed to load campaign details");
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    if (!campaignId) return;
    setGoalsLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_goals")
        .select("*")
        .eq("workspace_id", campaignId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setExistingGoals(data as GoalsData);
        setGoalForm({
          primary_kpi: data.primary_kpi,
          primary_kpi_threshold: String(data.primary_kpi_threshold),
          secondary_kpi: data.secondary_kpi || '',
          secondary_kpi_threshold: data.secondary_kpi_threshold ? String(data.secondary_kpi_threshold) : '',
          frequency_threshold: String(data.frequency_threshold || 4),
          show_secondary: !!data.secondary_kpi,
        });
      } else {
        setExistingGoals(null);
      }
    } catch (error) {
      console.error("Error fetching goals:", error);
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleSaveGoals = async () => {
    if (!workspace || !goalForm.primary_kpi || !goalForm.primary_kpi_threshold) {
      toast.error("Please set a primary KPI and threshold");
      return;
    }

    setGoalsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const primaryOption = KPI_OPTIONS.find(o => o.value === goalForm.primary_kpi);
      const secondaryOption = goalForm.show_secondary && goalForm.secondary_kpi 
        ? KPI_OPTIONS.find(o => o.value === goalForm.secondary_kpi) 
        : null;

      const goalData = {
        workspace_id: workspace.id,
        brand_id: workspace.brand_id,
        created_by: user.id,
        primary_kpi: goalForm.primary_kpi,
        primary_kpi_label: primaryOption?.label || goalForm.primary_kpi,
        primary_kpi_goal_type: primaryOption?.goalType || 'less_than',
        primary_kpi_threshold: parseFloat(goalForm.primary_kpi_threshold),
        secondary_kpi: secondaryOption ? goalForm.secondary_kpi : null,
        secondary_kpi_label: secondaryOption?.label || null,
        secondary_kpi_goal_type: secondaryOption?.goalType || null,
        secondary_kpi_threshold: secondaryOption && goalForm.secondary_kpi_threshold 
          ? parseFloat(goalForm.secondary_kpi_threshold) : null,
        frequency_threshold: parseFloat(goalForm.frequency_threshold) || 4,
        check_frequency_at: 'campaign',
        updated_at: new Date().toISOString(),
      };

      if (existingGoals) {
        const { error } = await supabase
          .from("campaign_goals")
          .update(goalData)
          .eq("id", existingGoals.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campaign_goals")
          .insert(goalData);
        if (error) throw error;
      }

      toast.success("Performance goals saved");
      setIsEditingGoals(false);
      await fetchGoals();
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving goals:", error);
      toast.error(error.message || "Failed to save goals");
    } finally {
      setGoalsSaving(false);
    }
  };

  const applySuggestions = (suggestion: ReturnType<typeof suggestGoals>) => {
    setGoalForm({
      primary_kpi: suggestion.primary.kpi,
      primary_kpi_threshold: String(suggestion.primary.threshold),
      secondary_kpi: suggestion.secondary?.kpi || '',
      secondary_kpi_threshold: suggestion.secondary ? String(suggestion.secondary.threshold) : '',
      frequency_threshold: '4',
      show_secondary: !!suggestion.secondary,
    });
    setIsEditingGoals(true);
  };

  const handleSaveName = async () => {
    if (!workspace || !editName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ name: editName.trim(), updated_at: new Date().toISOString() })
        .eq("id", workspace.id);

      if (error) throw error;
      
      setWorkspace({ ...workspace, name: editName.trim() });
      setIsEditingName(false);
      toast.success("Campaign name updated");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating name:", error);
      toast.error("Failed to update campaign name");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOffer = async () => {
    if (!workspace) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ 
          offer_name: editOfferName.trim() || null, 
          offer_url: editOfferUrl.trim() || null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", workspace.id);

      if (error) throw error;
      
      setWorkspace({ 
        ...workspace, 
        offer_name: editOfferName.trim() || null, 
        offer_url: editOfferUrl.trim() || null 
      });
      setIsEditingOffer(false);
      toast.success("Offer details updated");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating offer:", error);
      toast.error("Failed to update offer details");
    } finally {
      setSaving(false);
    }
  };

  const cancelEditName = () => {
    setEditName(workspace?.name || "");
    setIsEditingName(false);
  };

  const cancelEditOffer = () => {
    setEditOfferName(workspace?.offer_name || "");
    setEditOfferUrl(workspace?.offer_url || "");
    setIsEditingOffer(false);
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode; nextStep: string }> = {
      draft: { 
        label: getStatusLabel("draft"), 
        color: "bg-gray-100 text-gray-700 border-gray-200",
        icon: <PenTool className="h-4 w-4" />,
        nextStep: "Complete your creative setup"
      },
      creative_in_progress: { 
        label: getStatusLabel("creative_in_progress"), 
        color: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <Sparkles className="h-4 w-4" />,
        nextStep: "Finish selecting your creative angles"
      },
      waiting_for_assets: { 
        label: getStatusLabel("waiting_for_assets"), 
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        icon: <Clock className="h-4 w-4" />,
        nextStep: "Upload your video or images"
      },
      ready_to_publish: { 
        label: getStatusLabel("ready_to_publish"), 
        color: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle2 className="h-4 w-4" />,
        nextStep: "Review and launch your campaign"
      },
      publishing_to_meta: { 
        label: "Publishing...", 
        color: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
        nextStep: "Campaign is being published..."
      },
      live: { 
        label: getStatusLabel("live"), 
        color: "bg-primary/10 text-primary border-primary/20",
        icon: <Play className="h-4 w-4" />,
        nextStep: "Monitor performance in Results"
      },
      completed: { 
        label: getStatusLabel("completed"), 
        color: "bg-gray-100 text-gray-600 border-gray-200",
        icon: <CheckCircle2 className="h-4 w-4" />,
        nextStep: "View final results"
      },
      imported: {
        label: "Imported",
        color: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <CheckCircle2 className="h-4 w-4" />,
        nextStep: "Set performance goals to track this campaign"
      },
    };
    return statusMap[status] || statusMap.draft;
  };

  const getCreativePreview = () => {
    if (!workspace?.creative_json) return null;
    const creative = workspace.creative_json;
    
    // Extract hooks, scripts, headlines from creative_json
    const hooks = creative.hooks || [];
    const scripts = creative.scripts || [];
    const headlines = creative.headlines || [];
    
    return { hooks, scripts, headlines };
  };

  const getCopyPreview = () => {
    if (!workspace?.selected_copy) return null;
    return workspace.selected_copy;
  };

  const handleContinue = () => {
    if (!workspace) return;
    
    const status = workspace.progress_status;
    
    if (status === 'live' || status === 'completed') {
      // Prefer in-page detail view if parent provided a handler — avoids
      // navigating back to the same /data page (which felt like a loop).
      if (onViewResults) {
        onViewResults(workspace.id);
        onOpenChange(false);
        return;
      }
      navigate('/data');
    } else if (status === 'ready_to_publish' || status === 'publishing_to_meta') {
      navigate(`/campaigns/build?workspace=${workspace.id}`);
    } else if (status === 'creative_in_progress' || status === 'waiting_for_assets') {
      // For in-progress creative work - go to creative studio
      navigate(`/creative-studio?workspace=${workspace.id}`);
    } else {
      // For draft - go to create flow to start setup
      navigate(`/create?workspace=${workspace.id}`);
    }
    
    onOpenChange(false);
  };

  const statusInfo = workspace ? getStatusInfo(workspace.progress_status) : null;
  const creativePreview = getCreativePreview();
  const copyPreview = getCopyPreview();

  const templateSlug = (workspace?.campaign_templates as any)?.slug || null;
  const suggestion = workspace ? suggestGoals(workspace.offer_price, templateSlug) : null;

  const getGoalTypeLabel = (kpi: string) => {
    const opt = KPI_OPTIONS.find(o => o.value === kpi);
    if (!opt) return 'less than';
    return opt.goalType === 'less_than' ? 'less than' : 'greater than';
  };

  const getThresholdPrefix = (kpi: string) => {
    const opt = KPI_OPTIONS.find(o => o.value === kpi);
    if (!opt) return '$';
    if (kpi === 'roas') return '';
    if (kpi === 'ctr') return '';
    if (kpi === 'purchases') return '';
    return '$';
  };

  const getThresholdSuffix = (kpi: string) => {
    if (kpi === 'roas') return 'x';
    if (kpi === 'ctr') return '%';
    return '';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-base font-display"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') cancelEditName();
                  }}
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={handleSaveName}
                  disabled={saving}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={cancelEditName}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <SheetTitle className="text-lg font-display truncate">
                  {loading ? <Skeleton className="h-6 w-40" /> : workspace?.name}
                </SheetTitle>
                {!loading && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
            {statusInfo && !isEditingName && (
              <Badge variant="outline" className={`gap-1 flex-shrink-0 ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            )}
          </div>
          
          {/* Offer Section */}
          {isEditingOffer ? (
            <div className="space-y-2 pt-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Offer Name</label>
                <Input
                  value={editOfferName}
                  onChange={(e) => setEditOfferName(e.target.value)}
                  placeholder="Enter offer name..."
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Offer URL</label>
                <Input
                  value={editOfferUrl}
                  onChange={(e) => setEditOfferUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={handleSaveOffer}
                  disabled={saving}
                >
                  <Check className="h-3 w-3" />
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs"
                  onClick={cancelEditOffer}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {workspace?.offer_name ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">Promoting:</span> {workspace.offer_name}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">No offer linked</p>
              )}
              {!loading && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingOffer(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex-1 space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : workspace ? (
          <ScrollArea className="flex-1 py-4">
            <div className="space-y-4 pr-4">
              {/* Next Step Card */}
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Next Step</p>
                      <p className="text-sm text-muted-foreground">{statusInfo?.nextStep}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs for Creative / Copy / Goals / Details. Default to Goals
                  when there's no creative or copy yet so the drawer never
                  feels empty for live campaigns surfaced by the report. */}
              <Tabs defaultValue={(creativePreview || copyPreview) ? 'creative' : 'goals'} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="creative" className="text-xs">Creative</TabsTrigger>
                  <TabsTrigger value="copy" className="text-xs">Copy</TabsTrigger>
                  <TabsTrigger value="goals" className="text-xs">Goals</TabsTrigger>
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                </TabsList>

                <TabsContent value="creative" className="mt-4 space-y-3">
                  {creativePreview ? (
                    <>
                      {creativePreview.hooks?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Video className="h-3 w-3" /> Hooks
                          </p>
                          <div className="space-y-2">
                            {creativePreview.hooks.slice(0, 3).map((hook: any, i: number) => (
                              <Card key={i} className="bg-muted/30">
                                <CardContent className="p-3">
                                  <p className="text-sm">{typeof hook === 'string' ? hook : hook.text || hook.content || 'Hook ' + (i + 1)}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      {creativePreview.scripts?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Scripts
                          </p>
                          <div className="space-y-2">
                            {creativePreview.scripts.slice(0, 2).map((script: any, i: number) => (
                              <Card key={i} className="bg-muted/30">
                                <CardContent className="p-3">
                                  <p className="text-sm line-clamp-3">{typeof script === 'string' ? script : script.content || script.text || 'Script ' + (i + 1)}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No creative saved in LUMI for this campaign</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This is normal for campaigns built outside LUMI. Use the Goals tab to set targets, or tap View Results to see performance.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="copy" className="mt-4 space-y-3">
                  {copyPreview ? (
                    <>
                      {copyPreview.headline && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Headline</p>
                          <p className="text-sm font-medium">{copyPreview.headline}</p>
                        </div>
                      )}
                      {copyPreview.primaryText && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Primary Text</p>
                          <p className="text-sm">{copyPreview.primaryText}</p>
                        </div>
                      )}
                      {copyPreview.description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                          <p className="text-sm text-muted-foreground">{copyPreview.description}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No copy selected yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Continue setup to select copy</p>
                    </div>
                  )}
                </TabsContent>

                {/* Goals Tab */}
                <TabsContent value="goals" className="mt-4 space-y-4">
                  {goalsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : existingGoals && !isEditingGoals ? (
                    /* Saved goals summary */
                    <div className="space-y-3">
                      <Card className="border-green-200 dark:border-green-800">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Target className="h-4 w-4 text-primary" /> Performance Goals
                            </p>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsEditingGoals(true)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                          </div>
                          <div className="text-sm space-y-1">
                            <p>
                              <span className="text-muted-foreground">Primary:</span>{' '}
                              <span className="font-medium">{existingGoals.primary_kpi_label}</span>{' '}
                              — {existingGoals.primary_kpi_goal_type === 'less_than' ? 'less than' : 'greater than'}{' '}
                              {getThresholdPrefix(existingGoals.primary_kpi)}{existingGoals.primary_kpi_threshold}{getThresholdSuffix(existingGoals.primary_kpi)}
                            </p>
                            {existingGoals.secondary_kpi && (
                              <p>
                                <span className="text-muted-foreground">Secondary:</span>{' '}
                                <span className="font-medium">{existingGoals.secondary_kpi_label}</span>{' '}
                                — {existingGoals.secondary_kpi_goal_type === 'less_than' ? 'less than' : 'greater than'}{' '}
                                {getThresholdPrefix(existingGoals.secondary_kpi)}{existingGoals.secondary_kpi_threshold}{getThresholdSuffix(existingGoals.secondary_kpi)}
                              </p>
                            )}
                            <p>
                              <span className="text-muted-foreground">Frequency:</span>{' '}
                              flag above {existingGoals.frequency_threshold || 4}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
                        <p>✅ Green if {existingGoals.primary_kpi_label} is {existingGoals.primary_kpi_goal_type === 'less_than' ? 'less than' : 'greater than'} {getThresholdPrefix(existingGoals.primary_kpi)}{existingGoals.primary_kpi_threshold}{getThresholdSuffix(existingGoals.primary_kpi)}{existingGoals.secondary_kpi ? ` and ${existingGoals.secondary_kpi_label} meets goal` : ''}</p>
                        <p>🟡 Yellow if within 25% of goal</p>
                        <p>🔴 Red if outside goal threshold</p>
                      </div>
                    </div>
                  ) : (
                    /* Goal configuration form */
                    <div className="space-y-4">
                      {/* LUMI suggestion card — only show if no existing goals and not editing */}
                      {!existingGoals && !isEditingGoals && suggestion && (
                        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <img src={lumiLogo} className="h-5 w-5" alt="" />
                              <span className="text-sm font-semibold">LUMI suggests for this campaign:</span>
                            </div>
                            <div className="text-sm space-y-1">
                              <p>
                                <span className="font-medium">Primary KPI:</span> {suggestion.primary.label} — goal: {suggestion.primary.goalType === 'less_than' ? 'less than' : 'greater than'} {getThresholdPrefix(suggestion.primary.kpi)}{suggestion.primary.threshold}{getThresholdSuffix(suggestion.primary.kpi)}
                              </p>
                              {suggestion.secondary && (
                                <p>
                                  <span className="font-medium">Secondary KPI:</span> {suggestion.secondary.label} — goal: {suggestion.secondary.goalType === 'less_than' ? 'less than' : 'greater than'} {getThresholdPrefix(suggestion.secondary.kpi)}{suggestion.secondary.threshold}{getThresholdSuffix(suggestion.secondary.kpi)}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground italic">{suggestion.note}</p>
                            <p className="text-xs text-muted-foreground">These are starting points based on your offer type and price point. Adjust them as you gather real data.</p>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => applySuggestions(suggestion)}>Use these suggestions</Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsEditingGoals(true)}>Set manually</Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Form — show when editing or when suggestion was applied */}
                      {(isEditingGoals) && (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm">Primary KPI</Label>
                            <Select value={goalForm.primary_kpi} onValueChange={v => setGoalForm(p => ({ ...p, primary_kpi: v }))}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Select KPI..." /></SelectTrigger>
                              <SelectContent>
                                {KPI_OPTIONS.map(o => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {goalForm.primary_kpi && (
                            <div>
                              <Label className="text-sm">
                                Goal: {getGoalTypeLabel(goalForm.primary_kpi)} {getThresholdPrefix(goalForm.primary_kpi)}____{getThresholdSuffix(goalForm.primary_kpi)}
                              </Label>
                              <Input
                                type="number"
                                step="any"
                                className="mt-1"
                                value={goalForm.primary_kpi_threshold}
                                onChange={e => setGoalForm(p => ({ ...p, primary_kpi_threshold: e.target.value }))}
                                placeholder="Enter threshold"
                              />
                            </div>
                          )}

                          {!goalForm.show_secondary ? (
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() => setGoalForm(p => ({ ...p, show_secondary: true }))}
                            >
                              + Add secondary KPI
                            </button>
                          ) : (
                            <>
                              <div>
                                <Label className="text-sm">Secondary KPI (optional)</Label>
                                <Select value={goalForm.secondary_kpi} onValueChange={v => setGoalForm(p => ({ ...p, secondary_kpi: v }))}>
                                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select KPI..." /></SelectTrigger>
                                  <SelectContent>
                                    {KPI_OPTIONS.filter(o => o.value !== goalForm.primary_kpi).map(o => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {goalForm.secondary_kpi && (
                                <div>
                                  <Label className="text-sm">
                                    Goal: {getGoalTypeLabel(goalForm.secondary_kpi)} {getThresholdPrefix(goalForm.secondary_kpi)}____{getThresholdSuffix(goalForm.secondary_kpi)}
                                  </Label>
                                  <Input
                                    type="number"
                                    step="any"
                                    className="mt-1"
                                    value={goalForm.secondary_kpi_threshold}
                                    onChange={e => setGoalForm(p => ({ ...p, secondary_kpi_threshold: e.target.value }))}
                                    placeholder="Enter threshold"
                                  />
                                </div>
                              )}
                              <button
                                className="text-xs text-muted-foreground hover:underline"
                                onClick={() => setGoalForm(p => ({ ...p, show_secondary: false, secondary_kpi: '', secondary_kpi_threshold: '' }))}
                              >
                                Remove secondary KPI
                              </button>
                            </>
                          )}

                          <div>
                            <Label className="text-sm">Flag when frequency exceeds</Label>
                            <Input
                              type="number"
                              step="0.1"
                              className="mt-1 w-24"
                              value={goalForm.frequency_threshold}
                              onChange={e => setGoalForm(p => ({ ...p, frequency_threshold: e.target.value }))}
                            />
                          </div>

                          {/* Preview */}
                          {goalForm.primary_kpi && goalForm.primary_kpi_threshold && (
                            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
                              <p className="font-medium text-foreground text-sm mb-1">Your campaign will be reviewed as:</p>
                              <p>✅ Green if {KPI_OPTIONS.find(o => o.value === goalForm.primary_kpi)?.label} is {getGoalTypeLabel(goalForm.primary_kpi)} {getThresholdPrefix(goalForm.primary_kpi)}{goalForm.primary_kpi_threshold}{getThresholdSuffix(goalForm.primary_kpi)}</p>
                              <p>🟡 Yellow if within 25% of goal</p>
                              <p>🔴 Red if outside goal threshold</p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={handleSaveGoals} disabled={goalsSaving} className="flex-1">
                              {goalsSaving ? 'Saving...' : 'Save Goals'}
                            </Button>
                            {existingGoals && (
                              <Button variant="ghost" onClick={() => setIsEditingGoals(false)}>Cancel</Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="details" className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm">{new Date(workspace.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Updated</p>
                      <p className="text-sm">{new Date(workspace.updated_at).toLocaleDateString()}</p>
                    </div>
                    {workspace.offer_url && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Offer URL</p>
                        <a 
                          href={workspace.offer_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {workspace.offer_url.slice(0, 40)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {workspace.meta_campaign_status && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Meta Status</p>
                        <p className="text-sm capitalize">{workspace.meta_campaign_status}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        ) : null}

        {/* Footer Actions */}
        <div className="pt-4 border-t mt-auto space-y-2">
          <Button 
            onClick={() => setShowCreativeModal(true)} 
            className="w-full gap-2"
            variant="outline"
          >
            <Lightbulb className="h-4 w-4" />
            Generate Angles & Ideas
          </Button>
          <Button 
            onClick={handleContinue} 
            className="w-full gap-2"
            variant="lumi"
          >
            {workspace?.progress_status === 'live' || workspace?.progress_status === 'completed' ? (
              <>
                <Eye className="h-4 w-4" />
                View Results
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </SheetContent>

      {/* Creative Flow Modal */}
      <CreativeFlowModal
        open={showCreativeModal}
        onOpenChange={setShowCreativeModal}
        workspaceId={campaignId}
        onComplete={() => {
          onUpdate?.();
          fetchWorkspace();
        }}
      />
    </Sheet>
  );
}
