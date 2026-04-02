import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Image, Video, Smartphone, Monitor, MoreHorizontal, ThumbsUp, MessageCircle, Share2, ExternalLink, Info } from "lucide-react";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AdPreviewProps {
  concept: {
    title?: string;
    hook?: string;
    stage?: string;
    linkedAsset?: {
      url?: string;
      type?: string;
    };
    verticalAsset?: {
      url?: string;
      type?: string;
    };
    finalCopy?: {
      headline?: string;
      primaryText?: string;
      description?: string;
      cta?: string;
    };
    final_copy?: {
      headline?: string;
      primary_text?: string;
      description?: string;
      cta?: string;
    };
    uploaded_asset_id?: string;
  };
  brandName?: string;
  websiteUrl?: string;
  isDmCampaign?: boolean;
}

export function AdPreview({ concept, brandName = "Your Brand", websiteUrl, isDmCampaign = false }: AdPreviewProps) {
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setMediaAspect(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  const handleVideoLoad = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    if (vid.videoWidth && vid.videoHeight) {
      setMediaAspect(vid.videoWidth / vid.videoHeight);
    }
  }, []);

  const conceptData = concept as any;
  const assetUrl = concept.linkedAsset?.url || conceptData.uploaded_asset_url || conceptData.asset_url || null;
  const assetType = concept.linkedAsset?.type || conceptData.linkedAsset?.file_type || 'image';
  const isVideo = assetType.includes('video') || /\.(mp4|mov|webm|m4v)$/i.test(assetUrl || '');

  // Resolve vertical (9:16) asset for Stories/Reels
  const verticalAssetUrl = concept.verticalAsset?.url || conceptData.verticalAsset?.url || conceptData.vertical_asset_url || null;
  const verticalAssetType = concept.verticalAsset?.type || conceptData.verticalAsset?.type || assetType;
  const isVerticalVideo = verticalAssetType.includes('video') || /\.(mp4|mov|webm|m4v)$/i.test(verticalAssetUrl || '');
  // For stories: use vertical asset if available, otherwise fall back to main asset
  const storiesAssetUrl = verticalAssetUrl || assetUrl;
  const storiesIsVideo = verticalAssetUrl ? isVerticalVideo : isVideo;
  
  // Whether the asset needs Meta-style padding in vertical containers (square or wider in 9:16)
  const needsMetaPadding = mediaAspect !== null && mediaAspect > 0.7;

  // Normalize copy fields (handle both naming conventions + flattened shapes)
  const copy = concept.finalCopy || concept.final_copy || {
    headline: conceptData.headline,
    primaryText: conceptData.primaryText || conceptData.primary_text,
    description: conceptData.description,
    cta: conceptData.cta,
  } as any;
  const headline = copy.headline || "Your Headline";
  const primaryText = copy.primaryText || copy.primary_text || "Your ad copy will appear here...";
  const description = copy.description || "";
  const cta = copy.cta || "Learn More";
  
  // Extract domain from URL
  const domain = websiteUrl ? (() => {
    try {
      return new URL(normalizeWebsiteUrl(websiteUrl)).hostname.replace('www.', '');
    } catch {
      return 'yourwebsite.com';
    }
  })() : 'yourwebsite.com';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {isVideo ? <Video className="h-4 w-4" /> : <Image className="h-4 w-4" />}
            {concept.title || 'Ad Preview'}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {concept.stage === 'tofu' ? 'Grow' : 
             concept.stage === 'mofu' ? 'Nurture' : 
             concept.stage === 'bofu' ? 'Convert' : 
             concept.stage || 'Grow'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
            <TabsTrigger value="feed" className="gap-2 data-[state=active]:bg-transparent">
              <Monitor className="h-3 w-3" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="stories" className="gap-2 data-[state=active]:bg-transparent">
              <Smartphone className="h-3 w-3" />
              Stories
            </TabsTrigger>
          </TabsList>
          
          {/* Feed Preview */}
          <TabsContent value="feed" className="mt-0">
            <div className="bg-card border rounded-lg mx-4 my-4 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {brandName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{brandName}</p>
                    <p className="text-xs text-muted-foreground">Sponsored</p>
                  </div>
                </div>
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </div>
              
              {/* Primary Text */}
              <div className="px-3 py-2">
                <p className="text-sm line-clamp-3">{primaryText}</p>
              </div>
              
              {/* Media */}
              <AspectRatio ratio={1} className="bg-muted">
                {assetUrl ? (
                  isVideo ? (
                    <video 
                      src={assetUrl} 
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      onLoadedMetadata={handleVideoLoad}
                    />
                  ) : (
                    <img 
                      src={assetUrl} 
                      alt="Ad creative"
                      className="w-full h-full object-cover"
                      onLoad={handleImageLoad}
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Your creative here</p>
                    </div>
                  </div>
                )}
              </AspectRatio>
              
              {/* Link Preview / CTA */}
              {isDmCampaign ? (
                <div className="p-3 border-t">
                  <button className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded transition-colors flex items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Send Message
                  </button>
                </div>
              ) : (
                <div className="p-3 border-t bg-muted/30">
                  <p className="text-xs text-muted-foreground uppercase">{domain}</p>
                  <p className="font-semibold text-sm line-clamp-1">{headline}</p>
                  {description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
                  )}
                  <button className="mt-2 w-full py-2 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm rounded transition-colors flex items-center justify-center gap-2">
                    {cta}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="shrink-0 mt-0.5">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs space-y-1.5 p-3">
                        <p><span className="font-semibold">Button color:</span> This will match Meta's native CTA styling in your live ad — the color shown here is just our preview color and can't be customized.</p>
                        <p><span className="font-semibold">Why "{cta}":</span> This CTA was pre-selected as part of your campaign strategy. Lumi chose it based on your campaign goal to drive the best results.</p>
                      </TooltipContent>
                    </Tooltip>
                    <span>CTA button color & style will match Meta's native design in your live ad</span>
                  </div>
                </div>
              )}
              
              {/* Engagement */}
              <div className="flex items-center justify-between px-3 py-2 border-t">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs">Like</span>
                  </button>
                  <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">Comment</span>
                  </button>
                  <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Share2 className="h-4 w-4" />
                    <span className="text-xs">Share</span>
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Stories Preview */}
          <TabsContent value="stories" className="mt-0">
            <div className="flex justify-center py-4 px-4">
              <div className="w-[220px] bg-black rounded-2xl overflow-hidden shadow-lg relative">
                {/* Stories Frame */}
                <AspectRatio ratio={9/16}>
                  {storiesAssetUrl ? (
                    <div className="relative w-full h-full overflow-hidden">
                      {/* Blurred background for non-vertical assets (only when no dedicated vertical asset) */}
                      {!verticalAssetUrl && needsMetaPadding && (
                        storiesIsVideo ? (
                          <video src={storiesAssetUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60" muted playsInline />
                        ) : (
                          <img src={storiesAssetUrl} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60" />
                        )
                      )}
                      {!verticalAssetUrl && needsMetaPadding && <div className="absolute inset-0 bg-black/30 z-[5]" />}
                      {storiesIsVideo ? (
                        <video 
                          src={storiesAssetUrl} 
                          className={`w-full h-full ${!verticalAssetUrl && needsMetaPadding ? 'object-contain relative z-10' : 'object-cover'}`}
                          muted
                          playsInline
                          onLoadedMetadata={handleVideoLoad}
                        />
                      ) : (
                        <img 
                          src={storiesAssetUrl} 
                          alt="Ad creative"
                          className={`w-full h-full ${!verticalAssetUrl && needsMetaPadding ? 'object-contain relative z-10' : 'object-cover'}`}
                          onLoad={handleImageLoad}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/30 to-primary/10 text-white">
                      <div className="text-center">
                        <Image className="h-10 w-10 mx-auto mb-2 opacity-70" />
                        <p className="text-xs px-4">Your creative here</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Overlay elements */}
                  <div className="absolute inset-0 flex flex-col">
                    {/* Top bar */}
                    <div className="p-3">
                      <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-white rounded-full" />
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                          {brandName.charAt(0)}
                        </div>
                        <span className="text-white text-xs font-medium drop-shadow">{brandName}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-white/20 text-white border-none">
                          Sponsored
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Spacer */}
                    <div className="flex-1" />
                    
                    {/* Bottom CTA */}
                    <div className="p-3 bg-gradient-to-t from-black/60 to-transparent">
                      {isDmCampaign ? (
                        <button className="w-full py-2 bg-white text-black font-semibold text-xs rounded-full flex items-center justify-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          Send Message
                        </button>
                      ) : (
                        <>
                          <p className="text-white text-xs mb-2 line-clamp-2 drop-shadow">{headline}</p>
                          <button className="w-full py-2 bg-white text-black font-semibold text-xs rounded-full flex items-center justify-center gap-1">
                            {cta}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </AspectRatio>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}