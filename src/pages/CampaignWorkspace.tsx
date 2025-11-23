import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  ArrowLeft, 
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { CreativeAssets } from "@/components/CreativeAssets";
import { ProductionChecklist } from "@/components/ProductionChecklist";
import { CreativeUploader } from "@/components/CreativeUploader";
import { CreativeSidebar } from "@/components/CreativeSidebar";
import { ProductionPanel } from "@/components/ProductionPanel";

export default function CampaignWorkspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState("tofu");

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*, brands(*)")
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
      const { data, error } = await supabase.functions.invoke('generate-creative', {
        body: {
          brandName: workspace.brands?.name || workspace.name,
          strategyData: workspace.strategy_json,
          creativeType: 'complete',
          audiencePsychology: workspace.brands?.audience_psychology
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <CreativeSidebar 
          workspace={workspace}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
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
                <Badge variant="secondary">
                  {progressLabels[workspace.progress_status] || workspace.progress_status}
                </Badge>
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
                      {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                filterStage={['tofu', 'mofu', 'bofu'].includes(activeSection) ? activeSection : undefined}
                filterFormat={['scripts', 'broll', 'carousels', 'static'].includes(activeSection) ? activeSection : undefined}
              />
            )}
          </div>
        </div>

        {/* Production Panel */}
        {workspace.creative_json && (
          <ProductionPanel 
            workspace={workspace}
            onFinalize={handleFinalize}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
