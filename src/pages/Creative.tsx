import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sparkles, Rocket, Clipboard, Grid3X3, ArrowLeft, ClipboardList, FileText, Lightbulb, Check } from "lucide-react";
import { AngleCopyNav } from "@/components/creative/AngleCopyNav";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { LumiLoader } from "@/components/LumiLoader";
import { GeneratingModal } from "@/components/GeneratingModal";
import { AngleSelector, CreativeAngle } from "@/components/creative/AngleSelector";
import { CreativeGrid } from "@/components/creative/CreativeGrid";
import { CreativeCellData } from "@/components/creative/CreativeCell";
import { ProductionChecklistPanel, ProductionItem } from "@/components/creative/ProductionChecklistPanel";
import { CopyPreview } from "@/components/creative/CopyPreview";
import { LumiChat } from "@/components/LumiChat";
import { cn } from "@/lib/utils";

type DashboardStep = "select_angles" | "creative_grid";
type CreativeTab = "copy" | "ideas"; // Copy first, then creative
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState<GeneratingPhase>(null);
  const [regeneratingCellId, setRegeneratingCellId] = useState<string | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [workspace, setWorkspace] = useState<any>(null);
  
  // URL parameters for add-creative mode
  const urlWorkspaceId = searchParams.get("workspace");
  const isAddCreativeMode = searchParams.get("addCreative") === "true";
  const [showLumiChat, setShowLumiChat] = useState(false);
  
  // Proactive Lumi chat after first angle generation
  const [showAngleFeedbackChat, setShowAngleFeedbackChat] = useState(false);
  
  // Creative state
  const [dashboardStep, setDashboardStep] = useState<DashboardStep>("select_angles");
  const [creativeTab, setCreativeTab] = useState<CreativeTab>("copy"); // Default to copy first
  const [availableAngles, setAvailableAngles] = useState<CreativeAngle[]>([]);
  const [selectedAngleIds, setSelectedAngleIds] = useState<string[]>([]);
  const [activeAngleId, setActiveAngleId] = useState<string>("");
  const [gridData, setGridData] = useState<CreativeCellData[]>([]);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [angleCopy, setAngleCopy] = useState<Record<string, any>>({});
  const [regeneratingCopy, setRegeneratingCopy] = useState(false);
  const [copySelections, setCopySelections] = useState<Record<string, { headlines: number[]; descriptions: number[]; primary_copy: number[] }>>({});

  // Lumi contextual recommendations
  const { setRecommendation } = useLumiAssistant();

  useEffect(() => {
    fetchInitialData();
  }, []);
  
  // Show Lumi chat when in add-creative mode
  useEffect(() => {
    if (isAddCreativeMode && !loading && workspace) {
      setShowLumiChat(true);
    }
  }, [isAddCreativeMode, loading, workspace]);

  // Contextual recommendations based on workflow state
  useEffect(() => {
    if (loading) return;
    
    if (productionItems.length >= 3) {
      setRecommendation({
        id: "creative-production-ready",
        title: "Ready for Production!",
        message: `You've got ${productionItems.length} concepts queued up. Time to record and bring them to life!`,
        actionLabel: "Go to Production",
        onAction: () => navigate("/production"),
      });
    } else if (gridData.length > 0 && productionItems.length === 0) {
      setRecommendation({
        id: "creative-add-to-checklist",
        title: "Love What You See?",
        message: "Click the ✓ on any concept to add it to your production checklist. Aim for at least 3!",
      });
    } else if (availableAngles.length > 0 && selectedAngleIds.length < 3) {
      setRecommendation({
        id: "creative-select-angles",
        title: "Pick Your Angles",
        message: "Select at least 3 creative angles to generate your unique ad concepts.",
      });
    } else if (workspace && !availableAngles.length) {
      setRecommendation({
        id: "creative-generate-angles",
        title: "Let's Get Creative!",
        message: "Click 'Generate Creative Angles' to discover unique ways to position your offer.",
      });
    }
  }, [loading, productionItems.length, gridData.length, availableAngles.length, selectedAngleIds.length, workspace, setRecommendation, navigate]);

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
        
        // If workspace ID is in URL, select that campaign; otherwise select first
        const targetCampaignId = urlWorkspaceId || filteredCampaigns[0]?.id;
        if (targetCampaignId) {
          await handleCampaignSelect(targetCampaignId);
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
        setAngleCopy(creativeData.angle_copy || {});
        setCopySelections(creativeData.copy_selections || {});
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
        setAngleCopy({});
        setCopySelections({});
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

    // Check for strategy_json - either from planner or from linked offer (imported campaign)
    if (!workspace.strategy_json) {
      // Check if this is an imported campaign that needs an offer linked
      const isImportedCampaign = workspace.progress_status === 'imported' || 
        (workspace.meta_campaign_ids && !workspace.template_id);
      
      if (isImportedCampaign) {
        toast.error("Please link an offer to this campaign first. Go to Data dashboard to link an offer.");
      } else {
        toast.error("Please complete your campaign strategy in the Planner first.");
      }
      return;
    }

    setGenerating(true);
    setGeneratingPhase("angles");
    try {
      // Get existing conversation insights if any
      const existingInsights = workspace.creative_json?.conversationInsights || [];
      
      // For imported campaigns, the strategy_json contains the offer data
      const strategyData = workspace.strategy_json;
      const isImportedCampaign = strategyData?.source === 'imported_campaign';
      
      // Use offer data from strategy_json for imported campaigns
      const offerData = isImportedCampaign && strategyData?.offer 
        ? {
            name: strategyData.offer.name,
            description: strategyData.offer.description,
            price: strategyData.offer.price,
            product_psychology: strategyData.offer.product_psychology,
          }
        : {
            name: workspace.offer_name,
            description: workspace.offer_description,
            price: workspace.offer_price,
          };
      
      const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
        body: {
          brandName: workspace.brands?.name || workspace.name,
          strategyData: strategyData,
          audiencePsychology: isImportedCampaign 
            ? strategyData?.audience_psychology 
            : workspace.brands?.audience_psychology,
          offerData,
          conversationInsights: existingInsights,
          isImportedCampaign,
        }
      });

      if (error) throw error;

      setAvailableAngles(data.angles);
      
      // Save angles to workspace
      await saveCreativeState({ angles: data.angles });
      
      toast.success("Creative angles ready!");
      
      // Trigger proactive Lumi chat for angle feedback
      setShowAngleFeedbackChat(true);
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
      
      // Generate angle-level copy in background (don't block UI)
      generateAngleCopy(selectedAngles).catch(err => {
        console.error("Background copy generation failed:", err);
      });
      
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

  // Generate copy variations for all selected angles (runs in background)
  const generateAngleCopy = async (angles: CreativeAngle[]) => {
    if (!workspace) return;
    
    try {
      // Fetch offer data for copy generation
      let offerData = null;
      if (workspace.offer_id) {
        const { data } = await supabase
          .from('offers')
          .select('name, description, price_point, target_outcome, product_psychology, messaging_guidelines')
          .eq('id', workspace.offer_id)
          .single();
        offerData = data;
      }

      const { data, error } = await supabase.functions.invoke('generate-angle-copy', {
        body: {
          angles,
          brandInfo: {
            name: workspace.brands?.name,
            brand_voice: workspace.brands?.brand_voice,
          },
          offerData: offerData || {
            name: workspace.offer_name,
            description: workspace.offer_description,
            price_point: workspace.offer_price,
          },
          audiencePsychology: workspace.brands?.audience_psychology,
        }
      });

      if (error) throw error;

      // Update local state
      setAngleCopy(data.angle_copy);
      
      // Save angle copy to workspace
      await saveCreativeState({ angle_copy: data.angle_copy });
      console.log("Angle copy generated successfully");
    } catch (err: any) {
      console.error("Failed to generate angle copy:", err);
      // Don't show error toast - this is background work
    }
  };

  // Regenerate copy for a single angle (user-triggered)
  const regenerateAngleCopy = async (angleId: string) => {
    if (!workspace) return;
    
    setRegeneratingCopy(true);
    try {
      const angle = availableAngles.find(a => a.id === angleId);
      if (!angle) throw new Error("Angle not found");

      // Fetch offer data for copy generation
      let offerData = null;
      if (workspace.offer_id) {
        const { data } = await supabase
          .from('offers')
          .select('name, description, price_point, target_outcome, product_psychology, messaging_guidelines')
          .eq('id', workspace.offer_id)
          .single();
        offerData = data;
      }

      const { data, error } = await supabase.functions.invoke('generate-angle-copy', {
        body: {
          angles: [angle],
          brandInfo: {
            name: workspace.brands?.name,
            brand_voice: workspace.brands?.brand_voice,
          },
          offerData: offerData || {
            name: workspace.offer_name,
            description: workspace.offer_description,
            price_point: workspace.offer_price,
          },
          audiencePsychology: workspace.brands?.audience_psychology,
        }
      });

      if (error) throw error;

      // Merge new copy with existing
      const newAngleCopy = { ...angleCopy, ...data.angle_copy };
      setAngleCopy(newAngleCopy);
      
      // Save to workspace
      await saveCreativeState({ angle_copy: newAngleCopy });
      toast.success("Copy regenerated!");
    } catch (err: any) {
      console.error("Failed to regenerate angle copy:", err);
      if (err.message?.includes("429")) toast.error("Rate limit exceeded. Please wait a moment.");
      else if (err.message?.includes("402")) toast.error("AI credits depleted. Please add credits in Settings.");
      else toast.error(err.message || "Failed to regenerate copy");
    } finally {
      setRegeneratingCopy(false);
    }
  };

  // Handle copy selection changes
  const handleCopySelectionsChange = async (angleId: string, selections: { headlines: number[]; descriptions: number[]; primary_copy: number[] }) => {
    const newSelections = { ...copySelections, [angleId]: selections };
    setCopySelections(newSelections);
    await saveCreativeState({ copy_selections: newSelections });
  };

  // Handle inline copy edits
  const handleCopyEdit = async (angleId: string, type: "headlines" | "descriptions" | "primary_copy", index: number, newText: string) => {
    const currentAngleCopy = angleCopy[angleId];
    if (!currentAngleCopy) return;
    
    const updatedVariations = [...currentAngleCopy[type]];
    updatedVariations[index] = {
      ...updatedVariations[index],
      text: newText,
      character_count: newText.length,
    };
    
    const newAngleCopy = {
      ...angleCopy,
      [angleId]: {
        ...currentAngleCopy,
        [type]: updatedVariations,
      },
    };
    
    setAngleCopy(newAngleCopy);
    await saveCreativeState({ angle_copy: newAngleCopy });
  };

  const saveCreativeState = async (updates: any) => {
    if (!workspace) return;
    
    const creative_json = {
      ...workspace.creative_json,
      ...updates,
    };

    // Transform productionItems to production_items format for Production page
    const productionItemsForDb = updates.productionItems?.map((item: ProductionItem) => ({
      id: item.id,
      hook: item.hook,
      format: item.format,
      guidance: item.guidance,
      angleName: item.angleName,
      status: item.completed ? "approved" : "ready",
      notes: item.assetNote || "",
    })) || (workspace.production_items as any[]) || [];

    await supabase
      .from("campaign_workspaces")
      .update({ 
        creative_json,
        production_items: productionItemsForDb,
        progress_status: updates.gridData?.length > 0 ? "creative_in_progress" : workspace.progress_status 
      })
      .eq("id", workspace.id);

    setWorkspace((prev: any) => ({ ...prev, creative_json, production_items: productionItemsForDb }));
  };

  const triggerMilestoneConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#ec4899', '#f59e0b'],
    });
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
    
    // Milestone celebration when reaching 3 items
    if (productionItems.length < 3 && updatedItems.length >= 3) {
      triggerMilestoneConfetti();
      toast.success("🎉 Nice! You have enough concepts to start production", {
        description: "You can now go to Production to record and upload assets.",
        duration: 5000,
      });
    } else {
      toast.success(`Added ${uniqueNewItems.length} items to checklist`);
    }
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
    
    // Milestone celebration when reaching 3 items
    if (productionItems.length < 3 && updatedItems.length >= 3) {
      triggerMilestoneConfetti();
      toast.success("🎉 Nice! You have enough concepts to start production", {
        description: "You can now go to Production to record and upload assets.",
        duration: 5000,
      });
    } else {
      toast.success("Added to checklist");
    }
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
  const handleRegenerateCell = async (cellId: string) => {
    const cell = gridData.find(c => c.id === cellId);
    if (!cell) return;
    
    const angle = availableAngles.find(a => a.id === cell.angleId);
    if (!angle) {
      toast.error("Angle not found for this cell");
      return;
    }

    setRegeneratingCellId(cellId);
    
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-creative-cell', {
        body: {
          cell,
          angle,
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

      // Update the cell in gridData
      const updatedGridData = gridData.map(c => 
        c.id === cellId ? data.cell : c
      );
      setGridData(updatedGridData);
      
      // Save to workspace
      await saveCreativeState({ gridData: updatedGridData });
      
      toast.success("Fresh idea generated!");
    } catch (error: any) {
      console.error("Error regenerating cell:", error);
      if (error.message?.includes("429")) {
        toast.error("Rate limit exceeded. Please wait a moment.");
      } else if (error.message?.includes("402")) {
        toast.error("AI credits depleted. Please add credits in Settings.");
      } else {
        toast.error(error.message || "Failed to regenerate idea");
      }
    } finally {
      setRegeneratingCellId(null);
    }
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
              <Card variant="gradient" className="max-w-md">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-lumi-purple-1/20 to-lumi-pink-1/20 flex items-center justify-center">
                    <Clipboard className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-gradient-lumi">
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
              <div className="border-b border-border bg-background/95 backdrop-blur-sm p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Select value={selectedCampaignId} onValueChange={handleCampaignSelect}>
                      <SelectTrigger className="w-auto border-0 p-0 h-auto hover:bg-transparent focus:ring-0 shadow-none gap-2 max-w-[200px] sm:max-w-none">
                        <div className="flex flex-col items-start gap-0.5 sm:gap-1 text-left">
                          <h1 className="text-lg sm:text-2xl font-bold truncate">{workspace.name}</h1>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
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
                          <Button variant="ghost" size="sm" className="gap-2 min-h-[44px]">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Change Angles</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg mx-4">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-lg">Change creative angles?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              Going back will let you select different angles. Your current grid will be regenerated.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                            <AlertDialogAction className="min-h-[44px]" onClick={() => setDashboardStep("select_angles")}>
                              Change Angles
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {progressLabels[workspace.progress_status] || workspace.progress_status}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-auto p-3 sm:p-6">
                {availableAngles.length === 0 ? (
                  /* Initial state - generate angles */
                  <div className="h-full flex items-center justify-center">
                    <Card className="max-w-xl border-2 shadow-lg rounded-2xl mx-3">
                      <CardHeader className="text-center space-y-2 sm:space-y-3 px-4 sm:px-6">
                        <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                          <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                        </div>
                        <CardTitle className="text-xl sm:text-2xl font-display">Creative Studio</CardTitle>
                        <CardDescription className="text-sm sm:text-base">
                          Lumi will generate creative angles based on your strategy.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-center pb-6 sm:pb-8 px-4 sm:px-6">
                        <Button 
                          onClick={generateAngles} 
                          disabled={generating}
                          size="lg"
                          variant="default"
                          className="min-h-[44px] w-full sm:w-auto"
                        >
                          {generating ? (
                            <>
                              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate Angles
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
                  /* Step 2+: Creative Grid with Tabs */
                  <div className="space-y-4">
                    {/* Angle Navigation - Above Tabs */}
                    <div className="flex flex-col items-center">
                      <AngleCopyNav
                        angles={selectedAngles}
                        activeAngleId={activeAngleId}
                        onAngleChange={setActiveAngleId}
                        selections={copySelections}
                        angleCopy={angleCopy}
                        creativeSelections={
                          // Build creative selections per angle from production items
                          selectedAngles.reduce((acc, angle) => {
                            acc[angle.id] = productionItems
                              .filter(item => item.angleName === angle.name)
                              .map(item => item.id);
                            return acc;
                          }, {} as Record<string, string[]>)
                        }
                        currentTab={creativeTab}
                      />
                    </div>

                    {/* Toggle between Copy and Creative with progress */}
                    <div className="flex justify-center mb-4">
                      <div className="inline-flex items-center bg-muted rounded-full p-1 relative">
                        {/* Step indicators */}
                        <div className="absolute -top-6 left-0 right-0 flex justify-center gap-6 text-[10px] text-muted-foreground">
                          <span className={cn(
                            "transition-colors",
                            creativeTab === "copy" && "text-primary font-medium"
                          )}>Step 1</span>
                          <span className={cn(
                            "transition-colors",
                            creativeTab === "ideas" && "text-primary font-medium"
                          )}>Step 2</span>
                        </div>
                        
                        <button
                          onClick={() => setCreativeTab("copy")}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                            creativeTab === "copy"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <FileText className="h-4 w-4" />
                          Copy
                          {(() => {
                            const angleSel = copySelections[activeAngleId];
                            const count = angleSel 
                              ? (angleSel.headlines?.length || 0) + (angleSel.descriptions?.length || 0) + (angleSel.primary_copy?.length || 0)
                              : 0;
                            return count > 0 ? (
                              <Badge variant="secondary" className="h-5 px-1.5 text-xs gap-0.5 bg-green-500/20 text-green-700">
                                <Check className="h-3 w-3" />
                              </Badge>
                            ) : null;
                          })()}
                        </button>
                        <button
                          onClick={() => setCreativeTab("ideas")}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                            creativeTab === "ideas"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Lightbulb className="h-4 w-4" />
                          Creative
                          {(() => {
                            const activeAngle = selectedAngles.find(a => a.id === activeAngleId);
                            const count = activeAngle 
                              ? productionItems.filter(item => item.angleName === activeAngle.name).length 
                              : 0;
                            return count > 0 ? (
                              <Badge variant="secondary" className="h-5 px-1.5 text-xs gap-0.5 bg-green-500/20 text-green-700">
                                <Check className="h-3 w-3" />
                              </Badge>
                            ) : null;
                          })()}
                        </button>
                      </div>
                    </div>

                    {creativeTab === "ideas" ? (
                      <CreativeGrid
                        angles={selectedAngles}
                        activeAngleId={activeAngleId}
                        onAngleChange={setActiveAngleId}
                        gridData={gridData}
                        selectedCells={selectedCells}
                        onCellToggle={handleCellToggle}
                        onAddToChecklist={handleAddToChecklist}
                        onAddSingleToChecklist={handleAddSingleToChecklist}
                        onRegenerateCell={handleRegenerateCell}
                        checklistIds={productionItems.map(item => item.id)}
                        regeneratingCellId={regeneratingCellId}
                        hideAngleNav={true}
                      />
                    ) : (
                      <CopyPreview
                        angles={selectedAngles}
                        activeAngleId={activeAngleId}
                        onAngleChange={setActiveAngleId}
                        angleCopy={angleCopy}
                        onRegenerateAngleCopy={regenerateAngleCopy}
                        isRegenerating={regeneratingCopy}
                        selections={copySelections}
                        onSelectionsChange={handleCopySelectionsChange}
                        onCopyEdit={handleCopyEdit}
                        hideAngleNav={true}
                      />
                    )}
                  </div>
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
                  workspaceId={workspace?.id}
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
                        workspaceId={workspace?.id}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Lumi Chat for add-creative mode */}
      {showLumiChat && brand && workspace && (
        <LumiChat 
          context="add-creative" 
          brand={brand}
          workspace={workspace}
          trigger={null}
          autoOpen={true}
          onOpenChange={(open) => {
            if (!open) {
              setShowLumiChat(false);
              // Clear URL params when closing
              if (isAddCreativeMode) {
                searchParams.delete("addCreative");
                setSearchParams(searchParams);
              }
            }
          }}
          customStarters={
            workspace.strategy_json
              ? [
                  { label: "Upload my creative", message: `I have new creative ready for "${workspace.name}". Walk me through the upload process.` },
                  { label: "Brainstorm new angles", message: `Help me come up with fresh creative angles for "${workspace.offer_name || workspace.name}".` },
                  { label: "What's working?", message: "Based on my campaign, what types of creative tend to perform best?" },
                  { label: "Generate more ideas", message: "Generate additional creative concepts I can add to this campaign." },
                ]
              : [
                  { label: "Complete strategy first", message: `I want to add creative but "${workspace.name}" doesn't have a complete strategy yet. What should I do?` },
                  { label: "Go to Planning", message: "Take me to the Planning page to complete my campaign strategy." },
                  { label: "Pick different campaign", message: "Help me choose a different campaign that's ready for new creative." },
                ]
          }
        />
      )}
      
      {/* Proactive Lumi Chat after angle generation */}
      {showAngleFeedbackChat && brand && workspace && availableAngles.length > 0 && (
        <LumiChat 
          context="angle-feedback" 
          brand={brand}
          workspace={workspace}
          trigger={null}
          autoOpen={true}
          initialMessage="What do you think about these angles? Would you like to chat about your offer and audience so I can create even better angles, hooks and creative concepts?"
          generatedAngles={availableAngles}
          onOpenChange={(open) => {
            if (!open) {
              setShowAngleFeedbackChat(false);
            }
          }}
          onSaveInsights={(insights) => {
            // Save conversation insights to workspace for future creative generations
            saveCreativeState({ 
              conversationInsights: [
                ...(workspace.creative_json?.conversationInsights || []),
                insights
              ]
            });
            toast.success("Conversation insights saved for future creative");
          }}
          customStarters={[
            { label: "I love these!", message: "These angles are great! Let's build on them and create the hooks and concepts." },
            { label: "Let's refine them", message: "I'd like to chat about my offer and audience to make these angles even more powerful." },
            { label: "Different direction", message: "I want to explore a different creative direction. Let me tell you more about what I'm looking for." },
            { label: "Tell me more", message: "Can you explain why you chose these specific angles for my offer?" },
          ]}
        />
      )}
    </DashboardLayout>
  );
}
