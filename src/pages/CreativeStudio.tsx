import { useState, useEffect, useRef, useCallback } from "react";
import { LumiEducationCard } from "@/components/LumiEducationCard";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Target, Lightbulb, FileText, Rocket, 
  ChevronRight, CheckCircle2, Circle, Loader2,
  Sparkles, ArrowRight, Video, Film, Image, Trash2,
  X, Check, FileDown, Printer, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { LumiThinking, LumiThinkingInline } from "@/components/LumiThinking";
import { SparkleIcon } from "@/components/SparkleIcon";
import { AngleSelector, CreativeAngle } from "@/components/creative/AngleSelector";
import { CreativeBriefDocument } from "@/components/creative/CreativeBriefDocument";
import { CreativeIntelligenceCard, CreativeIntelligence } from "@/components/creative/CreativeIntelligenceCard";
import { CreativeCellData } from "@/components/creative/CreativeCell";
import { ProductionItem } from "@/components/creative/ProductionChecklistPanel";
import { ProductionManager } from "@/components/creative/ProductionManager";
import { AngleCopyEditor } from "@/components/creative/AngleCopyEditor";
 import { CreativeContextInput, CreativeContext } from "@/components/creative/CreativeContextInput";
import { CreativeStudioExplainer, useCreativeStudioExplainer } from "@/components/creative/CreativeStudioExplainer";
import { Json } from "@/integrations/supabase/types";
import { AutoSaveIndicator, SaveStatus } from "@/components/AutoSaveIndicator";
import { useBrand } from "@/contexts/BrandContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import {
   Sheet,
   SheetContent,
   SheetHeader,
   SheetTitle,
 } from "@/components/ui/sheet";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { CreativeRefreshDialog } from "@/components/creative/CreativeRefreshDialog";

type WorkflowTab = "angles" | "concepts" | "copy" | "build";

function normalizeScriptLines(input: unknown): string[] | undefined {
  if (!input) return undefined;

  const splitSentences = (text: string) => {
    // Normalize whitespace first
    const normalized = text.replace(/\s+/g, " ").trim();
    // Split while keeping punctuation
    const parts = normalized.split(/([.!?])\s+/);
    const lines: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const sentence = `${parts[i] ?? ""}${parts[i + 1] ?? ""}`.trim();
      if (sentence) lines.push(sentence);
    }
    return lines;
  };

  const splitLines = (text: string) => {
    const byNewline = text
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (byNewline.length > 1) return byNewline;
    return splitSentences(text);
  };

  // String
  if (typeof input === "string") {
    const lines = splitLines(input).filter(Boolean);
    return lines.length ? lines.slice(0, 8) : undefined;
  }

  // Array (usually string[])
  if (Array.isArray(input)) {
    const rawStrings = input.filter((v) => typeof v === "string") as string[];
    if (rawStrings.length === 0) return undefined;

    // If we got a single mega-paragraph, split it into teleprompter-friendly lines
    if (rawStrings.length === 1) {
      const one = rawStrings[0].trim();
      if (!one) return undefined;
      const lines = splitLines(one).filter(Boolean);
      return lines.length ? lines.slice(0, 8) : undefined;
    }

    // If we got multiple entries, also split any that contain newlines
    const flattened = rawStrings
      .flatMap((s) => (s.includes("\n") ? splitLines(s) : [s.trim()]))
      .map((s) => s.trim())
      .filter(Boolean);

    return flattened.length ? flattened.slice(0, 8) : undefined;
  }

  return undefined;
}

interface WorkspaceOption {
  id: string;
  name: string;
  offerName: string | null;
  hasAngles: boolean;
  hasGrid: boolean;
  productionCount: number;
}

// Lumi-approved microcopy for creative generation
const creativeGenerationCopy = [
  "This is where Lumi does the thinking.",
  "Finding the strongest angle to lead with.",
  "Lining up your creative options.",
  "Making the strategic call.",
  "Setting this up the smart way.",
  "Making this easy to execute.",
];

const formatIcons = { talking_head: Video, broll: Film, graphic: Image };
const formatLabels = { talking_head: "Talking Head", broll: "B-Roll", graphic: "Graphic" };


export default function CreativeStudio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showExplainer, closeExplainer } = useCreativeStudioExplainer();
  const { activeBrand, loading: brandLoading } = useBrand();
  
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<WorkflowTab>("angles");
  const [contentIdeas, setContentIdeas] = useState<any[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  
  const [availableAngles, setAvailableAngles] = useState<CreativeAngle[]>([]);
  const [selectedAngleIds, setSelectedAngleIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState<"angles" | "grid" | null>(null);
  
  const [activeAngleId, setActiveAngleId] = useState<string>("");
  const [gridData, setGridData] = useState<CreativeCellData[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  
  // Copy state (lifted from ProductionManager)
  const [angleCopy, setAngleCopy] = useState<Record<string, any>>({});
  const [copySaveStatus, setCopySaveStatus] = useState<SaveStatus>("idle");
  
  // Creative intelligence state
  const [creativeIntelligence, setCreativeIntelligence] = useState<CreativeIntelligence | null>(null);
  const [fetchingIntelligence, setFetchingIntelligence] = useState(false);


  // Regeneration confirmation state
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
 
  // Pre-generation context state
  const [showContextInput, setShowContextInput] = useState(false);

  // Auto-generate copy state
  const [shouldAutoGenerateCopy, setShouldAutoGenerateCopy] = useState(false);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Creative Brief state
  const [showBrief, setShowBrief] = useState(false);
  const [offerPsychology, setOfferPsychology] = useState<any>(null);
  const [offerAudiencePsychology, setOfferAudiencePsychology] = useState<any>(null);

  const urlWorkspaceId = searchParams.get("workspace");
  const isRefreshCreativeMode = searchParams.get("refreshCreative") === "true";
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);


  useEffect(() => { 
    if (!brandLoading && activeBrand) {
      // Clear all stale state when brand changes
      setWorkspaces([]);
      setSelectedWorkspaceId("");
      setWorkspace(null);
      setAvailableAngles([]);
      setSelectedAngleIds([]);
      setGridData([]);
      setProductionItems([]);
      setAngleCopy({});
      setActiveAngleId("");
      setActiveTab("angles");
      // Clear workspace URL param on brand switch to prevent cross-brand loading
      setSearchParams(p => { p.delete("workspace"); return p; }, { replace: true });
      setLoading(true);
      fetchInitialData(); 
    }
  }, [brandLoading, activeBrand?.id]);

  // Show refresh dialog when navigating from recommendations
  useEffect(() => {
    if (!loading && workspace && isRefreshCreativeMode) {
      setShowRefreshDialog(true);
    }
  }, [loading, workspace, isRefreshCreativeMode]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      // Use active brand from context instead of querying directly
      if (!activeBrand) { 
        navigate("/dashboard"); 
        return; 
      }
      
      setBrandId(activeBrand.id);

      const { data: workspacesData } = await supabase
        .from("campaign_workspaces")
        .select("id, name, offer_name, creative_json, production_items, strategy_json, archived")
        .eq("brand_id", activeBrand.id)
        .not("strategy_json", "is", null)
        .neq("archived", true)
        .order("updated_at", { ascending: false });

      const options: WorkspaceOption[] = (workspacesData || []).map(w => {
        const c = w.creative_json as Record<string, any> | null;
        const p = w.production_items as any[] | null;
        return { id: w.id, name: w.name, offerName: w.offer_name, hasAngles: !!c?.angles?.length, hasGrid: !!c?.gridData?.length, productionCount: p?.length || 0 };
      });
      setWorkspaces(options);

      // Only use URL workspace ID if it belongs to the active brand's workspaces
      const validWorkspaceIds = new Set(options.map(o => o.id));
      const targetId = (urlWorkspaceId && validWorkspaceIds.has(urlWorkspaceId)) 
        ? urlWorkspaceId 
        : options[0]?.id;
      if (targetId) await loadWorkspace(targetId);

      const { data: ideasData } = await supabase
        .from("content_ideas").select("*").eq("brand_id", activeBrand.id).order("created_at", { ascending: false }).limit(50);
      setContentIdeas(ideasData || []);
    } catch (e) { console.error(e); toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const loadWorkspace = async (id: string) => {
    setSelectedWorkspaceId(id);
    setSearchParams(p => { p.set("workspace", id); return p; }, { replace: true });
    try {
      const { data } = await supabase.from("campaign_workspaces").select("*, brands(*)").eq("id", id).single();
      
      // Guard: ensure workspace belongs to the active brand
      if (data && activeBrand && data.brand_id !== activeBrand.id) {
        console.warn(`Workspace ${id} belongs to brand ${data.brand_id}, not active brand ${activeBrand.id}. Skipping.`);
        setSearchParams(p => { p.delete("workspace"); return p; }, { replace: true });
        return;
      }
      
      setWorkspace(data);
      
      // Fetch offer psychology if workspace has an offer_id
      if (data?.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('product_psychology, offer_audience_psychology')
          .eq('id', data.offer_id)
          .single();
        setOfferPsychology(offerData?.product_psychology || null);
        setOfferAudiencePsychology(offerData?.offer_audience_psychology || null);
      } else {
        setOfferPsychology(null);
        setOfferAudiencePsychology(null);
      }
      const c = data?.creative_json as Record<string, any> | null;
      // Inject default angle if angles exist but it's missing
      const DEFAULT_ANGLE = {
        id: "direct_from_page",
        name: "Straight from Your Page",
        description: "Uses copy directly from your sales page — your offer name, description, and call-to-action as-is.",
        isDefault: true
      };
      let loadedAngles = c?.angles || [];
      if (loadedAngles.length > 0 && !loadedAngles.some((a: any) => a.id === "direct_from_page")) {
        loadedAngles = [DEFAULT_ANGLE, ...loadedAngles];
      }
      const loadedAngleIds = new Set(loadedAngles.map((a: any) => a.id));
      
      // Validate selectedAngleIds - only keep IDs that exist in available angles
      const storedSelectedIds = c?.selectedAngleIds || [];
      let validSelectedIds = storedSelectedIds.filter((id: string) => loadedAngleIds.has(id));
      // Ensure default angle is always selected if angles exist
      if (loadedAngles.length > 0 && !validSelectedIds.includes("direct_from_page")) {
        validSelectedIds = ["direct_from_page", ...validSelectedIds];
      }
      
      // Validate gridData - only keep cells whose angleId exists
      const loadedGridData = c?.gridData || [];
      const validGridData = loadedGridData.filter((cell: any) => loadedAngleIds.has(cell.angleId));
      
      setAvailableAngles(loadedAngles);
      setSelectedAngleIds(validSelectedIds);
      setGridData(validGridData);
      setActiveAngleId(validSelectedIds[0] || "");

      const loadedProductionItems = ((data?.production_items as any[]) || []).map((pi: any) => {
        const normalized = normalizeScriptLines(pi?.script_lines);
        return normalized ? { ...pi, script_lines: normalized } : pi;
      });
      setProductionItems(loadedProductionItems);

      // Load angle copy
      if (c?.angle_copy) {
        setAngleCopy(c.angle_copy);
      }
      
      // Load cached creative intelligence
      if (c?.creativeIntelligence) {
        setCreativeIntelligence(c.creativeIntelligence);
      }
      
    // ========== Smart tab selection based on progress ==========
    const hasAngles = loadedAngles.length > 0;
    const hasGridData = validGridData.length > 0;
    const hasProductionItems = loadedProductionItems.length > 0;
    const hasCopy = c?.angle_copy && Object.keys(c.angle_copy).some(
      (id: string) => c.angle_copy[id]?.headlines?.length > 0 || 
            c.angle_copy[id]?.descriptions?.length > 0 ||
            c.angle_copy[id]?.primary_copy?.length > 0
    );
    
    // Check for saved tab first
    const savedTab = c?.lastActiveTab as WorkflowTab | undefined;
    let targetTab: WorkflowTab = "angles";
    
    if (savedTab) {
      // Validate saved tab is still appropriate
      const tabIsValid = 
        savedTab === "angles" ||
        (savedTab === "concepts" && hasGridData) ||
        (savedTab === "copy" && hasProductionItems) ||
        (savedTab === "build" && hasProductionItems);
      
      if (tabIsValid) {
        targetTab = savedTab;
      }
    }
    
    // If no valid saved tab, use smart detection
    if (targetTab === "angles" && !savedTab) {
      if (hasProductionItems && hasCopy) {
        targetTab = "build";
      } else if (hasProductionItems) {
        targetTab = "copy";
      } else if (hasGridData) {
        targetTab = "concepts";
      }
    }
    
    setActiveTab(targetTab);
    // ========== End smart tab selection ==========
    
      // If there's a mismatch, clean up the stored data
      if (validSelectedIds.length !== storedSelectedIds.length || validGridData.length !== loadedGridData.length) {
        console.warn('Cleaned up stale angle references from workspace');
      }
    } catch (e) { console.error(e); }
  };

  // Save last active tab to workspace when it changes
  useEffect(() => {
    if (workspace && activeTab && activeTab !== "angles") {
      const cur = (workspace.creative_json || {}) as Record<string, any>;
      // Only save if different from current stored value
      if (cur.lastActiveTab !== activeTab) {
        supabase
          .from("campaign_workspaces")
          .update({ 
            creative_json: { ...cur, lastActiveTab: activeTab },
            updated_at: new Date().toISOString()
          })
          .eq("id", workspace.id)
          .then(() => {
            // Update local workspace state
            setWorkspace((prev: any) => ({
              ...prev,
              creative_json: { ...prev?.creative_json, lastActiveTab: activeTab }
            }));
          });
      }
    }
    // Reset auto-generate flag when leaving copy tab
    if (activeTab !== "copy") {
      setShouldAutoGenerateCopy(false);
    }
  }, [activeTab, workspace?.id]);

  // Debounced save for selectedAngleIds to ensure persistence
  const selectedAngleIdsRef = useRef(selectedAngleIds);
  selectedAngleIdsRef.current = selectedAngleIds;
  
  useEffect(() => {
    if (!workspace || availableAngles.length === 0) return;
    const timer = setTimeout(() => {
      saveCreativeState({ selectedAngleIds: selectedAngleIdsRef.current });
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedAngleIds, workspace?.id, availableAngles.length]);

  const saveCreativeState = useCallback(async (updates: any) => {
    if (!workspace) return;
    setSaveStatus("saving");
    try {
      const cur = (workspace.creative_json || {}) as Record<string, any>;
      await supabase.from("campaign_workspaces").update({ creative_json: { ...cur, ...updates }, updated_at: new Date().toISOString() }).eq("id", workspace.id);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save creative state:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [workspace]);

  const saveProductionItems = useCallback(async (items: ProductionItem[]) => {
    if (!workspace) return;
    setSaveStatus("saving");
    try {
      await supabase.from("campaign_workspaces").update({ production_items: items as unknown as Json, updated_at: new Date().toISOString() }).eq("id", workspace.id);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save production items:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [workspace]);

  const handleCopyChange = useCallback((angleId: string, copy: any) => {
    setAngleCopy(prev => ({ ...prev, [angleId]: copy }));
  }, []);

  const handleSaveCopy = useCallback(async () => {
    if (!workspace) return;
    setCopySaveStatus("saving");
    try {
      const cur = (workspace.creative_json || {}) as Record<string, any>;
      await supabase
        .from("campaign_workspaces")
        .update({
          creative_json: { ...cur, angle_copy: angleCopy },
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.id);
      setCopySaveStatus("saved");
      setTimeout(() => setCopySaveStatus("idle"), 2000);
      toast.success("Copy saved!");
    } catch (e) {
      console.error("Failed to save copy:", e);
      setCopySaveStatus("error");
      setTimeout(() => setCopySaveStatus("idle"), 3000);
      toast.error("Failed to save copy");
    }
  }, [workspace, angleCopy]);

  const handleAddCustomAngle = useCallback((newAngle: CreativeAngle) => {
    setAvailableAngles(prev => [...prev, newAngle]);
    // Persist immediately
    saveCreativeState({ angles: [...availableAngles, newAngle] });
  }, [availableAngles, saveCreativeState]);

  const handleRegenerateClick = () => {
    // If user has downstream progress, show confirmation dialog
    if (gridData.length > 0 || productionItems.length > 0) {
      setShowRegenerateConfirm(true);
      return;
    }
    generateAngles();
  };

   // Fetch creative intelligence from past ad performance
   const fetchCreativeIntelligence = async (): Promise<CreativeIntelligence | null> => {
     if (!workspace?.brands?.meta_account_id || !brandId) return null;
     
     // Check if we already have cached intelligence for this workspace
     const cached = (workspace.creative_json as Record<string, any>)?.creativeIntelligence;
     if (cached) {
       setCreativeIntelligence(cached);
       return cached;
     }
     
     setFetchingIntelligence(true);
     try {
       const objective = (workspace.strategy_json as any)?.objective || 'sales';
       const { data, error } = await supabase.functions.invoke('analyze-past-creatives', {
         body: { brandId, campaignObjective: objective }
       });
       if (error) throw error;
       setCreativeIntelligence(data);
       // Cache in workspace
       await saveCreativeState({ creativeIntelligence: data });
       return data;
     } catch (e) {
       console.error("Failed to fetch creative intelligence:", e);
       const fallback: CreativeIntelligence = { hasData: false, summary: "Could not analyze past ads." };
       setCreativeIntelligence(fallback);
       return fallback;
     } finally {
       setFetchingIntelligence(false);
     }
   };

   const generateAngles = async (context?: CreativeContext | null) => {
    if (!workspace?.strategy_json) { toast.error("Complete strategy first"); return; }
    
    // Create a new round timestamp
    const newRound = new Date().toISOString();
    
    setGenerating(true); setGeneratingPhase("angles");
    try {
      // Fetch intelligence in parallel with setting up
      const intelligence = await fetchCreativeIntelligence();
      
      const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
         body: { 
           brandName: workspace.brands?.name, 
           strategyData: workspace.strategy_json, 
           audiencePsychology: workspace.brands?.audience_psychology, 
           offerData: { name: workspace.offer_name, description: workspace.offer_description, price: workspace.offer_price },
           preGenerationContext: context,
           conversationInsights: (workspace.creative_json as Record<string, any>)?.conversationInsights,
           creativeIntelligence: intelligence,
         }
      });
      if (error) throw error;
      
      // Prepend the default "Straight from Your Page" angle
      const DEFAULT_ANGLE = {
        id: "direct_from_page",
        name: "Straight from Your Page",
        description: "Uses copy directly from your sales page — your offer name, description, and call-to-action as-is.",
        isDefault: true
      };
      const allAngles = [DEFAULT_ANGLE, ...(data.angles || []).filter((a: any) => a.id !== "direct_from_page")];
      
      setAvailableAngles(allAngles);
      setSelectedAngleIds(["direct_from_page"]);
      setGridData([]);
      setActiveAngleId("");
       await saveCreativeState({ 
         angles: allAngles, 
         selectedAngleIds: ["direct_from_page"], 
         gridData: [],
         preGenerationContext: context || null,
         currentRound: newRound,
       });
      toast.success("Angles ready!");
      setActiveTab("angles");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setGenerating(false); setGeneratingPhase(null); }
  };

  const generateCreativeGrid = async () => {
    if (!selectedAngleIds.length) { toast.error("Select angles first"); return; }
    setGenerating(true); setGeneratingPhase("grid");
    try {
      const angles = availableAngles.filter(a => selectedAngleIds.includes(a.id));
      
      // Get offer data for messaging guidelines and product psychology
      let messagingGuidelines = null;
      let productPsychology = null;
      
      if (workspace.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('messaging_guidelines, product_psychology')
          .eq('id', workspace.offer_id)
          .single();
        
        if (offerData) {
          messagingGuidelines = offerData.messaging_guidelines;
          productPsychology = offerData.product_psychology;
        }
      }
      
      const { data, error } = await supabase.functions.invoke('generate-creative-grid', {
        body: { 
          angles, 
          brandName: workspace.brands?.name, 
          strategyData: workspace.strategy_json, 
          audiencePsychology: workspace.brands?.audience_psychology, 
          offerData: { 
            name: workspace.offer_name, 
            description: workspace.offer_description, 
            price: workspace.offer_price,
            url: workspace.offer_url
          },
          brandVoice: workspace.brands?.brand_voice,
          messagingGuidelines,
          productPsychology,
          nicheContext: workspace.brands?.industry,
          creativeIntelligence,
        }
      });
      if (error) throw error;
      setGridData(data.grid);
      setActiveAngleId(selectedAngleIds[0]);
      await saveCreativeState({ angles: availableAngles, selectedAngleIds, gridData: data.grid });
      toast.success("Creative ready!");
      setActiveTab("concepts");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setGenerating(false); setGeneratingPhase(null); }
  };

  const addToChecklist = (cell: CreativeCellData) => {
    const angle = availableAngles.find(a => a.id === cell.angleId);
    const currentRound = (workspace?.creative_json as Record<string, any>)?.currentRound || null;
    const newItem: ProductionItem = { 
      id: `prod_${Date.now()}`, 
      format: cell.format, 
      hook: cell.hook, 
      guidance: cell.guidance, 
      angleName: angle?.name || "", 
      completed: false,
      round: currentRound || undefined,
      // Talking head multi-hook system
      verbal_hook: cell.verbal_hook,
      written_hook: cell.written_hook,
      visual_hook: cell.visual_hook,
      visual_hook_options: cell.visual_hook_options,
      hook_technique: cell.hook_technique,
      delivery_style: cell.delivery_style,
      script_lines: normalizeScriptLines(cell.script_lines) || cell.script_lines,
      text_overlays: cell.text_overlays,
      caption_reminder: cell.caption_reminder,
      // Psychology fields
      psychology_trigger: cell.psychology_trigger,
      why_this_works: cell.why_this_works,
    };
    const updated = [...productionItems, newItem];
    setProductionItems(updated);
    saveProductionItems(updated);
    toast.success("Added to checklist!");
  };

  const removeFromChecklist = (id: string) => {
    const updated = productionItems.filter(i => i.id !== id);
    setProductionItems(updated);
    saveProductionItems(updated);
  };

  const handleBuildCampaign = () => {
    if (productionItems.length < 3) { toast.error(`Need 3+ concepts (have ${productionItems.length})`); return; }
    navigate(`/campaigns/build?workspace=${workspace.id}`);
  };

  const saveItemToLibrary = async (item: ProductionItem) => {
    if (!workspace || !brandId) return;
    try {
      await supabase.from("content_ideas").insert({
        brand_id: brandId,
        offer_id: workspace.offer_id || null,
        title: item.hook,
        content: JSON.stringify({
          format: item.format,
          guidance: item.guidance,
          angle: item.angleName,
        }),
        type: "creative_concept",
        status: "idea",
        tags: [item.format, item.angleName, "creative"].filter(Boolean),
      });

      // Remove from checklist after saving
      const updated = productionItems.filter(i => i.id !== item.id);
      setProductionItems(updated);
      saveProductionItems(updated);

      toast.success("Saved for later");
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    }
  };

  const refineScript = useCallback(async (itemId: string, feedback: string) => {
    const item = productionItems.find(i => i.id === itemId);
    if (!item || !workspace) throw new Error("Item not found");
    
    const angle = availableAngles.find(a => a.name === item.angleName);
    
    const { data, error } = await supabase.functions.invoke('regenerate-creative-cell', {
      body: {
        cell: {
          id: item.id,
          format: item.format,
          hook: item.hook,
          guidance: item.guidance,
          row: "attention",
        },
        angle: angle || { name: item.angleName, description: "" },
        brandName: workspace.brands?.name,
        strategyData: workspace.strategy_json,
        audiencePsychology: workspace.brands?.audience_psychology,
        offerData: { name: workspace.offer_name, description: workspace.offer_description, price: workspace.offer_price },
        brandVoice: workspace.brands?.brand_voice,
        userFeedback: feedback,
      }
    });
    if (error) throw error;
    
    const updatedCell = data.cell;
    const updatedItems = productionItems.map(pi => {
      if (pi.id !== itemId) return pi;
      return {
        ...pi,
        hook: updatedCell.hook,
        guidance: updatedCell.guidance,
        verbal_hook: updatedCell.verbal_hook || pi.verbal_hook,
        written_hook: updatedCell.written_hook || pi.written_hook,
        visual_hook: updatedCell.visual_hook || pi.visual_hook,
        visual_hook_options: updatedCell.visual_hook_options || pi.visual_hook_options,
        script_lines: updatedCell.script_lines || pi.script_lines,
        text_overlays: updatedCell.text_overlays || pi.text_overlays,
        delivery_style: updatedCell.delivery_style || pi.delivery_style,
        psychology_trigger: updatedCell.psychology_trigger || pi.psychology_trigger,
        why_this_works: updatedCell.why_this_works || pi.why_this_works,
      };
    });
    setProductionItems(updatedItems);
    saveProductionItems(updatedItems);
  }, [productionItems, workspace, availableAngles, saveProductionItems]);

  const workflowTabs = [
    { id: "angles" as const, label: "Angles", icon: Target },
    { id: "concepts" as const, label: "Creative Concepts", icon: Lightbulb },
    { id: "copy" as const, label: "Ad Copy", icon: FileText },
    { id: "build" as const, label: "Creation", icon: Rocket },
  ];

  // Tab progress indicators
  const tabProgress = {
    angles: availableAngles.length > 0,
    concepts: gridData.length > 0,
    copy: Object.keys(angleCopy).some(id => {
      const c = angleCopy[id];
      return c && (c.headlines?.length > 0 || c.descriptions?.length > 0 || c.primary_copy?.length > 0);
    }),
    build: productionItems.some(item => {
      const assets = workspace?.user_uploaded_assets || [];
      return assets.some((a: any) => a.linked_concept_id === item.id);
    }),
  };

  // Context-aware primary action for top-right
  const getPrimaryAction = () => {
    if (activeTab === "angles") {
      if (availableAngles.length === 0) return null;
      if (selectedAngleIds.length > 0) return { label: "Generate Creative", icon: Sparkles, action: generateCreativeGrid, disabled: generating };
      return null;
    }
    if (activeTab === "concepts") {
      if (productionItems.length === 0) return null;
      const visibleAngles = availableAngles.filter(a => selectedAngleIds.includes(a.id));
      const currentIndex = visibleAngles.findIndex(a => a.id === activeAngleId);
      const isLastAngle = currentIndex >= visibleAngles.length - 1;
      if (isLastAngle) {
        return { label: "Continue to Ad Copy", icon: ArrowRight, action: () => { setShouldAutoGenerateCopy(true); setActiveTab("copy"); }, disabled: false };
      }
      return { label: "Next Concept", icon: ArrowRight, action: () => setActiveAngleId(visibleAngles[currentIndex + 1].id), disabled: false };
    }
    if (activeTab === "copy") {
      return { label: "Continue to Build", icon: ArrowRight, action: () => setActiveTab("build"), disabled: false };
    }
    // No top-right action for build tab — Build Campaign lives at bottom of Creation tab
    if (activeTab === "build") {
      return null;
    }
    return null;
  };

  const primaryAction = getPrimaryAction();

  if (loading) return <DashboardLayout><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;

  // No workspaces with strategy - show helpful empty state
  if (workspaces.length === 0) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="min-h-[60vh]"
        >
          <div className="max-w-6xl mx-auto py-12">
            <Card className="rounded-2xl">
              <CardContent className="pt-6 text-center py-16">
                <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No campaigns ready for creative</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                  Create a new ad campaign first, then come back here to generate creative angles, hooks, and copy.
                </p>
                <Button onClick={() => navigate("/create")} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create New Ad
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="min-h-[calc(100vh-120px)] flex flex-col"
      >
        {/* Main Content */}
        <div className="flex-1 max-w-6xl mx-auto w-full">
          {/* Toolbar — inside content container for alignment */}
          <div className="flex items-end justify-between gap-3 mb-6">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs text-muted-foreground font-medium">Campaign</span>
              <Select value={selectedWorkspaceId} onValueChange={loadWorkspace}>
                <SelectTrigger className="w-[200px] sm:w-[260px]"><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>{workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.offerName || w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {(gridData.length > 0 || productionItems.length > 0) && (
                <Button variant="outline" size="sm" onClick={() => setShowBrief(true)} className="gap-2 hidden sm:flex">
                  <FileDown className="h-4 w-4" />
                  Creative Brief
                </Button>
              )}
              {primaryAction && (
                <Button 
                  variant="lumi"
                  onClick={primaryAction.action} 
                  disabled={primaryAction.disabled}
                  className="gap-2 hidden sm:flex"
                >
                  <primaryAction.icon className="h-4 w-4" />
                  {primaryAction.label}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkflowTab)}>
            <TabsList className="grid w-full grid-cols-4 mb-6 h-12 bg-transparent p-0 gap-2 rounded-none">
            {workflowTabs.map((t) => {
              const isActive = activeTab === t.id;
              const colorMap: Record<string, { active: string; inactive: string }> = {
                angles: {
                  active: "bg-tab-orange-light text-primary-foreground shadow-md",
                  inactive: "bg-tab-orange-light/10 text-tab-orange-dark hover:bg-tab-orange-light/20 border border-tab-orange-light/20",
                },
                concepts: {
                  active: "bg-tab-pink-light text-primary-foreground shadow-md",
                  inactive: "bg-tab-pink-light/10 text-tab-pink-dark hover:bg-tab-pink-light/20 border border-tab-pink-light/20",
                },
                copy: {
                  active: "bg-tab-purple-light text-primary-foreground shadow-md",
                  inactive: "bg-tab-purple-light/10 text-tab-purple-dark hover:bg-tab-purple-light/20 border border-tab-purple-light/20",
                },
                build: {
                  active: "bg-tab-blue-light text-primary-foreground shadow-md",
                  inactive: "bg-tab-blue-light/10 text-tab-blue-dark hover:bg-tab-blue-light/20 border border-tab-blue-light/20",
                },
              };
              const colors = colorMap[t.id] || colorMap.angles;
              return (
                <TabsTrigger 
                  key={t.id} 
                  value={t.id} 
                  className={cn(
                    "gap-1.5 relative rounded-xl h-10 text-sm font-semibold transition-all",
                    isActive ? colors.active : colors.inactive,
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {tabProgress[t.id] && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                      <Check className="h-2 w-2 text-white" />
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="angles">
            {!workspace ? (
              <Card className="rounded-2xl"><CardContent className="pt-6 text-center py-16"><Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold">Select a campaign above</h3></CardContent></Card>
            ) : availableAngles.length === 0 ? (
               <Card className="rounded-2xl">
                 <CardContent className="pt-6 text-center py-16">
                   <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4 animate-pulse" />
                   <h3 className="text-lg font-semibold mb-2">
                     {generating ? "Generating your angles…" : "Generate Creative Angles"}
                   </h3>
                   <p className="text-muted-foreground text-sm mb-6">
                     {generating
                       ? "Lumi is crafting unique creative angles for your campaign"
                       : "Lumi will suggest unique creative angles based on your strategy"}
                   </p>
                    {!generating && (
                      <div className="flex flex-col items-center gap-3">
                        <Button onClick={() => generateAngles()} className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          Generate Angles
                        </Button>
                        {workspace?.brands?.meta_account_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-muted-foreground"
                            onClick={() => setShowRefreshDialog(true)}
                          >
                            <BarChart3 className="h-4 w-4" />
                            See What's Worked
                          </Button>
                        )}
                      </div>
                    )}
                   {generating && <LumiThinkingInline isOpen={true} customCopy={["Crafting your creative angles…"]} />}
                 </CardContent>
               </Card>
            ) : (
              <div className="space-y-8">
                {/* Creative Intelligence Card */}
                {creativeIntelligence && (
                  <CreativeIntelligenceCard intelligence={creativeIntelligence} />
                )}
                <AngleSelector angles={availableAngles} selectedAngles={selectedAngleIds} onSelectionChange={setSelectedAngleIds} onContinue={generateCreativeGrid} isGenerating={generating} onAddCustomAngle={handleAddCustomAngle} brandName={workspace?.brands?.name} offerData={{ name: workspace?.offer_name, description: workspace?.offer_description, price: workspace?.offer_price }} />
                <div className="flex justify-end gap-2">
                  {workspace?.brands?.meta_account_id && (
                    <Button variant="outline" onClick={() => setShowRefreshDialog(true)} disabled={generating}>
                      <BarChart3 className="h-4 w-4 mr-2" />See What's Worked
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleRegenerateClick} disabled={generating}><Sparkles className="h-4 w-4 mr-2" />Regenerate</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="concepts">
            {gridData.length === 0 ? (
              <Card className="rounded-2xl"><CardContent className="pt-6 text-center py-16"><Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Generate Creative First</h3><p className="text-muted-foreground text-sm mb-4">Head to the Angles tab to generate your creative concepts.</p><Button onClick={() => setActiveTab("angles")} variant="outline">Go to Angles</Button></CardContent></Card>
            ) : (
              <div className="space-y-8">
                {selectedAngleIds.length > 1 && (
                  <div className="space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {availableAngles.filter(a => selectedAngleIds.includes(a.id)).map(a => {
                        const isActive = activeAngleId === a.id;
                        const cellCount = gridData.filter(c => c.angleId === a.id).length;
                        const addedCount = gridData.filter(c => c.angleId === a.id && productionItems.some(p => p.hook === c.hook)).length;
                        return (
                          <Button 
                            key={a.id} 
                            variant={isActive ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setActiveAngleId(a.id)}
                            className={cn(
                              "gap-2 min-w-fit transition-all",
                              isActive && "shadow-md ring-2 ring-primary/30"
                            )}
                          >
                            {a.name}
                            {addedCount > 0 && (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                {addedCount}/{cellCount}
                              </Badge>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                    {/* Active angle description */}
                    {activeAngleId && (
                      <p className="text-sm text-muted-foreground px-1">
                        {availableAngles.find(a => a.id === activeAngleId)?.description}
                      </p>
                    )}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {gridData.filter(c => c.angleId === activeAngleId).map(cell => {
                    const Icon = formatIcons[cell.format];
                    const isAdded = productionItems.some(p => p.hook === cell.hook);
                    return (
                      <Card key={cell.id} className={cn(
                        "transition-all rounded-2xl",
                        isAdded ? "ring-1 ring-green-200 bg-green-50/50 dark:ring-green-800 dark:bg-green-950/20" : "hover:shadow-md border"
                      )}>
                        <CardContent className="pt-4 p-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" />{formatLabels[cell.format]}</Badge>
                            {isAdded && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                          </div>
                          <p className="font-semibold text-base leading-snug">{cell.hook}</p>
                          <p className="text-xs text-muted-foreground line-clamp-3">{cell.guidance}</p>
                          {cell.why_this_works && (
                            <p className="text-xs text-primary/80 italic">💡 {cell.why_this_works}</p>
                          )}
                          {!isAdded && (
                            <Button size="sm" variant="outline" className="w-full" onClick={() => addToChecklist(cell)}>
                              Add to Checklist
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  {(() => {
                    const visibleAngles = availableAngles.filter(a => selectedAngleIds.includes(a.id));
                    const currentIndex = visibleAngles.findIndex(a => a.id === activeAngleId);
                    const isLastAngle = currentIndex >= visibleAngles.length - 1;
                    return (
                      <Button
                        onClick={() => {
                          if (isLastAngle) {
                            setShouldAutoGenerateCopy(true);
                            setActiveTab("copy");
                          } else {
                            setActiveAngleId(visibleAngles[currentIndex + 1].id);
                          }
                        }}
                        disabled={productionItems.length === 0}
                        className="gap-2"
                      >
                        {isLastAngle ? "Continue to Ad Copy" : "Next Concept"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="copy">
            {productionItems.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="pt-6 text-center py-16">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select Concepts First</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Add creative concepts to your checklist before writing copy.
                  </p>
                  <Button onClick={() => setActiveTab("concepts")} variant="outline">
                    Go to Creative Concepts
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Ad Copy</h2>
                    <p className="text-sm text-muted-foreground">
                      Write headlines, descriptions, and primary copy for your ads
                    </p>
                  </div>
                  <AutoSaveIndicator status={copySaveStatus} />
                </div>
                
                <AngleCopyEditor
                  angles={availableAngles}
                  selectedAngleIds={selectedAngleIds.length > 0 ? selectedAngleIds : [...new Set(productionItems.map(p => availableAngles.find(a => a.name === p.angleName)?.id).filter(Boolean))] as string[]}
                  angleCopy={angleCopy}
                  brandInfo={workspace?.brands}
                  offerData={{
                    name: workspace?.offer_name,
                    description: workspace?.offer_description,
                    price_point: workspace?.offer_price,
                  }}
                  audiencePsychology={workspace?.brands?.audience_psychology}
                  onCopyChange={handleCopyChange}
                  onSave={handleSaveCopy}
                  productionItemCount={productionItems.length}
                  autoGenerate={shouldAutoGenerateCopy}
                />
                
                <div className="flex justify-end">
                  <Button onClick={() => setActiveTab("build")} className="gap-2">
                    Continue to Build
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="build">
            <ProductionManager
              workspace={workspace}
              productionItems={productionItems}
              angles={availableAngles}
              selectedAngleIds={selectedAngleIds}
              onRemoveItem={removeFromChecklist}
              onBuildCampaign={handleBuildCampaign}
              onUpdateWorkspace={(updates) => setWorkspace((prev: any) => ({ ...prev, ...updates }))}
              onSaveToLibrary={saveItemToLibrary}
              brandId={brandId}
              angleCopy={angleCopy}
              onRefineScript={refineScript}
              currentRound={(workspace?.creative_json as Record<string, any>)?.currentRound}
              onArchivePrevious={async () => {
                const currentRound = (workspace?.creative_json as Record<string, any>)?.currentRound;
                if (!currentRound) return;
                const previousItems = productionItems.filter(i => !i.round || i.round !== currentRound);
                const currentItems = productionItems.filter(i => i.round === currentRound);
                // Archive previous items into creative_json
                const cur = (workspace?.creative_json || {}) as Record<string, any>;
                const archived = [...(cur.archivedProductionItems || []), ...previousItems];
                await supabase.from("campaign_workspaces").update({
                  creative_json: { ...cur, archivedProductionItems: archived },
                  production_items: currentItems as unknown as Json,
                  updated_at: new Date().toISOString(),
                }).eq("id", workspace.id);
                setProductionItems(currentItems);
                setWorkspace((prev: any) => ({
                  ...prev,
                  creative_json: { ...prev?.creative_json, archivedProductionItems: archived },
                }));
                toast.success(`Archived ${previousItems.length} items from previous rounds`);
              }}
              onClearAll={async () => {
                const cur = (workspace?.creative_json || {}) as Record<string, any>;
                const archived = [...(cur.archivedProductionItems || []), ...productionItems];
                await supabase.from("campaign_workspaces").update({
                  creative_json: { ...cur, archivedProductionItems: archived },
                  production_items: [] as unknown as Json,
                  updated_at: new Date().toISOString(),
                }).eq("id", workspace.id);
                setProductionItems([]);
                setWorkspace((prev: any) => ({
                  ...prev,
                  creative_json: { ...prev?.creative_json, archivedProductionItems: archived },
                }));
                toast.success("Checklist cleared — all items archived");
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile floating primary action */}
      {primaryAction && (
        <div className="sm:hidden fixed bottom-6 left-4 right-4 z-30">
          <Button 
            variant="lumi"
            onClick={primaryAction.action} 
            disabled={primaryAction.disabled}
            className="w-full gap-2 shadow-lg"
            size="lg"
          >
            <primaryAction.icon className="h-4 w-4" />
            {primaryAction.label}
          </Button>
        </div>
      )}
      
      
      <LumiThinking isOpen={generating} customCopy={creativeGenerationCopy} />
      <CreativeStudioExplainer open={showExplainer} onClose={closeExplainer} />
      
      {/* Creative Brief Sheet */}
      <Sheet open={showBrief} onOpenChange={setShowBrief}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="flex items-center justify-between">
              <span>Creative Brief</span>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)] p-6">
            <CreativeBriefDocument
              brandName={workspace?.brands?.name || activeBrand?.name || ""}
              offerData={{
                name: workspace?.offer_name || undefined,
                description: workspace?.offer_description || undefined,
                price: workspace?.offer_price || undefined,
                url: workspace?.offer_url || undefined,
              }}
              productPsychology={offerPsychology}
              audiencePsychology={offerAudiencePsychology || workspace?.brands?.audience_psychology}
              angles={availableAngles}
              selectedAngleIds={selectedAngleIds}
              gridData={gridData.length > 0 ? gridData : productionItems.map(pi => ({
                id: pi.id,
                angleId: availableAngles.find(a => a.name === pi.angleName)?.id || "direct_from_page",
                format: pi.format,
                hook: pi.hook || "",
                guidance: pi.guidance || "",
                row: "attention" as const,
                why_this_works: pi.why_this_works || "",
                script_lines: pi.script_lines || [],
              }))}
              angleCopy={angleCopy}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
      
      {/* Regeneration Confirmation Dialog */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Angles?</AlertDialogTitle>
            <AlertDialogDescription>
              Regenerating angles will clear your existing creative concepts and production checklist. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowRegenerateConfirm(false);
               setShowContextInput(true);
            }}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
 
       {/* Context Input Dialog for Regeneration */}
       <Dialog open={showContextInput} onOpenChange={setShowContextInput}>
         <DialogContent className="sm:max-w-lg">
           <DialogHeader>
             <DialogTitle>Any direction for this round?</DialogTitle>
             <DialogDescription>
               Help Lumi create angles that better fit your needs.
             </DialogDescription>
           </DialogHeader>
           <CreativeContextInput
             compact
             onGenerate={(context) => {
               setShowContextInput(false);
               generateAngles(context);
             }}
             onSkip={() => {
               setShowContextInput(false);
               generateAngles();
             }}
             isGenerating={generating}
             existingContext={(workspace?.creative_json as Record<string, any>)?.preGenerationContext}
           />
         </DialogContent>
        </Dialog>

        {/* Creative Refresh Dialog */}
        <CreativeRefreshDialog
          open={showRefreshDialog}
          onClose={() => {
            setShowRefreshDialog(false);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('refreshCreative');
            setSearchParams(newParams, { replace: true });
          }}
          onBuildOnWhatWorks={(performanceContext) => {
            setShowRefreshDialog(false);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('refreshCreative');
            setSearchParams(newParams, { replace: true });
            // Save performance context then generate with it
            const cur = (workspace?.creative_json || {}) as Record<string, any>;
            supabase.from("campaign_workspaces").update({
              creative_json: { ...cur, performanceContext: performanceContext as unknown as Json },
              updated_at: new Date().toISOString(),
            }).eq("id", workspace?.id).then(() => {
              generateAngles({ performanceContext } as any);
            });
          }}
          onStartFresh={() => {
            setShowRefreshDialog(false);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('refreshCreative');
            setSearchParams(newParams, { replace: true });
            setShowContextInput(true);
          }}
          brandId={brandId}
          campaignObjective={workspace?.strategy_json?.objective}
        />
        {/* Auto-save status indicator */}
        {workspace && (
          <div className="fixed bottom-4 right-4 z-30 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border shadow-sm">
            <AutoSaveIndicator status={saveStatus} size="sm" />
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
