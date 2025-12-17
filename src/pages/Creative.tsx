import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sparkles, Rocket, Clipboard, Upload, Grid3X3, ArrowLeft, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { CampaignFlowBreadcrumb } from "@/components/CampaignFlowBreadcrumb";
import { LumiLoader } from "@/components/LumiLoader";
import { GeneratingModal } from "@/components/GeneratingModal";
import { AngleSelector, CreativeAngle } from "@/components/creative/AngleSelector";
import { CreativeGrid } from "@/components/creative/CreativeGrid";
import { CreativeCellData } from "@/components/creative/CreativeCell";
import { BulkUploader, UploadedAsset } from "@/components/creative/BulkUploader";
import { ProductionChecklistPanel, ProductionItem } from "@/components/creative/ProductionChecklistPanel";
import { cn } from "@/lib/utils";

type DashboardStep = "select_angles" | "creative_grid";
type GeneratingPhase = "angles" | "grid" | null;

const angleGenerationSteps = [
  "Analyzing your brand strategy...",
  "Identifying creative opportunities...",
  "Exploring psychological triggers...",
  "Crafting unique angles...",
  "Building your options..."
];

const gridGenerationSteps = [
  "Preparing your selected angles...",
  "Creating attention-grabbing hooks...",
  "Designing trust-building ideas...",
  "Developing action-driving concepts...",
  "Organizing your creative grid..."
];

export default function Creative() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState<GeneratingPhase>(null);
  const [brand, setBrand] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [workspace, setWorkspace] = useState<any>(null);
  
  // Creative state
  const [dashboardStep, setDashboardStep] = useState<DashboardStep>("select_angles");
  const [availableAngles, setAvailableAngles] = useState<CreativeAngle[]>([]);
  const [selectedAngleIds, setSelectedAngleIds] = useState<string[]>([]);
  const [activeAngleId, setActiveAngleId] = useState<string>("");
  const [gridData, setGridData] = useState<CreativeCellData[]>([]);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [activeTab, setActiveTab] = useState<string>("grid");

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

      const { data: campaignsData } = await supabase
        .from("campaign_workspaces")
        .select("id, name, progress_status, offer_name, updated_at, creative_json")
        .eq("brand_id", brandData.id)
        .order("updated_at", { ascending: false });

      if (campaignsData && campaignsData.length > 0) {
        const filteredCampaigns = await Promise.all(
          campaignsData.map(async (campaign) => {
            if (!campaign.offer_name) return campaign;
            
            const { data: offer } = await supabase
              .from('offers')
              .select('archived')
              .eq('brand_id', brandData.id)
              .eq('name', campaign.offer_name)
              .maybeSingle();
            
            if (!offer || !offer.archived || ['live', 'completed'].includes(campaign.progress_status)) {
              return campaign;
            }
            return null;
          })
        );

        setCampaigns(filteredCampaigns.filter(Boolean) as any[]);
        
        if (filteredCampaigns[0]) {
          await handleCampaignSelect(filteredCampaigns[0].id);
        }
      } else {
        setCampaigns([]);
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
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*, brands(*)")
        .eq("id", campaignId)
        .single();

      if (error) throw error;
      setWorkspace(data);
      
      // Load existing creative data if available
      const creativeData = data.creative_json as Record<string, any> | null;
      if (creativeData?.angles) {
        const angles = creativeData.angles as CreativeAngle[];
        setAvailableAngles(angles);
        setSelectedAngleIds(creativeData.selectedAngleIds || []);
        
        // Normalize gridData angleIds (fix for old data where angleId was set to name instead of id)
        let gridDataNormalized = creativeData.gridData || [];
        if (gridDataNormalized.length > 0) {
          const angleIdMap = new Map<string, string>();
          angles.forEach(a => {
            angleIdMap.set(a.name.toLowerCase(), a.id);
            angleIdMap.set(a.id.toLowerCase(), a.id);
          });
          gridDataNormalized = gridDataNormalized.map((cell: any) => {
            const lookupKey = (cell.angleId || "").toLowerCase();
            const correctedId = angleIdMap.get(lookupKey);
            return correctedId ? { ...cell, angleId: correctedId } : cell;
          });
        }
        
        setGridData(gridDataNormalized);
        setProductionItems(creativeData.productionItems || []);
        setDashboardStep(gridDataNormalized.length > 0 ? "creative_grid" : "select_angles");
        if (creativeData.selectedAngleIds?.length > 0) {
          setActiveAngleId(creativeData.selectedAngleIds[0]);
        }
      } else {
        // Reset state for new campaign
        setAvailableAngles([]);
        setSelectedAngleIds([]);
        setGridData([]);
        setProductionItems([]);
        setDashboardStep("select_angles");
        setActiveAngleId("");
      }
    } catch (error: any) {
      console.error("Error loading campaign:", error);
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  const generateAngles = async () => {
    if (!workspace) return;

    if (!workspace.strategy_json) {
      toast.error("Please complete your campaign strategy in the Planner first.");
      return;
    }

    setGenerating(true);
    setGeneratingPhase("angles");
    try {
      const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
        body: {
          brandName: workspace.brands?.name || workspace.name,
          strategyData: workspace.strategy_json,
          audiencePsychology: workspace.brands?.audience_psychology,
          offerData: {
            name: workspace.offer_name,
            description: workspace.offer_description,
            price: workspace.offer_price,
          }
        }
      });

      if (error) throw error;

      setAvailableAngles(data.angles);
      
      // Save angles to workspace
      await saveCreativeState({ angles: data.angles });
      
      toast.success("Creative angles ready!");
    } catch (error: any) {
      console.error("Error generating angles:", error);
      if (error.message?.includes("429")) toast.error("Rate limit exceeded. Please wait a moment.");
      else if (error.message?.includes("402")) toast.error("AI credits depleted. Please add credits in Settings.");
      else toast.error(error.message || "Failed to generate angles");
    } finally {
      setGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const generateCreativeGrid = async () => {
    if (selectedAngleIds.length < 3) {
      toast.error("Please select at least 3 angles");
      return;
    }

    setGenerating(true);
    setGeneratingPhase("grid");
    try {
      const selectedAngles = availableAngles.filter(a => selectedAngleIds.includes(a.id));
      
      const { data, error } = await supabase.functions.invoke('generate-creative-grid', {
        body: {
          angles: selectedAngles,
          brandName: workspace.brands?.name || workspace.name,
          strategyData: workspace.strategy_json,
          audiencePsychology: workspace.brands?.audience_psychology,
          offerData: {
            name: workspace.offer_name,
            description: workspace.offer_description,
            price: workspace.offer_price,
          }
        }
      });

      if (error) throw error;

      setGridData(data.grid);
      setActiveAngleId(selectedAngleIds[0]);
      setDashboardStep("creative_grid");
      
      // Save to workspace
      await saveCreativeState({
        angles: availableAngles,
        selectedAngleIds,
        gridData: data.grid,
      });
      
      toast.success("Creative ideas generated!");
    } catch (error: any) {
      console.error("Error generating grid:", error);
      if (error.message?.includes("429")) toast.error("Rate limit exceeded. Please wait a moment.");
      else if (error.message?.includes("402")) toast.error("AI credits depleted. Please add credits in Settings.");
      else toast.error(error.message || "Failed to generate creative ideas");
    } finally {
      setGenerating(false);
      setGeneratingPhase(null);
    }
  };

  const saveCreativeState = async (updates: any) => {
    if (!workspace) return;
    
    const creative_json = {
      ...workspace.creative_json,
      ...updates,
    };

    await supabase
      .from("campaign_workspaces")
      .update({ 
        creative_json,
        progress_status: updates.gridData?.length > 0 ? "creative_in_progress" : workspace.progress_status 
      })
      .eq("id", workspace.id);

    setWorkspace((prev: any) => ({ ...prev, creative_json }));
  };

  const handleCellToggle = (cellId: string) => {
    setSelectedCells(prev => 
      prev.includes(cellId) 
        ? prev.filter(id => id !== cellId)
        : [...prev, cellId]
    );
  };

  const handleAddToChecklist = () => {
    const cellsToAdd = gridData.filter(cell => 
      selectedCells.includes(cell.id) && cell.angleId === activeAngleId
    );
    
    const angle = availableAngles.find(a => a.id === activeAngleId);
    
    const newItems: ProductionItem[] = cellsToAdd.map(cell => ({
      id: cell.id,
      format: cell.format,
      hook: cell.hook,
      guidance: cell.guidance,
      angleName: angle?.name || "",
      completed: false,
      assetNote: cell.format === "talking_head" ? "Record video" : 
                 cell.format === "broll" ? "Upload b-roll" : "Design graphic"
    }));

    // Avoid duplicates
    const existingIds = productionItems.map(item => item.id);
    const uniqueNewItems = newItems.filter(item => !existingIds.includes(item.id));
    
    const updatedItems = [...productionItems, ...uniqueNewItems];
    setProductionItems(updatedItems);
    setSelectedCells(prev => prev.filter(id => !cellsToAdd.find(c => c.id === id)));
    
    // Save to workspace
    saveCreativeState({ productionItems: updatedItems });
    
    toast.success(`Added ${uniqueNewItems.length} items to checklist`);
  };

  const handleAddSingleToChecklist = (cellId: string) => {
    const cell = gridData.find(c => c.id === cellId);
    if (!cell) return;
    
    // Check if already in checklist
    if (productionItems.some(item => item.id === cellId)) {
      toast.info("Already in checklist");
      return;
    }
    
    const angle = availableAngles.find(a => a.id === cell.angleId);
    
    const newItem: ProductionItem = {
      id: cell.id,
      format: cell.format,
      hook: cell.hook,
      guidance: cell.guidance,
      angleName: angle?.name || "",
      completed: false,
      assetNote: cell.format === "talking_head" ? "Record video" : 
                 cell.format === "broll" ? "Upload b-roll" : "Design graphic"
    };
    
    const updatedItems = [...productionItems, newItem];
    setProductionItems(updatedItems);
    saveCreativeState({ productionItems: updatedItems });
    
    toast.success("Added to checklist");
  };

  const handleToggleComplete = (id: string) => {
    const updatedItems = productionItems.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setProductionItems(updatedItems);
    saveCreativeState({ productionItems: updatedItems });
  };

  const handleRemoveFromChecklist = (id: string) => {
    const updatedItems = productionItems.filter(item => item.id !== id);
    setProductionItems(updatedItems);
    saveCreativeState({ productionItems: updatedItems });
  };

  const handleBulkUploadAdd = (assets: UploadedAsset[]) => {
    const newItems: ProductionItem[] = assets.map(asset => {
      const angle = availableAngles.find(a => a.id === asset.angleId);
      return {
        id: asset.id,
        format: asset.format,
        hook: asset.file.name,
        guidance: "Uploaded asset - ready to use",
        angleName: angle?.name || "Unassigned",
        completed: true,
        assetNote: "Asset uploaded"
      };
    });
    
    const updatedItems = [...productionItems, ...newItems];
    setProductionItems(updatedItems);
    saveCreativeState({ productionItems: updatedItems });
    
    toast.success(`Added ${assets.length} uploaded assets to checklist`);
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

  const selectedAngles = availableAngles.filter(a => selectedAngleIds.includes(a.id));

  if (loading && campaigns.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <LumiLoader size="lg" message="Loading Creative Studio..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <GeneratingModal 
        isOpen={generating}
        title={generatingPhase === "angles" ? "Discovering creative angles..." : "Building your creative ideas..."}
        steps={generatingPhase === "angles" ? angleGenerationSteps : gridGenerationSteps}
      />
      
      <CampaignFlowBreadcrumb 
        currentStep="creative" 
        campaignId={selectedCampaignId}
        progressStatus={workspace?.progress_status}
      />
      
      <div className="flex h-[calc(100vh-4rem-53px)] w-full overflow-hidden">
        {!workspace ? (
          <div className="flex-1 flex flex-col">
            {/* Campaign Selector for empty state */}
            <div className="border-b border-border bg-background/95 backdrop-blur-sm p-4">
              <Label htmlFor="campaign-select-empty" className="text-sm font-medium mb-2 block">
                Select Campaign
              </Label>
              <Select value={selectedCampaignId} onValueChange={handleCampaignSelect}>
                <SelectTrigger id="campaign-select-empty" className="w-full text-left">
                  <SelectValue placeholder={campaigns.length === 0 ? "Start with the ad planner" : "Choose a campaign..."} />
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
                          <span className="font-medium text-sm truncate">{campaign.name}</span>
                          {campaign.offer_name && (
                            <span className="text-xs text-muted-foreground truncate">{campaign.offer_name}</span>
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
                    {campaigns.length === 0 ? "Ready to create?" : "Select a Campaign"}
                  </CardTitle>
                  <CardDescription>
                    {campaigns.length === 0
                      ? "Start by creating your first campaign in the Planner. Once you've got a strategy, you'll generate creative ideas here."
                      : "Choose a campaign from the dropdown above to start creating."}
                  </CardDescription>
                </CardHeader>
                {campaigns.length === 0 && (
                  <CardContent className="flex justify-center pb-6">
                    <Button onClick={() => navigate("/planning")} size="lg" variant="lumi">
                      <Rocket className="mr-2 h-4 w-4" />
                      Go to Planner
                    </Button>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="border-b border-border bg-background/95 backdrop-blur-sm p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Select value={selectedCampaignId} onValueChange={handleCampaignSelect}>
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
                                <span className="text-xs text-muted-foreground">{campaign.offer_name}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {dashboardStep === "creative_grid" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Change Angles Button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Change Angles</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Change creative angles?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Going back will let you select different angles. Your current creative grid will be regenerated with the new selection.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => setDashboardStep("select_angles")}>
                              Change Angles
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* View Toggle with active indicator */}
                      <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setActiveTab("grid")}
                          className={cn(
                            "gap-2 h-8 px-3 rounded-md transition-all",
                            activeTab === "grid" 
                              ? "bg-background shadow-sm text-foreground" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Grid3X3 className="h-4 w-4" />
                          <span className="hidden sm:inline">Grid</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setActiveTab("upload")}
                          className={cn(
                            "gap-2 h-8 px-3 rounded-md transition-all",
                            activeTab === "upload" 
                              ? "bg-background shadow-sm text-foreground" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Upload className="h-4 w-4" />
                          <span className="hidden sm:inline">Upload</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      {progressLabels[workspace.progress_status] || workspace.progress_status}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-auto p-6">
                {availableAngles.length === 0 ? (
                  /* Initial state - generate angles */
                  <div className="h-full flex items-center justify-center">
                    <Card className="max-w-xl border-2 shadow-lg rounded-2xl">
                      <CardHeader className="text-center space-y-3">
                        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                          <Sparkles className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <CardTitle className="text-2xl font-display">Creative Studio</CardTitle>
                        <CardDescription className="text-base">
                          Ready to create! Lumi will generate creative angles based on your strategy, then you'll choose which ones to develop.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-center pb-8">
                        <Button 
                          onClick={generateAngles} 
                          disabled={generating}
                          size="lg"
                          variant="default"
                        >
                          {generating ? (
                            <>
                              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                              Generating angles...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate Creative Angles
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : dashboardStep === "select_angles" ? (
                  /* Step 1: Angle Selection */
                  <AngleSelector
                    angles={availableAngles}
                    selectedAngles={selectedAngleIds}
                    onSelectionChange={setSelectedAngleIds}
                    onContinue={generateCreativeGrid}
                    isGenerating={generating}
                  />
                ) : (
                  /* Step 2+: Creative Grid & Upload */
                  activeTab === "grid" ? (
                    <CreativeGrid
                      angles={selectedAngles}
                      activeAngleId={activeAngleId}
                      onAngleChange={setActiveAngleId}
                      gridData={gridData}
                      selectedCells={selectedCells}
                      onCellToggle={handleCellToggle}
                      onAddToChecklist={handleAddToChecklist}
                      onAddSingleToChecklist={handleAddSingleToChecklist}
                      checklistIds={productionItems.map(item => item.id)}
                    />
                  ) : (
                    <BulkUploader
                      angles={selectedAngles}
                      uploadedAssets={uploadedAssets}
                      onAssetsChange={setUploadedAssets}
                      onAddToChecklist={handleBulkUploadAdd}
                    />
                  )
                )}
              </div>
            </div>

            {/* Right Sidebar - Production Checklist (Desktop) */}
            {(dashboardStep === "creative_grid" || productionItems.length > 0) && (
              <div className="hidden lg:block w-[350px] border-l border-border bg-muted/30">
                <ProductionChecklistPanel
                  items={productionItems}
                  onToggleComplete={handleToggleComplete}
                  onRemove={handleRemoveFromChecklist}
                />
              </div>
            )}

            {/* Mobile Checklist FAB + Sheet */}
            {(dashboardStep === "creative_grid" || productionItems.length > 0) && (
              <div className="lg:hidden fixed bottom-6 right-6 z-50">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button 
                      size="lg" 
                      className="h-14 w-14 rounded-full shadow-lg relative"
                    >
                      <ClipboardList className="h-6 w-6" />
                      {productionItems.length > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                        >
                          {productionItems.length}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
                    <SheetHeader className="pb-4">
                      <SheetTitle>Production Checklist</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-auto h-[calc(80vh-80px)]">
                      <ProductionChecklistPanel
                        items={productionItems}
                        onToggleComplete={handleToggleComplete}
                        onRemove={handleRemoveFromChecklist}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
