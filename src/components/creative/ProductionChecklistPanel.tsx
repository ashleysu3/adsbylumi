import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Video, Film, Image, Trash2, CheckCircle2, ArrowRight, Sparkles, Library, Crown, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LumiThinking } from "@/components/LumiThinking";

export interface TextOverlay {
  text: string;
  timing: string;
  type?: "hook" | "transition" | "insight" | "cta";
}

export interface ProductionItem {
  id: string;
  format: "talking_head" | "broll" | "graphic";
  hook: string;
  guidance: string;
  angleName: string;
  completed: boolean;
  assetNote?: string;
  // Talking head multi-hook system
  verbal_hook?: string;
  written_hook?: string;
  visual_hook?: string;
  script_lines?: string[];
  text_overlays?: TextOverlay[];
  caption_reminder?: boolean;
  // Psychology fields
  psychology_trigger?: string;
  why_this_works?: string;
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
};

const formatLabels = {
  talking_head: "Record Video",
  broll: "Record / Upload B-Roll",
  graphic: "Design Graphic",
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

  const completedCount = items.filter((item) => item.completed).length;
  const hasMinimumItems = items.length >= 3;
  const canRank = items.length >= 6;
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
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {item.angleName}
                                  </Badge>
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
