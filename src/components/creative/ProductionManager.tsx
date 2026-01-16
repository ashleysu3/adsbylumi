import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Rocket, Upload, CheckCircle2, AlertCircle, 
  Video, Film, Image, Eye, FolderOpen
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ProductionItem } from "./ProductionChecklistPanel";
import { CreativeChecklistCard } from "./CreativeChecklistCard";
import { AngleCopyEditor } from "./AngleCopyEditor";
import { CreativeAngle } from "./AngleSelector";

interface ProductionManagerProps {
  workspace: any;
  productionItems: ProductionItem[];
  angles: CreativeAngle[];
  selectedAngleIds: string[];
  onRemoveItem: (id: string) => void;
  onBuildCampaign: () => void;
  onUpdateWorkspace: (updates: any) => void;
}

export function ProductionManager({
  workspace,
  productionItems,
  angles,
  selectedAngleIds,
  onRemoveItem,
  onBuildCampaign,
  onUpdateWorkspace,
}: ProductionManagerProps) {
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadedAssets = workspace?.user_uploaded_assets || [];
  const creativeJson = workspace?.creative_json || {};
  const angleCopy = creativeJson.angle_copy || {};
  
  // Group items by angle
  const itemsByAngle = productionItems.reduce((acc, item) => {
    const angleKey = item.angleName || "Unassigned";
    if (!acc[angleKey]) acc[angleKey] = [];
    acc[angleKey].push(item);
    return acc;
  }, {} as Record<string, ProductionItem[]>);
  
  // Get asset linked to a specific production item
  const getAssetForItem = (itemId: string) => {
    return uploadedAssets.find((a: any) => a.linked_concept_id === itemId);
  };
  
  // Count items with assets
  const itemsWithAssets = productionItems.filter(item => getAssetForItem(item.id)).length;
  
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
  
  const handleCopyChange = (angleId: string, copy: any) => {
    const updatedAngleCopy = { ...angleCopy, [angleId]: copy };
    onUpdateWorkspace({ creative_json: { ...creativeJson, angle_copy: updatedAngleCopy } });
  };
  
  const handleSaveCopy = async () => {
    try {
      await supabase
        .from('campaign_workspaces')
        .update({
          creative_json: { ...creativeJson, angle_copy: angleCopy },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id);
      toast.success("Copy saved!");
    } catch (e) {
      toast.error("Failed to save copy");
    }
  };
  
  // Count creatives per angle for the copy editor
  const getCreativeCountForAngle = (angleId: string) => {
    const angle = angles.find(a => a.id === angleId);
    if (!angle) return 0;
    return productionItems.filter(item => item.angleName === angle.name).length;
  };
  
  const isReadyToBuild = productionItems.length >= 3;
  const hasAnyCopy = Object.keys(angleCopy).length > 0;
  
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
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Production Checklist</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={itemsWithAssets === productionItems.length ? "default" : "secondary"}>
                    {itemsWithAssets}/{productionItems.length} uploaded
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(itemsByAngle).map(([angleName, items]) => (
                <div key={angleName} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">{angleName}</h4>
                    <Badge variant="outline" className="text-xs">{items.length} creative{items.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <CreativeChecklistCard
                        key={item.id}
                        item={item}
                        uploadedAsset={getAssetForItem(item.id)}
                        onUploadClick={() => handleUploadClick(item.id)}
                        onRemove={() => onRemoveItem(item.id)}
                        onPreview={setPreviewAsset}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          
          {/* Build Campaign Button */}
          <Card className={cn(
            "border-2 transition-all",
            isReadyToBuild ? "border-primary" : "border-dashed"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isReadyToBuild ? (
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {isReadyToBuild ? "Ready to build!" : `Need ${3 - productionItems.length} more concepts`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {productionItems.length} concept{productionItems.length !== 1 ? "s" : ""} in checklist
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={onBuildCampaign} 
                  disabled={!isReadyToBuild}
                  size="lg"
                  className="gap-2"
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
          <div className="sticky top-4">
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
    </>
  );
}
