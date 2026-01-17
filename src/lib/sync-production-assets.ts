/**
 * Utility to sync user_uploaded_assets to production_items
 * This ensures assets linked by concept_id are reflected in production_items
 */

export interface UserUploadedAsset {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  linked_concept_id?: string;
  uploaded_at?: string;
}

export interface ProductionItem {
  id: string;
  concept_id?: string;
  status: 'pending' | 'ready' | 'in_progress' | 'recorded' | 'uploaded' | 'approved';
  linkedAsset?: {
    url: string;
    id: string;
    type: string;
    fileName: string;
  };
  uploaded_asset_id?: string;
  finalCopy?: {
    headline?: string;
    description?: string;
    primary_text?: string;
  };
  final_copy?: {
    headline?: string;
    description?: string;
    primary_text?: string;
  };
  angle?: string;
  angleId?: string;
  [key: string]: any;
}

export interface SyncResult {
  updated: boolean;
  items: ProductionItem[];
  syncedCount: number;
}

/**
 * Syncs user_uploaded_assets to production_items
 * Updates production items with linkedAsset data when an asset is linked by concept_id
 */
export function syncAssetsToProductionItems(
  productionItems: ProductionItem[],
  userUploadedAssets: UserUploadedAsset[] | null | undefined
): SyncResult {
  if (!productionItems || productionItems.length === 0) {
    return { updated: false, items: productionItems || [], syncedCount: 0 };
  }

  if (!userUploadedAssets || userUploadedAssets.length === 0) {
    return { updated: false, items: productionItems, syncedCount: 0 };
  }

  let updated = false;
  let syncedCount = 0;

  const updatedItems = productionItems.map((item) => {
    // Find an asset linked to this production item
    const linkedAsset = userUploadedAssets.find(
      (asset) => asset.linked_concept_id === item.id || 
                 asset.linked_concept_id === item.concept_id
    );

    if (!linkedAsset) {
      return item;
    }

    // Check if asset is already synced
    const alreadySynced = 
      item.linkedAsset?.id === linkedAsset.id || 
      item.uploaded_asset_id === linkedAsset.id;

    if (alreadySynced) {
      return item;
    }

    // Sync the asset to the production item
    updated = true;
    syncedCount++;

    return {
      ...item,
      linkedAsset: {
        url: linkedAsset.file_url,
        id: linkedAsset.id,
        type: linkedAsset.file_type,
        fileName: linkedAsset.file_name,
      },
      uploaded_asset_id: linkedAsset.id,
      // If status is pending/ready, upgrade to uploaded
      status: ['pending', 'ready', 'in_progress', 'recorded'].includes(item.status)
        ? 'uploaded' as const
        : item.status,
    };
  });

  return { updated, items: updatedItems, syncedCount };
}

/**
 * Check if a production item is ready for campaign (has asset + copy)
 */
export function isItemReadyForCampaign(
  item: ProductionItem,
  angleCopy?: Record<string, any>
): { ready: boolean; hasAsset: boolean; hasCopy: boolean; reason?: string } {
  const hasAsset = !!(item.linkedAsset?.url || item.uploaded_asset_id);
  
  const hasFinalCopy = !!(
    item.finalCopy?.headline || 
    item.final_copy?.headline
  );
  
  const angleId = item.angle || item.angleId;
  const hasAngleCopy = angleId && angleCopy?.[angleId] && (
    angleCopy[angleId].headlines?.length > 0 ||
    angleCopy[angleId].descriptions?.length > 0 ||
    angleCopy[angleId].primary_copy?.length > 0
  );

  const hasCopy = hasFinalCopy || hasAngleCopy;
  const ready = hasAsset && hasCopy && item.status === 'approved';

  let reason: string | undefined;
  if (!hasAsset) {
    reason = 'Missing creative asset';
  } else if (!hasCopy) {
    reason = 'Missing ad copy';
  } else if (item.status !== 'approved') {
    reason = 'Not approved yet';
  }

  return { ready, hasAsset, hasCopy, reason };
}

/**
 * Get readiness summary for production items
 */
export function getReadinessSummary(
  productionItems: ProductionItem[],
  angleCopy?: Record<string, any>
): {
  total: number;
  uploaded: number;
  approved: number;
  ready: number;
  needsAsset: number;
  needsCopy: number;
  needsApproval: number;
} {
  if (!productionItems || productionItems.length === 0) {
    return {
      total: 0,
      uploaded: 0,
      approved: 0,
      ready: 0,
      needsAsset: 0,
      needsCopy: 0,
      needsApproval: 0,
    };
  }

  let uploaded = 0;
  let approved = 0;
  let ready = 0;
  let needsAsset = 0;
  let needsCopy = 0;
  let needsApproval = 0;

  for (const item of productionItems) {
    const { ready: isReady, hasAsset, hasCopy } = isItemReadyForCampaign(item, angleCopy);
    
    if (hasAsset) uploaded++;
    if (item.status === 'approved') approved++;
    if (isReady) ready++;
    if (!hasAsset) needsAsset++;
    if (hasAsset && !hasCopy) needsCopy++;
    if (hasAsset && hasCopy && item.status !== 'approved') needsApproval++;
  }

  return {
    total: productionItems.length,
    uploaded,
    approved,
    ready,
    needsAsset,
    needsCopy,
    needsApproval,
  };
}
