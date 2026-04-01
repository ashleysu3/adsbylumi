import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Rocket, Upload, CheckCircle2, AlertCircle, 
  Video, Film, Image, Eye, FolderOpen, Maximize2,
  Sparkles, Loader2, Filter, Library, Info, Download,
  Archive, Trash2, ChevronDown, Star, Printer, CheckSquare, Square, XCircle,
  Share2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ProductionItem } from "./ProductionChecklistPanel";
import { CreativeChecklistCard } from "./CreativeChecklistCard";
import { CreativeAngle } from "./AngleSelector";
import { AdPreviewModal } from "./AdPreviewModal";
import { ExportChecklistModal } from "./ExportChecklistModal";
import { ShareWithClientDialog } from "./ShareWithClientDialog";
import { ClientActivityFeed } from "./ClientActivityFeed";
import { format } from "date-fns";

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
  angleCopy?: Record<string, any>;
  onRefineScript?: (itemId: string, feedback: string) => Promise<void>;
  currentRound?: string;
  onArchivePrevious?: () => Promise<void>;
  onClearAll?: () => Promise<void>;
  onUrlChange?: (url: string) => void;
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
  angleCopy: angleCopyProp,
  onRefineScript,
  currentRound,
  onArchivePrevious,
  onClearAll,
  onUrlChange,
}: ProductionManagerProps) {
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadingVerticalItemId, setUploadingVerticalItemId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const [adPreviewItem, setAdPreviewItem] = useState<ProductionItem | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState<string | null>(null);
  const [isRanking, setIsRanking] = useState(false);
  const [rankedItems, setRankedItems] = useState<RankedItem[]>([]);
  const [showSaveOthersPrompt, setShowSaveOthersPrompt] = useState(false);
  const [overallStrategy, setOverallStrategy] = useState<string>("");
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [movingToLibrary, setMovingToLibrary] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previousOpen, setPreviousOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoving, setBulkMoving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [resolvedAssetUrls, setResolvedAssetUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verticalFileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadedAssets = workspace?.user_uploaded_assets || [];
  const uploadedAssetSignature = uploadedAssets
    .map((asset: any) => `${asset?.id ?? ""}:${asset?.storage_path ?? asset?.storagePath ?? ""}`)
    .join("|");
  const angleCopy = angleCopyProp || workspace?.creative_json?.angle_copy || {};
  const selectedCopy = workspace?.selected_copy || {};

  useEffect(() => {
    let isCancelled = false;

    const storagePaths: string[] = Array.from(
      new Set<string>(
        uploadedAssets
          .map((asset: any) => asset?.storage_path || asset?.storagePath)
          .filter((path: unknown): path is string => typeof path === "string" && path.length > 0)
      )
    );

    if (storagePaths.length === 0) {
      setResolvedAssetUrls({});
      return;
    }

    const resolveSignedUrls = async () => {
      const { data, error } = await supabase.storage
        .from("creative-assets")
        .createSignedUrls(storagePaths, 60 * 60 * 6);

      if (error) {
        console.error("Failed to resolve signed creative URLs:", error);
        return;
      }

      const mapped = storagePaths.reduce<Record<string, string>>((acc, path, index) => {
        const signedUrl = data?.[index]?.signedUrl;
        if (signedUrl) {
          acc[path] = signedUrl.startsWith("http")
            ? signedUrl
            : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${signedUrl.startsWith("/") ? signedUrl : `/${signedUrl}`}`;
        }
        return acc;
      }, {});

      if (!isCancelled) {
        setResolvedAssetUrls(mapped);
      }
    };

    resolveSignedUrls();

    return () => {
      isCancelled = true;
    };
  }, [workspace?.id, uploadedAssetSignature]);
  
  // Split items by round
  const currentRoundItems = currentRound 
    ? productionItems.filter(i => i.round === currentRound)
    : productionItems;
  const previousRoundItems = currentRound
    ? productionItems.filter(i => !i.round || i.round !== currentRound)
    : [];
  
  // Group previous items by round for collapsible display
  const previousByRound = previousRoundItems.reduce((acc, item) => {
    const key = item.round || "legacy";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ProductionItem[]>);
  
  const displayItems = showTopOnly && rankedItems.length > 0 
    ? currentRoundItems 
    : currentRoundItems;
  
  const canRank = productionItems.length >= 6;
  const hasRankedItems = rankedItems.length > 0;
  
  // Group items by angle
  const itemsByAngle = displayItems.reduce((acc, item) => {
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
  
  const normalizeLookup = (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";

  const resolveAssetUrl = (rawAsset: any) => {
    if (!rawAsset) return null;
    const storagePath = rawAsset.storage_path || rawAsset.storagePath;
    const signedUrl = storagePath ? resolvedAssetUrls[storagePath] : undefined;
    return signedUrl || rawAsset.file_url || rawAsset.url || rawAsset.signed_url || null;
  };

  const normalizeUploadedAsset = (rawAsset: any) => {
    if (!rawAsset) return null;
    const fileUrl = resolveAssetUrl(rawAsset);
    if (!fileUrl) return null;

    return {
      id: rawAsset.id || rawAsset.asset_id || fileUrl,
      file_name: rawAsset.file_name || rawAsset.name || rawAsset.fileName || "Creative asset",
      file_url: fileUrl,
      file_type: rawAsset.file_type || rawAsset.type || "",
      storage_path: rawAsset.storage_path || rawAsset.storagePath,
    };
  };

  // Get asset linked to a specific production item (strict mapping for status/checklist)
  const getAssetForItem = (item: ProductionItem) => {
    const itemAny = item as any;

    const byLinkedConcept = uploadedAssets.find((asset: any) =>
      [item.id, itemAny.concept_id].filter(Boolean).includes(asset?.linked_concept_id)
    );

    const byAssetId = uploadedAssets.find(
      (asset: any) =>
        asset?.id &&
        [itemAny.uploaded_asset_id, itemAny.linkedAsset?.id].filter(Boolean).includes(asset.id)
    );

    const byStoragePath = uploadedAssets.find((asset: any) => {
      const candidatePath = asset?.storage_path || asset?.storagePath;
      if (!candidatePath) return false;
      return [
        itemAny.storage_path,
        itemAny.linkedAsset?.storagePath,
        itemAny.linkedAsset?.storage_path,
      ]
        .filter(Boolean)
        .includes(candidatePath);
    });

    const byAssetUrl = uploadedAssets.find((asset: any) => {
      const candidateUrl = resolveAssetUrl(asset);
      return (
        !!candidateUrl &&
        [itemAny.uploaded_asset_url, itemAny.linkedAsset?.url]
          .filter(Boolean)
          .includes(candidateUrl)
      );
    });

    return (
      normalizeUploadedAsset(byLinkedConcept) ||
      normalizeUploadedAsset(byAssetId) ||
      normalizeUploadedAsset(byStoragePath) ||
      normalizeUploadedAsset(byAssetUrl) ||
      normalizeUploadedAsset({
        id: itemAny.linkedAsset?.id || itemAny.uploaded_asset_id,
        file_name: itemAny.linkedAsset?.fileName,
        file_url: itemAny.linkedAsset?.url || itemAny.uploaded_asset_url,
        file_type: itemAny.linkedAsset?.type,
        storage_path: itemAny.linkedAsset?.storagePath || itemAny.linkedAsset?.storage_path || itemAny.storage_path,
      })
    );
  };

  // Relaxed asset lookup for legacy data in Ad Preview only
  const getPreviewAssetForItem = (item: ProductionItem) => {
    const strictAsset = getAssetForItem(item);
    if (strictAsset) return strictAsset;

    const unlinkedLegacyAssets = uploadedAssets
      .filter((asset: any) => !asset?.linked_concept_id)
      .map((asset: any) => normalizeUploadedAsset(asset))
      .filter((asset: any) => !!asset);

    if (unlinkedLegacyAssets.length === 0) return null;
    if (unlinkedLegacyAssets.length === 1) return unlinkedLegacyAssets[0];

    const itemIndex = productionItems.findIndex((productionItem) => productionItem.id === item.id);
    if (itemIndex >= 0 && itemIndex < unlinkedLegacyAssets.length) {
      return unlinkedLegacyAssets[itemIndex];
    }

    return unlinkedLegacyAssets[0];
  };

  // Count items with assets
  const itemsWithAssets = productionItems.filter(item => !!getAssetForItem(item)).length;

  // Check if at least one creative is uploaded
  const hasAtLeastOneUpload = productionItems.some(item => !!getAssetForItem(item));

  // Updated readiness check - needs 3+ concepts AND at least one upload
  const isReadyToBuild = productionItems.length >= 1 && hasAtLeastOneUpload;
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
      // Prompt user to save the others
      const rankedIds = (data.rankedItems || []).map((r: any) => r.id);
      const nonRankedCount = productionItems.filter(i => !rankedIds.includes(i.id)).length;
      if (nonRankedCount > 0 && onSaveToLibrary) {
        setShowSaveOthersPrompt(true);
      }
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
      toast.success(`Saved ${nonRankedItems.length} concepts for later`);
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

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === productionItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(productionItems.map(i => i.id)));
    }
  };

  const handleBulkMoveToLibrary = async () => {
    if (!onSaveToLibrary || selectedIds.size === 0) return;
    setBulkMoving(true);
    try {
      const itemsToMove = productionItems.filter(i => selectedIds.has(i.id));
      for (const item of itemsToMove) {
        await onSaveToLibrary(item);
      }
      toast.success(`Moved ${itemsToMove.length} concept${itemsToMove.length !== 1 ? "s" : ""} to library`);
      setSelectedIds(new Set());
      setBulkSelectMode(false);
    } catch (error: any) {
      toast.error("Failed to move some items: " + error.message);
    } finally {
      setBulkMoving(false);
    }
  };

  // Validate video aspect ratio — must be 9:16 (vertical)
  const validateVideoAspectRatio = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        const ratio = video.videoWidth / video.videoHeight;
        // 9:16 = 0.5625. Allow some tolerance (0.45–0.65)
        if (ratio > 0.65) {
          toast.error("Videos must be in 9:16 (vertical/reel) format. Please upload a vertical video.", { duration: 5000 });
          resolve(false);
        } else {
          resolve(true);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(true); // Allow on error — don't block uploads we can't validate
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // Handle file selection for a specific item
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File must be less than 50MB");
      return;
    }

    // Enforce 9:16 for videos
    if (file.type.startsWith('video/')) {
      const isValid = await validateVideoAspectRatio(file);
      if (!isValid) {
        event.target.value = '';
        return;
      }
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
      
      // Remove any existing asset for this item (but keep vertical version)
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

  // Handle vertical (9:16) version upload for an image
  const handleVerticalFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File must be less than 50MB");
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error("Only image files can be uploaded as a 9:16 version");
      return;
    }
    
    setUploadingVerticalItemId(itemId);
    
    try {
      const brandId = workspace.brand_id;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_vertical_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${brandId}/${workspace.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('creative-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('creative-assets')
        .getPublicUrl(filePath);
      
      const item = productionItems.find(i => i.id === itemId);
      const verticalConceptId = `${itemId}_vertical`;
      const newAsset = {
        id: `asset_${Date.now()}_v`,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: urlData.publicUrl,
        storage_path: filePath,
        uploaded_at: new Date().toISOString(),
        linked_concept_id: verticalConceptId,
        linked_concept_title: item?.hook ? `${item.hook} (9:16)` : null,
        is_vertical_version: true,
      };
      
      // Remove any existing vertical asset for this item
      const filteredAssets = uploadedAssets.filter((a: any) => a.linked_concept_id !== verticalConceptId);
      const updatedAssets = [...filteredAssets, newAsset];
      
      await supabase
        .from('campaign_workspaces')
        .update({ 
          user_uploaded_assets: updatedAssets,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);
      
      onUpdateWorkspace({ user_uploaded_assets: updatedAssets });
      toast.success("9:16 version uploaded!");
      
    } catch (e: any) {
      console.error("Vertical upload error:", e);
      toast.error("Failed to upload file");
    } finally {
      setUploadingVerticalItemId(null);
      event.target.value = '';
    }
  };
  
  const handleUploadClick = (itemId: string) => {
    setUploadingItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleUploadVerticalClick = (itemId: string) => {
    setUploadingVerticalItemId(itemId);
    verticalFileInputRef.current?.click();
  };

  // Get the vertical (9:16) version of an asset for an item
  const getVerticalAssetForItem = (item: ProductionItem) => {
    const verticalConceptId = `${item.id}_vertical`;
    const verticalAsset = uploadedAssets.find((a: any) => a.linked_concept_id === verticalConceptId);
    if (!verticalAsset) return null;
    return normalizeUploadedAsset(verticalAsset);
  };
  
  const getAngleCopyKeyForItem = (item: ProductionItem): string | null => {
    const itemAny = item as any;
    const directKeys = [itemAny.angleId, itemAny.angle, itemAny.angle_id].filter(Boolean) as string[];

    const directMatch = directKeys.find((key) => !!angleCopy[key]);
    if (directMatch) return directMatch;

    const normalizedItemAngleName = normalizeLookup(item.angleName || itemAny.angle_name || itemAny.angle);
    const matchedAngle = angles.find((angle) => normalizeLookup(angle.name) === normalizedItemAngleName);
    if (matchedAngle?.id && angleCopy[matchedAngle.id]) return matchedAngle.id;

    const nameKeyMatch = Object.keys(angleCopy).find(
      (key) => normalizeLookup(key) === normalizedItemAngleName
    );

    // Also check item.id as a key (used as fallback when saving edits)
    const idKeyMatch = item.id && angleCopy[item.id] ? item.id : null;

    return nameKeyMatch || matchedAngle?.id || idKeyMatch || null;
  };

  // Get copy for item's angle (supports id-keyed and name-keyed stores)
  const getCopyForItem = (item: ProductionItem) => {
    const key = getAngleCopyKeyForItem(item);
    return key ? angleCopy[key] : undefined;
  };

  // Handle copy changes from checklist cards
  const handleChecklistCopyChange = (item: ProductionItem, updatedCopy: any) => {
    let copyKey = getAngleCopyKeyForItem(item);
    if (!copyKey) {
      const itemAny = item as any;
      copyKey = itemAny.angleId || itemAny.angle_id || item.angleName || item.id;
    }
    if (copyKey) {
      const updatedAngleCopy = { ...angleCopy, [copyKey]: updatedCopy };
      onUpdateWorkspace({
        creative_json: {
          ...(workspace?.creative_json || {}),
          angle_copy: updatedAngleCopy,
        },
      });
    }
  };
  
  if (productionItems.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-16">
          <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Creatives Selected</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Add concepts from the Creative Concepts tab to build your production checklist.
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
      <input
        ref={verticalFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => uploadingVerticalItemId && handleVerticalFileSelect(e, uploadingVerticalItemId)}
      />
      
      <div className="space-y-4">
        {/* Creative Checklist - Full Width */}
        <div className="space-y-4">
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
                  {/* Share with Client */}
                  {productionItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShareDialogOpen(true)}
                      className="gap-1"
                    >
                      <Share2 className="h-3 w-3" />
                      Share with Client
                    </Button>
                  )}
                  {/* Export Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExportModalOpen(true)}
                          className="gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Export Production Checklist
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download CSV to share with your client or creative team</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Move to Concept Library */}
                  {onSaveToLibrary && (
                    <Button
                      variant={bulkSelectMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (bulkSelectMode) {
                          setBulkSelectMode(false);
                          setSelectedIds(new Set());
                        } else {
                          setBulkSelectMode(true);
                        }
                      }}
                      className="gap-1"
                    >
                      <Library className="h-3 w-3" />
                      {bulkSelectMode ? "Cancel" : "Move to Concept Library"}
                    </Button>
                  )}
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
                        Save Others for Later
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
                          <p>Lumi will rank your {productionItems.length} concepts and pick the top 5</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {/* Archive / Clear Actions */}
                  {previousRoundItems.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!onArchivePrevious) return;
                          setArchiving(true);
                          await onArchivePrevious();
                          setArchiving(false);
                        }}
                        disabled={archiving}
                        className="gap-1"
                      >
                        {archiving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                        Archive Previous ({previousRoundItems.length})
                      </Button>
                    </div>
                  )}
                  {productionItems.length > 0 && onClearAll && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        setClearing(true);
                        await onClearAll();
                        setClearing(false);
                      }}
                      disabled={clearing}
                      className="gap-1 text-muted-foreground"
                    >
                      {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Clear All
                    </Button>
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
              {/* Bulk Selection Bar */}
              {bulkSelectMode && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                    >
                      {selectedIds.size === productionItems.length ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                      {selectedIds.size === productionItems.length ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size} of {productionItems.length} selected
                    </span>
                  </div>
                  <Button
                    variant="lumi"
                    size="sm"
                    disabled={selectedIds.size === 0 || bulkMoving}
                    onClick={handleBulkMoveToLibrary}
                    className="gap-1.5"
                  >
                    {bulkMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Library className="h-3.5 w-3.5" />}
                    Move {selectedIds.size > 0 ? `(${selectedIds.size})` : ""} to Library
                  </Button>
                </div>
              )}
              {/* Current Round Label */}
              {currentRound && previousRoundItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Current Round</span>
                  <Badge variant="secondary" className="text-xs">
                    {currentRoundItems.length} creative{currentRoundItems.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              )}
              
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
                          uploadedAsset={getAssetForItem(item)}
                          uploadedAssetVertical={getVerticalAssetForItem(item)}
                          onUploadClick={() => handleUploadClick(item.id)}
                          onUploadVerticalClick={() => handleUploadVerticalClick(item.id)}
                          onRemove={() => onRemoveItem(item.id)}
                          onPreview={setPreviewAsset}
                          onAdPreview={() => setAdPreviewItem(item)}
                          onSaveToLibrary={onSaveToLibrary ? () => handleSaveToLibrary(item) : undefined}
                          savingToLibrary={savingToLibrary === item.id}
                          rank={rankedItem.rank}
                          rationale={rankedItem.rationale}
                          showAngleBadge
                          onRefineScript={onRefineScript}
                          selected={bulkSelectMode ? selectedIds.has(item.id) : undefined}
                          onToggleSelect={bulkSelectMode ? () => toggleSelectItem(item.id) : undefined}
                          angleCopy={getCopyForItem(item)}
                          onCopyChange={(updated) => handleChecklistCopyChange(item, updated)}
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
                              uploadedAsset={getAssetForItem(item)}
                              uploadedAssetVertical={getVerticalAssetForItem(item)}
                              onUploadClick={() => handleUploadClick(item.id)}
                              onUploadVerticalClick={() => handleUploadVerticalClick(item.id)}
                              onRemove={() => onRemoveItem(item.id)}
                              onPreview={setPreviewAsset}
                              onAdPreview={() => setAdPreviewItem(item)}
                              onSaveToLibrary={onSaveToLibrary ? () => handleSaveToLibrary(item) : undefined}
                              savingToLibrary={savingToLibrary === item.id}
                              rank={rank}
                              rationale={rationale}
                              onRefineScript={onRefineScript}
                              selected={bulkSelectMode ? selectedIds.has(item.id) : undefined}
                              onToggleSelect={bulkSelectMode ? () => toggleSelectItem(item.id) : undefined}
                              angleCopy={getCopyForItem(item)}
                              onCopyChange={(updated) => handleChecklistCopyChange(item, updated)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* Previous Batches Collapsible */}
              {previousRoundItems.length > 0 && (
                <Collapsible open={previousOpen} onOpenChange={setPreviousOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground">
                      <span className="flex items-center gap-2">
                        <Archive className="h-4 w-4" />
                        Previous Batches
                        <Badge variant="outline" className="text-xs">{previousRoundItems.length}</Badge>
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", previousOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-2">
                    {Object.entries(previousByRound).map(([roundKey, items]) => {
                      const roundLabel = roundKey === "legacy" 
                        ? "Legacy Items" 
                        : `Round from ${format(new Date(roundKey), "MMM d")}`;
                      const prevByAngle = items.reduce((acc, item) => {
                        const k = item.angleName || "Unassigned";
                        if (!acc[k]) acc[k] = [];
                        acc[k].push(item);
                        return acc;
                      }, {} as Record<string, ProductionItem[]>);
                      
                      return (
                        <div key={roundKey} className="space-y-3 border-l-2 border-muted pl-4">
                          <p className="text-xs font-medium text-muted-foreground">{roundLabel} · {items.length} items</p>
                          {Object.entries(prevByAngle).map(([angleName, angleItems]) => (
                            <div key={angleName} className="space-y-2">
                              <h4 className="text-xs font-semibold text-muted-foreground/70">{angleName}</h4>
                              {angleItems.map((item) => (
                                <CreativeChecklistCard
                                  key={item.id}
                                  item={item}
                                  uploadedAsset={getAssetForItem(item)}
                                  uploadedAssetVertical={getVerticalAssetForItem(item)}
                                  onUploadClick={() => handleUploadClick(item.id)}
                                  onUploadVerticalClick={() => handleUploadVerticalClick(item.id)}
                                  onRemove={() => onRemoveItem(item.id)}
                                  onPreview={setPreviewAsset}
                                  onAdPreview={() => setAdPreviewItem(item)}
                                  onSaveToLibrary={onSaveToLibrary ? () => handleSaveToLibrary(item) : undefined}
                                  savingToLibrary={savingToLibrary === item.id}
                                  onRefineScript={onRefineScript}
                                  angleCopy={getCopyForItem(item)}
                                  onCopyChange={(updated) => handleChecklistCopyChange(item, updated)}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
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
                      {!hasAtLeastOneUpload
                        ? "Upload at least 1 creative file to continue"
                        : `${itemsWithAssets}/${productionItems.length} creatives uploaded`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button 
                    variant="lumi"
                    onClick={() => {
                      // Flag image items without a vertical version as auto_extend
                      const imageItemsWithoutVertical = productionItems.filter(item => {
                        const asset = getAssetForItem(item);
                        if (!asset) return false;
                        const isVideo = asset.file_type?.startsWith('video/');
                        if (isVideo) return false;
                        const verticalAsset = getVerticalAssetForItem(item);
                        return !verticalAsset;
                      });
                      
                      if (imageItemsWithoutVertical.length > 0) {
                        // Update production items with auto_extend flag
                        const updatedItems = productionItems.map(item => {
                          const needsAutoExtend = imageItemsWithoutVertical.some(i => i.id === item.id);
                          return needsAutoExtend ? { ...item, auto_extend: true } : item;
                        });
                        onUpdateWorkspace({ production_items: updatedItems });
                        toast.info(
                          `${imageItemsWithoutVertical.length} image${imageItemsWithoutVertical.length > 1 ? 's' : ''} without a 9:16 version — Meta will auto-extend with color bars`,
                          { duration: 4000 }
                        );
                      }
                      
                      onBuildCampaign();
                    }} 
                    disabled={!isReadyToBuild}
                    size="lg"
                    className="gap-2"
                    title={!isReadyToBuild ? "Upload at least one creative asset to build" : undefined}
                  >
                    <Rocket className="h-5 w-5" />
                    Build Campaign
                  </Button>
                  {!isReadyToBuild && (
                    <p className="text-xs text-muted-foreground text-right">
                      Upload at least one creative asset above to enable building
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Activity Feed */}
          <ClientActivityFeed workspaceId={workspace.id} />
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
          asset={getPreviewAssetForItem(adPreviewItem)}
          angleCopy={getCopyForItem(adPreviewItem)}
          selectedCopy={selectedCopy}
          brandName={workspace?.brands?.name}
          websiteUrl={workspace?.offer_url || workspace?.brands?.website_url}
          isDmCampaign={!!(workspace?.creative_json as any)?.dmLeadsCampaign || !!(workspace?.creative_json as any)?.commentDmCampaign}
          onCopyChange={(updatedCopy) => {
            let copyKey = getAngleCopyKeyForItem(adPreviewItem);
            // If no key found, create one from angle name
            if (!copyKey) {
              const itemAny = adPreviewItem as any;
              copyKey = itemAny.angleId || itemAny.angle_id || adPreviewItem.angleName || adPreviewItem.id;
            }
            if (copyKey) {
              const updatedAngleCopy = { ...angleCopy, [copyKey]: updatedCopy };
              onUpdateWorkspace({
                creative_json: {
                  ...(workspace?.creative_json || {}),
                  angle_copy: updatedAngleCopy,
                },
              });
            }
          }}
          onUrlChange={onUrlChange}
        />
      )}

      {/* Export Checklist Modal */}
      <ExportChecklistModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        productionItems={productionItems}
        angleCopy={angleCopy}
        brandName={workspace?.brands?.name}
        offerName={workspace?.offer_name}
      />

      {/* Share with Client Dialog */}
      <ShareWithClientDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        workspace={workspace}
        productionItems={productionItems}
        brandId={brandId}
      />

      {/* Save Others Prompt after Lumi's Top 5 */}
      <Dialog open={showSaveOthersPrompt} onOpenChange={setShowSaveOthersPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Save the rest for later?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Lumi picked your Top 5. Want to save the other {productionItems.filter(i => !rankedItems.map(r => r.id).includes(i.id)).length} concepts to your Concept Library so you can use them in future rounds?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSaveOthersPrompt(false)}>
              No, keep them here
            </Button>
            <Button 
              onClick={async () => {
                setShowSaveOthersPrompt(false);
                await handleMoveOthersToLibrary();
              }}
              disabled={movingToLibrary}
              className="gap-2"
            >
              {movingToLibrary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />}
              Save to Library
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
