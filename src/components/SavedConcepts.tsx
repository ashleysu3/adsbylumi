import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, HeartOff, Copy, Check, Video, FileText, Layers, Image as ImageIcon, Target, Zap, TrendingUp, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SavedConceptsProps {
  workspace: any;
  type: 'concepts' | 'copy' | 'loved';
  onUpdate?: (updates: any) => Promise<void>;
}

const stageBadgeColors: Record<string, string> = {
  grow: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  nurture: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  convert: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  // Legacy support
  tofu: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mofu: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  bofu: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const stageDisplayNames: Record<string, string> = {
  grow: "Grow",
  nurture: "Nurture",
  convert: "Convert",
  tofu: "Grow",
  mofu: "Nurture",
  bofu: "Convert",
};

const stageIcons: Record<string, React.ElementType> = {
  grow: Target,
  nurture: Zap,
  convert: TrendingUp,
  tofu: Target,
  mofu: Zap,
  bofu: TrendingUp,
};

const formatIcons: Record<string, React.ElementType> = {
  talking_head: Video,
  b_roll: Video,
  carousel: Layers,
  static: ImageIcon,
};

export function SavedConcepts({ workspace, type, onUpdate }: SavedConceptsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || creative.customer_journey || {};
  const lovedConcepts = workspace.loved_concepts || [];
  const selectedCopy = workspace.selected_copy || {};

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get all concepts with proper IDs (support both old and new naming)
  const growConcepts = (creativeMix.grow || creativeMix.tofu || []).map((c: any, idx: number) => ({ 
    ...c, 
    stage: 'grow',
    conceptId: `grow-${idx}`
  }));
  const nurtureConcepts = (creativeMix.nurture || creativeMix.mofu || []).map((c: any, idx: number) => ({ 
    ...c, 
    stage: 'nurture',
    conceptId: `nurture-${idx}`
  }));
  const convertConcepts = (creativeMix.convert || creativeMix.bofu || []).map((c: any, idx: number) => ({ 
    ...c, 
    stage: 'convert',
    conceptId: `convert-${idx}`
  }));
  
  // Also check legacy tofu/mofu/bofu IDs in lovedConcepts
  const allConcepts = [...growConcepts, ...nurtureConcepts, ...convertConcepts];
  
  // Filter for loved concepts - check both new IDs and legacy IDs
  const savedConceptsList = allConcepts.filter(c => {
    // Check direct match
    if (lovedConcepts.includes(c.conceptId)) return true;
    // Check legacy format (tofu-0, mofu-1, etc.)
    const legacyStage = c.stage === 'grow' ? 'tofu' : c.stage === 'nurture' ? 'mofu' : 'bofu';
    const legacyId = c.conceptId.replace(c.stage, legacyStage);
    if (lovedConcepts.includes(legacyId)) return true;
    // Check if concept has its own id property
    if (c.id && lovedConcepts.includes(c.id)) return true;
    return false;
  });

  // Get saved copy
  const adCopyLibrary = creative.ad_copy_library || {};
  const headlines = adCopyLibrary.headlines || creative.headlines || [];
  const primaryCopyObj = adCopyLibrary.primary_copy || creative.primary_copy || {};
  const descriptions = adCopyLibrary.descriptions || creative.descriptions || [];

  const allPrimaryCopy = [
    ...(primaryCopyObj.short || []),
    ...(primaryCopyObj.medium || []),
    ...(primaryCopyObj.long || []),
  ];

  const savedHeadlines = headlines.filter((_: any, idx: number) => 
    selectedCopy.headlines?.includes(`headline_${idx}`)
  );
  const savedPrimary = allPrimaryCopy.filter((_: any, idx: number) => 
    selectedCopy.primary_copy?.includes(`primary_${idx}`)
  );
  const savedDescriptions = descriptions.filter((_: any, idx: number) => 
    selectedCopy.descriptions?.includes(`desc_${idx}`)
  );

  if (type === 'concepts' || type === 'loved') {
    if (savedConceptsList.length === 0) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Heart className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>No Saved Concepts Yet</CardTitle>
              <CardDescription>
                Browse your creative concepts and click the heart icon to save your favorites here for easy access.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Saved Concepts</h2>
          <p className="text-muted-foreground">Your favorite creative concepts for easy access</p>
        </div>

        <div className="grid gap-4">
          {savedConceptsList.map((concept: any) => {
            const StageIcon = stageIcons[concept.stage] || Target;
            const FormatIcon = formatIcons[concept.format] || FileText;
            
            return (
              <Card key={concept.conceptId} className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 opacity-70 hover:opacity-100 hover:bg-pink-50 dark:hover:bg-pink-950"
                  onClick={async () => {
                    // Remove from loved concepts
                    const newLoved = lovedConcepts.filter((id: string) => {
                      if (id === concept.conceptId) return false;
                      // Also check legacy format
                      const legacyStage = concept.stage === 'grow' ? 'tofu' : concept.stage === 'nurture' ? 'mofu' : 'bofu';
                      const legacyId = concept.conceptId.replace(concept.stage, legacyStage);
                      if (id === legacyId) return false;
                      if (concept.id && id === concept.id) return false;
                      return true;
                    });
                    
                    const { error } = await supabase
                      .from('campaign_workspaces')
                      .update({ 
                        loved_concepts: newLoved,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', workspace.id);
                    
                    if (error) {
                      toast.error("Failed to remove from favorites");
                      return;
                    }
                    
                    if (onUpdate) {
                      await onUpdate({ loved_concepts: newLoved });
                    }
                    toast.success("Removed from favorites");
                  }}
                >
                  <HeartOff className="h-4 w-4 text-pink-500" />
                </Button>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className={stageBadgeColors[concept.stage]}>
                      <StageIcon className="h-3 w-3 mr-1" />
                      {stageDisplayNames[concept.stage] || concept.stage?.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <FormatIcon className="h-3 w-3" />
                      {concept.format?.replace('_', ' ')}
                    </Badge>
                    {concept.hook_type && (
                      <Badge variant="secondary">{concept.hook_type}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{concept.title || concept.name || concept.hook}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {concept.hook && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Hook</p>
                      <p className="text-sm bg-muted p-2 rounded">{concept.hook}</p>
                    </div>
                  )}
                  {concept.script && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Script</p>
                      <p className="text-sm bg-muted p-2 rounded line-clamp-4">{concept.script}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => copyToClipboard(
                        concept.script || concept.hook || concept.name || concept.title,
                        concept.conceptId
                      )}
                    >
                      {copiedId === concept.conceptId ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Content
                        </>
                      )}
                    </Button>
                    {workspace?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const { error } = await supabase.from('creative_bench').insert({
                            workspace_id: workspace.id,
                            brand_id: workspace.brand_id,
                            production_item_id: concept.conceptId,
                            status: 'bench',
                            performance_snapshot: {
                              name: concept.title || concept.name || concept.hook,
                              hook: concept.hook,
                              script: concept.script,
                              format: concept.format,
                              stage: concept.stage,
                              angle: concept.angle_name || concept.hook_type,
                              type: 'concept_library',
                            },
                            auto_rotate_approved: false,
                          });
                          if (error) {
                            if (error.code === '23505') {
                              toast.error('Already on the bench');
                            } else {
                              toast.error('Failed to add to bench');
                            }
                          } else {
                            toast.success('Added to bench!');
                          }
                        }}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Bench
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Saved Copy View
  const totalSaved = savedHeadlines.length + savedPrimary.length + savedDescriptions.length;

  if (totalSaved === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Star className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No Saved Copy Yet</CardTitle>
            <CardDescription>
              Go to the Copy Library and select your favorite headlines, primary copy, and descriptions to save them here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const renderCopyItem = (item: any, id: string, prefix: string) => {
    const StageIcon = stageIcons[item.stage] || Target;
    return (
      <Card key={id} className="group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${stageBadgeColors[item.stage] || stageBadgeColors.tofu}`}>
                <StageIcon className="h-3 w-3 mr-1" />
                {item.stage?.toUpperCase()}
              </Badge>
              {item.angle && (
                <Badge variant="outline" className="text-xs">{item.angle}</Badge>
              )}
              {item.length && (
                <Badge variant="secondary" className="text-xs">{item.length}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => copyToClipboard(item.text, id)}
            >
              {copiedId === id ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-sm">{item.text}</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Saved Copy</h2>
        <p className="text-muted-foreground">Your selected ad copy for Meta Ads Manager</p>
      </div>

      <Tabs defaultValue="headlines">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="headlines" className="gap-2">
            Headlines
            <Badge variant="secondary">{savedHeadlines.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="primary" className="gap-2">
            Primary
            <Badge variant="secondary">{savedPrimary.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="descriptions" className="gap-2">
            Descriptions
            <Badge variant="secondary">{savedDescriptions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="headlines">
          <ScrollArea className="h-[500px]">
            <div className="grid gap-3 pr-4">
              {savedHeadlines.map((item: any, idx: number) => 
                renderCopyItem(item, `saved-headline-${idx}`, 'headline')
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="primary">
          <ScrollArea className="h-[500px]">
            <div className="grid gap-3 pr-4">
              {savedPrimary.map((item: any, idx: number) => 
                renderCopyItem(item, `saved-primary-${idx}`, 'primary')
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="descriptions">
          <ScrollArea className="h-[500px]">
            <div className="grid gap-3 pr-4">
              {savedDescriptions.map((item: any, idx: number) => 
                renderCopyItem(item, `saved-desc-${idx}`, 'desc')
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Button 
        className="w-full"
        onClick={async () => {
          const allText = [
            '=== HEADLINES ===',
            ...savedHeadlines.map((h: any, i: number) => `${i + 1}. ${h.text}`),
            '',
            '=== PRIMARY COPY ===',
            ...savedPrimary.map((p: any, i: number) => `${i + 1}. ${p.text}`),
            '',
            '=== DESCRIPTIONS ===',
            ...savedDescriptions.map((d: any, i: number) => `${i + 1}. ${d.text}`),
          ].join('\n');
          await navigator.clipboard.writeText(allText);
          toast.success("All saved copy copied to clipboard!");
        }}
      >
        <Copy className="h-4 w-4 mr-2" />
        Copy All Saved Copy
      </Button>
    </div>
  );
}