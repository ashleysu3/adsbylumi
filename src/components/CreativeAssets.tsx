import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Copy, 
  RefreshCw, 
  HelpCircle, 
  Sparkles, 
  ChevronDown,
  Video,
  Image as ImageIcon,
  FileText,
  Layers,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreativeAssetsProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

const formatIcons = {
  talking_head: Video,
  b_roll: Video,
  carousel: Layers,
  static: ImageIcon,
  script: FileText,
  overlay: FileText,
};

const stageColors = {
  tofu: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
  mofu: "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400",
  bofu: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
};

export function CreativeAssets({ workspace, onUpdate }: CreativeAssetsProps) {
  const creative = workspace.creative_json || {};
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [activeStage, setActiveStage] = useState<string>("tofu");
  const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Load existing selections from workspace
  useEffect(() => {
    if (workspace.production_checklist) {
      const checklist = workspace.production_checklist;
      const selected = new Set<string>();
      
      // Extract concept IDs from checklist items
      checklist.forEach((item: any) => {
        if (item.concept_id) {
          selected.add(item.concept_id);
        }
      });
      
      setSelectedConcepts(selected);
    }
  }, [workspace.production_checklist]);

  const toggleConcept = (conceptId: string) => {
    setExpandedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  };

  const generateChecklistForConcept = (concept: any, stage: string, conceptId: string) => {
    const items: any[] = [];
    
    // Script recording task
    if (concept.script || concept.format === 'talking_head') {
      const scriptLines = concept.script 
        ? concept.script.split('\n').filter((line: string) => line.trim())
        : ["Record talking head video following the script"];
      
      items.push({
        id: `record_${conceptId}`,
        concept_id: conceptId,
        category: "📹 To Record",
        title: `${stage.toUpperCase()}: ${concept.title}`,
        details: scriptLines,
        completed: false,
        stage: stage,
        format: concept.format
      });
    }

    // B-roll recording task
    if (concept.broll_instructions || concept.format === 'b_roll') {
      const brollLines = concept.broll_instructions
        ? concept.broll_instructions.split('\n').filter((line: string) => line.trim())
        : ["Record B-roll footage"];
      
      items.push({
        id: `broll_${conceptId}`,
        concept_id: conceptId,
        category: "📹 To Record",
        title: `B-roll for: ${concept.title}`,
        details: brollLines,
        completed: false,
        stage: stage,
        format: 'b_roll'
      });
    }

    // Carousel design task
    if (concept.format === 'carousel') {
      const carouselDetails = typeof concept.carousel_structure === 'string'
        ? concept.carousel_structure.split('\n').filter((line: string) => line.trim())
        : Array.isArray(concept.carousel_structure)
        ? concept.carousel_structure
        : ["Design carousel slides with consistent branding", "Include clear CTA on final slide"];
      
      items.push({
        id: `carousel_${conceptId}`,
        concept_id: conceptId,
        category: "🎨 To Design",
        title: `${stage.toUpperCase()} Carousel: ${concept.title}`,
        details: carouselDetails,
        completed: false,
        stage: stage,
        format: 'carousel'
      });
    }

    // Static graphic task
    if (concept.format === 'static') {
      const staticDetails = concept.static_layout
        ? concept.static_layout.split('\n').filter((line: string) => line.trim())
        : ["Design static graphic following brand guidelines"];
      
      items.push({
        id: `static_${conceptId}`,
        concept_id: conceptId,
        category: "🎨 To Design",
        title: `${stage.toUpperCase()} Static: ${concept.title}`,
        details: staticDetails,
        completed: false,
        stage: stage,
        format: 'static'
      });
    }

    // Overlay text task
    if (concept.overlay_text) {
      const overlayDetails = concept.overlay_text.split('\n').filter((line: string) => line.trim());
      
      items.push({
        id: `overlay_${conceptId}`,
        concept_id: conceptId,
        category: "✂️ Post-Production",
        title: `Add overlays for: ${concept.title}`,
        details: overlayDetails.length > 0 ? overlayDetails : [concept.overlay_text],
        completed: false,
        stage: stage
      });
    }

    return items;
  };

  const handleConceptSelection = async (conceptId: string, concept: any, stage: string, isChecked: boolean) => {
    setIsSaving(true);
    
    try {
      let updatedChecklist = [...(workspace.production_checklist || [])];
      
      if (isChecked) {
        // Add to selected
        setSelectedConcepts(prev => new Set(prev).add(conceptId));
        
        // Generate checklist items for this concept
        const newItems = generateChecklistForConcept(concept, stage, conceptId);
        updatedChecklist = [...updatedChecklist, ...newItems];
        
        toast.success(`Added "${concept.title}" to production checklist`);
      } else {
        // Remove from selected
        setSelectedConcepts(prev => {
          const next = new Set(prev);
          next.delete(conceptId);
          return next;
        });
        
        // Remove all checklist items for this concept
        updatedChecklist = updatedChecklist.filter((item: any) => item.concept_id !== conceptId);
        
        toast.success(`Removed "${concept.title}" from production checklist`);
      }
      
      // Save to database
      const { error } = await supabase
        .from('campaign_workspaces')
        .update({ 
          production_checklist: updatedChecklist,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      if (error) throw error;
      
      // Update parent component
      await onUpdate({ production_checklist: updatedChecklist });
      
    } catch (error: any) {
      console.error("Error updating checklist:", error);
      toast.error("Failed to update checklist");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleExpand = async (conceptId: string, concept: any, stage: string, action: 'regenerate' | 'more_options' | 'expand_idea') => {
    const actionLabels = {
      regenerate: 'Regenerating',
      more_options: 'Getting more options',
      expand_idea: 'Expanding idea'
    };
    
    toast.info(`${actionLabels[action]}...`);
    setIsSaving(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('expand-creative', {
        body: {
          concept,
          action,
          stage,
          brandName: workspace.brands?.name || 'Your Brand',
          audiencePsychology: workspace.brands?.audience_psychology
        }
      });
      
      if (error) throw error;
      
      if (data.error) {
        if (data.error.includes('429')) {
          toast.error('Rate limit exceeded. Please wait a moment.');
        } else if (data.error.includes('402')) {
          toast.error('AI credits depleted. Please add credits in Settings.');
        } else {
          toast.error(data.error);
        }
        return;
      }
      
      const newConcepts = data.concepts || [];
      console.log('Received expanded concepts:', newConcepts);
      
      // Add new concepts to the creative mix
      const updatedCreative = { ...creative };
      if (!updatedCreative.creative_mix) {
        updatedCreative.creative_mix = { tofu: [], mofu: [], bofu: [] };
      }
      
      // Add version metadata to new concepts
      const conceptsWithMeta = newConcepts.map((c: any, idx: number) => ({
        ...c,
        version: Date.now(),
        original_id: conceptId,
        action_taken: action,
        variant_index: idx
      }));
      
      // Insert after the original concept
      const stageArray = updatedCreative.creative_mix[stage] || [];
      const originalIndex = parseInt(conceptId.split('-')[1]);
      stageArray.splice(originalIndex + 1, 0, ...conceptsWithMeta);
      updatedCreative.creative_mix[stage] = stageArray;
      
      // Save to workspace
      const { error: updateError } = await supabase
        .from('campaign_workspaces')
        .update({
          creative_json: updatedCreative,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      if (updateError) throw updateError;
      
      // Update parent component
      await onUpdate({ creative_json: updatedCreative });
      
      toast.success(`Generated ${newConcepts.length} new variation${newConcepts.length > 1 ? 's' : ''}!`);
      
    } catch (error: any) {
      console.error('Error expanding creative:', error);
      toast.error('Failed to expand creative. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!creative || Object.keys(creative).length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No creative assets generated yet</p>
            <Button onClick={() => window.location.href = `/creative?workspace=${workspace.id}`}>
              Generate Creative
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const creativeMix = creative.creative_mix || {};
  const tofuCreative = creativeMix.tofu || [];
  const mofuCreative = creativeMix.mofu || [];
  const bofuCreative = creativeMix.bofu || [];

  const allStages = [
    { id: "tofu", label: "TOFU (Awareness)", items: tofuCreative, color: "border-blue-500" },
    { id: "mofu", label: "MOFU (Consideration)", items: mofuCreative, color: "border-purple-500" },
    { id: "bofu", label: "BOFU (Conversion)", items: bofuCreative, color: "border-green-500" },
  ];

  const renderConcept = (concept: any, index: number, stage: string) => {
    const conceptId = `${stage}-${index}`;
    const isExpanded = expandedConcepts.has(conceptId);
    const isSelected = selectedConcepts.has(conceptId);
    const FormatIcon = formatIcons[concept.format as keyof typeof formatIcons] || FileText;

    return (
      <Card 
        key={conceptId} 
        className={`border-l-4 transition-all ${
          stage === 'tofu' ? 'border-l-blue-500' : 
          stage === 'mofu' ? 'border-l-purple-500' : 
          'border-l-green-500'
        } ${isSelected ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}
      >
        <Collapsible open={isExpanded} onOpenChange={() => toggleConcept(conceptId)}>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-4">
              <div className="pt-1">
                <Checkbox 
                  checked={isSelected}
                  disabled={isSaving}
                  onCheckedChange={(checked) => 
                    handleConceptSelection(conceptId, concept, stage, checked === true)
                  }
                  className="h-5 w-5"
                />
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FormatIcon className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-base">{concept.title}</h4>
                  {isSelected && (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Selected
                    </Badge>
                  )}
                  {concept.action_taken && (
                    <Badge variant="outline" className="bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400">
                      {concept.action_taken === 'regenerate' && '🔄 Regenerated'}
                      {concept.action_taken === 'more_options' && '✨ Variation'}
                      {concept.action_taken === 'expand_idea' && '📝 Expanded'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={stageColors[stage as keyof typeof stageColors]}>
                    {stage.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary">{concept.format}</Badge>
                  {concept.angle && (
                    <Badge variant="outline" className="bg-accent/50">
                      {concept.angle}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleExpand(conceptId, concept, stage, 'regenerate')}
                  disabled={isSaving}
                  title="Regenerate this concept with a new angle"
                >
                  <RefreshCw className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {concept.script && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Script</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(concept.script, "Script")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                    {concept.script}
                  </p>
                </div>
              )}

              {concept.overlay_text && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Overlay Text</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md">{concept.overlay_text}</p>
                </div>
              )}

              {concept.broll_instructions && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">B-Roll Instructions</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                    {concept.broll_instructions}
                  </p>
                </div>
              )}

              {concept.carousel_structure && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Carousel Structure</p>
                  <div className="text-sm bg-muted/30 p-3 rounded-md">
                    {typeof concept.carousel_structure === 'string' 
                      ? concept.carousel_structure 
                      : JSON.stringify(concept.carousel_structure, null, 2)}
                  </div>
                </div>
              )}

              {concept.static_layout && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Static Layout</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                    {concept.static_layout}
                  </p>
                </div>
              )}

              {concept.psychology_trigger && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Psychology Trigger</p>
                  <p className="text-sm text-primary bg-primary/5 p-3 rounded-md">
                    {concept.psychology_trigger}
                  </p>
                </div>
              )}

              {concept.why_it_works && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Why This Works</p>
                  <p className="text-sm bg-accent/10 p-3 rounded-md">
                    {concept.why_it_works}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExpand(conceptId, concept, stage, 'more_options')}
                  disabled={isSaving}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  More Options
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExpand(conceptId, concept, stage, 'expand_idea')}
                  disabled={isSaving}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Expand Idea
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Funnel Stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {allStages.map((stage) => {
              const selectedInStage = stage.items.filter((_: any, idx: number) => 
                selectedConcepts.has(`${stage.id}-${idx}`)
              ).length;
              
              return (
                <Button
                  key={stage.id}
                  variant={activeStage === stage.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveStage(stage.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm">{stage.label}</span>
                    <div className="flex items-center gap-1">
                      {selectedInStage > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 px-1">
                          {selectedInStage}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="ml-1">
                        {stage.items.length}
                      </Badge>
                    </div>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Selection Summary */}
        {selectedConcepts.size > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Selected Creative
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total selected:</span>
                <Badge variant="default">{selectedConcepts.size}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Production checklist items have been auto-generated for selected concepts.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          <div className="space-y-6 pr-4">
            {allStages
              .filter(stage => activeStage === "all" || stage.id === activeStage)
              .map((stage) => (
                <div key={stage.id}>
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-1">{stage.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stage.id === "tofu" && "Awareness stage: Hooks and curiosity-driven creative"}
                      {stage.id === "mofu" && "Consideration stage: Story, proof, and authority"}
                      {stage.id === "bofu" && "Conversion stage: Clear offers and calls-to-action"}
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {stage.items.length > 0 ? (
                      stage.items.map((concept: any, index: number) => 
                        renderConcept(concept, index, stage.id)
                      )
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No {stage.id.toUpperCase()} creative generated yet
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}