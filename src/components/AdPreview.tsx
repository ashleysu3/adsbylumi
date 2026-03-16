import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Image, Video, Smartphone, Monitor, MoreHorizontal, ThumbsUp, MessageCircle, Share2, ExternalLink } from "lucide-react";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";

interface AdPreviewProps {
  concept: {
    title?: string;
    hook?: string;
    stage?: string;
    linkedAsset?: {
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
}

export function AdPreview({ concept, brandName = "Your Brand", websiteUrl }: AdPreviewProps) {
  const assetUrl = concept.linkedAsset?.url;
  const assetType = concept.linkedAsset?.type || 'image';
  const isVideo = assetType === 'video' || assetUrl?.includes('.mp4') || assetUrl?.includes('.mov');
  
  // Normalize copy fields (handle both naming conventions)
  const copy = concept.finalCopy || concept.final_copy || {} as any;
  const headline = copy.headline || "Your Headline";
  const primaryText = copy.primaryText || copy.primary_text || "Your ad copy will appear here...";
  const description = copy.description || "";
  const cta = copy.cta || "Learn More";
  
  // Extract domain from URL
  const domain = websiteUrl ? new URL(websiteUrl).hostname.replace('www.', '') : 'yourwebsite.com';

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
                    />
                  ) : (
                    <img 
                      src={assetUrl} 
                      alt="Ad creative"
                      className="w-full h-full object-cover"
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
              
              {/* Link Preview */}
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
              </div>
              
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
                  {assetUrl ? (
                    isVideo ? (
                      <video 
                        src={assetUrl} 
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img 
                        src={assetUrl} 
                        alt="Ad creative"
                        className="w-full h-full object-cover"
                      />
                    )
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
                      <p className="text-white text-xs mb-2 line-clamp-2 drop-shadow">{headline}</p>
                      <button className="w-full py-2 bg-white text-black font-semibold text-xs rounded-full flex items-center justify-center gap-1">
                        {cta}
                        <ExternalLink className="h-3 w-3" />
                      </button>
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