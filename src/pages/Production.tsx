import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Filter } from "lucide-react";
import { ProductionCard } from "@/components/ProductionCard";
import { ProductionWorkflow } from "@/components/ProductionWorkflow";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Production() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<any>(null);
  const [productionItems, setProductionItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

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

      // Get the most recent workspace with production_items
      const { data: workspaces, error } = await supabase
        .from("campaign_workspaces")
        .select("*")
        .not("production_items", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (workspaces && workspaces.length > 0) {
        setWorkspace(workspaces[0]);
        const items = Array.isArray(workspaces[0].production_items) 
          ? workspaces[0].production_items 
          : [];
        setProductionItems(items);
      } else {
        toast.info("No production items found. Go to Creative dashboard and send concepts to production.");
        navigate("/creative");
      }
    } catch (error: any) {
      console.error("Error fetching workspace:", error);
      toast.error("Failed to load production workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceUpdate = async () => {
    await fetchWorkspace();
  };

  const handleCardClick = (item: any) => {
    setSelectedItem(item);
    setWorkflowOpen(true);
  };

  const handleBuildCampaign = () => {
    const approvedCount = productionItems.filter((item) => item.status === "approved").length;
    if (approvedCount < 3) {
      toast.error(`You need at least 3 approved concepts. Currently have ${approvedCount}.`);
      return;
    }
    navigate(`/workspace/${workspace.id}`);
  };

  const statusCounts = {
    total: productionItems.length,
    pending: productionItems.filter((i) => i.status === "pending" || i.status === "ready").length,
    in_progress: productionItems.filter((i) => i.status === "in_progress" || i.status === "recorded").length,
    completed: productionItems.filter((i) => i.status === "uploaded" || i.status === "approved").length,
    approved: productionItems.filter((i) => i.status === "approved").length,
  };

  const progress = statusCounts.total > 0 ? (statusCounts.completed / statusCounts.total) * 100 : 0;

  const filteredItems = productionItems.filter((item) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return item.status === "pending" || item.status === "ready";
    if (filterStatus === "in_progress") return item.status === "in_progress" || item.status === "recorded";
    if (filterStatus === "completed") return item.status === "uploaded" || item.status === "approved";
    return item.status === filterStatus;
  });

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
            <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Production Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Working on: {statusCounts.total} concepts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Concepts</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Overall Progress</h3>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}% Complete</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500/10 text-purple-600">
                    ✓ {statusCounts.approved} Ready
                  </Badge>
                  <Badge className="bg-blue-500/10 text-blue-600">
                    🎬 {statusCounts.in_progress} In Progress
                  </Badge>
                  <Badge className="bg-muted text-muted-foreground">
                    ⏳ {statusCounts.pending} Pending
                  </Badge>
                </div>
                <Button
                  onClick={handleBuildCampaign}
                  disabled={statusCounts.approved < 3}
                  size="sm"
                >
                  Build Campaign ({statusCounts.approved}/3+)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Concept Cards Grid */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No concepts match this filter. Try selecting a different status.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <ProductionCard key={item.id} item={item} onClick={() => handleCardClick(item)} />
            ))}
          </div>
        )}

        {/* Production Workflow Modal */}
        {selectedItem && (
          <ProductionWorkflow
            item={selectedItem}
            workspace={workspace}
            open={workflowOpen}
            onClose={() => {
              setWorkflowOpen(false);
              setSelectedItem(null);
            }}
            onUpdate={handleWorkspaceUpdate}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
