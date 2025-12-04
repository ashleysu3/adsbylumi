import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ArrowLeft, Rocket, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { CreativeAssets } from "@/components/CreativeAssets";
import { ProductionChecklist } from "@/components/ProductionChecklist";
import { CreativeUploader } from "@/components/CreativeUploader";
import { CreativeSidebar } from "@/components/CreativeSidebar";
import { CampaignFlowBreadcrumb } from "@/components/CampaignFlowBreadcrumb";
import { GeneratingModal } from "@/components/GeneratingModal";
import { AdCopyLibrary } from "@/components/AdCopyLibrary";
import { SavedConcepts } from "@/components/SavedConcepts";

export default function Creative() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("tofu");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch brand
      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!brandData) {
        toast.error("Please complete your brand setup first");
        navigate("/dashboard");
        return;
      }

      setBrand(brandData);

      // Fetch all campaigns for this brand
      const { data: campaignsData } = await supabase
        .from("campaign_workspaces")
        .select("id, name, progress_status, offer_name, updated_at, creative_json")
        .eq("brand_id", brandData.id)
        .order("updated_at", { ascending: false });

      // Filter campaigns based on offer archive status
      if (campaignsData && campaignsData.length > 0) {
        const filteredCampaigns = await Promise.all(
          campaignsData.map(async (campaign) => {
            if (!campaign.offer_name) return campaign;
            
            // Check if offer is archived
            const { data: offer } = await supabase
              .from('offers')
              .select('archived')
              .eq('brand_id', brandData.id)
              .eq('name', campaign.offer_name)
              .maybeSingle();
            
            // Show campaign if:
            // 1. Offer doesn't exist in offers table (legacy)
            // 2. Offer is not archived
            // 3. Campaign is live/completed (performance tracking)
            if (!offer || 
                !offer.archived || 
                ['live', 'completed'].includes(campaign.progress_status)) {
              return campaign;
            }
            
            return null;
          })
        );

        setCampaigns(filteredCampaigns.filter(Boolean) as any[]);
      } else {
        setCampaigns([]);
      }

      // Auto-select most recent campaign if available
      if (campaignsData && campaignsData.length > 0) {
        await handleCampaignSelect(campaignsData[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignSelect = async (campaignId: string) => {
    if (campaignId === "new") {
      navigate("/planning");
      return;
    }

    setSelectedCampaignId(campaignId);
    setLoading(true);

    try {
      // Fetch full campaign data
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*, brands(*)")
        .eq("id", campaignId)
        .single();

      if (error) throw error;
      setWorkspace(data);
    } catch (error: any) {
      console.error("Error loading campaign:", error);
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceUpdate = async (updates: any) => {
    setWorkspace((prev: any) => ({ ...prev, ...updates }));
  };

  const generateCreative = async () => {
    if (!workspace) return;

    // Check if strategy data exists
    if (!workspace.strategy_json) {
      toast.error("Please complete your campaign strategy in the Planner first.");
      return;
    }

    setGenerating(true);
    try {
      // Fetch full offer data from offers table
      let offerData = null;
      if (workspace.offer_name && brand?.id) {
        const { data: offer } = await supabase
          .from('offers')
          .select('*')
          .eq('brand_id', brand.id)
          .eq('name', workspace.offer_name)
          .maybeSingle();
        
        if (offer) {
          offerData = {
            name: offer.name,
            description: offer.description,
            price_point: offer.price_point,
            url: offer.url,
            target_outcome: offer.target_outcome,
            product_psychology: offer.product_psychology,
            messaging_guidelines: offer.messaging_guidelines
          };
        }
      }

      // Fetch campaign template to get the template slug for CTA context
      let templateData = null;
      if (workspace.template_id) {
        const { data: template } = await supabase
          .from('campaign_templates')
          .select('name, slug')
          .eq('id', workspace.template_id)
          .maybeSingle();
        
        if (template) {
          templateData = {
            name: template.name,
            slug: template.slug
          };
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: {
          brandName: workspace.brands?.name || workspace.name,
          strategyData: workspace.strategy_json,
          creativeType: 'complete',
          audiencePsychology: workspace.brands?.audience_psychology,
          offerData: offerData,
          templateData: templateData
        }
      });

      if (error) throw error;

      const updatedData = {
        creative_json: data,
        progress_status: "waiting_for_assets",
        production_checklist: generateProductionChecklist(data),
      };

      await supabase
        .from("campaign_workspaces")
        .update(updatedData)
        .eq("id", workspace.id);

      await handleWorkspaceUpdate(updatedData);
      toast.success("Creative assets generated!");
    } catch (error: any) {
      console.error("Error generating creative:", error);
      if (error.message?.includes("429")) toast.error("Rate limit exceeded. Please wait a moment.");
      else if (error.message?.includes("402")) toast.error("AI credits depleted. Please add credits in Settings.");
      else toast.error(error.message || "Failed to generate creative");
    } finally {
      setGenerating(false);
    }
  };

  const generateProductionChecklist = (creative: any) => {
    const items: any[] = [];
    if (creative.creative_mix) {
      const { tofu = [], mofu = [], bofu = [] } = creative.creative_mix;
      const allConcepts = [...tofu, ...mofu, ...bofu];

      allConcepts.forEach((concept: any, idx: number) => {
        const stage = concept.stage || 'tofu';
        if (concept.format === 'talking_head' || concept.script) {
          items.push({
            id: `record_${stage}_${idx}`,
            category: "📹 To Record",
            title: `${stage.toUpperCase()}: ${concept.title}`,
            details: concept.script,
            completed: false,
            stage
          });
        }
      });
    }
    return items;
  };

  const handleFinalize = () => {
    if (!workspace) return;
    toast.success("Ready to build campaign!");
    navigate(`/campaigns/build?workspace=${workspace.id}`);
  };

  const progressLabels: Record<string, string> = {
    draft: "Draft",
    creative_in_progress: "Creative in Progress",
    waiting_for_assets: "Waiting for Assets",
    ready_to_publish: "Ready to Publish",
    publishing_to_meta: "Publishing",
    live: "Live",
    completed: "Completed"
  };

  if (loading && campaigns.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <CampaignFlowBreadcrumb 
        currentStep="creative" 
        campaignId={selectedCampaignId}
        progressStatus={workspace?.progress_status}
      />
      <div className="flex h-[calc(100vh-4rem-53px)] w-full overflow-hidden">
        {/* Main Dashboard Area */}
        {!workspace ? (
          <div className="flex-1 flex flex-col">
            {/* Campaign Selector for empty state */}
            <div className="border-b border-border bg-background/95 backdrop-blur-sm p-4">
              <Label htmlFor="campaign-select-empty" className="text-sm font-medium mb-2 block">
                Select Campaign
              </Label>
              <Select
                value={selectedCampaignId}
                onValueChange={handleCampaignSelect}
              >
                <SelectTrigger id="campaign-select-empty" className="w-full text-left">
                  <SelectValue
                    placeholder={
                      campaigns.length === 0
                        ? "Start with the ad planner"
                        : "Choose a campaign..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 ? (
                    <SelectItem value="new">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4" />
                        <span>Start with the ad planner</span>
                      </div>
                    </SelectItem>
                  ) : (
                    campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        <div className="flex flex-col gap-0.5 py-0.5">
                          <span className="font-medium text-sm truncate">
                            {campaign.name}
                          </span>
                          {campaign.offer_name && (
                            <span className="text-xs text-muted-foreground truncate">
                              {campaign.offer_name}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Empty state */}
            <div className="flex-1 flex items-center justify-center p-6">
              <Card className="max-w-md border-2">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Clipboard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle>
                    {campaigns.length === 0 ? "Ready to shine? ✨" : "Select a Campaign"}
                  </CardTitle>
                  <CardDescription>
                    {campaigns.length === 0
                      ? "Start by creating your first campaign in Lumi Strategy. Once you've got a plan, Lumi will generate creative ideas here."
                      : "Choose a campaign from the dropdown above. If it doesn't have creative yet, Lumi can generate it for you."}
                  </CardDescription>
                </CardHeader>
                {campaigns.length === 0 && (
                  <CardContent className="flex justify-center pb-6">
                    <Button onClick={() => navigate("/planning")} size="lg" variant="lumi">
                      <Rocket className="mr-2 h-4 w-4" />
                      Start in Lumi Strategy
                    </Button>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* Sidebar - Hidden on mobile */}
            <div className="hidden md:block">
              <CreativeSidebar
                workspace={workspace}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onNavigateToProduction={() => navigate(`/production?workspace=${workspace.id}`)}
              />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Header with Campaign Dropdown */}
              <div className="border-b border-border bg-background/95 backdrop-blur-sm p-6">
                <div className="flex items-center justify-between gap-4">
                  {/* Campaign Dropdown */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Select
                      value={selectedCampaignId}
                      onValueChange={handleCampaignSelect}
                    >
                      <SelectTrigger className="w-auto border-0 p-0 h-auto hover:bg-transparent focus:ring-0 shadow-none gap-2">
                        <div className="flex flex-col items-start gap-1">
                          <h1 className="text-2xl font-bold truncate">{workspace.name}</h1>
                          <p className="text-sm text-muted-foreground truncate">
                            {workspace.offer_name || "Campaign Workspace"}
                          </p>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            <div className="flex flex-col gap-0.5 py-0.5">
                              <span className="font-medium text-sm">{campaign.name}</span>
                              {campaign.offer_name && (
                                <span className="text-xs text-muted-foreground">
                                  {campaign.offer_name}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Status Badge */}
                  <Badge variant="secondary" className="shrink-0">
                    {progressLabels[workspace.progress_status] || workspace.progress_status}
                  </Badge>
                </div>
              </div>

              {/* Main Panel */}
              <div className="flex-1 overflow-hidden">
                {!workspace.creative_json ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <Card className="max-w-xl border-2 shadow-lg rounded-2xl">
                      <CardHeader className="text-center space-y-3">
                        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-lumi flex items-center justify-center shadow-glow">
                          <Sparkles className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl font-display">Lumi Creative</CardTitle>
                        <CardDescription className="text-base">
                          Ready when you are! Lumi will generate scripts, copy, and creative direction tailored to your strategy.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-center pb-8">
                        <Button 
                          onClick={generateCreative} 
                          disabled={generating}
                          size="lg"
                          variant="lumi"
                          className="w-full max-w-xs gap-2"
                        >
                          {generating && <Loader2 className="h-5 w-5 animate-spin" />}
                          {!generating && <Sparkles className="h-5 w-5" />}
                          {generating ? "Lumi is thinking..." : "Generate Creative ✨"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : activeSection === 'uploads' ? (
                  <div className="h-full overflow-auto">
                    <div className="p-6">
                      <CreativeUploader workspace={workspace} onUpdate={handleWorkspaceUpdate} />
                    </div>
                  </div>
                ) : activeSection === 'checklist' ? (
                  <div className="h-full overflow-auto">
                    <div className="p-6">
                      <ProductionChecklist workspace={workspace} onUpdate={handleWorkspaceUpdate} />
                    </div>
                  </div>
                ) : activeSection === 'copy' ? (
                  <div className="h-full overflow-auto">
                    <div className="p-6">
                      <AdCopyLibrary workspace={workspace} brand={brand} onUpdate={handleWorkspaceUpdate} />
                    </div>
                  </div>
                ) : activeSection === 'saved-concepts' ? (
                  <div className="h-full overflow-auto">
                    <div className="p-6">
                      <SavedConcepts workspace={workspace} type="concepts" />
                    </div>
                  </div>
                ) : activeSection === 'saved-copy' ? (
                  <div className="h-full overflow-auto">
                    <div className="p-6">
                      <SavedConcepts workspace={workspace} type="copy" />
                    </div>
                  </div>
                ) : (
                  <CreativeAssets
                    workspace={workspace}
                    onUpdate={handleWorkspaceUpdate}
                    filterStage={['tofu', 'mofu', 'bofu'].includes(activeSection) ? activeSection : undefined}
                    filterFormat={['scripts', 'broll', 'carousels', 'static'].includes(activeSection) ? activeSection : undefined}
                    onGenerateCreative={generateCreative}
                    isGeneratingParent={generating}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generating Modal */}
      <GeneratingModal 
        isOpen={generating} 
        title="Generating Creative Assets"
        steps={[
          "Analyzing your brand psychology...",
          "Crafting hook variations...",
          "Writing compelling scripts...",
          "Generating ad copy...",
          "Building your creative mix...",
          "Finalizing production notes..."
        ]}
      />
    </DashboardLayout>
  );
}
