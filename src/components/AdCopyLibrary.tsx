import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check, Type, AlignLeft, MessageSquare, Smartphone, Target, Zap, TrendingUp, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AdCopyLibraryProps {
  workspace: any;
  onUpdate: (updates: any) => void;
}

const stageBadgeColors: Record<string, string> = {
  tofu: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mofu: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  bofu: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const stageIcons: Record<string, React.ElementType> = {
  tofu: Target,
  mofu: Zap,
  bofu: TrendingUp,
};

// Max selections per category for Meta Ads Manager
const MAX_SELECTIONS = 5;

export function AdCopyLibrary({ workspace, onUpdate }: AdCopyLibraryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const creative = workspace.creative_json || {};
  
  const adCopyLibrary = creative.ad_copy_library || {};
  const headlines = adCopyLibrary.headlines || creative.headlines || [];
  const primaryCopy = adCopyLibrary.primary_copy || creative.primary_copy || {};
  const descriptions = adCopyLibrary.descriptions || creative.descriptions || [];
  const storyReelCopy = adCopyLibrary.story_reel_copy || {};

  // Selection state - load from workspace or initialize
  const savedSelections = workspace.selected_copy || {};
  const [selectedHeadlines, setSelectedHeadlines] = useState<string[]>(savedSelections.headlines || []);
  const [selectedPrimaryCopy, setSelectedPrimaryCopy] = useState<string[]>(savedSelections.primary_copy || []);
  const [selectedDescriptions, setSelectedDescriptions] = useState<string[]>(savedSelections.descriptions || []);

  // AI recommendations based on variety (mix of stages and angles)
  const getAiRecommendedIds = (items: any[], prefix: string, maxRecommend = 5) => {
    if (!items.length) return [];
    
    const recommended: string[] = [];
    const stages = ['tofu', 'mofu', 'bofu'];
    
    // Try to get one from each stage first for variety
    for (const stage of stages) {
      const stageItems = items.filter(item => item.stage === stage);
      if (stageItems.length > 0 && recommended.length < maxRecommend) {
        const idx = items.findIndex(i => i === stageItems[0]);
        recommended.push(`${prefix}_${idx}`);
      }
    }
    
    // Fill remaining slots with highest quality (shortest headlines, varied angles)
    const remaining = items.filter((item, idx) => !recommended.includes(`${prefix}_${idx}`));
    for (const item of remaining) {
      if (recommended.length >= maxRecommend) break;
      const idx = items.findIndex(i => i === item);
      recommended.push(`${prefix}_${idx}`);
    }
    
    return recommended;
  };

  const recommendedHeadlines = getAiRecommendedIds(headlines, 'headline');
  const recommendedPrimaryCopy = getAiRecommendedIds(
    [...(primaryCopy.short || []), ...(primaryCopy.medium || []), ...(primaryCopy.long || [])].slice(0, 15),
    'primary'
  );
  const recommendedDescriptions = getAiRecommendedIds(descriptions, 'desc');

  // Save selections to database
  const saveSelections = async (type: string, ids: string[]) => {
    const newSelections = {
      ...savedSelections,
      [type]: ids
    };
    
    try {
      await supabase
        .from('campaign_workspaces')
        .update({ 
          selected_copy: newSelections,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      onUpdate({ selected_copy: newSelections });
    } catch (error) {
      console.error('Error saving selections:', error);
    }
  };

  const toggleSelection = (id: string, type: 'headlines' | 'primary_copy' | 'descriptions') => {
    let currentSelection: string[];
    let setSelection: React.Dispatch<React.SetStateAction<string[]>>;
    
    switch (type) {
      case 'headlines':
        currentSelection = selectedHeadlines;
        setSelection = setSelectedHeadlines;
        break;
      case 'primary_copy':
        currentSelection = selectedPrimaryCopy;
        setSelection = setSelectedPrimaryCopy;
        break;
      case 'descriptions':
        currentSelection = selectedDescriptions;
        setSelection = setSelectedDescriptions;
        break;
    }

    let newSelection: string[];
    if (currentSelection.includes(id)) {
      newSelection = currentSelection.filter(i => i !== id);
    } else {
      if (currentSelection.length >= MAX_SELECTIONS) {
        toast.error(`Maximum ${MAX_SELECTIONS} selections allowed for Meta Ads`);
        return;
      }
      newSelection = [...currentSelection, id];
    }
    
    setSelection(newSelection);
    saveSelections(type, newSelection);
  };

  const selectAiRecommended = (type: 'headlines' | 'primary_copy' | 'descriptions') => {
    let recommendations: string[];
    let setSelection: React.Dispatch<React.SetStateAction<string[]>>;
    
    switch (type) {
      case 'headlines':
        recommendations = recommendedHeadlines;
        setSelection = setSelectedHeadlines;
        break;
      case 'primary_copy':
        recommendations = recommendedPrimaryCopy;
        setSelection = setSelectedPrimaryCopy;
        break;
      case 'descriptions':
        recommendations = recommendedDescriptions;
        setSelection = setSelectedDescriptions;
        break;
    }
    
    const newSelection = recommendations.slice(0, MAX_SELECTIONS);
    setSelection(newSelection);
    saveSelections(type, newSelection);
    toast.success("AI recommendations selected!");
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copySelectedToClipboard = async (items: any[], selectedIds: string[], prefix: string, type: string) => {
    const selectedItems = items.filter((_, idx) => selectedIds.includes(`${prefix}_${idx}`));
    if (selectedItems.length === 0) {
      toast.error("No items selected");
      return;
    }
    const text = selectedItems.map((item, i) => `${i + 1}. ${item.text}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`${selectedItems.length} selected ${type} copied!`);
  };

  const renderCopyCard = (
    item: any, 
    id: string, 
    type: 'headlines' | 'primary_copy' | 'descriptions',
    isRecommended: boolean,
    isSelected: boolean,
    showCharCount = true
  ) => {
    const StageIcon = stageIcons[item.stage] || Target;
    return (
      <Card 
        key={id} 
        className={`group relative transition-all cursor-pointer ${
          isSelected 
            ? 'ring-2 ring-primary bg-primary/5' 
            : 'hover:shadow-md'
        }`}
        onClick={() => toggleSelection(id, type)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Checkbox 
                checked={isSelected}
                onCheckedChange={() => toggleSelection(id, type)}
                onClick={(e) => e.stopPropagation()}
                className="mr-1"
              />
              <Badge className={`text-xs ${stageBadgeColors[item.stage] || stageBadgeColors.tofu}`}>
                <StageIcon className="h-3 w-3 mr-1" />
                {item.stage?.toUpperCase()}
              </Badge>
              {item.angle && (
                <Badge variant="outline" className="text-xs">
                  {item.angle}
                </Badge>
              )}
              {item.length && (
                <Badge variant="secondary" className="text-xs">
                  {item.length}
                </Badge>
              )}
              {isRecommended && (
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  AI Pick
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(item.text, id);
              }}
            >
              {copiedId === id ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.text}</p>
          {showCharCount && (
            <div className="mt-3 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {item.text?.length || 0} characters
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Group primary copy by length
  const shortCopy = Array.isArray(primaryCopy.short) ? primaryCopy.short : 
                    Array.isArray(primaryCopy) ? primaryCopy.filter((c: any) => c.length === 'short') : [];
  const mediumCopy = Array.isArray(primaryCopy.medium) ? primaryCopy.medium :
                     Array.isArray(primaryCopy) ? primaryCopy.filter((c: any) => c.length === 'medium') : [];
  const longCopy = Array.isArray(primaryCopy.long) ? primaryCopy.long :
                   Array.isArray(primaryCopy) ? primaryCopy.filter((c: any) => c.length === 'long') : [];

  // Combined primary copy for indexing
  const allPrimaryCopy = [...shortCopy, ...mediumCopy, ...longCopy];

  const hasNoContent = headlines.length === 0 && descriptions.length === 0 && 
                       shortCopy.length === 0 && mediumCopy.length === 0 && longCopy.length === 0;

  if (hasNoContent) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Type className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No Copy Available</CardTitle>
            <CardDescription>
              Generate creative assets first to populate the copy library with headlines, descriptions, and primary copy.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Copy Library</h2>
          <p className="text-muted-foreground">Select up to 5 variations per category for Meta Ads</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            AI Recommended
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="headlines" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="headlines" className="gap-2">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">Headlines</span>
            <Badge variant={selectedHeadlines.length > 0 ? "default" : "secondary"} className="ml-1">
              {selectedHeadlines.length}/{headlines.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="primary" className="gap-2">
            <AlignLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Primary</span>
            <Badge variant={selectedPrimaryCopy.length > 0 ? "default" : "secondary"} className="ml-1">
              {selectedPrimaryCopy.length}/{allPrimaryCopy.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="descriptions" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Descriptions</span>
            <Badge variant={selectedDescriptions.length > 0 ? "default" : "secondary"} className="ml-1">
              {selectedDescriptions.length}/{descriptions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="story-reel" className="gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">9:16</span>
          </TabsTrigger>
        </TabsList>

        {/* Headlines Tab */}
        <TabsContent value="headlines">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg">Headlines</CardTitle>
                  <CardDescription>Select up to 5 headlines (max 40 chars)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectAiRecommended('headlines')}
                    className="gap-1"
                  >
                    <Sparkles className="h-4 w-4" />
                    Use AI Picks
                  </Button>
                  {selectedHeadlines.length > 0 && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => copySelectedToClipboard(headlines, selectedHeadlines, 'headline', 'headlines')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Selected ({selectedHeadlines.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid gap-3">
                  {headlines.map((item: any, idx: number) => {
                    const id = `headline_${idx}`;
                    return renderCopyCard(
                      item, 
                      id, 
                      'headlines',
                      recommendedHeadlines.includes(id),
                      selectedHeadlines.includes(id),
                      true
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Primary Copy Tab */}
        <TabsContent value="primary">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg">Primary Copy</CardTitle>
                  <CardDescription>Select up to 5 variations across all lengths</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectAiRecommended('primary_copy')}
                    className="gap-1"
                  >
                    <Sparkles className="h-4 w-4" />
                    Use AI Picks
                  </Button>
                  {selectedPrimaryCopy.length > 0 && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => copySelectedToClipboard(allPrimaryCopy, selectedPrimaryCopy, 'primary', 'primary copy')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Selected ({selectedPrimaryCopy.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="short" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="short">
                    Short (~125)
                    <Badge variant="secondary" className="ml-2">{shortCopy.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="medium">
                    Medium (~300)
                    <Badge variant="secondary" className="ml-2">{mediumCopy.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="long">
                    Long (500+)
                    <Badge variant="secondary" className="ml-2">{longCopy.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="short">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid gap-3">
                      {shortCopy.map((item: any, idx: number) => {
                        const id = `primary_${idx}`;
                        return renderCopyCard(
                          { ...item, length: 'short' },
                          id,
                          'primary_copy',
                          recommendedPrimaryCopy.includes(id),
                          selectedPrimaryCopy.includes(id),
                          true
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="medium">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid gap-3">
                      {mediumCopy.map((item: any, idx: number) => {
                        const id = `primary_${shortCopy.length + idx}`;
                        return renderCopyCard(
                          { ...item, length: 'medium' },
                          id,
                          'primary_copy',
                          recommendedPrimaryCopy.includes(id),
                          selectedPrimaryCopy.includes(id),
                          true
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="long">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid gap-3">
                      {longCopy.map((item: any, idx: number) => {
                        const id = `primary_${shortCopy.length + mediumCopy.length + idx}`;
                        return renderCopyCard(
                          { ...item, length: 'long' },
                          id,
                          'primary_copy',
                          recommendedPrimaryCopy.includes(id),
                          selectedPrimaryCopy.includes(id),
                          true
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Descriptions Tab */}
        <TabsContent value="descriptions">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg">Descriptions</CardTitle>
                  <CardDescription>Select up to 5 descriptions (max 30 chars)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectAiRecommended('descriptions')}
                    className="gap-1"
                  >
                    <Sparkles className="h-4 w-4" />
                    Use AI Picks
                  </Button>
                  {selectedDescriptions.length > 0 && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => copySelectedToClipboard(descriptions, selectedDescriptions, 'desc', 'descriptions')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Selected ({selectedDescriptions.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid gap-3">
                  {descriptions.map((item: any, idx: number) => {
                    const id = `desc_${idx}`;
                    return renderCopyCard(
                      item,
                      id,
                      'descriptions',
                      recommendedDescriptions.includes(id),
                      selectedDescriptions.includes(id),
                      true
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Story/Reel Tab */}
        <TabsContent value="story-reel">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Super Short Headlines */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Super Short Headlines
                </CardTitle>
                <CardDescription>
                  For 9:16 placements where minimal text shows (max 20 chars)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {(storyReelCopy.super_short_headlines || []).map((item: any, idx: number) => (
                    <Card key={idx} className="group">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.text}</p>
                          <span className="text-xs text-muted-foreground">
                            {item.text?.length || 0} chars
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => copyToClipboard(item.text, `ssh_${idx}`)}
                        >
                          {copiedId === `ssh_${idx}` ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {(!storyReelCopy.super_short_headlines || storyReelCopy.super_short_headlines.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No super short headlines generated yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Overlay Text */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Overlay Text</CardTitle>
                <CardDescription>
                  Text overlays for Stories & Reels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {(storyReelCopy.overlay_text || []).map((item: any, idx: number) => (
                    <Card key={idx} className="group">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            {item.lines?.map((line: string, lineIdx: number) => (
                              <p key={lineIdx} className="text-sm font-medium">
                                {line}
                              </p>
                            ))}
                            {item.style && (
                              <Badge variant="outline" className="text-xs mt-2">
                                {item.style}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0"
                            onClick={() => copyToClipboard(item.lines?.join("\n") || "", `ot_${idx}`)}
                          >
                            {copiedId === `ot_${idx}` ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!storyReelCopy.overlay_text || storyReelCopy.overlay_text.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No overlay text generated yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CTA Stickers */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">CTA Stickers</CardTitle>
                <CardDescription>
                  Call-to-action text for Stories & Reels stickers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {(storyReelCopy.cta_stickers || []).map((item: any, idx: number) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="gap-2"
                      onClick={() => copyToClipboard(item.text, `cta_${idx}`)}
                    >
                      {item.text}
                      {copiedId === `cta_${idx}` ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  ))}
                  {(!storyReelCopy.cta_stickers || storyReelCopy.cta_stickers.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      No CTA stickers generated yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
