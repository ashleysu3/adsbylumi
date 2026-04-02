import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  Image, Video, Smartphone, Monitor, MoreHorizontal, 
  ThumbsUp, MessageCircle, Share2, ExternalLink, 
  Heart, Bookmark, Send, ChevronLeft, ChevronRight,
  Link2, Pencil, Check, Globe, Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  verticalAsset?: {
    file_url: string;
    file_type: string;
    file_name: string;
  } | null;
  angleCopy?: AngleCopyData;
  selectedCopy?: Record<string, any>;
  brandName?: string;
  websiteUrl?: string;
  isDmCampaign?: boolean;
  onCopyChange?: (updatedCopy: AngleCopyData) => void;
  onUrlChange?: (url: string) => void;
}

export function AdPreviewModal({
  open,
  onOpenChange,
  item,
  asset,
  verticalAsset,
  angleCopy,
  selectedCopy,
  brandName = "Your Brand",
  websiteUrl,
  isDmCampaign = false,
  onCopyChange,
  onUrlChange,
}: AdPreviewModalProps) {
  const [platform, setPlatform] = useState<"feed" | "stories" | "reels" | "instagram">("feed");
  const [selectedHeadline, setSelectedHeadline] = useState(0);
  const [selectedDescription, setSelectedDescription] = useState(0);
  const [selectedPrimary, setSelectedPrimary] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localUrl, setLocalUrl] = useState(websiteUrl || "");

  useEffect(() => {
    setLocalUrl(websiteUrl || "");
  }, [websiteUrl]);
  
  const toVariationArray = (value: unknown): CopyVariation[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if (typeof entry === "string") return { text: entry };
          if (entry && typeof entry === "object" && typeof (entry as any).text === "string") {
            return {
              text: (entry as any).text,
              framework: (entry as any).framework,
              length: (entry as any).length,
            } as CopyVariation;
          }
          return null;
        })
        .filter((entry): entry is CopyVariation => !!entry && !!entry.text?.trim());
    }

    if (typeof value === "string") {
      return value.trim() ? [{ text: value.trim() }] : [];
    }

    return [];
  };

  const itemAny = item as any;

  // Try multiple sources for the asset URL
  const assetUrl = asset?.file_url || itemAny.uploaded_asset_url || itemAny.linkedAsset?.url || null;
  const inferredFileType = asset?.file_type || itemAny.linkedAsset?.type || "";
  const isVideo =
    inferredFileType.startsWith("video") ||
    /\.(mp4|mov|webm|m4v)$/i.test(assetUrl || "");

  // Resolve vertical (9:16) asset for Stories/Reels
  const verticalAssetUrl = verticalAsset?.file_url || null;
  const verticalFileType = verticalAsset?.file_type || "";
  const isVerticalVideo = verticalFileType.startsWith("video") || /\.(mp4|mov|webm|m4v)$/i.test(verticalAssetUrl || "");
  // Use vertical asset for vertical placements when available
  const getAssetForPlacement = (placement: "feed" | "vertical") => {
    if (placement === "vertical" && verticalAssetUrl) {
      return { url: verticalAssetUrl, isVid: isVerticalVideo };
    }
    return { url: assetUrl, isVid: isVideo };
  };

  const pickFirstNonEmpty = (...sets: CopyVariation[][]): CopyVariation[] => {
    for (const set of sets) {
      if (set.length > 0) return set;
    }
    return [];
  };

  const selectedCopyAny = selectedCopy as any;
  const sharedVariations = Array.isArray(selectedCopyAny?.shared_variations)
    ? selectedCopyAny.shared_variations
    : [];

  const selectedCopyHeadlines = pickFirstNonEmpty(
    toVariationArray(selectedCopyAny?.headlines),
    toVariationArray(sharedVariations.map((variation: any) => variation?.headline).filter(Boolean))
  );
  const selectedCopyDescriptions = pickFirstNonEmpty(
    toVariationArray(selectedCopyAny?.descriptions),
    toVariationArray(sharedVariations.map((variation: any) => variation?.description).filter(Boolean))
  );
  const selectedCopyPrimary = pickFirstNonEmpty(
    toVariationArray(selectedCopyAny?.primary_copy),
    toVariationArray(sharedVariations.map((variation: any) => variation?.primary_text).filter(Boolean))
  );

  // Try angleCopy first, then item's saved copy, then selected_copy, then hook-level fallback
  const itemCopy = itemAny.finalCopy || itemAny.final_copy || {};
  const itemHeadlines = toVariationArray(itemCopy.headline || itemAny.headline || itemAny.written_hook);
  const itemDescriptions = toVariationArray(itemCopy.description || itemAny.description);
  const itemPrimaryCopy = toVariationArray(
    itemCopy.primary_text ||
      itemCopy.primaryText ||
      itemCopy.primary_copy ||
      itemAny.primary_text ||
      itemAny.primaryText ||
      itemAny.hook
  );

  const fallbackHeadlines = pickFirstNonEmpty(itemHeadlines, selectedCopyHeadlines, toVariationArray(item.hook));
  const fallbackDescriptions = pickFirstNonEmpty(itemDescriptions, selectedCopyDescriptions);
  const fallbackPrimaryCopy = pickFirstNonEmpty(itemPrimaryCopy, selectedCopyPrimary, toVariationArray(item.hook));

  const angleHeadlines = toVariationArray(angleCopy?.headlines);
  const angleDescriptions = toVariationArray(angleCopy?.descriptions);
  const anglePrimary = toVariationArray(angleCopy?.primary_copy);

  const headlines = pickFirstNonEmpty(angleHeadlines, fallbackHeadlines);
  const descriptions = pickFirstNonEmpty(angleDescriptions, fallbackDescriptions);
  const primaryCopy = pickFirstNonEmpty(anglePrimary, fallbackPrimaryCopy);

  const currentHeadline = headlines[selectedHeadline]?.text || fallbackHeadlines[0]?.text || item.hook || "Your Headline Here";
  const currentDescription = descriptions[selectedDescription]?.text || fallbackDescriptions[0]?.text || "";
  const currentPrimary =
    primaryCopy[selectedPrimary]?.text ||
    fallbackPrimaryCopy[0]?.text ||
    item.hook ||
    "Your ad copy will appear here...";
  
  const domain = websiteUrl ? (() => {
    try { return new URL(websiteUrl).hostname.replace("www.", ""); } catch { return "yourwebsite.com"; }
  })() : "yourwebsite.com";

  useEffect(() => {
    if (!open) return;
    setSelectedHeadline(0);
    setSelectedDescription(0);
    setSelectedPrimary(0);
    setEditingField(null);
  }, [open, item.id]);

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

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (!editingField || !onCopyChange) {
      setEditingField(null);
      return;
    }

    // When angleCopy is empty/undefined, seed from current fallback values
    // so the save captures existing copy rather than losing it
    const hasAngleCopy = angleCopy && (
      (angleCopy.headlines?.length ?? 0) > 0 ||
      (angleCopy.descriptions?.length ?? 0) > 0 ||
      (angleCopy.primary_copy?.length ?? 0) > 0
    );

    const baseCopy = hasAngleCopy
      ? angleCopy!
      : {
          headlines: headlines.length > 0 ? [...headlines] : [],
          descriptions: descriptions.length > 0 ? [...descriptions] : [],
          primary_copy: primaryCopy.length > 0 ? [...primaryCopy] : [],
        };

    const updated = {
      // Preserve any extra fields from the original angleCopy
      ...(angleCopy || {}),
      headlines: [...(baseCopy.headlines || [])],
      descriptions: [...(baseCopy.descriptions || [])],
      primary_copy: [...(baseCopy.primary_copy || [])],
    };

    if (editingField === "headline") {
      if (updated.headlines[selectedHeadline]) {
        updated.headlines[selectedHeadline] = { ...updated.headlines[selectedHeadline], text: editValue };
      } else {
        updated.headlines = [{ text: editValue }];
      }
    } else if (editingField === "description") {
      if (updated.descriptions[selectedDescription]) {
        updated.descriptions[selectedDescription] = { ...updated.descriptions[selectedDescription], text: editValue };
      } else {
        updated.descriptions = [{ text: editValue }];
      }
    } else if (editingField === "primary") {
      if (updated.primary_copy[selectedPrimary]) {
        updated.primary_copy[selectedPrimary] = { ...updated.primary_copy[selectedPrimary], text: editValue };
      } else {
        updated.primary_copy = [{ text: editValue }];
      }
    }

    onCopyChange(updated);
    setEditingField(null);
  };

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

  // Reset aspect when asset changes
  useEffect(() => {
    setMediaAspect(null);
  }, [assetUrl]);

  const isVerticalAsset = mediaAspect !== null && mediaAspect < 0.7; // ~9:16 or taller
  const needsMetaPadding = (placement: "feed" | "vertical") => 
    placement === "vertical" && mediaAspect !== null && mediaAspect > 0.7; // square-ish or wider in a vertical container

  const renderMedia = (placement: "feed" | "vertical" = "feed", className?: string) => {
    const { url: mediaUrl, isVid: mediaIsVideo } = getAssetForPlacement(placement);
    const hasVerticalOverride = placement === "vertical" && !!verticalAssetUrl;

    if (mediaUrl) {
      const showBlurBg = !hasVerticalOverride && needsMetaPadding(placement);
      const useContain = showBlurBg || (placement === "vertical" && !hasVerticalOverride && isVerticalAsset);
      
      const mediaElement = mediaIsVideo ? (
        <video 
          src={mediaUrl} 
          className={cn(
            "w-full h-full",
            useContain ? "object-contain relative z-10" : "object-cover",
            className
          )}
          controls
          muted
          playsInline
          onLoadedMetadata={handleVideoLoad}
        />
      ) : (
        <img 
          src={mediaUrl} 
          alt="Ad creative"
          className={cn(
            "w-full h-full",
            useContain ? "object-contain relative z-10" : "object-cover",
            className
          )}
          onLoad={handleImageLoad}
        />
      );

      if (showBlurBg) {
        return (
          <div className="relative w-full h-full overflow-hidden">
            {/* Blurred background layer */}
            {mediaIsVideo ? (
              <video
                src={mediaUrl}
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60"
                muted
                playsInline
              />
            ) : (
              <img
                src={mediaUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60"
              />
            )}
            {/* Dark overlay for depth */}
            <div className="absolute inset-0 bg-black/30 z-[5]" />
            {/* Actual media centered */}
            {mediaElement}
          </div>
        );
      }

      return mediaElement;
    }
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
        <div className="text-center">
          <Image className="h-16 w-16 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Upload your creative</p>
          <p className="text-xs mt-1">to see the preview</p>
        </div>
      </div>
    );
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
              
              <div className="flex-1 p-4 md:p-6 flex items-start justify-center overflow-y-auto">
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
                      <p className="text-sm whitespace-pre-wrap line-clamp-4">{currentPrimary}</p>
                      {currentPrimary.length > 200 && (
                        <span className="text-xs text-muted-foreground">... see more</span>
                      )}
                    </div>
                    
                    {/* Media */}
                    <AspectRatio ratio={1} className="bg-muted">
                      {renderMedia()}
                    </AspectRatio>
                    
                    {/* Link Preview / CTA */}
                    {isDmCampaign ? (
                      <div className="p-4 border-t">
                        <button className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Send Message
                        </button>
                      </div>
                    ) : (
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
                    )}
                    
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
                  <div className="w-[280px] max-h-[calc(90vh-180px)] bg-black rounded-3xl overflow-hidden shadow-2xl relative">
                    <AspectRatio ratio={9/16} className="max-h-[calc(90vh-180px)]">
                      {renderMedia("vertical")}
                      
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
                          {isDmCampaign ? (
                            <button className="w-full py-3 bg-white text-black font-bold rounded-full flex items-center justify-center gap-2">
                              <MessageCircle className="h-4 w-4" />
                              Send Message
                            </button>
                          ) : (
                            <>
                              <p className="text-white text-sm mb-3 font-medium drop-shadow-lg line-clamp-2">{currentHeadline}</p>
                              <button className="w-full py-3 bg-white text-black font-bold rounded-full flex items-center justify-center gap-2 pointer-events-auto hover:bg-white/90 transition-colors">
                                Learn More
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </AspectRatio>
                  </div>
                </TabsContent>
                
                {/* Reels Preview */}
                <TabsContent value="reels" className="mt-0">
                  <div className="w-[280px] max-h-[calc(90vh-180px)] bg-black rounded-3xl overflow-hidden shadow-2xl relative">
                    <AspectRatio ratio={9/16} className="max-h-[calc(90vh-180px)]">
                      {renderMedia("vertical")}
                      
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
                      {renderMedia()}
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
                        {isDmCampaign ? (
                          <><MessageCircle className="h-4 w-4" /> Send Message</>
                        ) : (
                          <>Learn More <ExternalLink className="h-4 w-4" /></>
                        )}
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          {/* Right: Copy Editor & Info */}
          <div className="w-80 border-l bg-background p-4 space-y-5 overflow-y-auto">
            {/* Destination URL - hidden for DM campaigns */}
            {!isDmCampaign && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Destination URL</span>
                  </div>
                  {localUrl && (
                    <a
                      href={localUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <Input
                  value={localUrl || ""}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  onBlur={() => {
                    if (onUrlChange && localUrl !== websiteUrl) onUrlChange(localUrl || "");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="https://yourwebsite.com"
                  className="text-sm"
                />
              </div>
            )}
            {isDmCampaign && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  This is a DM campaign — Meta will automatically add a "Send Message" button. No destination URL needed.
                </p>
              </div>
            )}
            
            <div className="h-px bg-border" />
            
            <div>
              <h4 className="text-sm font-semibold mb-1">Copy Variations</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Click <Pencil className="h-3 w-3 inline" /> to edit copy. Use arrows to preview variations.
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
                    {editingField === "headline" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 text-sm"
                          maxLength={26}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm line-clamp-2 flex-1">{currentHeadline}</p>
                        {onCopyChange && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => startEditing("headline", currentHeadline)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
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
                    {editingField === "description" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 text-sm"
                          maxLength={30}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm line-clamp-2 flex-1">{currentDescription || "No description"}</p>
                        {onCopyChange && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => startEditing("description", currentDescription)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
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
                  <div className="flex-1 p-2 bg-muted rounded-lg">
                    {editingField === "primary" ? (
                      <div className="space-y-1">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-sm min-h-[160px] resize-y"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="max-h-48 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">{currentPrimary}</p>
                        </div>
                        {onCopyChange && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 mt-1 gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => startEditing("primary", currentPrimary)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
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
                {(primaryCopy[selectedPrimary] as any)?.length && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {(primaryCopy[selectedPrimary] as any).length}
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
