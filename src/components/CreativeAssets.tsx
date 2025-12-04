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
  ThumbsDown,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { GeneratingModal } from "@/components/GeneratingModal";

interface CreativeAssetsProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
  filterStage?: string;
  filterFormat?: string;
  filterContentType?: string;
  filterTrend?: string;
  filterFormats?: string[];
  filterContentTypes?: string[];
  onGenerateCreative?: () => void;
  isGeneratingParent?: boolean;
  onClearFilters?: () => void;
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
  grow: "bg-blue-500/10 border-blue-500/30",
  nurture: "bg-purple-500/10 border-purple-500/30",
  convert: "bg-green-500/10 border-green-500/30",
  // Legacy support
  tofu: "bg-blue-500/10 border-blue-500/30",
  mofu: "bg-purple-500/10 border-purple-500/30",
  bofu: "bg-green-500/10 border-green-500/30",
};

const stageBadgeColors = {
  grow: "bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400",
  nurture: "bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-400",
  convert: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
  // Legacy support
  tofu: "bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400",
  mofu: "bg-purple-500/20 text-purple-700 border-purple-500/30 dark:text-purple-400",
  bofu: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
};

// Map legacy stage names to new names for display
const stageDisplayNames: Record<string, string> = {
  grow: "Grow",
  nurture: "Nurture", 
  convert: "Convert",
  tofu: "Grow",
  mofu: "Nurture",
  bofu: "Convert",
};

export function CreativeAssets({ workspace, onUpdate, filterStage, filterFormat, filterContentType, filterTrend, filterFormats, filterContentTypes, onGenerateCreative, isGeneratingParent, onClearFilters }: CreativeAssetsProps) {
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
    const reminders: Record<string, string> = {
      grow: "authentic, conversational hooks with pattern interrupts and curiosity gaps",
      nurture: "trust-building through social proof, testimonials, and educational value",
      convert: "clear CTAs with urgency and specific outcomes, addressing final objections",
      // Legacy support
      tofu: "authentic, conversational hooks with pattern interrupts and curiosity gaps",
      mofu: "trust-building through social proof, testimonials, and educational value",
      bofu: "clear CTAs with urgency and specific outcomes, addressing final objections"
    };
    return reminders[stage] || "authentic, engaging content";
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

  const handleSendToProduction = async (conceptId: string, concept: any, stage: string) => {
    try {
      // Generate unique ID for production item
      const productionItemId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get existing production items
      const existingItems = workspace.production_items || [];
      
      // Check if concept is already in production
      const alreadyInProduction = existingItems.some(
        (item: any) => item.concept_id === conceptId
      );
      
      if (alreadyInProduction) {
        toast.info("This concept is already in production!");
        return;
      }
      
      // Determine format
      const format = concept.format || 
        (concept.script ? 'talking_head' : 
         concept.broll_instructions ? 'broll' : 
         concept.carousel_structure ? 'carousel' : 
         concept.static_layout ? 'static' : 'unknown');
      
      // Create production item with proper structure
      const productionItem = {
        id: productionItemId,
        concept_id: conceptId,
        concept: concept,
        format: format,
        stage: stage,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      
      const updatedItems = [...existingItems, productionItem];
      
      // Update database
      const { error } = await supabase
        .from('campaign_workspaces')
        .update({
          production_items: updatedItems,
          progress_status: 'waiting_for_assets',
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      if (error) throw error;
      
      await onUpdate({ 
        production_items: updatedItems,
        progress_status: 'waiting_for_assets'
      });
      
      toast.success(`✨ "${concept.title}" sent to production!`, {
        description: "Go to Production dashboard to record/design and upload"
      });
      
    } catch (error: any) {
      console.error('Error sending to production:', error);
      toast.error('Failed to send to production. Please try again.');
    }
  };

  const isInProduction = (conceptId: string) => {
    const existingItems = workspace.production_items || [];
    return existingItems.some((item: any) => item.concept_id === conceptId);
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

  const creativeMix = creative.creative_mix || creative.customer_journey || {};
  // Support both old (tofu/mofu/bofu) and new (grow/nurture/convert) structures
  const growCreative = creativeMix.grow || creativeMix.tofu || [];
  const nurtureCreative = creativeMix.nurture || creativeMix.mofu || [];
  const convertCreative = creativeMix.convert || creativeMix.bofu || [];

  // Apply filters
  let filteredGrow = growCreative;
  let filteredNurture = nurtureCreative;
  let filteredConvert = convertCreative;
  
  // Check if we have multi-select filters (from Lumi Recommends)
  const hasMultiFilters = (filterFormats && filterFormats.length > 0) || (filterContentTypes && filterContentTypes.length > 0);
  
  if (hasMultiFilters) {
    // Apply OR filtering: show concepts matching ANY of the selected formats OR content types
    const multiFilter = (c: any) => {
      // Check format match
      if (filterFormats && filterFormats.length > 0) {
        const formatMatches = filterFormats.some(f => {
          if (f === 'talking_head') return c.format === 'talking_head' || (c.script && !c.format);
          if (f === 'carousel') return c.format === 'carousel';
          if (f === 'testimonial') return c.format === 'testimonial';
          if (f === 'before_after') return c.format === 'before_after';
          if (f === 'pov_reel') return c.format === 'pov_reel';
          if (f === 'static') return c.format === 'static' || c.format === 'static_graphic';
          if (f === 'lofi') return c.format === 'lofi' || c.format === 'scrappy';
          if (f === 'b_roll') return c.format === 'b_roll' || c.broll_instructions;
          if (f === 'screen_recording') return c.format === 'screen_recording';
          return c.format === f;
        });
        if (formatMatches) return true;
      }
      
      // Check content type match
      if (filterContentTypes && filterContentTypes.length > 0) {
        const contentMatches = filterContentTypes.some(ct => {
          if (ct === 'educational') return c.content_type === 'educational' || c.psychology_trigger?.toLowerCase().includes('educate');
          if (ct === 'emotional') return c.content_type === 'emotional' || c.psychology_trigger?.toLowerCase().includes('emotion');
          if (ct === 'authority') return c.content_type === 'authority' || c.psychology_trigger?.toLowerCase().includes('authority');
          if (ct === 'identity') return c.content_type === 'identity' || c.psychology_trigger?.toLowerCase().includes('identity');
          if (ct === 'transformation') return c.content_type === 'transformation' || c.psychology_trigger?.toLowerCase().includes('transform');
          if (ct === 'objection') return c.content_type === 'objection' || c.psychology_trigger?.toLowerCase().includes('objection');
          return c.content_type === ct;
        });
        if (contentMatches) return true;
      }
      
      return false;
    };
    
    filteredGrow = filteredGrow.filter(multiFilter);
    filteredNurture = filteredNurture.filter(multiFilter);
    filteredConvert = filteredConvert.filter(multiFilter);
  } else if (filterFormat) {
    const formatFilter = (c: any) => {
      // Legacy format names
      if (filterFormat === 'scripts') return c.format === 'talking_head' || c.script;
      if (filterFormat === 'broll') return c.format === 'b_roll' || c.broll_instructions;
      if (filterFormat === 'carousels') return c.format === 'carousel';
      // New format filters
      if (filterFormat === 'talking_head') return c.format === 'talking_head' || (c.script && !c.format);
      if (filterFormat === 'b_roll') return c.format === 'b_roll' || c.broll_instructions;
      if (filterFormat === 'pov_reel') return c.format === 'pov_reel';
      if (filterFormat === 'testimonial') return c.format === 'testimonial';
      if (filterFormat === 'before_after') return c.format === 'before_after';
      if (filterFormat === 'carousel') return c.format === 'carousel';
      if (filterFormat === 'static') return c.format === 'static' || c.format === 'static_graphic';
      if (filterFormat === 'lofi') return c.format === 'lofi' || c.format === 'scrappy';
      if (filterFormat === 'screen_recording') return c.format === 'screen_recording';
      return true;
    };
    filteredGrow = filteredGrow.filter(formatFilter);
    filteredNurture = filteredNurture.filter(formatFilter);
    filteredConvert = filteredConvert.filter(formatFilter);
  }

  // Apply content type filter (single, only if not using multi-filter)
  if (!hasMultiFilters && filterContentType) {
    const contentTypeFilter = (c: any) => {
      if (filterContentType === 'story') return c.content_type === 'story' || c.psychology_trigger?.toLowerCase().includes('story');
      if (filterContentType === 'transformation') return c.content_type === 'transformation' || c.psychology_trigger?.toLowerCase().includes('transform');
      if (filterContentType === 'identity') return c.content_type === 'identity' || c.psychology_trigger?.toLowerCase().includes('identity');
      if (filterContentType === 'emotional') return c.content_type === 'emotional' || c.psychology_trigger?.toLowerCase().includes('emotion');
      if (filterContentType === 'authority') return c.content_type === 'authority' || c.psychology_trigger?.toLowerCase().includes('authority');
      if (filterContentType === 'educational') return c.content_type === 'educational' || c.psychology_trigger?.toLowerCase().includes('educate');
      if (filterContentType === 'objection') return c.content_type === 'objection' || c.psychology_trigger?.toLowerCase().includes('objection');
      return true;
    };
    filteredGrow = filteredGrow.filter(contentTypeFilter);
    filteredNurture = filteredNurture.filter(contentTypeFilter);
    filteredConvert = filteredConvert.filter(contentTypeFilter);
  }

  // Apply trend filter
  if (filterTrend) {
    const trendFilter = (c: any) => {
      if (!c.is_trend && !c.trend_source) return false;
      if (filterTrend === 'trend_hooks') return c.type === 'hook';
      if (filterTrend === 'trend_visuals') return c.trend_type === 'visual';
      if (filterTrend === 'trend_formats') return c.trend_type === 'format';
      return c.is_trend || c.trend_source;
    };
    filteredGrow = filteredGrow.filter(trendFilter);
    filteredNurture = filteredNurture.filter(trendFilter);
    filteredConvert = filteredConvert.filter(trendFilter);
  }
  
  const allStages = [
    { id: "grow", label: "Grow Creative", subtitle: "Reach New People", items: filteredGrow },
    { id: "nurture", label: "Nurture Creative", subtitle: "Build Trust", items: filteredNurture },
    { id: "convert", label: "Convert Creative", subtitle: "Inspire Action", items: filteredConvert },
  ].filter(stage => {
    if (!filterStage) return true;
    // Support both old and new filter values
    if (filterStage === 'tofu') return stage.id === 'grow';
    if (filterStage === 'mofu') return stage.id === 'nurture';
    if (filterStage === 'bofu') return stage.id === 'convert';
    return stage.id === filterStage;
  });

  const renderConcept = (concept: any, index: number, stage: string) => {
    const conceptId = `${stage}-${index}`;
    const isExpanded = expandedConcepts.has(conceptId);
    const isLoved = lovedConcepts.has(conceptId);
    const FormatIcon = formatIcons[concept.format as keyof typeof formatIcons] || FileText;
    
    // Helper to safely parse script content (handles stringified JSON)
    const parseScriptContent = (content: any): any => {
      if (!content) return null;
      if (Array.isArray(content)) return content;
      if (typeof content === 'string') {
        // Check if it's a stringified JSON array
        const trimmed = content.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            return JSON.parse(trimmed);
          } catch {
            return content; // Return as string if parse fails
          }
        }
        return content;
      }
      return content;
    };

    // Get the script content (handles both 'script' and 'content' fields)
    const getScriptContent = () => {
      const raw = concept.script || concept.content;
      return parseScriptContent(raw);
    };

    // Helper to format script for copying
    const formatScriptForCopy = (script: any): string => {
      const parsed = parseScriptContent(script);
      if (typeof parsed === 'string') return parsed;
      if (Array.isArray(parsed)) {
        return parsed.map((segment: any) => {
          const speaker = segment.speaker ? `[${segment.speaker}]` : '';
          const timing = segment.timing ? ` (${segment.timing})` : '';
          const text = segment.dialogue || segment.text || '';
          return `${speaker}${timing}: ${text}`;
        }).join('\n\n');
      }
      return JSON.stringify(script, null, 2);
    };

    // Helper to render script with proper formatting
    const renderScript = (script: any) => {
      const parsed = parseScriptContent(script);
      if (typeof parsed === 'string') {
        return <span>{parsed}</span>;
      }
      if (Array.isArray(parsed)) {
        return (
          <div className="space-y-3">
            {parsed.map((segment: any, i: number) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  {segment.speaker && (
                    <span className="font-semibold text-primary">{segment.speaker}</span>
                  )}
                  {segment.timing && (
                    <Badge variant="outline" className="text-xs">{segment.timing}</Badge>
                  )}
                </div>
                <p>{segment.dialogue || segment.text || ''}</p>
              </div>
            ))}
          </div>
        );
      }
      return <span>{JSON.stringify(script, null, 2)}</span>;
    };

    // Get main content preview
    const getContentPreview = () => {
      const scriptContent = getScriptContent();
      if (scriptContent) {
        // Handle array format (speaker/dialogue/timing objects)
        if (Array.isArray(scriptContent)) {
          return scriptContent
            .slice(0, 2)
            .map((segment: any) => segment.dialogue || segment.text || '')
            .filter(Boolean)
            .join(' ');
        }
        // Handle string format
        if (typeof scriptContent === 'string') {
          const lines = scriptContent.split('\n').filter((l: string) => l.trim());
          return lines.slice(0, 3).join('\n');
        }
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
              {/* Top row: Icon, Title, Format + Sentiment buttons */}
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${stageColors[stage as keyof typeof stageColors]}`}>
                  <FormatIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base leading-tight mb-2">{concept.title}</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={stageBadgeColors[stage as keyof typeof stageBadgeColors]}>
                      {stageDisplayNames[stage] || stage}
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
                {/* Sentiment buttons - top right */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant={isLoved ? "default" : "ghost"}
                    onClick={() => handleLoveIt(conceptId, concept, stage)}
                    className={`h-8 w-8 ${isLoved ? 'bg-pink-500 hover:bg-pink-600' : 'hover:bg-pink-50 dark:hover:bg-pink-950 hover:text-pink-600'}`}
                    disabled={isGenerating}
                    title={isLoved ? 'Loved' : 'Love It'}
                  >
                    <Heart className={`h-4 w-4 ${isLoved ? 'fill-current' : ''}`} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFeedbackDialog({ open: true, conceptId, concept, stage })}
                    className="h-8 w-8 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600"
                    disabled={isGenerating}
                    title="Hate It"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content Preview with inline copy button */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50 relative">
                <p className="text-sm whitespace-pre-wrap line-clamp-3 pr-8">
                  {getContentPreview()}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-7 w-7 opacity-60 hover:opacity-100"
                  onClick={() => {
                    const contentToCopy = (concept.script || concept.content)
                      ? formatScriptForCopy(concept.script || concept.content)
                      : concept.carousel_structure
                        ? JSON.stringify(concept.carousel_structure, null, 2)
                        : concept.static_layout || concept.title;
                    copyToClipboard(contentToCopy, "Creative content");
                  }}
                  title="Copy content"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Action Buttons - Clean bottom row */}
              <div className="flex items-center justify-between">
                {/* Left: Primary actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isInProduction(conceptId) ? "secondary" : "default"}
                    onClick={() => handleSendToProduction(conceptId, concept, stage)}
                    className="gap-2"
                    disabled={isGenerating || isInProduction(conceptId)}
                  >
                    <Send className="h-4 w-4" />
                    {isInProduction(conceptId) ? 'In Production' : 'Send to Production'}
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="ghost" className="gap-2">
                      <Eye className="h-4 w-4" />
                      {isExpanded ? 'Hide' : 'See'} Details
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                {/* Right: Secondary action */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMoreLikeThis(conceptId, concept, stage)}
                  className="gap-2"
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-4 w-4" />
                  More Like This
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-6 border-t border-border/50">
              {(concept.script || concept.content) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Full Script</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(formatScriptForCopy(concept.script || concept.content), "Script")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap font-mono">
                    {renderScript(concept.script || concept.content)}
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
                    {typeof concept.static_layout === 'string' ? (
                      concept.static_layout
                    ) : (
                      <div className="space-y-2">
                        {concept.static_layout.headline_text && (
                          <div>
                            <span className="font-semibold">Headline: </span>
                            {concept.static_layout.headline_text}
                          </div>
                        )}
                        {concept.static_layout.sub_headline_text && (
                          <div>
                            <span className="font-semibold">Sub-headline: </span>
                            {concept.static_layout.sub_headline_text}
                          </div>
                        )}
                        {concept.static_layout.body_text_section && (
                          <div>
                            <span className="font-semibold">Body: </span>
                            {concept.static_layout.body_text_section}
                          </div>
                        )}
                        {concept.static_layout.call_to_action && (
                          <div>
                            <span className="font-semibold">CTA: </span>
                            {concept.static_layout.call_to_action}
                          </div>
                        )}
                        {concept.static_layout.background_visual && (
                          <div>
                            <span className="font-semibold">Visual: </span>
                            {concept.static_layout.background_visual}
                          </div>
                        )}
                      </div>
                    )}
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
        {/* Filter indicator when Lumi Recommends filters are active */}
        {hasMultiFilters && (
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm">
                Showing: {[...(filterFormats || []), ...(filterContentTypes || [])].join(', ')}
              </span>
            </div>
            {onClearFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs h-7">
                Clear filters
              </Button>
            )}
          </div>
        )}
        
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
            <p className="text-muted-foreground mb-2">No creative concepts match your filters</p>
            {hasMultiFilters && onClearFilters && (
              <Button 
                onClick={onClearFilters}
                variant="outline"
                size="sm"
                className="gap-2 mb-4"
              >
                Clear filters to see all concepts
              </Button>
            )}
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

    {/* Generating Modal for expand-creative operations */}
    <GeneratingModal 
      isOpen={isGenerating} 
      title="Generating Variations"
      steps={[
        "Analyzing concept structure...",
        "Applying your preferences...",
        "Creating new variations...",
        "Optimizing for funnel stage...",
        "Finalizing concepts..."
      ]}
    />
    </>
  );
}