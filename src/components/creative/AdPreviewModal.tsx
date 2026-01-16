import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Image, Video, Smartphone, Monitor, MoreHorizontal, 
  ThumbsUp, MessageCircle, Share2, ExternalLink, 
  Heart, Bookmark, Send, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductionItem } from "./ProductionChecklistPanel";

interface CopyVariation {
  text: string;
  framework?: string;
  length?: string;
}

interface AngleCopyData {
  headlines: CopyVariation[];
  descriptions: CopyVariation[];
  primary_copy: CopyVariation[];
}

interface AdPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProductionItem;
  asset?: {
    file_url: string;
    file_type: string;
    file_name: string;
  } | null;
  angleCopy?: AngleCopyData;
  brandName?: string;
  websiteUrl?: string;
}

export function AdPreviewModal({
  open,
  onOpenChange,
  item,
  asset,
  angleCopy,
  brandName = "Your Brand",
  websiteUrl,
}: AdPreviewModalProps) {
  const [platform, setPlatform] = useState<"feed" | "stories" | "reels" | "instagram">("feed");
  const [selectedHeadline, setSelectedHeadline] = useState(0);
  const [selectedDescription, setSelectedDescription] = useState(0);
  const [selectedPrimary, setSelectedPrimary] = useState(0);
  
  const isVideo = asset?.file_type?.startsWith("video/");
  const headlines = angleCopy?.headlines || [];
  const descriptions = angleCopy?.descriptions || [];
  const primaryCopy = angleCopy?.primary_copy || [];
  
  const currentHeadline = headlines[selectedHeadline]?.text || "Your Headline Here";
  const currentDescription = descriptions[selectedDescription]?.text || "";
  const currentPrimary = primaryCopy[selectedPrimary]?.text || item.hook || "Your ad copy will appear here...";
  
  const domain = websiteUrl ? (() => {
    try { return new URL(websiteUrl).hostname.replace("www.", ""); } catch { return "yourwebsite.com"; }
  })() : "yourwebsite.com";

  const cycleOption = (
    current: number, 
    length: number, 
    setter: (n: number) => void, 
    direction: "next" | "prev"
  ) => {
    if (length <= 1) return;
    if (direction === "next") {
      setter((current + 1) % length);
    } else {
      setter((current - 1 + length) % length);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">Ad Preview</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{item.hook}</p>
            </div>
            <Badge variant="secondary">{item.angleName}</Badge>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Preview */}
          <div className="flex-1 flex flex-col bg-muted/20 overflow-y-auto">
            {/* Platform Tabs */}
            <Tabs value={platform} onValueChange={(v) => setPlatform(v as any)} className="w-full">
              <div className="border-b bg-background px-4">
                <TabsList className="bg-transparent h-12">
                  <TabsTrigger value="feed" className="gap-2 data-[state=active]:bg-muted">
                    <Monitor className="h-4 w-4" />
                    Feed
                  </TabsTrigger>
                  <TabsTrigger value="stories" className="gap-2 data-[state=active]:bg-muted">
                    <Smartphone className="h-4 w-4" />
                    Stories
                  </TabsTrigger>
                  <TabsTrigger value="reels" className="gap-2 data-[state=active]:bg-muted">
                    <Video className="h-4 w-4" />
                    Reels
                  </TabsTrigger>
                  <TabsTrigger value="instagram" className="gap-2 data-[state=active]:bg-muted">
                    <Heart className="h-4 w-4" />
                    Instagram
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex-1 p-6 flex items-start justify-center">
                {/* Facebook Feed */}
                <TabsContent value="feed" className="mt-0 w-full max-w-md">
                  <div className="bg-card border rounded-xl overflow-hidden shadow-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                          {brandName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{brandName}</p>
                          <p className="text-sm text-muted-foreground">Sponsored · 🌐</p>
                        </div>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </div>
                    
                    {/* Primary Text */}
                    <div className="px-4 py-3">
                      <p className="text-sm whitespace-pre-wrap">{currentPrimary}</p>
                    </div>
                    
                    {/* Media */}
                    <AspectRatio ratio={1} className="bg-muted">
                      {asset?.file_url ? (
                        isVideo ? (
                          <video 
                            src={asset.file_url} 
                            className="w-full h-full object-cover"
                            controls
                            muted
                            playsInline
                          />
                        ) : (
                          <img 
                            src={asset.file_url} 
                            alt="Ad creative"
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
                          <div className="text-center">
                            <Image className="h-16 w-16 mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">Upload your creative</p>
                            <p className="text-xs mt-1">to see the preview</p>
                          </div>
                        </div>
                      )}
                    </AspectRatio>
                    
                    {/* Link Preview */}
                    <div className="p-4 border-t bg-muted/30">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{domain}</p>
                      <p className="font-semibold mt-1">{currentHeadline}</p>
                      {currentDescription && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{currentDescription}</p>
                      )}
                      <button className="mt-3 w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                        Learn More
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Engagement */}
                    <div className="flex items-center justify-around px-4 py-3 border-t">
                      <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted">
                        <ThumbsUp className="h-5 w-5" />
                        <span className="text-sm font-medium">Like</span>
                      </button>
                      <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted">
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Comment</span>
                      </button>
                      <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted">
                        <Share2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Share</span>
                      </button>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Stories Preview */}
                <TabsContent value="stories" className="mt-0">
                  <div className="w-[280px] bg-black rounded-3xl overflow-hidden shadow-2xl relative">
                    <AspectRatio ratio={9/16}>
                      {asset?.file_url ? (
                        isVideo ? (
                          <video 
                            src={asset.file_url} 
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            autoPlay
                            loop
                          />
                        ) : (
                          <img 
                            src={asset.file_url} 
                            alt="Ad creative"
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/40 to-primary/20">
                          <div className="text-center text-white">
                            <Image className="h-12 w-12 mx-auto mb-2 opacity-70" />
                            <p className="text-sm">Your creative here</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 flex flex-col pointer-events-none">
                        {/* Progress bar */}
                        <div className="p-4">
                          <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full w-2/3 bg-white rounded-full animate-pulse" />
                          </div>
                          <div className="flex items-center gap-2 mt-4">
                            <div className="w-9 h-9 rounded-full bg-white/30 backdrop-blur flex items-center justify-center text-white font-bold text-sm">
                              {brandName.charAt(0)}
                            </div>
                            <span className="text-white text-sm font-semibold drop-shadow-lg">{brandName}</span>
                            <Badge className="text-[10px] py-0.5 bg-white/20 text-white border-none backdrop-blur">
                              Sponsored
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex-1" />
                        
                        {/* Bottom CTA */}
                        <div className="p-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-16">
                          <p className="text-white text-sm mb-3 font-medium drop-shadow-lg line-clamp-2">{currentHeadline}</p>
                          <button className="w-full py-3 bg-white text-black font-bold rounded-full flex items-center justify-center gap-2 pointer-events-auto hover:bg-white/90 transition-colors">
                            Learn More
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </AspectRatio>
                  </div>
                </TabsContent>
                
                {/* Reels Preview */}
                <TabsContent value="reels" className="mt-0">
                  <div className="w-[280px] bg-black rounded-3xl overflow-hidden shadow-2xl relative">
                    <AspectRatio ratio={9/16}>
                      {asset?.file_url ? (
                        isVideo ? (
                          <video 
                            src={asset.file_url} 
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            autoPlay
                            loop
                          />
                        ) : (
                          <img 
                            src={asset.file_url} 
                            alt="Ad creative"
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/40 to-primary/20">
                          <div className="text-center text-white">
                            <Video className="h-12 w-12 mx-auto mb-2 opacity-70" />
                            <p className="text-sm">Your video here</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {/* Right sidebar */}
                        <div className="flex-1" />
                        <div className="w-14 flex flex-col items-center justify-end pb-20 gap-5">
                          <div className="text-center">
                            <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center pointer-events-auto hover:bg-white/30">
                              <Heart className="h-6 w-6 text-white" />
                            </button>
                            <span className="text-white text-xs mt-1 block">12.3K</span>
                          </div>
                          <div className="text-center">
                            <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center pointer-events-auto hover:bg-white/30">
                              <MessageCircle className="h-6 w-6 text-white" />
                            </button>
                            <span className="text-white text-xs mt-1 block">847</span>
                          </div>
                          <div className="text-center">
                            <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center pointer-events-auto hover:bg-white/30">
                              <Send className="h-6 w-6 text-white" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Bottom info */}
                        <div className="absolute bottom-0 left-0 right-14 p-4 bg-gradient-to-t from-black/70 to-transparent">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur flex items-center justify-center text-white font-bold text-xs">
                              {brandName.charAt(0)}
                            </div>
                            <span className="text-white text-sm font-semibold">{brandName}</span>
                            <Badge className="text-[10px] py-0.5 bg-white/20 text-white border-none">Sponsored</Badge>
                          </div>
                          <p className="text-white text-sm line-clamp-2 mb-3">{currentPrimary.slice(0, 100)}...</p>
                          <button className="w-full py-2.5 bg-white text-black font-bold rounded-lg flex items-center justify-center gap-2 pointer-events-auto hover:bg-white/90">
                            Learn More
                          </button>
                        </div>
                      </div>
                    </AspectRatio>
                  </div>
                </TabsContent>
                
                {/* Instagram Feed */}
                <TabsContent value="instagram" className="mt-0 w-full max-w-md">
                  <div className="bg-card border rounded-xl overflow-hidden shadow-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-0.5">
                          <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-foreground font-bold text-sm">
                            {brandName.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="font-semibold text-sm">{brandName.toLowerCase().replace(/\s/g, "")}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">Sponsored</p>
                        </div>
                      </div>
                      <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </div>
                    
                    {/* Media */}
                    <AspectRatio ratio={1} className="bg-muted">
                      {asset?.file_url ? (
                        isVideo ? (
                          <video 
                            src={asset.file_url} 
                            className="w-full h-full object-cover"
                            controls
                            muted
                            playsInline
                          />
                        ) : (
                          <img 
                            src={asset.file_url} 
                            alt="Ad creative"
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
                          <div className="text-center">
                            <Image className="h-16 w-16 mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">Upload your creative</p>
                          </div>
                        </div>
                      )}
                    </AspectRatio>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-4">
                        <Heart className="h-6 w-6 cursor-pointer hover:text-red-500 transition-colors" />
                        <MessageCircle className="h-6 w-6 cursor-pointer" />
                        <Send className="h-6 w-6 cursor-pointer" />
                      </div>
                      <Bookmark className="h-6 w-6 cursor-pointer" />
                    </div>
                    
                    {/* Caption */}
                    <div className="px-3 pb-3">
                      <p className="text-sm">
                        <span className="font-semibold">{brandName.toLowerCase().replace(/\s/g, "")}</span>{" "}
                        <span className="whitespace-pre-wrap">{currentPrimary.slice(0, 150)}</span>
                        {currentPrimary.length > 150 && <span className="text-muted-foreground">... more</span>}
                      </p>
                    </div>
                    
                    {/* CTA */}
                    <div className="px-3 pb-4">
                      <button className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                        Learn More
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          {/* Right: Copy Selector */}
          <div className="w-80 border-l bg-background p-4 space-y-6 overflow-y-auto">
            <div>
              <h4 className="text-sm font-semibold mb-3">Select Copy Variations</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Use the arrows to preview different copy combinations.
              </p>
            </div>
            
            {/* Headlines */}
            {headlines.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Headline</span>
                  <span className="text-xs text-muted-foreground">{selectedHeadline + 1}/{headlines.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => cycleOption(selectedHeadline, headlines.length, setSelectedHeadline, "prev")}
                    disabled={headlines.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 p-2 bg-muted rounded-lg">
                    <p className="text-sm line-clamp-2">{currentHeadline}</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => cycleOption(selectedHeadline, headlines.length, setSelectedHeadline, "next")}
                    disabled={headlines.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Descriptions */}
            {descriptions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Description</span>
                  <span className="text-xs text-muted-foreground">{selectedDescription + 1}/{descriptions.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => cycleOption(selectedDescription, descriptions.length, setSelectedDescription, "prev")}
                    disabled={descriptions.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 p-2 bg-muted rounded-lg">
                    <p className="text-sm line-clamp-2">{currentDescription || "No description"}</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 shrink-0"
                    onClick={() => cycleOption(selectedDescription, descriptions.length, setSelectedDescription, "next")}
                    disabled={descriptions.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Primary Copy */}
            {primaryCopy.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Primary Copy</span>
                  <span className="text-xs text-muted-foreground">{selectedPrimary + 1}/{primaryCopy.length}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 shrink-0 mt-1"
                    onClick={() => cycleOption(selectedPrimary, primaryCopy.length, setSelectedPrimary, "prev")}
                    disabled={primaryCopy.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 p-2 bg-muted rounded-lg max-h-32 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{currentPrimary}</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 shrink-0 mt-1"
                    onClick={() => cycleOption(selectedPrimary, primaryCopy.length, setSelectedPrimary, "next")}
                    disabled={primaryCopy.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {primaryCopy[selectedPrimary]?.length && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {primaryCopy[selectedPrimary].length}
                  </Badge>
                )}
              </div>
            )}
            
            {headlines.length === 0 && descriptions.length === 0 && primaryCopy.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No copy generated yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Generate copy in the Build tab to preview different variations.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
