import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, Film, Image, Layers, Trash2, CheckCircle2, ArrowRight, Sparkles, Library, Crown, Info, ChevronDown, ChevronUp, Copy, Mic, Type, Eye, Volume2, Brain, Download, Printer, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LumiThinking } from "@/components/LumiThinking";

const hookTechniqueLabels: Record<string, { label: string; color: string }> = {
  mid_sentence: { label: "Mid-Sentence Start", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  confession: { label: "Confession", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  controversial: { label: "Controversial", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  specific_number: { label: "Specific Number", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  pattern_interrupt: { label: "Pattern Interrupt", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

// Hook technique explanations for education
const hookTechniqueExplanations: Record<string, string> = {
  mid_sentence: "Starting mid-thought makes viewers feel like they walked into a private conversation. Instant curiosity.",
  confession: "Vulnerability builds trust fast. Admitting a struggle or mistake creates an emotional connection.",
  controversial: "Bold takes stop the scroll. Challenging common beliefs makes people want to hear your reasoning.",
  specific_number: "Exact numbers signal credibility and experience. Generic claims get ignored; specifics get attention.",
  pattern_interrupt: "The unexpected breaks mental autopilot. When something doesn't fit the pattern, we pay attention.",
};
export interface TextOverlay {
  text: string;
  timing: string;
  type?: "hook" | "pain" | "transition" | "insight" | "proof" | "cta";
  /** Optional drag-positioned xy (0–1 normalized of video size, center of text). */
  xy?: { x: number; y: number };
  /** Max text-box width as a fraction (0-1) of the video width. */
  width?: number;
  /** Per-overlay font-size multiplier on top of the style's base size. */
  scale?: number;
}

/**
 * Structured creative brief that a graphic/carousel recommendation hands off to
 * the copy compiler (compose-ad) and render engine. This is the contract.
 */
export interface CreativeBrief {
  format: "single_graphic" | "carousel";
  placements: ("feed" | "story")[];
  angle: "mistake" | "curiosity" | "outcome" | "contrarian" | "question" | "story";
  concept: string;
  keyMessage: string;
  offer: string;
  cta: string;
  audience: string;
  proofPoint?: string | null;
  styleHint: "photo-forward" | "type-led" | "highlighter" | "testimonial" | "card" | "framed";
  photoTreatment: "cutout" | "with-background" | "none";
  slideCount: number;
  slidePlan?: { role: "hook" | "problem" | "framework" | "proof" | "cta" | string }[];
  imageSource?: "user-photo" | "generated" | "none";
  imagePrompt?: string | null;
}

export interface ProductionItem {
  id: string;
  format: "talking_head" | "broll" | "graphic" | "carousel";
  hook: string;
  guidance: string;
  angleName: string;
  completed: boolean;
  assetNote?: string;
  round?: string; // ISO timestamp of generation batch
  // Talking head multi-hook system
  verbal_hook?: string;
  written_hook?: string;
  visual_hook?: string;
  visual_hook_options?: string[];
  hook_technique?: "mid_sentence" | "confession" | "controversial" | "specific_number" | "pattern_interrupt";
  delivery_style?: string;
  script_lines?: string[];
  text_overlays?: TextOverlay[];
  caption_reminder?: boolean;
  // B-roll specific
  broll_vibe?: string;
  broll_shots?: string[]; // legacy — older cells may still carry these
  mood?: string;
  // Psychology fields
  psychology_trigger?: string;
  why_this_works?: string;
  // Structured handoff for graphic + carousel recommendations
  brief?: CreativeBrief;
}

export interface RankedItem extends ProductionItem {
  rank: number;
  rationale: string;
}

interface ProductionChecklistPanelProps {
  items: ProductionItem[];
  onToggleComplete: (id: string) => void;
  onRemove: (id: string) => void;
  onSaveToLibrary: (item: ProductionItem) => void;
  workspaceId?: string;
  brandId?: string;
}

const formatIcons = {
  talking_head: Video,
  broll: Film,
  graphic: Image,
  carousel: Layers,
};

const formatLabels = {
  talking_head: "Record Video",
  broll: "Record / Upload B-Roll",
  graphic: "Design Graphic",
  carousel: "Build Carousel",
};

const rankingCopy = [
  "This is where Lumi does the thinking.",
  "Analyzing your creative mix.",
  "Checking what's worked before.",
  "Making the strategic call.",
  "Finding your strongest concepts.",
];

export function ProductionChecklistPanel({
  items,
  onToggleComplete,
  onRemove,
  onSaveToLibrary,
  workspaceId,
  brandId,
}: ProductionChecklistPanelProps) {
  const navigate = useNavigate();
  const [isRanking, setIsRanking] = useState(false);
  const [rankedItems, setRankedItems] = useState<RankedItem[]>([]);
  const [overallStrategy, setOverallStrategy] = useState<string>("");
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<string | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const completedCount = items.filter((item) => item.completed).length;
  const hasMinimumItems = items.length >= 3;
  const canRank = items.length >= 6;

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyScriptToClipboard = (scriptLines: string[] | undefined) => {
    if (!scriptLines || scriptLines.length === 0) {
      toast.error("No script to copy");
      return;
    }
    const scriptText = scriptLines.join("\n");
    navigator.clipboard.writeText(scriptText);
    toast.success("Script copied to clipboard!");
  };
  const itemsNeeded = Math.max(0, 3 - items.length);

  // Get display items based on ranking state
  const getDisplayItems = () => {
    if (rankedItems.length > 0 && showTopOnly) {
      return rankedItems;
    }
    return items;
  };

  const displayItems = getDisplayItems();

  // Group items by format
  const groupedItems = displayItems.reduce((acc, item) => {
    if (!acc[item.format]) {
      acc[item.format] = [];
    }
    acc[item.format].push(item);
    return acc;
  }, {} as Record<string, (ProductionItem | RankedItem)[]>);

  const handleGoToProduction = () => {
    if (workspaceId) {
      navigate(`/production?workspace=${workspaceId}`);
    }
  };

  const handleRankConcepts = async () => {
    if (!brandId) {
      toast.error("Brand not found");
      return;
    }

    setIsRanking(true);
    try {
      const { data, error } = await supabase.functions.invoke("rank-creative-concepts", {
        body: { items, brandId },
      });

      if (error) throw error;

      if (data.rankedItems && data.rankedItems.length > 0) {
        setRankedItems(data.rankedItems);
        setOverallStrategy(data.overallStrategy || "");
        setShowTopOnly(true);
        toast.success("Lumi's Top 5 ready!");
      } else {
        toast.error("Could not rank concepts");
      }
    } catch (error: any) {
      console.error("Ranking error:", error);
      if (error.message?.includes("429")) {
        toast.error("Rate limited. Please try again in a moment.");
      } else if (error.message?.includes("402")) {
        toast.error("AI credits depleted. Please add credits.");
      } else {
        toast.error("Failed to rank concepts");
      }
    } finally {
      setIsRanking(false);
    }
  };

  const handleSaveToLibrary = async (item: ProductionItem) => {
    setSavingToLibrary(item.id);
    try {
      await onSaveToLibrary(item);
    } finally {
      setSavingToLibrary(null);
    }
  };

  const isRankedItem = (item: ProductionItem | RankedItem): item is RankedItem => {
    return "rank" in item;
  };

  if (items.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Production Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No items yet</p>
            <p className="text-xs mt-1">Click "Add to Checklist" on creative cells to build your production list</p>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Add at least 3 concepts to continue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Production Checklist</CardTitle>
            <Badge variant={hasMinimumItems ? "default" : "secondary"} className={hasMinimumItems ? "bg-green-500/10 text-green-600 border-green-500/20" : ""}>
              {hasMinimumItems ? (
                <><Sparkles className="h-3 w-3 mr-1" />{items.length} ready</>
              ) : (
                <>{items.length}/3 min</>
              )}
            </Badge>
          </div>
          {!hasMinimumItems && (
            <p className="text-xs text-muted-foreground mt-1">
              Add {itemsNeeded} more concept{itemsNeeded !== 1 ? 's' : ''} to unlock Production
            </p>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col">
          {/* Lumi's Top 5 Section */}
          {canRank && (
            <div className="px-6 pb-4">
              {rankedItems.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={handleRankConcepts}
                  disabled={isRanking}
                >
                  <Crown className="h-4 w-4" />
                  Get Lumi's Top 5
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Button
                      variant={showTopOnly ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowTopOnly(!showTopOnly)}
                    >
                      <Crown className="h-3 w-3" />
                      {showTopOnly ? "Top 5 Only" : "Show Top 5"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRankConcepts}
                      disabled={isRanking}
                    >
                      Re-rank
                    </Button>
                  </div>
                  {overallStrategy && showTopOnly && (
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      {overallStrategy}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <ScrollArea className="flex-1 max-h-[calc(100vh-400px)]">
            <div className="px-6 pb-6 space-y-6">
              {Object.entries(groupedItems).map(([format, formatItems]) => {
                const Icon = formatIcons[format as keyof typeof formatIcons];
                return (
                  <div key={format} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      {formatLabels[format as keyof typeof formatLabels]}
                    </div>
                    <div className="space-y-2">
                      {formatItems.map((item) => {
                        const ranked = isRankedItem(item);
                        const isExpanded = expandedItems.has(item.id);
                        const isTalkingHead = item.format === "talking_head";
                        const hasScriptDetails = isTalkingHead && (item.script_lines?.length || item.verbal_hook || item.written_hook || item.visual_hook);
                        
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "p-3 rounded-lg border bg-card transition-all",
                              item.completed && "opacity-60",
                              ranked && "ring-1 ring-primary/30 bg-primary/5"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={item.completed}
                                onCheckedChange={() => onToggleComplete(item.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {ranked && (
                                    <Badge variant="default" className="bg-primary text-primary-foreground text-xs px-1.5 py-0">
                                      #{item.rank}
                                    </Badge>
                                  )}
                                  <p
                                    className={cn(
                                      "font-medium text-sm flex-1",
                                      item.completed && "line-through"
                                    )}
                                  >
                                    {item.hook}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.guidance}
                                </p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {item.angleName}
                                  </Badge>
                                  {item.hook_technique && hookTechniqueLabels[item.hook_technique] && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn("text-xs", hookTechniqueLabels[item.hook_technique].color)}
                                    >
                                      {hookTechniqueLabels[item.hook_technique].label}
                                    </Badge>
                                  )}
                                  {ranked && item.rationale && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5"
                                          onClick={() => setExpandedRationale(
                                            expandedRationale === item.id ? null : item.id
                                          )}
                                        >
                                          <Info className="h-3 w-3 text-primary" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="max-w-xs">
                                        <p className="text-xs">{item.rationale}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                {ranked && expandedRationale === item.id && (
                                  <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                                    {item.rationale}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Copy Script button for talking head */}
                                {isTalkingHead && item.script_lines?.length && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => copyScriptToClipboard(item.script_lines)}
                                    title="Copy script to clipboard"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {/* Expand/collapse for talking head details */}
                                {hasScriptDetails && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => toggleExpand(item.id)}
                                    title={isExpanded ? "Collapse details" : "Expand script details"}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleSaveToLibrary(item)}
                                  disabled={savingToLibrary === item.id}
                                  title="Save to Library for later"
                                >
                                  <Library className={cn("h-3.5 w-3.5", savingToLibrary === item.id && "animate-pulse")} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => onRemove(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Structured creative brief for graphic / carousel cells */}
                            {(item.format === "graphic" || item.format === "carousel") && item.brief && (
                              <div className="mt-4 pt-4 border-t border-border space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold">Creative Brief</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      {item.brief.format === "carousel"
                                        ? `Carousel · ${item.brief.slideCount} slides`
                                        : "Single graphic"}
                                    </Badge>
                                    {item.brief.styleHint && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        {item.brief.styleHint}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <BriefRow label="Concept" value={item.brief.concept} />
                                  <BriefRow label="Key message" value={item.brief.keyMessage} />
                                  <BriefRow label="Offer" value={item.brief.offer} />
                                  <BriefRow label="CTA" value={item.brief.cta} />
                                  <BriefRow label="Audience" value={item.brief.audience} />
                                  <BriefRow label="Angle" value={item.brief.angle} />
                                  {item.brief.proofPoint && (
                                    <BriefRow label="Proof" value={item.brief.proofPoint} />
                                  )}
                                  <BriefRow
                                    label="Placements"
                                    value={(item.brief.placements || []).join(", ") || "feed"}
                                  />
                                  {item.brief.photoTreatment && (
                                    <BriefRow label="Photo" value={item.brief.photoTreatment} />
                                  )}
                                </div>

                                {item.brief.format === "carousel" && item.brief.slidePlan?.length ? (
                                  <div className="space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                      Slide plan
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {item.brief.slidePlan.map((s, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px]">
                                          {i + 1}. {s.role}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <Button
                                  size="sm"
                                  className="w-full gap-2"
                                  onClick={() => {
                                    window.dispatchEvent(
                                      new CustomEvent("creative-brief:generate", {
                                        detail: { itemId: item.id, brief: item.brief },
                                      })
                                    );
                                    toast.success("Brief queued for the generator");
                                  }}
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                  Generate this creative
                                </Button>
                              </div>
                            )}


                            {/* Expanded Talking Head Details */}
                            {isTalkingHead && isExpanded && (
                              <div className="mt-4 pt-4 border-t border-border space-y-4">
                                {/* Three-Hook System Explainer */}
                                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-green-500/5 border">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold">The Three-Hook System</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-3">
                                    Capture attention in the first 3 seconds with hooks that work together:
                                  </p>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <Mic className="h-3 w-3 text-blue-500" />
                                      <span className="font-medium">Verbal</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Type className="h-3 w-3 text-purple-500" />
                                      <span className="font-medium">Written</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Eye className="h-3 w-3 text-green-500" />
                                      <span className="font-medium">Visual</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Hook Cards */}
                                <div className="grid gap-3">
                                  {/* Verbal Hook */}
                                  {item.verbal_hook && (
                                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                                        <Mic className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold uppercase">Verbal Hook</span>
                                      </div>
                                      <p className="text-sm font-medium">"{item.verbal_hook}"</p>
                                    </div>
                                  )}

                                  {/* Written Hook */}
                                  {item.written_hook && (
                                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                                        <Type className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold uppercase">Written Hook (On Screen)</span>
                                      </div>
                                      <p className="text-sm font-medium">"{item.written_hook}"</p>
                                    </div>
                                  )}

                                  {/* Visual Hook */}
                                  {(item.visual_hook || item.visual_hook_options?.length) && (
                                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                                      <div className="flex items-center gap-2 text-green-600 mb-1">
                                        <Eye className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold uppercase">Visual Hook Options</span>
                                      </div>
                                      {item.visual_hook_options && item.visual_hook_options.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {item.visual_hook_options.map((option, idx) => (
                                            <Badge key={idx} variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                                              {option}
                                            </Badge>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm">{item.visual_hook}</p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Why This Works - Psychology Card */}
                                {(item.psychology_trigger || item.why_this_works || item.hook_technique) && (
                                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Brain className="h-4 w-4 text-primary" />
                                      <span className="text-sm font-semibold">Why This Works</span>
                                    </div>
                                    {item.psychology_trigger && (
                                      <Badge variant="outline" className="mb-2 text-xs bg-primary/10 text-primary border-primary/30">
                                        {item.psychology_trigger}
                                      </Badge>
                                    )}
                                    {item.why_this_works && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {item.why_this_works}
                                      </p>
                                    )}
                                    {item.hook_technique && hookTechniqueExplanations[item.hook_technique] && !item.why_this_works && (
                                      <p className="text-sm text-muted-foreground">
                                        {hookTechniqueExplanations[item.hook_technique]}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Line-by-Line Script */}
                                {item.script_lines && item.script_lines.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold flex items-center gap-2">
                                        📜 Your Script
                                      </h4>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => copyScriptToClipboard(item.script_lines)}
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copy Script
                                      </Button>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                                      {item.script_lines.map((line, idx) => (
                                        <div key={idx} className="flex gap-2 text-sm">
                                          <span className="text-muted-foreground w-5 shrink-0 text-right">{idx + 1}.</span>
                                          <span className={cn(
                                            line.includes("(pause)") || line.includes("(lean") ? "italic text-muted-foreground" : ""
                                          )}>{line}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* B-Roll Vibe + Library Link (broll cells only) */}
                                {item.format === "broll" && (item.broll_vibe || (item.broll_shots && item.broll_shots.length > 0)) && (
                                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Film className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-semibold">B-Roll Vibe</span>
                                    </div>
                                    {item.broll_vibe && (
                                      <p className="text-sm">{item.broll_vibe}</p>
                                    )}
                                    <a
                                      href="/creative-toolkit"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    >
                                      Grab footage from your B-Roll Library →
                                    </a>
                                    {item.broll_shots && item.broll_shots.length > 0 && (
                                      <details className="text-xs text-muted-foreground">
                                        <summary className="cursor-pointer">Older shot ideas</summary>
                                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                                          {item.broll_shots.map((s, i) => (<li key={i}>{s}</li>))}
                                        </ul>
                                      </details>
                                    )}
                                  </div>
                                )}

                                {/* Text Overlays — the ad itself */}
                                {item.text_overlays && item.text_overlays.length > 0 && (
                                  <div className="space-y-2">
                                    <div>
                                      <h4 className="text-base font-semibold flex items-center gap-2">
                                        📝 Text Overlays{item.format === "broll" ? " — the ad" : ""}
                                      </h4>
                                      {item.format === "broll" && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          Powered by your brand voice — this is what sells the ad.
                                        </p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      {item.text_overlays.map((overlay, idx) => (
                                        <div
                                          key={idx}
                                          className={cn(
                                            "p-2 rounded border text-sm",
                                            overlay.type === "hook" && "bg-blue-500/5 border-blue-500/20",
                                            overlay.type === "pain" && "bg-rose-500/5 border-rose-500/20",
                                            overlay.type === "transition" && "bg-amber-500/5 border-amber-500/20",
                                            overlay.type === "insight" && "bg-purple-500/5 border-purple-500/20",
                                            overlay.type === "proof" && "bg-teal-500/5 border-teal-500/20",
                                            overlay.type === "cta" && "bg-green-500/5 border-green-500/20",
                                            !overlay.type && "bg-muted/50"
                                          )}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              {overlay.type && (
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                  {overlay.type}
                                                </Badge>
                                              )}
                                              <span>"{overlay.text}"</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                              ⏱️ {overlay.timing}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Delivery Style Tip */}
                                {item.delivery_style && (
                                  <div className="p-3 bg-muted/30 rounded-lg">
                                    <p className="text-sm italic text-muted-foreground">
                                      💡 <span className="font-medium">Delivery:</span> {item.delivery_style}
                                    </p>
                                  </div>
                                )}

                                {/* Caption Reminder */}
                                {item.caption_reminder !== false && (
                                  <Alert className="border-amber-500/30 bg-amber-500/5">
                                    <Volume2 className="h-4 w-4 text-amber-600" />
                                    <AlertDescription className="text-amber-700 text-sm">
                                      🔇 85% of viewers watch without sound — always add captions!
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          
          {/* CTA Section */}
          <div className="p-4 border-t border-border mt-auto">
            <Button 
              onClick={handleGoToProduction}
              disabled={!hasMinimumItems}
              className="w-full"
              size="lg"
            >
              {hasMinimumItems ? (
                <>
                  Go to Production
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                `Add ${itemsNeeded} more to continue`
              )}
            </Button>
            {hasMinimumItems && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Record videos, upload assets & approve concepts
              </p>
            )}
          </div>
        </CardContent>

        <LumiThinking isOpen={isRanking} customCopy={rankingCopy} />
      </Card>
    </TooltipProvider>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-xs leading-snug">{value}</p>
    </div>
  );
}
