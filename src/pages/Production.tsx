import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProductionPanel } from "@/components/ProductionPanel";
import { toast } from "sonner";

export default function Production() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<any>(null);

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const fetchWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get the most recent workspace with creative_json
      const { data: workspaces, error } = await supabase
        .from("campaign_workspaces")
        .select("*")
        .not("creative_json", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (workspaces && workspaces.length > 0) {
        setWorkspace(workspaces[0]);
      } else {
        toast.info("No creative workspace found. Create one in the Creative dashboard first.");
        navigate("/creative");
      }
    } catch (error: any) {
      console.error("Error fetching workspace:", error);
      toast.error("Failed to load production workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    if (workspace?.id) {
      navigate(`/workspace/${workspace.id}`);
    }
  };

  const handleWorkspaceUpdate = (updates: any) => {
    setWorkspace({ ...workspace, ...updates });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading production dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!workspace) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No production workspace found</p>
            <Button onClick={() => navigate("/creative")}>
              Go to Creative Dashboard
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/creative")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Production Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                {workspace.offer_name || workspace.name}
              </p>
            </div>
          </div>
        </div>

        {/* Production Panel */}
        <ProductionPanel 
          workspace={workspace} 
          onFinalize={handleFinalize}
          onUpdate={handleWorkspaceUpdate}
        />
      </div>
    </DashboardLayout>
  );
}
