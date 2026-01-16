import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, ArrowRight, Rocket, CheckCircle2, 
  Copy, Check, Loader2, RefreshCw, FileText, Type, MessageSquare,
  Lightbulb, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreativeAngle {
  id: string;
  name: string;
  description: string;
}

interface CopyVariation {
  text: string;
  framework: string;
  character_count?: number;
}

interface AngleCopy {
  headlines: CopyVariation[];
  descriptions: CopyVariation[];
  primary_copy: CopyVariation[];
}

interface CreativeFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | null;
  onComplete?: () => void;
}

type FlowStep = "loading" | "generate_angles" | "select_angles" | "generating_content" | "review_copy" | "complete";

const stepLabels: Record<FlowStep, string> = {
  loading: "Loading...",
  generate_angles: "Get Started",
  select_angles: "Choose Angles",
  generating_content: "Generating...",
  review_copy: "Review Copy",
  complete: "Ready!",
};

const stepProgress: Record<FlowStep, number> = {
  loading: 0,
  generate_angles: 10,
  select_angles: 30,
  generating_content: 50,
  review_copy: 80,
  complete: 100,
};

export function CreativeFlowModal({ open, onOpenChange, workspaceId, onComplete }: CreativeFlowModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<FlowStep>("loading");
  const [workspace, setWorkspace] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  
  // Angles state
  const [availableAngles, setAvailableAngles] = useState<CreativeAngle[]>([]);
  const [selectedAngleIds, setSelectedAngleIds] = useState<string[]>([]);
  
  // Copy state
  const [angleCopy, setAngleCopy] = useState<Record<string, AngleCopy>>({});
  const [activeAngleId, setActiveAngleId] = useState<string>("");
  const [copySelections, setCopySelections] = useState<Record<string, { headlines: number[]; descriptions: number[]; primary_copy: number[] }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load workspace data when modal opens
  useEffect(() => {
    if (open && workspaceId) {
      loadWorkspace();
    } else if (!open) {
      // Reset state when modal closes
      setStep("loading");
      setAvailableAngles([]);
      setSelectedAngleIds([]);
      setAngleCopy({});
      setCopySelections({});
    }
  }, [open, workspaceId]);

  const loadWorkspace = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*, brands(*)")
        .eq("id", workspaceId)
        .single();

      if (error) throw error;
      setWorkspace(data);

      // Check if we have existing creative data
      const creativeData = data.creative_json as Record<string, any> | null;
      if (creativeData?.angles?.length > 0) {
        setAvailableAngles(creativeData.angles);
        setSelectedAngleIds(creativeData.selectedAngleIds || []);
        setAngleCopy(creativeData.angle_copy || {});
        setCopySelections(creativeData.copy_selections || {});
        
        if (creativeData.angle_copy && Object.keys(creativeData.angle_copy).length > 0) {
          setActiveAngleId(creativeData.selectedAngleIds?.[0] || creativeData.angles[0]?.id);
          setStep("review_copy");
        } else {
          setStep("select_angles");
        }
      } else if (!data.strategy_json) {
        // No strategy - can't generate
        toast.error("Please complete the campaign strategy first");
        onOpenChange(false);
      } else {
        setStep("generate_angles");
      }
    } catch (error: any) {
      console.error("Error loading workspace:", error);
      toast.error("Failed to load campaign data");
      onOpenChange(false);
    }
  };

  const generateAngles = async () => {
    if (!workspace) return;

    setGenerating(true);
    try {
      const strategyData = workspace.strategy_json;
      const isImportedCampaign = strategyData?.source === 'imported_campaign';
      
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
          strategyData,
          audiencePsychology: isImportedCampaign 
            ? strategyData?.audience_psychology 
            : workspace.brands?.audience_psychology,
          offerData,
          conversationInsights: workspace.creative_json?.conversationInsights || [],
          isImportedCampaign,
        }
      });

      if (error) throw error;

      setAvailableAngles(data.angles);
      
      // Save to workspace
      await saveCreativeState({ angles: data.angles });
      
      setStep("select_angles");
      toast.success("Creative angles ready!");
    } catch (error: any) {
      console.error("Error generating angles:", error);
      handleAIError(error);
    } finally {
      setGenerating(false);
    }
  };

  const generateCopy = async () => {
    if (selectedAngleIds.length === 0) {
      toast.error("Please select at least one angle");
      return;
    }

    setGenerating(true);
    setStep("generating_content");
    
    try {
      const selectedAngles = availableAngles.filter(a => selectedAngleIds.includes(a.id));
      
      // Fetch offer data for better copy
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
          angles: selectedAngles,
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

      setAngleCopy(data.angle_copy);
      setActiveAngleId(selectedAngleIds[0]);
      
      // Save to workspace
      await saveCreativeState({
        selectedAngleIds,
        angle_copy: data.angle_copy,
      });
      
      setStep("review_copy");
      toast.success("Ad copy generated!");
    } catch (error: any) {
      console.error("Error generating copy:", error);
      handleAIError(error);
      setStep("select_angles");
    } finally {
      setGenerating(false);
    }
  };

  const saveCreativeState = async (updates: Record<string, any>) => {
    if (!workspace) return;
    
    const existingCreative = workspace.creative_json || {};
    const newCreative = { ...existingCreative, ...updates };
    
    await supabase
      .from("campaign_workspaces")
      .update({ 
        creative_json: newCreative,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workspace.id);
    
    // Update local workspace reference
    setWorkspace((prev: any) => prev ? { ...prev, creative_json: newCreative } : prev);
  };

  const handleAIError = (error: any) => {
    if (error.message?.includes("429")) {
      toast.error("Rate limit exceeded. Please wait a moment.");
    } else if (error.message?.includes("402")) {
      toast.error("AI credits depleted. Please add credits in Settings.");
    } else {
      toast.error(error.message || "Something went wrong");
    }
  };

  const toggleAngle = (angleId: string) => {
    if (selectedAngleIds.includes(angleId)) {
      setSelectedAngleIds(prev => prev.filter(id => id !== angleId));
    } else if (selectedAngleIds.length < 5) {
      setSelectedAngleIds(prev => [...prev, angleId]);
    }
  };

  const handleCopyText = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleCopySelection = (angleId: string, type: "headlines" | "descriptions" | "primary_copy", index: number) => {
    const current = copySelections[angleId] || { headlines: [], descriptions: [], primary_copy: [] };
    const typeSelections = current[type] || [];
    const newTypeSelections = typeSelections.includes(index)
      ? typeSelections.filter(i => i !== index)
      : [...typeSelections, index];
    
    const newSelections = {
      ...copySelections,
      [angleId]: { ...current, [type]: newTypeSelections },
    };
    
    setCopySelections(newSelections);
    saveCreativeState({ copy_selections: newSelections });
  };

  const handleComplete = () => {
    toast.success("Creative saved! Ready to build your ad.");
    onComplete?.();
    onOpenChange(false);
  };

  const goToCampaignBuilder = () => {
    onOpenChange(false);
    navigate(`/campaigns/build?workspace=${workspaceId}`);
  };

  const goToCreativeStudio = () => {
    onOpenChange(false);
    navigate(`/creative?workspace=${workspaceId}`);
  };

  const getSelectedCopyCount = () => {
    return Object.values(copySelections).reduce((sum, sel) => {
      return sum + (sel.headlines?.length || 0) + (sel.descriptions?.length || 0) + (sel.primary_copy?.length || 0);
    }, 0);
  };

  const currentAngleCopy = angleCopy[activeAngleId] || { headlines: [], descriptions: [], primary_copy: [] };
  const selectedAngles = availableAngles.filter(a => selectedAngleIds.includes(a.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with Progress */}
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-display flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Generate Angles & Ideas
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {workspace?.name || "Create ad copy for your campaign"}
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {stepLabels[step]}
            </Badge>
          </div>
          <Progress value={stepProgress[step]} className="h-1 mt-3" />
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 sm:p-6">
          {step === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {step === "generate_angles" && (
            <div className="text-center py-8 space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-display font-bold">Creative Angles</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  We'll generate unique creative angles based on your campaign strategy and audience psychology.
                </p>
              </div>
              <Button 
                onClick={generateAngles} 
                disabled={generating}
                size="lg"
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Angles...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Angles
                  </>
                )}
              </Button>
            </div>
          )}

          {step === "select_angles" && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-display font-bold">Choose Your Angles</h3>
                <p className="text-sm text-muted-foreground">
                  Select 1–5 angles. Each becomes a unique set of ad copy.
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((slot) => (
                    <div
                      key={slot}
                      className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        slot <= selectedAngleIds.length ? "bg-primary scale-110" : "bg-muted"
                      )}
                    />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {selectedAngleIds.length === 0 ? "Select at least 1" : `${selectedAngleIds.length}/5`}
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                {availableAngles.map((angle) => {
                  const isSelected = selectedAngleIds.includes(angle.id);
                  const isDisabled = !isSelected && selectedAngleIds.length >= 5;
                  
                  return (
                    <Card
                      key={angle.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-primary/5",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => !isDisabled && toggleAngle(angle.id)}
                    >
                      <CardHeader className="pb-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold">{angle.name}</CardTitle>
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            className="h-5 w-5"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <CardDescription className="text-xs line-clamp-2">
                          {angle.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === "generating_content" && (
            <div className="text-center py-12 space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-display font-bold">Creating Your Ad Copy</h3>
                <p className="text-sm text-muted-foreground">
                  Generating headlines, descriptions, and primary copy for {selectedAngleIds.length} angle{selectedAngleIds.length > 1 ? 's' : ''}...
                </p>
              </div>
            </div>
          )}

          {step === "review_copy" && (
            <div className="space-y-4">
              {/* Angle Tabs */}
              {selectedAngles.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedAngles.map((angle) => (
                    <Button
                      key={angle.id}
                      variant={activeAngleId === angle.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveAngleId(angle.id)}
                      className="whitespace-nowrap"
                    >
                      {angle.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Copy Sections */}
              <div className="space-y-4">
                {/* Headlines */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Type className="h-4 w-4" />
                    Headlines
                  </div>
                  <div className="grid gap-2">
                    {currentAngleCopy.headlines?.map((v, i) => {
                      const id = `${activeAngleId}-h-${i}`;
                      const isSelected = copySelections[activeAngleId]?.headlines?.includes(i);
                      return (
                        <Card 
                          key={id} 
                          className={cn(
                            "cursor-pointer transition-all",
                            isSelected && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => toggleCopySelection(activeAngleId, "headlines", i)}
                        >
                          <CardContent className="p-3 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{v.text}</p>
                              <Badge variant="outline" className="text-xs mt-1">{v.framework}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleCopyText(v.text, id); }}
                              >
                                {copiedId === id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <Checkbox checked={isSelected} className="h-5 w-5" />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Descriptions */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <FileText className="h-4 w-4" />
                    Descriptions
                  </div>
                  <div className="grid gap-2">
                    {currentAngleCopy.descriptions?.map((v, i) => {
                      const id = `${activeAngleId}-d-${i}`;
                      const isSelected = copySelections[activeAngleId]?.descriptions?.includes(i);
                      return (
                        <Card 
                          key={id} 
                          className={cn(
                            "cursor-pointer transition-all",
                            isSelected && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => toggleCopySelection(activeAngleId, "descriptions", i)}
                        >
                          <CardContent className="p-3 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{v.text}</p>
                              <Badge variant="outline" className="text-xs mt-1">{v.framework}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleCopyText(v.text, id); }}
                              >
                                {copiedId === id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <Checkbox checked={isSelected} className="h-5 w-5" />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Copy */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <MessageSquare className="h-4 w-4" />
                    Primary Copy
                  </div>
                  <div className="grid gap-2">
                    {currentAngleCopy.primary_copy?.map((v, i) => {
                      const id = `${activeAngleId}-p-${i}`;
                      const isSelected = copySelections[activeAngleId]?.primary_copy?.includes(i);
                      return (
                        <Card 
                          key={id} 
                          className={cn(
                            "cursor-pointer transition-all",
                            isSelected && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => toggleCopySelection(activeAngleId, "primary_copy", i)}
                        >
                          <CardContent className="p-3 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm whitespace-pre-wrap line-clamp-4">{v.text}</p>
                              <Badge variant="outline" className="text-xs mt-1">{v.framework}</Badge>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); handleCopyText(v.text, id); }}
                              >
                                {copiedId === id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <Checkbox checked={isSelected} className="h-5 w-5" />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4 sm:p-6 pt-4 flex items-center justify-between gap-3 shrink-0">
          {step === "select_angles" && (
            <>
              <Button 
                variant="ghost" 
                onClick={() => setStep("generate_angles")}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <Button 
                onClick={generateCopy} 
                disabled={selectedAngleIds.length === 0 || generating}
                className="gap-2"
              >
                Generate Copy
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {step === "review_copy" && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getSelectedCopyCount() > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {getSelectedCopyCount()} selected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={goToCreativeStudio}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Full Studio
                </Button>
                <Button 
                  onClick={goToCampaignBuilder}
                  variant="default"
                  className="gap-2"
                >
                  <Rocket className="h-4 w-4" />
                  Build Ad
                </Button>
              </div>
            </>
          )}

          {(step === "loading" || step === "generate_angles" || step === "generating_content") && (
            <div className="flex-1" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
