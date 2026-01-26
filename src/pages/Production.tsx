import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Filter, Upload, Video, Image, X, ChevronDown, CheckCircle2 } from "lucide-react";
import { ProductionCard } from "@/components/ProductionCard";
import { ProductionWorkflow } from "@/components/ProductionWorkflow";
import { toast } from "sonner";
import { syncAssetsToProductionItems } from "@/lib/sync-production-assets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { cn } from "@/lib/utils";

interface UploadedAsset {
  id: string;
  file: File;
  format: "talking_head" | "broll" | "graphic";
  preview?: string;
}

interface WorkspaceOption {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
}

const LAST_WORKSPACE_KEY = "production_last_workspace_id";

export default function Production() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getEffectiveUserId } = useImpersonation();
  const workspaceIdParam = searchParams.get("workspace");
  
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<any>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const [productionItems, setProductionItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFormat, setFilterFormat] = useState("all");
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setRecommendation } = useLumiAssistant();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (workspaceIdParam && workspaceOptions.length > 0) {
      const found = workspaceOptions.find(w => w.id === workspaceIdParam);
      if (found) {
        loadWorkspace(workspaceIdParam);
      }
    }
  }, [workspaceIdParam, workspaceOptions]);

  const fetchWorkspaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch all workspaces with production_items
      const { data: workspaces, error } = await supabase
        .from("campaign_workspaces")
        .select("id, name, production_items, updated_at")
        .not("production_items", "is", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Filter to only workspaces with actual items (not empty arrays)
      const validWorkspaces = (workspaces || []).filter(w => {
        const items = Array.isArray(w.production_items) ? w.production_items : [];
        return items.length > 0;
      });

      const options: WorkspaceOption[] = validWorkspaces
        .filter(w => w.id && w.id.trim() !== '') // Ensure valid IDs
        .map(w => ({
          id: w.id,
          name: w.name || 'Untitled Workspace',
          itemCount: Array.isArray(w.production_items) ? w.production_items.length : 0,
          updatedAt: w.updated_at,
        }));

      setWorkspaceOptions(options);

      if (options.length === 0) {
        toast.info("No production items found. Go to Creative dashboard and send concepts to production.");
        setLoading(false);
        return;
      }

      // Determine which workspace to load
      let targetWorkspaceId: string | null = workspaceIdParam;

      if (!targetWorkspaceId) {
        // Check localStorage for last used workspace
        const savedId = localStorage.getItem(LAST_WORKSPACE_KEY);
        if (savedId && options.some(w => w.id === savedId)) {
          targetWorkspaceId = savedId;
        } else {
          // Default to most recent
          targetWorkspaceId = options[0].id;
        }
        // Update URL without adding to history
        setSearchParams({ workspace: targetWorkspaceId }, { replace: true });
      }

      await loadWorkspace(targetWorkspaceId);
    } catch (error: any) {
      console.error("Error fetching workspaces:", error);
      toast.error("Failed to load production workspaces");
      setLoading(false);
    }
  };

  const loadWorkspace = async (workspaceId: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    try {
      if (!silent) setLoading(true);

      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (error) throw error;

      setWorkspace(data);
      let items = Array.isArray(data.production_items) ? data.production_items : [];
      
      // Auto-sync user_uploaded_assets to production_items
      const userAssets = Array.isArray(data.user_uploaded_assets) ? data.user_uploaded_assets : [];
      const syncResult = syncAssetsToProductionItems(items as any, userAssets as any);
      
      if (syncResult.updated) {
        // Save synced items back to database
        await supabase
          .from("campaign_workspaces")
          .update({ production_items: syncResult.items })
          .eq("id", workspaceId);
        
        items = syncResult.items;
        if (!silent) {
          toast.success(`Synced ${syncResult.syncedCount} asset(s) to production items`);
        }
      }
      
      setProductionItems(items);

      // Keep the workflow dialog stable by refreshing the selected item in-place (prevents step “jumping”)
      if (workflowOpen && selectedItem?.id) {
        const freshSelected = items.find((i: any) => i.id === selectedItem.id);
        if (freshSelected) setSelectedItem(freshSelected);
      }

      // Save to localStorage
      localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId);

      if (!silent && items.length === 0) {
        toast.info("No production items yet. Send concepts to production from the Creative dashboard.");
      }
    } catch (error: any) {
      console.error("Error loading workspace:", error);
      toast.error("Failed to load workspace");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    setSearchParams({ workspace: workspaceId }, { replace: true });
    loadWorkspace(workspaceId);
  };

  const handleWorkspaceUpdate = async () => {
    if (workspace?.id) {
      // Avoid flicker/unmount while the workflow dialog is open
      await loadWorkspace(workspace.id, { silent: true });
    }
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

  const handleRemoveItem = async (itemId: string) => {
    const updatedItems = productionItems.filter(item => item.id !== itemId);
    
    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ production_items: updatedItems })
        .eq("id", workspace.id);

      if (error) throw error;

      setProductionItems(updatedItems);
      toast.success("Concept removed from production");
    } catch (error: any) {
      console.error("Error removing item:", error);
      toast.error("Failed to remove concept");
    }
  };

  // Quick approve handler for items with linked assets
  const handleQuickApprove = async (itemId: string) => {
    const item = productionItems.find(i => i.id === itemId);
    if (!item) return;

    const hasAsset = item.linkedAsset?.url || item.uploaded_asset_id;
    if (!hasAsset) {
      toast.error("Cannot approve: No asset linked to this concept");
      return;
    }

    const updatedItems = productionItems.map(i => 
      i.id === itemId ? { ...i, status: 'approved' } : i
    );

    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ production_items: updatedItems })
        .eq("id", workspace.id);

      if (error) throw error;

      setProductionItems(updatedItems);
      toast.success("Concept approved for campaign!");
    } catch (error: any) {
      console.error("Error approving item:", error);
      toast.error("Failed to approve concept");
    }
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
    // Status filter
    let statusMatch = true;
    if (filterStatus === "pending") statusMatch = item.status === "pending" || item.status === "ready";
    else if (filterStatus === "in_progress") statusMatch = item.status === "in_progress" || item.status === "recorded";
    else if (filterStatus === "completed") statusMatch = item.status === "uploaded" || item.status === "approved";
    else if (filterStatus !== "all") statusMatch = item.status === filterStatus;
    
    // Format filter
    let formatMatch = true;
    if (filterFormat !== "all") formatMatch = item.format === filterFormat;
    
    return statusMatch && formatMatch;
  });

  // Get unique formats for filter
  const availableFormats = [...new Set(productionItems.map((item) => item.format).filter(Boolean))];

  // Contextual Lumi recommendations (must be before early returns)
  const approvedCount = statusCounts.approved;
  useEffect(() => {
    if (loading || !workspace) return;
    
    if (approvedCount >= 3) {
      setRecommendation({
        id: "production-ready-to-build",
        title: "Ready to Launch!",
        message: `You have ${approvedCount} approved concepts — that's enough to build your campaign! Let's get it live.`,
        actionLabel: "Build Campaign",
        onAction: handleBuildCampaign,
      });
    } else if (statusCounts.completed > 0 && statusCounts.pending > 0) {
      setRecommendation({
        id: "production-keep-going",
        title: "Great Progress!",
        message: `${statusCounts.completed} concepts done, ${statusCounts.pending} to go. Keep the momentum!`,
      });
    } else if (statusCounts.total > 0 && statusCounts.pending === statusCounts.total) {
      setRecommendation({
        id: "production-get-started",
        title: "Time to Record!",
        message: "Your creative concepts are ready. Click any card to start recording or uploading assets.",
      });
    }
  }, [loading, workspace, approvedCount, statusCounts.completed, statusCounts.pending, statusCounts.total, setRecommendation]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center w-full max-w-sm">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))] rounded-full animate-pulse w-2/3" />
            </div>
            <p className="text-sm text-muted-foreground">Getting oriented…</p>
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => navigate("/creative")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-3xl font-bold">
                <span className="text-gradient-lumi">Production</span>
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {workspaceOptions.length > 1 ? (
                  <Select value={workspace?.id} onValueChange={handleWorkspaceChange}>
                    <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-transparent focus:ring-0 text-muted-foreground text-xs sm:text-sm font-normal gap-1 max-w-[150px] sm:max-w-none">
                      <SelectValue>{workspace.name}</SelectValue>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaceOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{option.name}</span>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {option.itemCount}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-muted-foreground text-xs sm:text-sm truncate">{workspace.name}</span>
                )}
                <span className="text-muted-foreground text-xs sm:text-sm shrink-0">• {statusCounts.total} concepts</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={filterFormat} onValueChange={setFilterFormat}>
              <SelectTrigger className="w-[120px] sm:w-[160px] min-h-[44px] shrink-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="talking_head">Talking Head</SelectItem>
                <SelectItem value="broll">B-Roll</SelectItem>
                <SelectItem value="graphic">Graphic</SelectItem>
                <SelectItem value="static">Static</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] sm:w-[160px] min-h-[44px] shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
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
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm sm:text-base">Progress</h3>
                <span className="text-xs sm:text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 sm:h-3" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-purple-500/10 text-purple-600 text-xs">
                    ✓ {statusCounts.approved}
                  </Badge>
                  <Badge className="bg-blue-500/10 text-blue-600 text-xs">
                    🎬 {statusCounts.in_progress}
                  </Badge>
                  <Badge className="bg-muted text-muted-foreground text-xs">
                    ⏳ {statusCounts.pending}
                  </Badge>
                </div>
                <Button
                  onClick={handleBuildCampaign}
                  size="sm"
                  className="min-h-[44px] w-full sm:w-auto"
                  disabled={statusCounts.approved < 3}
                  variant="lumi"
                >
                  Build ({statusCounts.approved}/3+)
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
              <ProductionCard 
                key={item.id} 
                item={item} 
                onClick={() => handleCardClick(item)} 
                onRemove={handleRemoveItem}
                onQuickApprove={handleQuickApprove}
              />
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
