import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Filter, Upload, Video, Image, X } from "lucide-react";
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
import { CampaignFlowBreadcrumb } from "@/components/CampaignFlowBreadcrumb";
import { cn } from "@/lib/utils";

interface UploadedAsset {
  id: string;
  file: File;
  format: "talking_head" | "broll" | "graphic";
  preview?: string;
}

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceIdParam = searchParams.get("workspace");
  
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<any>(null);
  const [productionItems, setProductionItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWorkspace();
  }, [workspaceIdParam]);

  const fetchWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      let workspaceData;

      // If workspace ID is provided in URL, fetch that specific workspace
      if (workspaceIdParam) {
        const { data, error } = await supabase
          .from("campaign_workspaces")
          .select("*")
          .eq("id", workspaceIdParam)
          .single();

        if (error) throw error;
        workspaceData = data;
      } else {
        // Otherwise, get the most recent workspace with production_items
        const { data: workspaces, error } = await supabase
          .from("campaign_workspaces")
          .select("*")
          .not("production_items", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        workspaceData = workspaces?.[0];
      }

      if (workspaceData) {
        setWorkspace(workspaceData);
        const items = Array.isArray(workspaceData.production_items) 
          ? workspaceData.production_items 
          : [];
        setProductionItems(items);
        
        // If no production items but workspace exists, show helpful message
        if (items.length === 0) {
          toast.info("No production items yet. Send concepts to production from the Creative dashboard.");
        }
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
    navigate(`/campaigns/build?workspace=${workspace.id}`);
  };

  // Bulk upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    processFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFiles = (files: File[]) => {
    const newAssets: UploadedAsset[] = files.map((file) => {
      const isVideo = file.type.startsWith("video/");
      return {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        format: isVideo ? "broll" : "graphic",
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
    });
    setUploadedAssets(prev => [...prev, ...newAssets]);
  };

  const updateAssetFormat = (id: string, format: "talking_head" | "broll" | "graphic") => {
    setUploadedAssets(prev => prev.map(a => a.id === id ? { ...a, format } : a));
  };

  const removeAsset = (id: string) => {
    const asset = uploadedAssets.find(a => a.id === id);
    if (asset?.preview) URL.revokeObjectURL(asset.preview);
    setUploadedAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleAddUploadsToProduction = async () => {
    const newItems = uploadedAssets.map(asset => ({
      id: asset.id,
      hook: asset.file.name,
      format: asset.format,
      guidance: "Uploaded asset",
      angleName: "Direct Upload",
      status: "uploaded",
      notes: "",
    }));

    const updatedItems = [...productionItems, ...newItems];
    
    await supabase
      .from("campaign_workspaces")
      .update({ production_items: updatedItems })
      .eq("id", workspace.id);

    setProductionItems(updatedItems);
    setUploadedAssets([]);
    toast.success(`Added ${newItems.length} assets to production`);
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
      <CampaignFlowBreadcrumb 
        currentStep="production" 
        campaignId={workspace?.id}
        progressStatus={workspace?.progress_status}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                <span className="text-gradient-lumi">Production</span> Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                {workspace.name} • {statusCounts.total} concepts
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
        <Card variant="gradient">
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
                  variant="lumi"
                >
                  Build Campaign ({statusCounts.approved}/3+)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Upload Section */}
        <Card
          variant="glow"
          className={cn(
            "border-2 border-dashed transition-all duration-300 cursor-pointer",
            isDragging && "border-primary bg-gradient-to-br from-lumi-purple-1/5 to-lumi-pink-1/5 shadow-glow"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Upload className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-medium">Drop files here or click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload videos and images directly to production
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </CardContent>
        </Card>

        {/* Uploaded assets pending */}
        {uploadedAssets.length > 0 && (
          <Card variant="glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{uploadedAssets.length} files ready to add</h3>
                <Button onClick={handleAddUploadsToProduction} size="sm" variant="lumi">
                  Add All to Production
                </Button>
              </div>
              <div className="space-y-3">
                {uploadedAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {asset.preview ? (
                        <img src={asset.preview} alt="" className="w-full h-full object-cover" />
                      ) : asset.file.type.startsWith("video/") ? (
                        <Video className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Image className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{asset.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(asset.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <Select
                      value={asset.format}
                      onValueChange={(v) => updateAssetFormat(asset.id, v as any)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="talking_head">Talking Head</SelectItem>
                        <SelectItem value="broll">B-Roll</SelectItem>
                        <SelectItem value="graphic">Graphic</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State for no production items */}
        {productionItems.length === 0 ? (
          <Card variant="glow" className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No concepts in production yet. Send concepts from the Creative dashboard to start producing.
              </p>
              <Button onClick={() => navigate("/creative")} variant="lumi">
                Go to Creative Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
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
