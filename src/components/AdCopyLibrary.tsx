import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Type, AlignLeft, MessageSquare, Smartphone, Target, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

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

export function AdCopyLibrary({ workspace }: AdCopyLibraryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const creative = workspace.creative_json || {};
  
  const adCopyLibrary = creative.ad_copy_library || {};
  const headlines = adCopyLibrary.headlines || creative.headlines || [];
  const primaryCopy = adCopyLibrary.primary_copy || creative.primary_copy || {};
  const descriptions = adCopyLibrary.descriptions || creative.descriptions || [];
  const storyReelCopy = adCopyLibrary.story_reel_copy || {};

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllToClipboard = async (items: any[], type: string) => {
    const text = items.map((item, i) => `${i + 1}. ${item.text}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success(`All ${type} copied!`);
  };

  const renderCopyCard = (item: any, id: string, showCharCount = true) => {
    const StageIcon = stageIcons[item.stage] || Target;
    return (
      <Card key={id} className="group relative hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => copyToClipboard(item.text, id)}
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Copy Library</h2>
          <p className="text-muted-foreground">All copy variations ready for Meta Ads Manager</p>
        </div>
      </div>

      <Tabs defaultValue="headlines" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="headlines" className="gap-2">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">Headlines</span>
            <Badge variant="secondary" className="ml-1">{headlines.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="primary" className="gap-2">
            <AlignLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Primary</span>
            <Badge variant="secondary" className="ml-1">{shortCopy.length + mediumCopy.length + longCopy.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="descriptions" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Descriptions</span>
            <Badge variant="secondary" className="ml-1">{descriptions.length}</Badge>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Headlines</CardTitle>
                  <CardDescription>Short, punchy headlines for your ads (max 40 chars)</CardDescription>
                </div>
                {headlines.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyAllToClipboard(headlines, "headlines")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid gap-3">
                  {headlines.map((item: any, idx: number) => 
                    renderCopyCard(item, `headline_${idx}`, true)
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Primary Copy Tab */}
        <TabsContent value="primary">
          <Tabs defaultValue="short" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="short">
                Short
                <Badge variant="secondary" className="ml-2">{shortCopy.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="medium">
                Medium
                <Badge variant="secondary" className="ml-2">{mediumCopy.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="long">
                Long
                <Badge variant="secondary" className="ml-2">{longCopy.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="short">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Short Primary Copy</CardTitle>
                      <CardDescription>~125 characters - great for quick impact</CardDescription>
                    </div>
                    {shortCopy.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyAllToClipboard(shortCopy, "short copy")}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid gap-3">
                      {shortCopy.map((item: any, idx: number) => 
                        renderCopyCard(item, `short_${idx}`, true)
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="medium">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Medium Primary Copy</CardTitle>
                      <CardDescription>~300 characters - balanced storytelling</CardDescription>
                    </div>
                    {mediumCopy.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyAllToClipboard(mediumCopy, "medium copy")}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid gap-3">
                      {mediumCopy.map((item: any, idx: number) => 
                        renderCopyCard(item, `medium_${idx}`, true)
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="long">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Long Primary Copy</CardTitle>
                      <CardDescription>500+ characters - full storytelling</CardDescription>
                    </div>
                    {longCopy.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyAllToClipboard(longCopy, "long copy")}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid gap-3">
                      {longCopy.map((item: any, idx: number) => 
                        renderCopyCard(item, `long_${idx}`, true)
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Descriptions Tab */}
        <TabsContent value="descriptions">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Descriptions</CardTitle>
                  <CardDescription>Link descriptions for your ads (max 30 chars)</CardDescription>
                </div>
                {descriptions.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyAllToClipboard(descriptions, "descriptions")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid gap-3">
                  {descriptions.map((item: any, idx: number) => 
                    renderCopyCard(item, `desc_${idx}`, true)
                  )}
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
