import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { 
  Video, 
  Image as ImageIcon, 
  Layers, 
  FileText,
  Sprout,
  HeartHandshake,
  Rocket,
  Heart,
  Clipboard,
  Type,
  Star,
  ChevronDown,
  ChevronRight,
  User,
  Smartphone,
  MessageSquare,
  ArrowLeftRight,
  Wand2,
  Monitor,
  Sparkles,
  Lightbulb,
  Shield,
  GraduationCap,
  AlertCircle,
  Eye,
  Film,
  Copy,
  Scissors,
  Zap
} from "lucide-react";
import { useState, useMemo } from "react";
import { LumiCharacter } from "./LumiCharacter";

interface CreativeSidebarProps {
  workspace: any;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNavigateToProduction: () => void;
  onRecommendationsChange?: (recommendations: string[]) => void;
}

// Lumi recommendation types based on offer/campaign/niche
const RECOMMENDATION_TYPES = [
  { id: "talking_head", label: "Talking Head", icon: User, tags: ["high-ticket", "coaching", "trust"] },
  { id: "carousel", label: "Carousel", icon: Layers, tags: ["educational", "e-commerce", "course"] },
  { id: "testimonial", label: "Testimonial", icon: MessageSquare, tags: ["social-proof", "convert", "trust"] },
  { id: "before_after", label: "Before/After", icon: ArrowLeftRight, tags: ["transformation", "fitness", "results"] },
  { id: "pov_reel", label: "POV Reel", icon: Eye, tags: ["trend", "relatable", "grow"] },
  { id: "static", label: "Static Ad", icon: ImageIcon, tags: ["retargeting", "convert", "simple"] },
  { id: "lofi", label: "Lo-Fi / UGC", icon: Smartphone, tags: ["authentic", "grow", "trend"] },
  { id: "educational", label: "Educational", icon: GraduationCap, tags: ["nurture", "value", "course"] },
  { id: "emotional", label: "Emotional", icon: Heart, tags: ["story", "connection", "identity"] },
  { id: "authority", label: "Authority", icon: Shield, tags: ["expert", "high-ticket", "trust"] },
];

export function CreativeSidebar({ workspace, activeSection, onSectionChange, onNavigateToProduction, onRecommendationsChange }: CreativeSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["journey"]);
  const [activeRecommendations, setActiveRecommendations] = useState<string[]>([]);
  
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || creative.customer_journey || {};
  const lovedConcepts = workspace.loved_concepts || [];
  
  // Support both old (tofu/mofu/bofu) and new (grow/nurture/convert) structure
  const growConcepts = creativeMix.grow || creativeMix.tofu || [];
  const nurtureConcepts = creativeMix.nurture || creativeMix.mofu || [];
  const convertConcepts = creativeMix.convert || creativeMix.bofu || [];
  
  const growCount = growConcepts.length;
  const nurtureCount = nurtureConcepts.length;
  const convertCount = convertConcepts.length;

  // All concepts for counting
  const allConcepts = [...growConcepts, ...nurtureConcepts, ...convertConcepts];

  // Generate Lumi recommendations based on workspace context
  const lumiRecommendations = useMemo(() => {
    const offerType = workspace.offer_name?.toLowerCase() || '';
    const strategyJson = workspace.strategy_json || {};
    const templateSlug = strategyJson.template_slug || '';
    
    // Score each recommendation type
    const scored = RECOMMENDATION_TYPES.map(rec => {
      let score = 0;
      
      // Boost based on offer type keywords
      if (offerType.includes('coach') || offerType.includes('course')) {
        if (['talking_head', 'testimonial', 'educational'].includes(rec.id)) score += 3;
      }
      if (offerType.includes('product') || offerType.includes('shop')) {
        if (['carousel', 'before_after', 'static'].includes(rec.id)) score += 3;
      }
      
      // Boost based on template/campaign type
      if (templateSlug.includes('grow') || templateSlug.includes('awareness')) {
        if (['pov_reel', 'lofi', 'emotional'].includes(rec.id)) score += 2;
      }
      if (templateSlug.includes('convert') || templateSlug.includes('sales')) {
        if (['testimonial', 'before_after', 'static'].includes(rec.id)) score += 2;
      }
      
      // Add some variety - boost based on existing content gaps
      const existingCount = allConcepts.filter(c => c.format === rec.id || c.content_type === rec.id).length;
      if (existingCount === 0) score += 1;
      
      // Base score for popular formats
      if (['talking_head', 'carousel', 'testimonial'].includes(rec.id)) score += 1;
      
      return { ...rec, score };
    });
    
    // Return top 5-6 recommendations
    return scored.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [workspace, allConcepts]);

  // Count by format type - VIDEO formats
  const videoFormatCounts = {
    talking_head: allConcepts.filter(c => c.format === 'talking_head' || (c.script && !c.format)).length,
    pov_reel: allConcepts.filter(c => c.format === 'pov_reel').length,
    b_roll: allConcepts.filter(c => c.format === 'b_roll' || c.broll_instructions).length,
    testimonial: allConcepts.filter(c => c.format === 'testimonial').length,
    before_after: allConcepts.filter(c => c.format === 'before_after').length,
    screen_recording: allConcepts.filter(c => c.format === 'screen_recording').length,
    clip_remix: allConcepts.filter(c => c.format === 'clip_remix' || c.format === 'remix').length,
  };

  // Count by format type - GRAPHICS formats
  const graphicsFormatCounts = {
    carousel: allConcepts.filter(c => c.format === 'carousel').length,
    static: allConcepts.filter(c => c.format === 'static' || c.format === 'static_graphic').length,
    lofi: allConcepts.filter(c => c.format === 'lofi' || c.format === 'scrappy').length,
  };

  // Count by content/story type
  const storyTypeCounts = {
    identity: allConcepts.filter(c => c.content_type === 'identity' || c.psychology_trigger?.includes('identity')).length,
    educational: allConcepts.filter(c => c.content_type === 'educational' || c.psychology_trigger?.includes('educate')).length,
    transformation: allConcepts.filter(c => c.content_type === 'transformation' || c.psychology_trigger?.includes('transform')).length,
    emotional: allConcepts.filter(c => c.content_type === 'emotional' || c.psychology_trigger?.includes('emotion')).length,
    authority: allConcepts.filter(c => c.content_type === 'authority' || c.psychology_trigger?.includes('authority')).length,
    objection: allConcepts.filter(c => c.content_type === 'objection' || c.psychology_trigger?.includes('objection')).length,
  };

  // Count copy items
  const adCopyLibrary = creative.ad_copy_library || {};
  const headlinesCount = (adCopyLibrary.headlines || creative.headlines || []).length;
  const primaryCopyObj = adCopyLibrary.primary_copy || creative.primary_copy || {};
  const primaryCopyCount = Array.isArray(primaryCopyObj) 
    ? primaryCopyObj.length 
    : (primaryCopyObj.short?.length || 0) + (primaryCopyObj.medium?.length || 0) + (primaryCopyObj.long?.length || 0);
  const descriptionsCount = (adCopyLibrary.descriptions || creative.descriptions || []).length;
  const totalCopyCount = headlinesCount + primaryCopyCount + descriptionsCount;

  // Count saved concepts (selected copy)
  const selectedCopy = workspace.selected_copy || {};
  const savedHeadlines = selectedCopy.headlines?.length || 0;
  const savedPrimary = selectedCopy.primary_copy?.length || 0;
  const savedDescriptions = selectedCopy.descriptions?.length || 0;
  const totalSavedCopy = savedHeadlines + savedPrimary + savedDescriptions;

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const toggleRecommendation = (recId: string) => {
    const newRecs = activeRecommendations.includes(recId) 
      ? activeRecommendations.filter(id => id !== recId)
      : [...activeRecommendations, recId];
    
    setActiveRecommendations(newRecs);
    
    // Notify parent with the full array of active recommendations
    onRecommendationsChange?.(newRecs);
  };

  const clearAllRecommendations = () => {
    setActiveRecommendations([]);
    onRecommendationsChange?.([]);
  };

  return (
    <div className="w-72 shrink-0 border-r border-border bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <LumiCharacter size="xs" />
        <h3 className="font-semibold text-sm text-foreground">Lumi Creative</h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-3 space-y-1">
          
          {/* ✨ Lumi Recommends Section */}
          <Card className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Lumi Recommends</span>
              </div>
              {activeRecommendations.length > 0 && (
                <button
                  onClick={clearAllRecommendations}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              {activeRecommendations.length > 0 
                ? `Filtering by ${activeRecommendations.length} type${activeRecommendations.length > 1 ? 's' : ''}`
                : 'Based on your offer, niche & psychology'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lumiRecommendations.map((rec) => {
                const Icon = rec.icon;
                const isActive = activeRecommendations.includes(rec.id);
                return (
                  <button
                    key={rec.id}
                    onClick={() => toggleRecommendation(rec.id)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {rec.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <Separator className="my-2 bg-border/50" />
          
          {/* A. Customer Journey - Expanded by default */}
          <Collapsible 
            open={expandedSections.includes("journey")}
            onOpenChange={() => toggleSection("journey")}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Customer Journey</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                    {growCount + nurtureCount + convertCount}
                  </Badge>
                  {expandedSections.includes("journey") ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-0.5 pl-2 mt-1">
              <Button
                variant={activeSection === "grow" ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-2 h-8"
                onClick={() => onSectionChange("grow")}
              >
                <Sprout className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="flex-1 text-left text-xs">Grow</span>
                {growCount > 0 && (
                  <Badge variant={activeSection === "grow" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {growCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant={activeSection === "nurture" ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-2 h-8"
                onClick={() => onSectionChange("nurture")}
              >
                <HeartHandshake className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span className="flex-1 text-left text-xs">Nurture</span>
                {nurtureCount > 0 && (
                  <Badge variant={activeSection === "nurture" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {nurtureCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant={activeSection === "convert" ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-2 h-8"
                onClick={() => onSectionChange("convert")}
              >
                <Rocket className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="flex-1 text-left text-xs">Convert</span>
                {convertCount > 0 && (
                  <Badge variant={activeSection === "convert" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {convertCount}
                  </Badge>
                )}
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2 bg-border/30" />

          {/* B. Creative Formats - Collapsed by default */}
          <Collapsible 
            open={expandedSections.includes("formats")}
            onOpenChange={() => toggleSection("formats")}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Creative Formats</span>
                </div>
                {expandedSections.includes("formats") ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-2 pl-2 mt-1">
              {/* VIDEO Subgroup */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <Video className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Video</span>
                </div>
                {[
                  { id: "talking_head", label: "Talking Head", icon: User, count: videoFormatCounts.talking_head },
                  { id: "pov_reel", label: "POV Reel", icon: Eye, count: videoFormatCounts.pov_reel },
                  { id: "b_roll", label: "B-Roll", icon: Video, count: videoFormatCounts.b_roll },
                  { id: "testimonial", label: "Testimonial", icon: MessageSquare, count: videoFormatCounts.testimonial },
                  { id: "before_after", label: "Before/After", icon: ArrowLeftRight, count: videoFormatCounts.before_after },
                  { id: "screen_recording", label: "Screen Recording", icon: Monitor, count: videoFormatCounts.screen_recording },
                  { id: "clip_remix", label: "Clip Remix", icon: Scissors, count: videoFormatCounts.clip_remix },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start gap-2 h-7 pl-4"
                      onClick={() => onSectionChange(item.id)}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="flex-1 text-left text-[11px]">{item.label}</span>
                      {item.count > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.count}</Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* GRAPHICS Subgroup */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <ImageIcon className="h-3 w-3 text-pink-500" />
                  <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wide">Graphics</span>
                </div>
                {[
                  { id: "carousel", label: "Carousel", icon: Layers, count: graphicsFormatCounts.carousel },
                  { id: "static", label: "Static Graphic", icon: ImageIcon, count: graphicsFormatCounts.static },
                  { id: "lofi", label: "Lo-Fi / Scrappy", icon: Smartphone, count: graphicsFormatCounts.lofi },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start gap-2 h-7 pl-4"
                      onClick={() => onSectionChange(item.id)}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="flex-1 text-left text-[11px]">{item.label}</span>
                      {item.count > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.count}</Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* STORY TYPES Subgroup */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Story Types</span>
                </div>
                {[
                  { id: "identity", label: "Identity", icon: User, count: storyTypeCounts.identity },
                  { id: "educational", label: "Educational", icon: GraduationCap, count: storyTypeCounts.educational },
                  { id: "transformation", label: "Transformational", icon: Wand2, count: storyTypeCounts.transformation },
                  { id: "emotional", label: "Emotional", icon: Heart, count: storyTypeCounts.emotional },
                  { id: "authority", label: "Authority", icon: Shield, count: storyTypeCounts.authority },
                  { id: "objection", label: "Objection", icon: AlertCircle, count: storyTypeCounts.objection },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start gap-2 h-7 pl-4"
                      onClick={() => onSectionChange(item.id)}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="flex-1 text-left text-[11px]">{item.label}</span>
                      {item.count > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.count}</Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2 bg-border/30" />

          {/* D. Loved */}
          <Button
            variant={activeSection === "loved-concepts" ? "secondary" : "ghost"}
            className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
            onClick={() => onSectionChange("loved-concepts")}
          >
            <div className="flex items-center gap-2">
              <Heart className={`h-4 w-4 ${lovedConcepts.length > 0 ? 'text-pink-500 fill-pink-500' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium text-muted-foreground">Loved</span>
            </div>
            {lovedConcepts.length > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                {lovedConcepts.length}
              </Badge>
            )}
          </Button>

          {/* E. Copy Library */}
          <Button
            variant={activeSection === "copy" ? "secondary" : "ghost"}
            className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
            onClick={() => onSectionChange("copy")}
          >
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Copy Library</span>
            </div>
            {totalCopyCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {totalCopyCount}
              </Badge>
            )}
          </Button>

          {/* Production CTA if loved concepts exist */}
          {lovedConcepts.length > 0 && (
            <>
              <Separator className="my-3 bg-border/30" />
              <Button
                variant="default"
                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white gap-2 shadow-sm"
                onClick={onNavigateToProduction}
              >
                <Clipboard className="h-4 w-4" />
                View Production ({lovedConcepts.length})
              </Button>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
