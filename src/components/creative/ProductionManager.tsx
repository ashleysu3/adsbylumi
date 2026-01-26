import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Rocket, Upload, CheckCircle2, AlertCircle, 
  Video, Film, Image, Eye, FolderOpen, Maximize2,
  Sparkles, Loader2, Filter, Library, Info
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ProductionItem } from "./ProductionChecklistPanel";
import { CreativeChecklistCard } from "./CreativeChecklistCard";
import { AngleCopyEditor } from "./AngleCopyEditor";
import { CreativeAngle } from "./AngleSelector";
import { AdPreviewModal } from "./AdPreviewModal";
import { AutoSaveIndicator, SaveStatus } from "@/components/AutoSaveIndicator";

interface RankedItem extends ProductionItem {
  rank: number;
  rationale: string;
}

interface ProductionManagerProps {
  workspace: any;
  productionItems: ProductionItem[];
  angles: CreativeAngle[];
  selectedAngleIds: string[];
  onRemoveItem: (id: string) => void;
  onBuildCampaign: () => void;
  onUpdateWorkspace: (updates: any) => void;
  onSaveToLibrary?: (item: ProductionItem) => void;
  brandId?: string;
}

export function ProductionManager({
  workspace,
  productionItems,
  angles,
  selectedAngleIds,
  onRemoveItem,
  onBuildCampaign,
  onUpdateWorkspace,
  onSaveToLibrary,
  brandId,
}: ProductionManagerProps) {
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const [adPreviewItem, setAdPreviewItem] = useState<ProductionItem | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState<string | null>(null);
  const [isRanking, setIsRanking] = useState(false);
  const [rankedItems, setRankedItems] = useState<RankedItem[]>([]);
  const [overallStrategy, setOverallStrategy] = useState<string>("");
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [movingToLibrary, setMovingToLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadedAssets = workspace?.user_uploaded_assets || [];
  const creativeJson = workspace?.creative_json || {};
  const angleCopy = creativeJson.angle_copy || {};
  
  const canRank = productionItems.length >= 6;
  const hasRankedItems = rankedItems.length > 0;
  
  // Group items by angle
  const itemsByAngle = productionItems.reduce((acc, item) => {
    const angleKey = item.angleName || "Unassigned";
    if (!acc[angleKey]) acc[angleKey] = [];
    acc[angleKey].push(item);
    return acc;
  }, {} as Record<string, ProductionItem[]>);
  
  // Get rank info for an item
  const getRankForItem = (itemId: string): { rank?: number; rationale?: string } => {
    const ranked = rankedItems.find(r => r.id === itemId);
    return ranked ? { rank: ranked.rank, rationale: ranked.rationale } : {};
  };
  
  // Filter items if showing top only
  const getDisplayItems = (items: ProductionItem[]) => {
    if (!showTopOnly || !hasRankedItems) return items;
    const rankedIds = rankedItems.map(r => r.id);
    return items.filter(item => rankedIds.includes(item.id));
  };
  
  // Get asset linked to a specific production item
  const getAssetForItem = (itemId: string) => {
    return uploadedAssets.find((a: any) => a.linked_concept_id === itemId);
  };
  
  // Count items with assets
  const itemsWithAssets = productionItems.filter(item => getAssetForItem(item.id)).length;
  
  // Check if at least one creative is uploaded
  const hasAtLeastOneUpload = productionItems.some(item => getAssetForItem(item.id));
  
  // Updated readiness check - needs 3+ concepts AND at least one upload
  const isReadyToBuild = productionItems.length >= 3 && hasAtLeastOneUpload;
  const hasAnyCopy = Object.keys(angleCopy).length > 0;
  
  const handleRankConcepts = async () => {
    if (!brandId) {
      toast.error("Brand not found");
      return;
    }
    setIsRanking(true);
    try {
      const { data, error } = await supabase.functions.invoke('rank-creative-concepts', {
        body: { items: productionItems, brandId }
      });
      if (error) throw error;
      setRankedItems(data.rankedItems || []);
      setOverallStrategy(data.overallStrategy || "");
      setShowTopOnly(true);
      toast.success("Lumi's Top 5 ready!");
    } catch (e: any) {
      console.error("Ranking error:", e);
      toast.error(e.message || "Failed to rank concepts");
    } finally {
      setIsRanking(false);
    }
  };
  
  const handleMoveOthersToLibrary = async () => {
    if (!onSaveToLibrary || !hasRankedItems) return;
    
    const rankedIds = rankedItems.map(r => r.id);
    const nonRankedItems = productionItems.filter(item => !rankedIds.includes(item.id));
    
    if (nonRankedItems.length === 0) {
      toast.info("All items are already in your top picks!");
      return;
    }
    
    setMovingToLibrary(true);
    try {
      for (const item of nonRankedItems) {
        await onSaveToLibrary(item);
      }
      toast.success(`Moved ${nonRankedItems.length} concepts to Concept Library`);
    } catch (error: any) {
      toast.error("Failed to move some items: " + error.message);
    } finally {
      setMovingToLibrary(false);
    }
  };
  
  const handleSaveToLibrary = async (item: ProductionItem) => {
    if (!onSaveToLibrary) return;
    setSavingToLibrary(item.id);
    try {
      await onSaveToLibrary(item);
    } finally {
      setSavingToLibrary(null);
    }
  };
  
  // Handle file selection for a specific item
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be less than 20MB");
      return;
    }
    
    setUploadingItemId(itemId);
    
    try {
      const brandId = workspace.brand_id;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${brandId}/${workspace.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('creative-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('creative-assets')
        .getPublicUrl(filePath);
      
      const item = productionItems.find(i => i.id === itemId);
      const newAsset = {
        id: `asset_${Date.now()}`,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: urlData.publicUrl,
        storage_path: filePath,
        uploaded_at: new Date().toISOString(),
        linked_concept_id: itemId,
        linked_concept_title: item?.hook || null,
      };
      
      // Remove any existing asset for this item
      const filteredAssets = uploadedAssets.filter((a: any) => a.linked_concept_id !== itemId);
      const updatedAssets = [...filteredAssets, newAsset];
      
      await supabase
        .from('campaign_workspaces')
        .update({ 
          user_uploaded_assets: updatedAssets,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      onUpdateWorkspace({ user_uploaded_assets: updatedAssets });
      toast.success("Asset uploaded!");
      
    } catch (e: any) {
      console.error("Upload error:", e);
      toast.error("Failed to upload file");
    } finally {
      setUploadingItemId(null);
      event.target.value = '';
    }
  };
  
  const handleUploadClick = (itemId: string) => {
    setUploadingItemId(itemId);
    fileInputRef.current?.click();
  };
  
  // Auto-save state for copy changes
  const [copySaveStatus, setCopySaveStatus] = useState<SaveStatus>("idle");
  
  const handleCopyChange = (angleId: string, copy: any) => {
    const updatedAngleCopy = { ...angleCopy, [angleId]: copy };
    onUpdateWorkspace({ creative_json: { ...creativeJson, angle_copy: updatedAngleCopy } });
  };
  
  const handleSaveCopy = async () => {
    setCopySaveStatus("saving");
    try {
      await supabase
        .from('campaign_workspaces')
        .update({
          creative_json: { ...creativeJson, angle_copy: angleCopy },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id);
      setCopySaveStatus("saved");
      setTimeout(() => setCopySaveStatus("idle"), 2000);
      toast.success("Copy saved!");
    } catch (e) {
      setCopySaveStatus("error");
      setTimeout(() => setCopySaveStatus("idle"), 3000);
      toast.error("Failed to save copy");
    }
  };
  
  // Count creatives per angle for the copy editor
  const getCreativeCountForAngle = (angleId: string) => {
    const angle = angles.find(a => a.id === angleId);
    if (!angle) return 0;
    return productionItems.filter(item => item.angleName === angle.name).length;
  };
  
  // Get copy for item's angle
  const getCopyForItem = (item: ProductionItem) => {
    const angle = angles.find(a => a.name === item.angleName);
    if (!angle) return undefined;
    return angleCopy[angle.id];
  };
  
  if (productionItems.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-16">
          <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Creatives Selected</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Add concepts from the Copy & Creative tab to build your production checklist.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={(e) => uploadingItemId && handleFileSelect(e, uploadingItemId)}
      />
      
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Creative Checklist (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Recommendation Banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Lumi recommends: 12-15 creatives maximum</p>
              <p className="text-xs text-muted-foreground mt-1">
                Starting with fewer, high-quality creatives helps the algorithm learn faster.
                {productionItems.length > 15 && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                    You have {productionItems.length} — consider narrowing down with "Get Lumi's Top 5".
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">Production Checklist</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {hasRankedItems && (
                    <>
                      <Button
                        variant={showTopOnly ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowTopOnly(!showTopOnly)}
                        className="gap-1"
                      >
                        <Filter className="h-3 w-3" />
                        {showTopOnly ? "Show All" : "Top 5 Only"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMoveOthersToLibrary}
                        disabled={movingToLibrary}
                        className="gap-1"
                      >
                        {movingToLibrary ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Library className="h-3 w-3" />
                        )}
                        Move Others to Concept Library
                      </Button>
                    </>
                  )}
                  {canRank && !hasRankedItems && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRankConcepts}
                            disabled={isRanking}
                            className="gap-1 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:from-amber-100 hover:to-amber-200"
                          >
                            {isRanking ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            Get Lumi's Top 5
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>AI will rank your {productionItems.length} concepts and pick the top 5</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Badge variant={itemsWithAssets === productionItems.length ? "default" : "secondary"}>
                    {itemsWithAssets}/{productionItems.length} uploaded
                  </Badge>
                </div>
              </div>
              {overallStrategy && (
                <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-2 rounded-md">
                  <span className="font-medium">Lumi's Strategy:</span> {overallStrategy}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {showTopOnly && hasRankedItems ? (
                /* When showing Top 5, display in rank order with angle as badge */
                <div className="space-y-2">
                  {rankedItems
                    .sort((a, b) => a.rank - b.rank)
                    .map((rankedItem) => {
                      const item = productionItems.find(p => p.id === rankedItem.id);
                      if (!item) return null;
                      return (
                        <CreativeChecklistCard
                          key={item.id}
                          item={item}
                          uploadedAsset={getAssetForItem(item.id)}
                          onUploadClick={() => handleUploadClick(item.id)}
                          onRemove={() => onRemoveItem(item.id)}
                          onPreview={setPreviewAsset}
                          onAdPreview={() => setAdPreviewItem(item)}
                          onSaveToLibrary={onSaveToLibrary ? () => handleSaveToLibrary(item) : undefined}
                          savingToLibrary={savingToLibrary === item.id}
                          rank={rankedItem.rank}
                          rationale={rankedItem.rationale}
                          showAngleBadge
                        />
                      );
                    })}
                </div>
              ) : (
                /* Default: group by angle */
                Object.entries(itemsByAngle).map(([angleName, items]) => {
                  const displayItems = getDisplayItems(items);
                  if (displayItems.length === 0) return null;
                  return (
                    <div key={angleName} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">{angleName}</h4>
                        <Badge variant="outline" className="text-xs">{displayItems.length} creative{displayItems.length !== 1 ? "s" : ""}</Badge>
                      </div>
                      <div className="space-y-2">
                        {displayItems.map((item) => {
                          const { rank, rationale } = getRankForItem(item.id);
                          return (
                            <CreativeChecklistCard
                              key={item.id}
                              item={item}
                              uploadedAsset={getAssetForItem(item.id)}
                              onUploadClick={() => handleUploadClick(item.id)}
                              onRemove={() => onRemoveItem(item.id)}
                              onPreview={setPreviewAsset}
                              onAdPreview={() => setAdPreviewItem(item)}
                              onSaveToLibrary={onSaveToLibrary ? () => handleSaveToLibrary(item) : undefined}
                              savingToLibrary={savingToLibrary === item.id}
                              rank={rank}
                              rationale={rationale}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          
          {/* Build Campaign Button with Status */}
          <Card className={cn(
            "border-2 transition-all",
            isReadyToBuild ? "border-green-500" : "border-dashed"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {isReadyToBuild ? (
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {isReadyToBuild ? "Ready for Publishing" : "Needs Creative"}
                      </p>
                      <Badge 
                        variant={isReadyToBuild ? "default" : "secondary"}
                        className={cn(
                          isReadyToBuild 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        )}
                      >
                        {isReadyToBuild ? "✓ Ready" : "In Progress"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {productionItems.length < 3 
                        ? `Need ${3 - productionItems.length} more concepts`
                        : !hasAtLeastOneUpload
                          ? "Upload at least 1 creative file to continue"
                          : `${itemsWithAssets}/${productionItems.length} creatives uploaded`
                      }
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={onBuildCampaign} 
                  disabled={!isReadyToBuild}
                  size="lg"
                  className={cn(
                    "gap-2",
                    isReadyToBuild && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <Rocket className="h-5 w-5" />
                  Build Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right: Copy Editor (2/5) */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 space-y-2">
            {/* Copy Editor Save Status */}
            <div className="flex items-center justify-end px-1">
              <AutoSaveIndicator status={copySaveStatus} size="sm" />
            </div>
            <AngleCopyEditor
              angles={angles}
              selectedAngleIds={selectedAngleIds}
              angleCopy={angleCopy}
              brandInfo={workspace?.brands}
              offerData={{
                name: workspace?.offer_name,
                description: workspace?.offer_description,
                price_point: workspace?.offer_price,
              }}
              audiencePsychology={workspace?.brands?.audience_psychology}
              onCopyChange={handleCopyChange}
              onSave={handleSaveCopy}
              productionItemCount={productionItems.length}
            />
          </div>
        </div>
      </div>
      
      {/* Preview Dialog */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden min-h-[400px]">
            {previewAsset?.file_type?.startsWith('image/') && (
              <img 
                src={previewAsset.file_url} 
                alt={previewAsset.file_name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
            {previewAsset?.file_type?.startsWith('video/') && (
              <video 
                controls 
                src={previewAsset.file_url}
                className="max-w-full max-h-[70vh]"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Ad Preview Modal */}
      {adPreviewItem && (
        <AdPreviewModal
          open={!!adPreviewItem}
          onOpenChange={(open) => !open && setAdPreviewItem(null)}
          item={adPreviewItem}
          asset={getAssetForItem(adPreviewItem.id)}
          angleCopy={getCopyForItem(adPreviewItem)}
          brandName={workspace?.brands?.name}
          websiteUrl={workspace?.offer_url || workspace?.brands?.website_url}
        />
      )}
    </>
  );
}
