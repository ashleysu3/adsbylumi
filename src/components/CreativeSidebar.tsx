import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Bookmark,
  Star,
  ChevronDown,
  ChevronRight,
  User,
  Camera,
  Smartphone,
  MessageSquare,
  ArrowLeftRight,
  LayoutGrid,
  Wand2,
  Monitor,
  Sparkles,
  Lightbulb,
  Shield,
  GraduationCap,
  AlertCircle,
  TrendingUp,
  Eye,
  Palette,
  Film,
  Copy
} from "lucide-react";
import { useState } from "react";

interface CreativeSidebarProps {
  workspace: any;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNavigateToProduction: () => void;
}

export function CreativeSidebar({ workspace, activeSection, onSectionChange, onNavigateToProduction }: CreativeSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["journey", "format"]);
  
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

  // Count loved by stage
  const lovedByStage = {
    grow: lovedConcepts.filter((id: string) => growConcepts.some((c: any) => c.id === id)).length,
    nurture: lovedConcepts.filter((id: string) => nurtureConcepts.some((c: any) => c.id === id)).length,
    convert: lovedConcepts.filter((id: string) => convertConcepts.some((c: any) => c.id === id)).length,
  };
  
  // Count by format type
  const formatCounts = {
    talking_head: allConcepts.filter(c => c.format === 'talking_head' || (c.script && !c.format)).length,
    b_roll: allConcepts.filter(c => c.format === 'b_roll' || c.broll_instructions).length,
    pov_reel: allConcepts.filter(c => c.format === 'pov_reel').length,
    testimonial: allConcepts.filter(c => c.format === 'testimonial').length,
    before_after: allConcepts.filter(c => c.format === 'before_after').length,
    carousel: allConcepts.filter(c => c.format === 'carousel').length,
    static: allConcepts.filter(c => c.format === 'static' || c.format === 'static_graphic').length,
    lofi: allConcepts.filter(c => c.format === 'lofi' || c.format === 'scrappy').length,
    screen_recording: allConcepts.filter(c => c.format === 'screen_recording').length,
  };

  // Count by content type
  const contentTypeCounts = {
    story: allConcepts.filter(c => c.content_type === 'story' || c.psychology_trigger?.includes('story')).length,
    transformation: allConcepts.filter(c => c.content_type === 'transformation' || c.psychology_trigger?.includes('transform')).length,
    identity: allConcepts.filter(c => c.content_type === 'identity' || c.psychology_trigger?.includes('identity')).length,
    emotional: allConcepts.filter(c => c.content_type === 'emotional' || c.psychology_trigger?.includes('emotion')).length,
    authority: allConcepts.filter(c => c.content_type === 'authority' || c.psychology_trigger?.includes('authority')).length,
    educational: allConcepts.filter(c => c.content_type === 'educational' || c.psychology_trigger?.includes('educate')).length,
    objection: allConcepts.filter(c => c.content_type === 'objection' || c.psychology_trigger?.includes('objection')).length,
  };

  // Count trends
  const trendConcepts = allConcepts.filter(c => c.is_trend || c.trend_source);
  const trendCounts = {
    trend_hooks: trendConcepts.filter(c => c.type === 'hook').length,
    trend_visuals: trendConcepts.filter(c => c.trend_type === 'visual').length,
    trend_formats: trendConcepts.filter(c => c.trend_type === 'format').length,
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

  const sections = [
    { 
      id: "journey", 
      label: "Customer Journey", 
      icon: Sparkles,
      items: [
        { id: "grow", label: "Grow", icon: Sprout, count: growCount, color: "text-emerald-600 dark:text-emerald-400" },
        { id: "nurture", label: "Nurture", icon: HeartHandshake, count: nurtureCount, color: "text-purple-600 dark:text-purple-400" },
        { id: "convert", label: "Convert", icon: Rocket, count: convertCount, color: "text-amber-600 dark:text-amber-400" },
      ]
    },
    {
      id: "format",
      label: "Format",
      icon: Film,
      items: [
        { id: "talking_head", label: "Talking Head", icon: User, count: formatCounts.talking_head },
        { id: "b_roll", label: "B-Roll", icon: Video, count: formatCounts.b_roll },
        { id: "pov_reel", label: "POV Reel", icon: Eye, count: formatCounts.pov_reel },
        { id: "testimonial", label: "Testimonial", icon: MessageSquare, count: formatCounts.testimonial },
        { id: "before_after", label: "Before/After", icon: ArrowLeftRight, count: formatCounts.before_after },
        { id: "carousel", label: "Carousel", icon: Layers, count: formatCounts.carousel },
        { id: "static", label: "Static Graphic", icon: ImageIcon, count: formatCounts.static },
        { id: "lofi", label: "Lo-Fi / Scrappy", icon: Smartphone, count: formatCounts.lofi },
        { id: "screen_recording", label: "Screen Recording", icon: Monitor, count: formatCounts.screen_recording },
      ]
    },
    {
      id: "content_type",
      label: "Content Type",
      icon: Lightbulb,
      items: [
        { id: "story", label: "Story", icon: FileText, count: contentTypeCounts.story },
        { id: "transformation", label: "Transformation", icon: Wand2, count: contentTypeCounts.transformation },
        { id: "identity", label: "Identity", icon: User, count: contentTypeCounts.identity },
        { id: "emotional", label: "Emotional", icon: Heart, count: contentTypeCounts.emotional },
        { id: "authority", label: "Authority", icon: Shield, count: contentTypeCounts.authority },
        { id: "educational", label: "Educational", icon: GraduationCap, count: contentTypeCounts.educational },
        { id: "objection", label: "Objection", icon: AlertCircle, count: contentTypeCounts.objection },
      ]
    },
    {
      id: "trends",
      label: "Trends",
      icon: TrendingUp,
      items: [
        { id: "trend_hooks", label: "Trend Hooks", icon: Sparkles, count: trendCounts.trend_hooks },
        { id: "trend_visuals", label: "Trend Visual Styles", icon: Palette, count: trendCounts.trend_visuals },
        { id: "trend_formats", label: "Trend Formats", icon: LayoutGrid, count: trendCounts.trend_formats },
      ]
    },
    {
      id: "saved",
      label: "Loved",
      icon: Heart,
      items: [
        { id: "loved-concepts", label: "Loved Concepts", icon: Heart, count: lovedConcepts.length, color: "text-pink-600 dark:text-pink-400" },
      ]
    },
    {
      id: "copy_section",
      label: "Copy Library",
      icon: Copy,
      items: [
        { id: "copy", label: "All Copy", icon: Type, count: totalCopyCount },
        { id: "saved-copy", label: "Saved Copy", icon: Star, count: totalSavedCopy, color: "text-amber-600 dark:text-amber-400" },
      ]
    }
  ];

  return (
    <div className="w-72 shrink-0 border-r border-border bg-background/50 backdrop-blur-sm">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm text-muted-foreground">Lumi Creative</h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-2 space-y-2">
          {/* Loved Creative Summary Card */}
          {lovedConcepts.length > 0 && (
            <>
              <Card className="mx-2 mt-2 p-3 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/20 dark:to-pink-900/20 border-pink-200 dark:border-pink-800">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400 fill-pink-600 dark:fill-pink-400" />
                  <span className="text-xs font-semibold text-pink-900 dark:text-pink-100">Loved Concepts</span>
                </div>
                <div className="text-3xl font-bold text-pink-900 dark:text-pink-100 mb-2">
                  {lovedConcepts.length}
                </div>
                <div className="flex flex-wrap gap-1">
                  {lovedByStage.grow > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Grow {lovedByStage.grow}
                    </Badge>
                  )}
                  {lovedByStage.nurture > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Nurture {lovedByStage.nurture}
                    </Badge>
                  )}
                  {lovedByStage.convert > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      Convert {lovedByStage.convert}
                    </Badge>
                  )}
                </div>
              </Card>
              
              <Button
                variant="default"
                className="mx-2 w-[calc(100%-1rem)] bg-pink-600 hover:bg-pink-700 dark:bg-pink-700 dark:hover:bg-pink-600 gap-2 mb-4"
                onClick={onNavigateToProduction}
              >
                <Clipboard className="h-4 w-4" />
                View Production
              </Button>
            </>
          )}
          
          {/* Collapsible Sections */}
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections.includes(section.id);
            const totalCount = section.items.reduce((sum, item) => sum + (item.count || 0), 0);
            
            return (
              <Collapsible 
                key={section.id} 
                open={isExpanded}
                onOpenChange={() => toggleSection(section.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <SectionIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalCount > 0 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {totalCount}
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-0.5 pl-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    
                    return (
                      <Button
                        key={item.id}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className={`w-full justify-start gap-2 h-8 ${item.color || ''}`}
                        onClick={() => onSectionChange(item.id)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1 text-left text-xs">{item.label}</span>
                        {typeof item.count === 'number' && item.count > 0 && (
                          <Badge variant={isActive ? "default" : "secondary"} className="ml-auto text-xs px-1.5 py-0">
                            {item.count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
