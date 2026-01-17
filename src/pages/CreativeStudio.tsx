import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Target, FileText, Rocket, 
  ChevronRight, CheckCircle2, Circle, Loader2,
  Sparkles, ArrowRight, FolderOpen, Video, Film, Image, Trash2,
  X, HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { LumiThinking } from "@/components/LumiThinking";
import { LumiCharacter } from "@/components/LumiCharacter";
import { AngleSelector, CreativeAngle } from "@/components/creative/AngleSelector";
import { CreativeCellData } from "@/components/creative/CreativeCell";
import { ProductionItem } from "@/components/creative/ProductionChecklistPanel";
import { ProductionManager } from "@/components/creative/ProductionManager";
import { CreativeStudioExplainer, useCreativeStudioExplainer } from "@/components/creative/CreativeStudioExplainer";
import { Json } from "@/integrations/supabase/types";

type WorkflowTab = "angles" | "copy_creative" | "build";

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

// Context-aware help messages for idle popup
const getIdleHelpMessage = (
  activeTab: WorkflowTab,
  availableAngles: CreativeAngle[],
  selectedAngleIds: string[],
  gridData: CreativeCellData[],
  productionItems: ProductionItem[]
) => {
  if (activeTab === "angles") {
    if (availableAngles.length === 0) {
      return "Click 'Generate Angles' to get AI-powered creative angle suggestions for your campaign.";
    }
    if (selectedAngleIds.length === 0) {
      return "Select 1-3 angles that resonate with your offer, then click 'Generate Creative' to continue.";
    }
    return "Great picks! Click 'Generate Creative' to create hooks and concepts for your selected angles.";
  }
  if (activeTab === "copy_creative") {
    if (gridData.length === 0) {
      return "Head to the Angles tab to generate your creative concepts first.";
    }
    if (productionItems.length === 0) {
      return "Browse the concepts and click 'Add to Checklist' on the ones you want to produce.";
    }
    return `You have ${productionItems.length} concepts ready. Add more or continue to the Build tab.`;
  }
  if (activeTab === "build") {
    if (productionItems.length < 3) {
      return `Add ${3 - productionItems.length} more concepts to unlock campaign building.`;
    }
    if (productionItems.length >= 6) {
      return "Use 'Get Lumi's Top 5' to narrow down your best performers, then upload creative files.";
    }
    return "Upload your creative files to each concept, then build your campaign!";
  }
  return "Need help? Let me know what you're trying to accomplish.";
};

export default function CreativeStudio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showExplainer, closeExplainer } = useCreativeStudioExplainer();
  
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
  
  // Idle help state
  const [showIdleHelp, setShowIdleHelp] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const IDLE_TIMEOUT = 45000; // 45 seconds

  const urlWorkspaceId = searchParams.get("workspace");

  // Idle detection
  useEffect(() => {
    const resetIdleTimer = () => {
      setShowIdleHelp(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setShowIdleHelp(true);
      }, IDLE_TIMEOUT);
    };

    // Listen for user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: brandData } = await supabase
        .from("brands").select("*").eq("user_id", user.id).single();
      if (!brandData) { navigate("/dashboard"); return; }
      
      setBrandId(brandData.id);

      const { data: workspacesData } = await supabase
        .from("campaign_workspaces")
        .select("id, name, offer_name, creative_json, production_items, strategy_json")
        .eq("brand_id", brandData.id)
        .not("strategy_json", "is", null)
        .order("updated_at", { ascending: false });

      const options: WorkspaceOption[] = (workspacesData || []).map(w => {
        const c = w.creative_json as Record<string, any> | null;
        const p = w.production_items as any[] | null;
        return { id: w.id, name: w.name, offerName: w.offer_name, hasAngles: !!c?.angles?.length, hasGrid: !!c?.gridData?.length, productionCount: p?.length || 0 };
      });
      setWorkspaces(options);

      const targetId = urlWorkspaceId || options[0]?.id;
      if (targetId) await loadWorkspace(targetId);

      const { data: ideasData } = await supabase
        .from("content_ideas").select("*").eq("brand_id", brandData.id).order("created_at", { ascending: false }).limit(50);
      setContentIdeas(ideasData || []);
    } catch (e) { console.error(e); toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  const loadWorkspace = async (id: string) => {
    setSelectedWorkspaceId(id);
    setSearchParams(p => { p.set("workspace", id); return p; }, { replace: true });
    try {
      const { data } = await supabase.from("campaign_workspaces").select("*, brands(*)").eq("id", id).single();
      setWorkspace(data);
      const c = data?.creative_json as Record<string, any> | null;
      setAvailableAngles(c?.angles || []);
      setSelectedAngleIds(c?.selectedAngleIds || []);
      setGridData(c?.gridData || []);
      setActiveAngleId(c?.selectedAngleIds?.[0] || "");
      setProductionItems((data?.production_items as any[]) || []);
    } catch (e) { console.error(e); }
  };

  const saveCreativeState = async (updates: any) => {
    if (!workspace) return;
    const cur = (workspace.creative_json || {}) as Record<string, any>;
    await supabase.from("campaign_workspaces").update({ creative_json: { ...cur, ...updates }, updated_at: new Date().toISOString() }).eq("id", workspace.id);
  };

  const saveProductionItems = async (items: ProductionItem[]) => {
    if (!workspace) return;
    await supabase.from("campaign_workspaces").update({ production_items: items as unknown as Json, updated_at: new Date().toISOString() }).eq("id", workspace.id);
  };

  const generateAngles = async () => {
    if (!workspace?.strategy_json) { toast.error("Complete strategy first"); return; }
    setGenerating(true); setGeneratingPhase("angles");
    try {
      const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
        body: { brandName: workspace.brands?.name, strategyData: workspace.strategy_json, audiencePsychology: workspace.brands?.audience_psychology, offerData: { name: workspace.offer_name, description: workspace.offer_description, price: workspace.offer_price } }
      });
      if (error) throw error;
      setAvailableAngles(data.angles);
      await saveCreativeState({ angles: data.angles });
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
          // New enriched context
          brandVoice: workspace.brands?.brand_voice,
          messagingGuidelines,
          productPsychology,
          nicheContext: workspace.brands?.industry
        }
      });
      if (error) throw error;
      setGridData(data.grid);
      setActiveAngleId(selectedAngleIds[0]);
      await saveCreativeState({ angles: availableAngles, selectedAngleIds, gridData: data.grid });
      toast.success("Creative ready!");
      setActiveTab("copy_creative");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setGenerating(false); setGeneratingPhase(null); }
  };

  const addToChecklist = (cell: CreativeCellData) => {
    const angle = availableAngles.find(a => a.id === cell.angleId);
    const newItem: ProductionItem = { id: `prod_${Date.now()}`, format: cell.format, hook: cell.hook, guidance: cell.guidance, angleName: angle?.name || "", completed: false };
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

      toast.success("Saved to Concept Library");
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    }
  };

  const workflowTabs = [
    { id: "angles" as const, label: "Angles", icon: Target },
    { id: "copy_creative" as const, label: "Copy & Creative", icon: FileText },
    { id: "build" as const, label: "Build", icon: Rocket },
  ];

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold"><span className="text-gradient-lumi">Creative Studio</span></h1>
            <p className="text-muted-foreground text-sm">Build ad creative from ideation to launch</p>
          </div>
          {workspaces.length > 0 && (
            <Select value={selectedWorkspaceId} onValueChange={loadWorkspace}>
              <SelectTrigger className="w-full sm:w-[280px]"><FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Select campaign" /></SelectTrigger>
              <SelectContent>{workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkflowTab)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {workflowTabs.map(t => <TabsTrigger key={t.id} value={t.id} className="gap-2"><t.icon className="h-4 w-4" /><span className="hidden sm:inline">{t.label}</span></TabsTrigger>)}
          </TabsList>

          <TabsContent value="angles">
            {!workspace ? (
              <Card><CardContent className="pt-6 text-center py-12"><Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold">Select a campaign above</h3></CardContent></Card>
            ) : availableAngles.length === 0 ? (
              <Card><CardContent className="pt-6 text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Generate Creative Angles</h3>
                <p className="text-muted-foreground text-sm mb-6">AI will suggest unique creative angles</p>
                <Button onClick={generateAngles} disabled={generating} className="gap-2">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Generate Angles</Button>
              </CardContent></Card>
            ) : (
              <div className="space-y-6">
                <AngleSelector angles={availableAngles} selectedAngles={selectedAngleIds} onSelectionChange={setSelectedAngleIds} onContinue={generateCreativeGrid} isGenerating={generating} />
                <div className="flex justify-end"><Button variant="outline" onClick={generateAngles} disabled={generating}><Sparkles className="h-4 w-4 mr-2" />Regenerate</Button></div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="copy_creative">
            {gridData.length === 0 ? (
              <Card><CardContent className="pt-6 text-center py-12"><FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-semibold mb-2">Generate Creative First</h3><Button onClick={() => setActiveTab("angles")} variant="outline">Go to Angles</Button></CardContent></Card>
            ) : (
              <div className="space-y-6">
                {selectedAngleIds.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {availableAngles.filter(a => selectedAngleIds.includes(a.id)).map(a => (
                        <Button key={a.id} variant={activeAngleId === a.id ? "default" : "outline"} size="sm" onClick={() => setActiveAngleId(a.id)}>{a.name}</Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-primary">↑</span>
                      <span>Click each angle to see all your concepts</span>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {gridData.filter(c => c.angleId === activeAngleId).map(cell => {
                    const Icon = formatIcons[cell.format];
                    const isAdded = productionItems.some(p => p.hook === cell.hook);
                    return (
                      <Card key={cell.id} className={cn("transition-all", isAdded && "ring-2 ring-green-500/50")}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="gap-1"><Icon className="h-3 w-3" />{formatLabels[cell.format]}</Badge>
                            {isAdded && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          </div>
                          <p className="font-medium text-sm">{cell.hook}</p>
                          <p className="text-xs text-muted-foreground">{cell.guidance}</p>
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
                {productionItems.length > 0 && (
                  <Card><CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Production Checklist ({productionItems.length})</h4>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("build")} className="gap-1">
                        <Rocket className="h-3 w-3" />
                        Go to Build
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {productionItems.slice(0, 3).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm truncate flex-1">{item.hook}</span>
                          <Badge variant="secondary">{formatLabels[item.format as keyof typeof formatLabels]}</Badge>
                        </div>
                      ))}
                      {productionItems.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">+{productionItems.length - 3} more items</p>
                      )}
                    </div>
                  </CardContent></Card>
                )}
                <div className="flex justify-end"><Button onClick={() => setActiveTab("build")} disabled={productionItems.length === 0} className="gap-2">Continue to Build<ArrowRight className="h-4 w-4" /></Button></div>
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
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Idle Help Popup - max 20% screen width */}
      <AnimatePresence>
        {showIdleHelp && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-[20vw] min-w-[280px]"
          >
            <Card className="shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm">
              <CardContent className="pt-4 pb-4 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => setShowIdleHelp(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="flex items-start gap-3 pr-6">
                  <LumiCharacter size="sm" state="idle" glow />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Need help?</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {getIdleHelpMessage(activeTab, availableAngles, selectedAngleIds, gridData, productionItems)}
                    </p>
                    <Button
                      size="sm"
                      variant="link"
                      className="px-0 h-auto text-xs text-primary"
                      onClick={() => {
                        setShowIdleHelp(false);
                        // Navigate to the next logical step
                        if (activeTab === "angles" && availableAngles.length > 0 && selectedAngleIds.length > 0) {
                          generateCreativeGrid();
                        } else if (activeTab === "copy_creative" && productionItems.length > 0) {
                          setActiveTab("build");
                        }
                      }}
                    >
                      Show me what to do next →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      <LumiThinking isOpen={generating} customCopy={creativeGenerationCopy} />
      <CreativeStudioExplainer open={showExplainer} onClose={closeExplainer} />
    </DashboardLayout>
  );
}
