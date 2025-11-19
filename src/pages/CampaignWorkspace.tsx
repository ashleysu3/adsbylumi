import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Rocket, CheckCircle2 } from "lucide-react";
import { ProductionChecklist } from "@/components/ProductionChecklist";
import { CreativeAssets } from "@/components/CreativeAssets";
import { AssetUploader } from "@/components/AssetUploader";
import { MetaCampaignBuilder } from "@/components/MetaCampaignBuilder";
import { WorkspaceHelp } from "@/components/WorkspaceHelp";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignWorkspace {
  id: string;
  name: string;
  brand_id: string;
  template_id: string | null;
  strategy_id: string | null;
  strategy_json: any;
  creative_json: any;
  offer_name: string | null;
  offer_url: string | null;
  offer_price: string | null;
  offer_description: string | null;
  progress_status: string;
  user_uploaded_assets: any;
  production_checklist: any;
  meta_campaign_status: string | null;
  meta_campaign_ids: any;
  final_answers: any;
  created_at: string;
  updated_at: string;
}

export default function CampaignWorkspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<CampaignWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState("creative");

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const fetchWorkspace = async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (error) throw error;
      setWorkspace(data);
    } catch (error) {
      console.error("Error fetching workspace:", error);
      toast.error("Failed to load campaign workspace");
    } finally {
      setLoading(false);
    }
  };

  const updateWorkspace = async (updates: Partial<CampaignWorkspace>) => {
    if (!workspace) return;

    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update(updates)
        .eq("id", workspace.id);

      if (error) throw error;
      
      setWorkspace({ ...workspace, ...updates });
      toast.success("Progress saved");
    } catch (error) {
      console.error("Error updating workspace:", error);
      toast.error("Failed to save progress");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-secondary",
      creative_in_progress: "bg-blue-500",
      waiting_for_assets: "bg-yellow-500",
      ready_to_publish: "bg-green-500",
      publishing_to_meta: "bg-purple-500",
      live: "bg-primary",
      completed: "bg-gray-500",
    };
    return colors[status] || "bg-secondary";
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-6 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!workspace) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Workspace not found</p>
              <Button onClick={() => navigate("/dashboard")} className="mt-4">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const hasCreative = workspace.creative_json && Object.keys(workspace.creative_json).length > 0;
  const assets = Array.isArray(workspace.user_uploaded_assets) ? workspace.user_uploaded_assets : [];
  const hasAssets = assets.length > 0;
  const canPublish = hasCreative && hasAssets && workspace.progress_status === "ready_to_publish";

  return (
    <DashboardLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{workspace.name}</h1>
              <p className="text-muted-foreground">Campaign Workspace</p>
            </div>
          </div>
          <Badge className={getStatusColor(workspace.progress_status)}>
            {getStatusLabel(workspace.progress_status)}
          </Badge>
        </div>

        <WorkspaceHelp />

        {workspace.offer_name && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{workspace.offer_name}</p>
                </div>
                {workspace.offer_price && (
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="font-medium">{workspace.offer_price}</p>
                  </div>
                )}
                {workspace.offer_url && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">URL</p>
                    <p className="font-medium break-all">{workspace.offer_url}</p>
                  </div>
                )}
                {workspace.offer_description && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p>{workspace.offer_description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="creative">
              Creative Assets
            </TabsTrigger>
            <TabsTrigger value="checklist">
              Production Checklist
            </TabsTrigger>
            <TabsTrigger value="uploads">
              Upload Assets
              {hasAssets && <CheckCircle2 className="h-4 w-4 ml-2 text-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="publish" disabled={!canPublish}>
              Publish to Meta
              <Rocket className="h-4 w-4 ml-2" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="creative">
            <CreativeAssets
              workspace={workspace}
              onUpdate={updateWorkspace}
            />
          </TabsContent>

          <TabsContent value="checklist">
            <ProductionChecklist
              workspace={workspace}
              onUpdate={updateWorkspace}
            />
          </TabsContent>

          <TabsContent value="uploads">
            <AssetUploader
              workspace={workspace}
              onUpdate={updateWorkspace}
            />
          </TabsContent>

          <TabsContent value="publish">
            <MetaCampaignBuilder
              workspace={workspace}
              onUpdate={updateWorkspace}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}