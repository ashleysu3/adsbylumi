import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Copy, 
  Heart,
  ChevronDown,
  Video,
  Image as ImageIcon,
  FileText,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  ThumbsDown
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface CreativeAssetsProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
  filterStage?: string;
  filterFormat?: string;
  onGenerateCreative?: () => void;
  isGeneratingParent?: boolean;
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
  tofu: "bg-blue-500/10 border-blue-500/30",
  mofu: "bg-purple-500/10 border-purple-500/30",
  bofu: "bg-green-500/10 border-green-500/30",
};

const stageBadgeColors = {
  tofu: "bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400",
  mofu: "bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-400",
  bofu: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
};

export function CreativeAssets({ workspace, onUpdate, filterStage, filterFormat, onGenerateCreative, isGeneratingParent }: CreativeAssetsProps) {
  const creative = workspace.creative_json || {};
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [lovedConcepts, setLovedConcepts] = useState<Set<string>>(
    new Set(workspace.loved_concepts || [])
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    conceptId: string;
    concept: any;
    stage: string;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

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

  const handleLoveIt = async (conceptId: string, concept: any, stage: string) => {
    const isLoved = lovedConcepts.has(conceptId);
    const newLovedSet = new Set(lovedConcepts);
    
    if (isLoved) {
      newLovedSet.delete(conceptId);
      toast.success(`Removed from favorites`);
    } else {
      newLovedSet.add(conceptId);
      toast.success(`❤️ Added to favorites!`, {
        description: concept.title
      });
    }
    
    setLovedConcepts(newLovedSet);
    
    // Save to database
    const { error } = await supabase
      .from('campaign_workspaces')
      .update({ 
        loved_concepts: Array.from(newLovedSet),
        updated_at: new Date().toISOString()
      })
      .eq('id', workspace.id);
    
    if (error) {
      console.error("Error saving loved concepts:", error);
      toast.error("Failed to save favorites");
      return;
    }
    
    await onUpdate({ loved_concepts: Array.from(newLovedSet) });
  };

  const getMetaBestPracticeReminder = (stage: string) => {
    const reminders = {
      tofu: "authentic, conversational hooks with pattern interrupts and curiosity gaps",
      mofu: "trust-building through social proof, testimonials, and educational value",
      bofu: "clear CTAs with urgency and specific outcomes, addressing final objections"
    };
    return reminders[stage as keyof typeof reminders] || "authentic, engaging content";
  };

  const handleHateIt = async (
    dialogData: { conceptId: string; concept: any; stage: string },
    feedback: string
  ) => {
    setIsGenerating(true);
    
    try {
      const { conceptId, concept, stage } = dialogData;
      
      // Get existing feedback data
      const existingFeedback = workspace.creative_feedback || { hated_concepts: [] };
      
      // If feedback provided, store it
      if (feedback.trim()) {
        existingFeedback.hated_concepts.push({
          conceptId,
          concept,
          stage,
          feedback: feedback.trim(),
          timestamp: new Date().toISOString()
        });
        
        toast.success("Feedback saved! We'll use this to improve future concepts.", {
          description: "The AI will learn from your preferences."
        });
      } else {
        toast.info("Concept removed without feedback");
      }
      
      // Remove concept from creative_json
      const updatedCreative = { ...workspace.creative_json };
      if (!updatedCreative.creative_mix) {
        updatedCreative.creative_mix = { tofu: [], mofu: [], bofu: [] };
      }
      
      const stageArray = updatedCreative.creative_mix[stage] || [];
      const conceptIndex = parseInt(conceptId.split('-')[1]);
      stageArray.splice(conceptIndex, 1);
      updatedCreative.creative_mix[stage] = stageArray;
      
      // Update database
      const { error } = await supabase
        .from('campaign_workspaces')
        .update({
          creative_json: updatedCreative,
          creative_feedback: existingFeedback,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      if (error) throw error;
      
      await onUpdate({ 
        creative_json: updatedCreative,
        creative_feedback: existingFeedback 
      });
      
      // Close dialog and reset
      setFeedbackDialog(null);
      setFeedbackText('');
      
    } catch (error: any) {
      console.error('Error handling hate it:', error);
      toast.error('Failed to process feedback. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMoreLikeThis = async (conceptId: string, concept: any, stage: string) => {
    toast.info('Generating variations...');
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('expand-creative', {
        body: {
          concept,
          action: 'more_options',
          stage,
          brandName: workspace.brands?.name || 'Your Brand',
          audiencePsychology: workspace.brands?.audience_psychology,
          creativeFeedback: workspace.creative_feedback
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
      const updatedCreative = { ...creative };
      if (!updatedCreative.creative_mix) {
        updatedCreative.creative_mix = { tofu: [], mofu: [], bofu: [] };
      }
      
      // Add new variations
      const stageArray = updatedCreative.creative_mix[stage] || [];
      const originalIndex = parseInt(conceptId.split('-')[1]);
      stageArray.splice(originalIndex + 1, 0, ...newConcepts);
      updatedCreative.creative_mix[stage] = stageArray;
      
      const { error: updateError } = await supabase
        .from('campaign_workspaces')
        .update({
          creative_json: updatedCreative,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      if (updateError) throw updateError;
      await onUpdate({ creative_json: updatedCreative });
      
      toast.success(`✨ Generated ${newConcepts.length} new variation${newConcepts.length > 1 ? 's' : ''}!`);
      
    } catch (error: any) {
      console.error('Error generating variations:', error);
      toast.error('Failed to generate variations. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateStage = async (stage: string) => {
    toast.info(`Regenerating all ${stage.toUpperCase()} concepts...`);
    setIsGenerating(true);
    
    try {
      const existingConcepts = creative.creative_mix?.[stage] || [];
      
      const { data, error } = await supabase.functions.invoke('expand-creative', {
        body: {
          action: 'regenerate_stage',
          stage,
          brandName: workspace.brands?.name || 'Your Brand',
          audiencePsychology: workspace.brands?.audience_psychology,
          existingConcepts,
          strategyData: workspace.strategy_json,
          creativeFeedback: workspace.creative_feedback
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
      const updatedCreative = { ...creative };
      if (!updatedCreative.creative_mix) {
        updatedCreative.creative_mix = { tofu: [], mofu: [], bofu: [] };
      }
      
      // Replace all concepts for this stage
      updatedCreative.creative_mix[stage] = newConcepts;
      
      const { error: updateError } = await supabase
        .from('campaign_workspaces')
        .update({
          creative_json: updatedCreative,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      if (updateError) throw updateError;
      await onUpdate({ creative_json: updatedCreative });
      
      toast.success(`✨ Regenerated ${newConcepts.length} ${stage.toUpperCase()} concept${newConcepts.length > 1 ? 's' : ''}!`);
      
    } catch (error: any) {
      console.error('Error regenerating stage:', error);
      toast.error('Failed to regenerate concepts. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!creative || Object.keys(creative).length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No creative assets generated yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const creativeMix = creative.creative_mix || {};
  const tofuCreative = creativeMix.tofu || [];
  const mofuCreative = creativeMix.mofu || [];
  const bofuCreative = creativeMix.bofu || [];

  // Apply filters
  let filteredTofu = tofuCreative;
  let filteredMofu = mofuCreative;
  let filteredBofu = bofuCreative;
  
  if (filterFormat) {
    const formatFilter = (c: any) => {
      if (filterFormat === 'scripts') return c.format === 'talking_head' || c.script;
      if (filterFormat === 'broll') return c.format === 'b_roll' || c.broll_instructions;
      if (filterFormat === 'carousels') return c.format === 'carousel';
      if (filterFormat === 'static') return c.format === 'static';
      return true;
    };
    filteredTofu = filteredTofu.filter(formatFilter);
    filteredMofu = filteredMofu.filter(formatFilter);
    filteredBofu = filteredBofu.filter(formatFilter);
  }
  
  const allStages = [
    { id: "tofu", label: "TOFU Creative", subtitle: "Awareness & Interest", items: filteredTofu },
    { id: "mofu", label: "MOFU Creative", subtitle: "Consideration & Trust", items: filteredMofu },
    { id: "bofu", label: "BOFU Creative", subtitle: "Decision & Action", items: filteredBofu },
  ].filter(stage => !filterStage || stage.id === filterStage);

  const renderConcept = (concept: any, index: number, stage: string) => {
    const conceptId = `${stage}-${index}`;
    const isExpanded = expandedConcepts.has(conceptId);
    const isLoved = lovedConcepts.has(conceptId);
    const FormatIcon = formatIcons[concept.format as keyof typeof formatIcons] || FileText;
    
    // Get main content preview
    const getContentPreview = () => {
      if (concept.script && typeof concept.script === 'string') {
        const lines = concept.script.split('\n').filter((l: string) => l.trim());
        return lines.slice(0, 3).join('\n');
      }
      if (concept.carousel_structure?.slides?.[0]) {
        return concept.carousel_structure.slides[0].text || '';
      }
      if (concept.static_layout && typeof concept.static_layout === 'string') {
        return concept.static_layout.split('\n')[0];
      }
      if (concept.static_layout && typeof concept.static_layout === 'object') {
        return JSON.stringify(concept.static_layout).substring(0, 100) + '...';
      }
      return concept.title;
    };

    return (
      <Card 
        key={conceptId} 
        className={`transition-all border-l-4 ${stageColors[stage as keyof typeof stageColors]} ${
          isLoved ? 'ring-2 ring-pink-500/50 bg-pink-500/5' : ''
        }`}
      >
        <Collapsible open={isExpanded} onOpenChange={() => toggleConcept(conceptId)}>
          <CardHeader className="pb-4">
            <div className="space-y-4">
              {/* Top row: Icon, Title, Format */}
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${stageColors[stage as keyof typeof stageColors]}`}>
                  <FormatIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base leading-tight mb-2">{concept.title}</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={stageBadgeColors[stage as keyof typeof stageBadgeColors]}>
                      {stage.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      <FormatIcon className="h-3 w-3 mr-1" />
                      {concept.format.replace('_', ' ')}
                    </Badge>
                    {concept.angle && (
                      <Badge variant="outline" className="bg-accent/50 capitalize">
                        {concept.angle}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Preview */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                <p className="text-sm whitespace-pre-wrap line-clamp-3">
                  {getContentPreview()}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  variant={isLoved ? "default" : "outline"}
                  onClick={() => handleLoveIt(conceptId, concept, stage)}
                  className="gap-2"
                  disabled={isGenerating}
                >
                  <Heart className={`h-4 w-4 ${isLoved ? 'fill-current' : ''}`} />
                  {isLoved ? 'Loved' : 'Love It'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFeedbackDialog({ open: true, conceptId, concept, stage })}
                  className="gap-2 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950"
                  disabled={isGenerating}
                >
                  <ThumbsDown className="h-4 w-4" />
                  Hate It
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMoreLikeThis(conceptId, concept, stage)}
                  className="gap-2"
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-4 w-4" />
                  More Like This
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const contentToCopy = concept.script || 
                      JSON.stringify(concept.carousel_structure, null, 2) || 
                      concept.static_layout || 
                      concept.title;
                    copyToClipboard(contentToCopy, "Creative content");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button size="sm" variant="ghost" className="gap-2">
                    <Eye className="h-4 w-4" />
                    {isExpanded ? 'Hide' : 'See'} Details
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-6 border-t border-border/50">
              {concept.script && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Full Script</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(concept.script, "Script")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap font-mono">
                    {concept.script}
                  </div>
                </div>
              )}

              {concept.broll_instructions && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">B-Roll Instructions</p>
                  <div className="bg-muted/30 rounded-lg p-3">
                    {Array.isArray(concept.broll_instructions) ? (
                      <ul className="space-y-2 text-sm">
                        {concept.broll_instructions.map((instruction: string, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <span>{instruction}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{concept.broll_instructions}</p>
                    )}
                  </div>
                </div>
              )}

              {concept.carousel_structure?.slides && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Carousel Structure ({concept.carousel_structure.slides.length} slides)</p>
                  <div className="space-y-3">
                    {concept.carousel_structure.slides.map((slide: any, i: number) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">Slide {i + 1}</Badge>
                        </div>
                        <p className="text-sm font-medium">{slide.text}</p>
                        {slide.visual && (
                          <p className="text-xs text-muted-foreground">Visual: {slide.visual}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {concept.static_layout && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Static Layout</p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {concept.static_layout}
                  </div>
                </div>
              )}

              {concept.overlay_text && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Text Overlays</p>
                  <div className="bg-muted/30 rounded-lg p-3">
                    {Array.isArray(concept.overlay_text) ? (
                      <ul className="space-y-1 text-sm">
                        {concept.overlay_text.map((text: string, i: number) => (
                          <li key={i}>• {text}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{concept.overlay_text}</p>
                    )}
                  </div>
                </div>
              )}

              {concept.psychology_trigger && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-primary mb-1">Psychology Trigger</p>
                  <p className="text-sm">{concept.psychology_trigger}</p>
                </div>
              )}

              {concept.why_it_works && (
                <div className="bg-accent/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Why This Works</p>
                  <p className="text-sm">{concept.why_it_works}</p>
                </div>
              )}

              {concept.production_notes && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Production Notes</p>
                  <p className="text-sm">{concept.production_notes}</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <>
      <ScrollArea className="h-[calc(100vh-12rem)]">
      <div className="space-y-8 p-6 pb-12">
        {allStages.map(stage => (
          stage.items.length > 0 && (
            <div key={stage.id} className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">{stage.label}</h2>
                  <p className="text-sm text-muted-foreground">{stage.subtitle}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRegenerateStage(stage.id)}
                  disabled={isGenerating}
                  className="gap-2 shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate All
                </Button>
              </div>
              <div className="space-y-6">
                {stage.items.map((concept: any, index: number) => 
                  renderConcept(concept, index, stage.id)
                )}
              </div>
            </div>
          )
        ))}
        
        {allStages.every(stage => stage.items.length === 0) && (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-6">No creative concepts match your filters</p>
            {onGenerateCreative && (
              <Button 
                onClick={onGenerateCreative}
                variant="default"
                className="gap-2"
                disabled={isGenerating || isGeneratingParent}
              >
                <Sparkles className="h-4 w-4" />
                {(isGenerating || isGeneratingParent) ? 'Generating...' : 'Generate Creative Concepts'}
              </Button>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
    
    <Dialog 
      open={feedbackDialog?.open || false} 
      onOpenChange={(open) => !open && setFeedbackDialog(null)}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Help Us Learn Your Preferences</DialogTitle>
          <DialogDescription>
            What didn't work for you about this concept? Your feedback helps us generate 
            better creative that aligns with your brand voice and goals.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/30 rounded-lg p-4 border">
            <p className="text-sm font-medium mb-1">{feedbackDialog?.concept?.title}</p>
            <p className="text-xs text-muted-foreground">
              {feedbackDialog?.concept?.format?.replace('_', ' ')} • {feedbackDialog?.stage?.toUpperCase()}
            </p>
          </div>
          
          <Textarea
            placeholder="What specifically didn't resonate with you? (e.g., 'Too aggressive', 'Doesn't match brand voice', 'Angle feels off-target')"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={4}
            className="resize-none"
          />
          
          {feedbackText.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                💡 <strong>Note:</strong> While we value your preferences, remember that Meta's 
                current best practices favor {getMetaBestPracticeReminder(feedbackDialog?.stage || '')}. 
                We'll balance your feedback with what's working now.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => handleHateIt(feedbackDialog!, '')}
          >
            Skip & Remove
          </Button>
          <Button
            variant="default"
            onClick={() => handleHateIt(feedbackDialog!, feedbackText)}
            disabled={isGenerating}
          >
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}