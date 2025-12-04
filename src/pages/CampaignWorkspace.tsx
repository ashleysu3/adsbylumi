import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { CreativeAssets } from "@/components/CreativeAssets";
import { ProductionChecklist } from "@/components/ProductionChecklist";
import { CreativeUploader } from "@/components/CreativeUploader";
import { CreativeSidebar } from "@/components/CreativeSidebar";
import { LumiLoader } from "@/components/LumiLoader";
import { GeneratingModal } from "@/components/GeneratingModal";

export default function CampaignWorkspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState("grow");

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*, brands(*), offers(*), campaign_templates:template_id(*)")
        .eq("id", workspaceId)
        .single();

      if (error) throw error;
      setWorkspace(data);
    } catch (error: any) {
      console.error("Error fetching workspace:", error);
      toast.error("Failed to load campaign workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceUpdate = async (updates: any) => {
    setWorkspace((prev: any) => ({ ...prev, ...updates }));
  };

  const generateCreative = async () => {
    setGenerating(true);
    try {
      // Build rich offer data from linked offer or workspace fields
      const linkedOffer = workspace.offers;
      const offerData = linkedOffer ? {
        name: linkedOffer.name,
        url: linkedOffer.url,
        price_point: linkedOffer.price_point,
        description: linkedOffer.description,
        target_outcome: linkedOffer.target_outcome,
        product_psychology: linkedOffer.product_psychology,
        messaging_guidelines: linkedOffer.messaging_guidelines
      } : {
        name: workspace.offer_name,
        url: workspace.offer_url,
        price_point: workspace.offer_price,
        description: workspace.offer_description
      };

      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: {
          brandName: workspace.brands?.name || workspace.name,
          strategyData: workspace.strategy_json,
          creativeType: 'complete',
          audiencePsychology: workspace.brands?.audience_psychology,
          offerData,
          productPsychology: linkedOffer?.product_psychology,
          templateData: workspace.campaign_templates
        }
      });

      if (error) throw error;
      
      await handleWorkspaceUpdate({
        creative_json: data,
        progress_status: "waiting_for_assets",
        production_checklist: generateProductionChecklist(data),
      });
      
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
      const { grow = [], nurture = [], convert = [] } = creative.creative_mix;
      const allConcepts = [...grow, ...nurture, ...convert];
      
      allConcepts.forEach((concept: any, idx: number) => {
        const stage = concept.stage || 'grow';
        const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1);
        if (concept.format === 'talking_head' || concept.script) {
          items.push({
            id: `record_${stage}_${idx}`,
            category: "📹 To Record",
            title: `${stageLabel}: ${concept.title}`,
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
    toast.success("Ready to build campaign!");
    navigate(`/campaigns/build?workspace=${workspaceId}`);
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

  const generatingSteps = [
    "Analyzing your brand psychology...",
    "Crafting your Grow creative...",
    "Building your Nurture content...",
    "Designing your Convert assets...",
    "Writing compelling copy variations...",
    "Finalizing your creative mix..."
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <LumiLoader size="lg" message="Loading your workspace..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!workspace) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Workspace not found</p>
            <Button onClick={() => navigate("/campaigns")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaigns
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <GeneratingModal 
        isOpen={generating} 
        title="Creating Your Creative Mix"
        steps={generatingSteps}
      />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <CreativeSidebar 
          workspace={workspace}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onNavigateToProduction={() => navigate("/production")}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate("/campaigns")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h1 className="text-2xl font-bold">{workspace.name}</h1>
                      <p className="text-sm text-muted-foreground">Campaign Workspace</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Panel */}
          <div className="flex-1 overflow-hidden">
            {!workspace.creative_json ? (
              <div className="h-full flex items-center justify-center p-6">
                <Card className="max-w-lg">
                  <CardHeader>
                    <CardTitle>Generate Creative Assets</CardTitle>
                    <CardDescription>
                      Start by generating your creative concepts and copy
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={generateCreative} disabled={generating}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Creative Mix
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
            ) : (
              <CreativeAssets 
                workspace={workspace} 
                onUpdate={handleWorkspaceUpdate}
                filterStage={['grow', 'nurture', 'convert'].includes(activeSection) ? activeSection : undefined}
                filterFormat={['scripts', 'broll', 'carousels', 'static'].includes(activeSection) ? activeSection : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
