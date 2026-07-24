import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ProductionItem {
  id: string;
  concept: any;
  status: string;
  angleName?: string;
  linkedAsset?: {
    id: string;
    url: string;
    storagePath?: string;
    type: string;
    fileName?: string;
  };
  // New field naming (preferred)
  finalCopy?: {
    headline: string;
    primaryText: string;
    description: string;
    cta: string;
  };
  // Legacy field naming (backward compatibility)
  final_copy?: {
    headline: string;
    primary_text?: string;
    primaryText?: string;
    description: string;
    call_to_action?: string;
    cta?: string;
  };
  // Legacy asset linking
  uploaded_asset_id?: string;
}

interface CopyVariation {
  text: string;
  framework: string;
  character_count?: number;
  length?: string;
}

interface AngleCopy {
  headlines: CopyVariation[];
  descriptions: CopyVariation[];
  primary_copy: CopyVariation[];
}

interface CopySelections {
  headlines: number[];
  descriptions: number[];
  primary_copy: number[];
}

// Normalize a string for tolerant key matching (mirrors the client helpers
// used in CampaignReview.tsx and ProductionManager.tsx).
function normalizeLookup(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Resolve the angle_copy entry for a production item. The client persists
// angle_copy under several possible keys depending on which surface saved it
// (angle id, angle name, normalized angle name, or — as a last-resort
// fallback used by the checklist card editor — the production item id).
// The server MUST accept all of those shapes or copy that the user clearly
// saved will look "missing" at publish time.
function resolveAngleCopyForItem(
  item: any,
  angles: any[] | undefined,
  angleCopy: Record<string, AngleCopy> | undefined,
): AngleCopy | null {
  if (!angleCopy || Object.keys(angleCopy).length === 0) return null;

  // 1) Direct id-based keys on the item.
  const directKeys = [item?.angleId, item?.angle, item?.angle_id]
    .filter((v: unknown) => typeof v === 'string' && v.length > 0) as string[];
  for (const key of directKeys) {
    if (angleCopy[key]) return angleCopy[key];
  }

  // 2) Match by angle name (tolerant) -> angle.id -> angleCopy[id].
  const normalizedName = normalizeLookup(item?.angleName || item?.angle_name || item?.angle);
  if (normalizedName) {
    const matchedAngle = (angles || []).find(
      (a: any) => normalizeLookup(a?.name) === normalizedName,
    );
    if (matchedAngle?.id && angleCopy[matchedAngle.id]) return angleCopy[matchedAngle.id];

    // 3) Match a key in angleCopy whose normalized form equals the angle name.
    const nameKeyMatch = Object.keys(angleCopy).find(
      (key) => normalizeLookup(key) === normalizedName,
    );
    if (nameKeyMatch) return angleCopy[nameKeyMatch];
  }

  // 4) Fallback: copy was saved under the item's own id.
  if (item?.id && angleCopy[item.id]) return angleCopy[item.id];

  return null;
}

// Pick the active variation out of an AngleCopy block, honoring copy_selections
// when present and falling back to the first non-empty variation otherwise.
function pickFromAngleCopy(
  copy: AngleCopy,
  selections: CopySelections | undefined,
): { headline: string; primaryText: string; description: string } {
  const pickIndex = (arr: number[] | undefined, max: number) => {
    if (Array.isArray(arr) && arr.length > 0 && arr[0] >= 0 && arr[0] < max) return arr[0];
    return 0;
  };
  const pickText = (variations: CopyVariation[] | undefined, idxArr: number[] | undefined): string => {
    if (!variations || variations.length === 0) return '';
    const idx = pickIndex(idxArr, variations.length);
    const primary = variations[idx]?.text?.trim();
    if (primary) return primary;
    // Fallback: first non-empty
    return variations.find((v) => v?.text?.trim())?.text?.trim() || '';
  };
  return {
    headline: pickText(copy.headlines, selections?.headlines),
    description: pickText(copy.descriptions, selections?.descriptions),
    primaryText: pickText(copy.primary_copy, selections?.primary_copy),
  };
}

// Helper to normalize production item copy fields
function normalizeCopy(
  item: ProductionItem,
  angles?: any[],
  angleCopy?: Record<string, AngleCopy>,
  copySelections?: Record<string, CopySelections>,
): { headline: string; primaryText: string; description: string; cta: string } | null {
  // 1) Preferred: angle-level copy (robust key matching).
  const matchedCopy = resolveAngleCopyForItem(item, angles, angleCopy);
  if (matchedCopy) {
    // Find the selection key the same way we found the copy key, so selections
    // line up with the AngleCopy entry we actually picked.
    let selectionKey: string | null = null;
    if (copySelections && Object.keys(copySelections).length > 0) {
      const candidateKeys: string[] = [
        ...(([item?.angleId, item?.angle, item?.angle_id].filter(
          (v: unknown) => typeof v === 'string' && v.length > 0,
        ) as string[])),
      ];
      const normalizedName = normalizeLookup((item as any)?.angleName || (item as any)?.angle_name || (item as any)?.angle);
      if (normalizedName) {
        const matchedAngle = (angles || []).find((a: any) => normalizeLookup(a?.name) === normalizedName);
        if (matchedAngle?.id) candidateKeys.push(matchedAngle.id);
        const nameKeyMatch = Object.keys(copySelections).find((k) => normalizeLookup(k) === normalizedName);
        if (nameKeyMatch) candidateKeys.push(nameKeyMatch);
      }
      if (item?.id) candidateKeys.push(item.id);
      selectionKey = candidateKeys.find((k) => !!copySelections[k]) || null;
    }
    const picked = pickFromAngleCopy(matchedCopy, selectionKey ? copySelections![selectionKey] : undefined);
    if (picked.headline || picked.primaryText || picked.description) {
      return {
        headline: picked.headline,
        primaryText: picked.primaryText,
        description: picked.description,
        cta: (item as any)?.finalCopy?.cta || (item as any)?.final_copy?.cta || 'LEARN_MORE',
      };
    }
  }

  // 2) Fall back to item-level finalCopy (camelCase).
  if (item.finalCopy && (item.finalCopy.headline || item.finalCopy.primaryText)) {
    return {
      headline: item.finalCopy.headline || '',
      primaryText: item.finalCopy.primaryText || '',
      description: item.finalCopy.description || '',
      cta: item.finalCopy.cta || 'LEARN_MORE',
    };
  }
  // 3) Fall back to legacy snake_case final_copy.
  if (item.final_copy && (item.final_copy.headline || item.final_copy.primaryText || item.final_copy.primary_text)) {
    return {
      headline: item.final_copy.headline || '',
      primaryText: item.final_copy.primaryText || item.final_copy.primary_text || '',
      description: item.final_copy.description || '',
      cta: item.final_copy.cta || item.final_copy.call_to_action || 'LEARN_MORE',
    };
  }
  return null;
}


interface BuildResult {
  success: boolean;
  campaignId?: string;
  adSetIds: string[];
  adIds: string[];
  warmAdIds: string[];
  failedAds: Array<{ conceptId: string; conceptTitle: string; error: string }>;
  warnings: string[];
}

function getMetaErrorMessage(metaError: any): string {
  if (!metaError) return 'Unknown Meta error';

  const userTitle = typeof metaError.error_user_title === 'string' ? metaError.error_user_title.trim() : '';
  const userMsg = typeof metaError.error_user_msg === 'string' ? metaError.error_user_msg.trim() : '';
  const baseMsg = typeof metaError.message === 'string' ? metaError.message.trim() : 'Unknown Meta error';
  const code = [metaError.code, metaError.error_subcode].filter(Boolean).join('/');

  let msg: string;
  if (userMsg) {
    msg = userTitle ? `${userTitle}: ${userMsg}` : userMsg;
  } else if (code) {
    msg = `${baseMsg} (Meta ${code})`;
  } else {
    msg = baseMsg;
  }

  // Meta's copy/policy disapprovals (often titled "Ad Copy or Policy") are
  // opaque to a non-marketer. When the error looks like one, append a plain-
  // language next step so the user knows this is about the ad copy, not a bug.
  const policyLike = /policy|disapprov|ad copy|prohibited|unacceptable|does not comply|violat/i;
  if (policyLike.test(`${userTitle} ${userMsg} ${baseMsg}`)) {
    msg += ' — This is an ad-copy/policy issue, not an app error. Edit your ad copy on the Creative page and republish.';
  }

  return msg;
}

// ---------------------------------------------------------------------------
// fetchWithTimeout: wraps fetch with an AbortController so a hung Meta or
// Supabase sub-request can never wall-clock the whole edge function (which
// surfaces to the client as "Edge Function returned a non-2xx status code" /
// "The request timed out"). Also adds bounded retries for transient failures
// (network errors, 5xx). We do NOT retry 4xx — those are Meta validation
// rejections and retrying would mask the real reason.
// ---------------------------------------------------------------------------
async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number; label?: string } = {}
): Promise<Response> {
  const { timeoutMs = 30_000, retries = 1, label = 'fetch', ...rest } = init;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: ctrl.signal });
      clearTimeout(timer);
      // Retry only on transient server errors
      if (res.status >= 500 && res.status < 600 && attempt < retries) {
        console.warn(`[${label}] ${res.status} on attempt ${attempt + 1}, retrying...`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      const isAbort = err?.name === 'AbortError' || /timed out/i.test(err?.message || '');
      console.warn(`[${label}] attempt ${attempt + 1} failed:`, err?.message || err);
      if (attempt >= retries) {
        if (isAbort) {
          throw new Error(`${label} timed out after ${timeoutMs}ms. Meta or our service didn't respond in time — please try again.`);
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  // unreachable
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed`);
}


Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. AUTHENTICATE USER
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create auth client to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    let parsedBody: any = null;
    try {
      parsedBody = await req.json();
    } catch (parseErr) {
      console.error('Failed to parse request body as JSON:', parseErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body. Please refresh and try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { workspaceId, answers, actAsUserId } = parsedBody || {};


    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    // Support admin impersonation
    let effectiveUserId = user.id;
    if (actAsUserId && actAsUserId !== user.id) {
      const supabaseForRoleCheck = createClient(supabaseUrl, supabaseServiceKey);
      const { data: adminRole } = await supabaseForRoleCheck
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        console.error('Non-admin attempted actAsUserId:', user.id);
        return new Response(
          JSON.stringify({ error: 'Admin role required for impersonation' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Admin impersonation: admin', user.id, 'acting as user', actAsUserId);
      effectiveUserId = actAsUserId;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. FETCH WORKSPACE WITH BRAND FOR OWNERSHIP CHECK
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select(`
        *,
        brands!inner(id, name, user_id, meta_account_id, meta_access_token, page_id, page_name, website_url, instagram_account_id, instagram_account_name),
        offers(url),
        campaign_templates(slug, name, objective, optimization_event)
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      console.error('Workspace fetch error:', workspaceError);
      throw new Error('Workspace not found');
    }

    const brand = workspace.brands;

    // 3. VERIFY OWNERSHIP
    if (brand.user_id !== effectiveUserId) {
      console.error('Access denied: User', user.id, 'does not own workspace', workspaceId);
      return new Response(
        JSON.stringify({ error: 'Access denied: You do not own this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Building Meta campaign for workspace:', workspaceId);

    const metaAccountId = brand.meta_account_id;
    const pageId = brand.page_id;
    const igAccountId = brand.instagram_account_id || null;
    
    if (!metaAccountId) {
      throw new Error('Meta account not connected. Please connect your Meta ad account first.');
    }

    // Read token directly from brand record (service-role context lacks auth.uid() for vault RPC)
    const metaAccessToken = brand.meta_access_token;

    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    if (!pageId) {
      throw new Error('Facebook Page not selected. Please select a Facebook Page in your brand settings to create ads.');
    }

    // Resolve destination URL with deep fallback chain
    const destinationUrl = answers?.finalUrl
      || workspace.offer_url
      || workspace.offers?.url
      || brand.website_url
      || '';

    if (!destinationUrl) {
      throw new Error('No destination URL found. Please add a URL to your offer or enter a landing page URL in your brand settings.');
    }

    console.log('Resolved destination URL:', destinationUrl);
    console.log('Building campaign for workspace:', workspaceId);
    console.log('Meta Account ID:', metaAccountId);
    console.log('Facebook Page ID:', pageId);

    // Initialize result tracking for partial success
    const result: BuildResult = {
      success: false,
      adSetIds: [],
      adIds: [],
      warmAdIds: [],
      failedAds: [],
      warnings: []
    };

    // Extract angle-level copy data from creative_json. Accept both snake_case
    // (angle_copy) and the legacy camelCase (angleCopy) key — both shapes
    // exist in the wild because earlier code paths saved one or the other.
    const creativeJson = workspace.creative_json as Record<string, any> || {};
    const angles = creativeJson.angles || [];
    const angleCopy: Record<string, AngleCopy> = creativeJson.angle_copy || creativeJson.angleCopy || {};
    const copySelections: Record<string, CopySelections> = creativeJson.copy_selections || creativeJson.copySelections || {};

    
    console.log(`Found ${angles.length} angles, ${Object.keys(angleCopy).length} angle copies, ${Object.keys(copySelections).length} copy selections`);

    // Resolve linkedAsset from user_uploaded_assets if not directly on the item.
    // Mirror the client-side resolver in src/lib/sync-production-assets.ts +
    // src/components/CampaignReview.tsx so the server accepts every linkage
    // shape the UI considers valid (concept_id, uploaded_asset_id, linkedAsset.id,
    // matching URL, or matching storage_path).
    const uploadedAssetsList: any[] = workspace.user_uploaded_assets || [];

    function resolveAssetForItem(item: any): any | null {
      if (!uploadedAssetsList.length) return null;
      const itemAny = item || {};
      const candidateConceptIds = [itemAny.id, itemAny.concept_id, itemAny.conceptId]
        .filter((v) => typeof v === 'string' && v.length > 0);
      const candidateAssetIds = [
        itemAny.uploaded_asset_id,
        itemAny.linkedAsset?.id,
      ].filter((v) => typeof v === 'string' && v.length > 0);
      const candidateUrls = [
        itemAny.uploaded_asset_url,
        itemAny.linkedAsset?.url,
        itemAny.asset_url,
      ].filter((v) => typeof v === 'string' && v.length > 0);
      const candidateStoragePaths = [
        itemAny.linkedAsset?.storagePath,
        itemAny.linkedAsset?.storage_path,
        itemAny.storage_path,
      ].filter((v) => typeof v === 'string' && v.length > 0);

      return (
        uploadedAssetsList.find((a: any) => a?.linked_concept_id && candidateConceptIds.includes(a.linked_concept_id)) ||
        uploadedAssetsList.find((a: any) => a?.id && candidateAssetIds.includes(a.id)) ||
        uploadedAssetsList.find((a: any) => a?.file_url && candidateUrls.includes(a.file_url)) ||
        uploadedAssetsList.find((a: any) => a?.storage_path && candidateStoragePaths.includes(a.storage_path)) ||
        null
      );
    }

    let productionItems: ProductionItem[] = (workspace.production_items || []).map(
      (item: any) => {
        const matchingAsset = resolveAssetForItem(item);
        if (!matchingAsset) {
          // Preserve any pre-existing linkedAsset; just normalize storagePath if missing
          if (item.linkedAsset?.url && !item.linkedAsset?.storagePath && item.linkedAsset?.storage_path) {
            return { ...item, linkedAsset: { ...item.linkedAsset, storagePath: item.linkedAsset.storage_path } };
          }
          return item;
        }
        // Merge: prefer item's own linkedAsset fields but backfill from the resolved asset
        const existing = item.linkedAsset || {};
        return {
          ...item,
          uploaded_asset_id: item.uploaded_asset_id || matchingAsset.id,
          linkedAsset: {
            id: existing.id || matchingAsset.id,
            url: existing.url || matchingAsset.file_url,
            storagePath: existing.storagePath || existing.storage_path || matchingAsset.storage_path,
            type: existing.type || matchingAsset.file_type,
            fileName: existing.fileName || matchingAsset.file_name,
          },
        };
      }
    );

    // Advanced-Build fallback: if no production_items were persisted but the user
    // has uploaded assets AND has approved shared copy variations (the Advanced
    // flow's signature), synthesize publishable items on the fly. Avoids the
    // "no creatives have an uploaded asset attached" block when the client-side
    // synthesis didn't persist (race, navigation, or older workspace shape).
    const itemsHaveLinkedAsset = productionItems.some(
      (i: any) => !!(i?.linkedAsset?.url || i?.linkedAsset?.storagePath || i?.uploaded_asset_id),
    );
    const sharedVariations: any[] = Array.isArray(
      (workspace as any)?.selected_copy?.shared_variations,
    )
      ? (workspace as any).selected_copy.shared_variations
      : [];
    if (!itemsHaveLinkedAsset && uploadedAssetsList.length > 0 && sharedVariations.length > 0) {
      console.log(
        `Synthesizing ${uploadedAssetsList.length} production_items from user_uploaded_assets × ${sharedVariations.length} shared_variations (Advanced-Build fallback)`,
      );
      productionItems = uploadedAssetsList.map((asset: any, idx: number) => {
        const variation: any = sharedVariations[idx % sharedVariations.length] || {};
        return {
          id: asset.id || `prod_${Date.now()}_${idx}`,
          status: 'approved',
          completed: true,
          angleName: variation.angle || `Ad ${idx + 1}`,
          uploaded_asset_id: asset.id,
          linkedAsset: {
            id: asset.id,
            url: asset.file_url,
            storagePath: asset.storage_path,
            type: asset.file_type,
            fileName: asset.name,
          },
          finalCopy: {
            headline: variation.headline || '',
            primaryText: variation.primary_text || variation.primaryText || '',
            description: variation.description || '',
            cta: variation.cta || 'LEARN_MORE',
          },
        } as any;
      });
    }

    // Bucket items so we can give a specific, useful error if nothing publishable
    const itemsWithAsset: ProductionItem[] = [];
    const itemsMissingAsset: ProductionItem[] = [];
    for (const item of productionItems) {
      const hasLinkedAsset = !!(item.linkedAsset?.url || item.linkedAsset?.storagePath);
      const hasUploadedAssetId = !!item.uploaded_asset_id;
      if (hasLinkedAsset || hasUploadedAssetId) {
        itemsWithAsset.push(item);
      } else {
        itemsMissingAsset.push(item);
      }
    }
    const approvedConcepts: ProductionItem[] = itemsWithAsset;

    console.log(`Resolved assets: ${uploadedAssetsList.length} uploaded, ${productionItems.filter((i: any) => i.linkedAsset).length} linked to items`);
    console.log(`Publishable concepts: ${approvedConcepts.length} of ${productionItems.length} total items`);

    if (approvedConcepts.length < 1) {
      const itemStatuses = productionItems.map((i: any) => ({
        id: i.id,
        status: i.status,
        completed: i.completed,
        title: i?.concept?.title,
        hasAsset: !!i.linkedAsset,
        hasUploadedAssetId: !!i.uploaded_asset_id,
        hasCopy: !!(i.finalCopy || i.final_copy),
      }));
      console.error('No publishable concepts found. Item details:', JSON.stringify(itemStatuses));
      console.error('Uploaded assets present:', uploadedAssetsList.map((a: any) => ({
        id: a?.id, linked_concept_id: a?.linked_concept_id, file_url: !!a?.file_url, storage_path: !!a?.storage_path,
      })));

      if (productionItems.length === 0) {
        throw new Error('No creatives found in this campaign. Add at least one creative with an uploaded asset, then try again.');
      }
      const missingNames = itemsMissingAsset
        .map((i: any) => i?.concept?.title || i?.angleName || `Creative ${String(i?.id || '').slice(0, 6)}`)
        .filter(Boolean)
        .slice(0, 5);
      const list = missingNames.length ? ` Missing an upload: ${missingNames.join(', ')}.` : '';
      throw new Error(`No creatives have an uploaded asset attached yet.${list} Upload a file to at least one creative in the Production step, then try again.`);
    }

    console.log(`Creating campaign with ${approvedConcepts.length} approved concepts`);

    // Build campaign names using LUMI format
    const productName = workspace.offer_name || 'Campaign';
    const startDate = answers?.startDate || new Date().toISOString().split('T')[0];
    
    // Resolve objective and optimization event with fallback chain:
    // 1) explicit answers values, 2) template values, 3) strategy_json values
    const template = (workspace as any)?.campaign_templates || null;
    const rawOptEventInput = String(
      answers?.optimizationEvent
        || answers?.optimization_event
        || template?.optimization_event
        || workspace?.strategy_json?.optimization_event
        || ''
    ).toUpperCase().trim();
    const rawObjectiveInput = String(
      answers?.objective
        || template?.objective
        || workspace?.strategy_json?.objective
        || ''
    ).toUpperCase().trim();

    // Normalize known aliases -> canonical Meta-ish event keys
    function normalizeEvent(input: string): string {
      const v = input.replace(/[^A-Z0-9]/g, ''); // strip spaces, dashes, underscores
      if (!v) return '';
      if (v.includes('PURCHASE') || v.includes('SALE') || v === 'CONVERSIONS' || v === 'CONVERSION') return 'PURCHASE';
      if (v.includes('LEAD')) return 'LEAD';
      if (v.includes('LANDINGPAGE') || v === 'LPV') return 'LANDING_PAGE_VIEWS';
      if (v.includes('LINKCLICK') || v === 'CLICKS') return 'LINK_CLICKS';
      if (v.includes('THRUPLAY') || v.includes('VIDEOVIEW') || v.includes('2SCONTINUOUS')) return 'THRUPLAY';
      if (v.includes('PROFILEVISIT') || v.includes('PROFILEVIEW')) return 'PROFILE_VISITS';
      if (v.includes('CONVERSATION') || v.includes('MESSAGING') || v.includes('MESSAGE')) return 'CONVERSATIONS';
      if (v.includes('ENGAGEMENT') || v.includes('POSTENGAGEMENT')) return 'POST_ENGAGEMENT';
      if (v.includes('REACH')) return 'REACH';
      if (v.includes('IMPRESSION')) return 'IMPRESSIONS';
      if (v.includes('AWARENESS')) return 'REACH';
      if (v.includes('TRAFFIC')) return 'LINK_CLICKS';
      return input.replace(/[\s-]/g, '_');
    }

    let normalizedOptEvent = normalizeEvent(rawOptEventInput);
    const normalizedObjective = normalizeEvent(rawObjectiveInput);

    // If no explicit optimization event, derive from objective
    if (!normalizedOptEvent && normalizedObjective) {
      normalizedOptEvent = normalizedObjective;
    }

    // Final safety net — default to LINK_CLICKS only if nothing else resolved
    if (!normalizedOptEvent) {
      normalizedOptEvent = 'LINK_CLICKS';
    }

    console.log('Objective resolution:', {
      raw_objective: answers?.objective,
      raw_optimization_event: answers?.optimizationEvent,
      template_objective: template?.objective,
      template_optimization_event: template?.optimization_event,
      normalized_objective: normalizedObjective,
      normalized_optimization_event: normalizedOptEvent,
    });

    const objectiveDisplayMap: { [key: string]: string } = {
      'LEAD': 'Leads',
      'PURCHASE': 'Sales',
      'LINK_CLICKS': 'Traffic',
      'LANDING_PAGE_VIEWS': 'Landing Page Views',
      'THRUPLAY': 'Video Views',
      'PROFILE_VISITS': 'Profile Visits',
      'CONVERSATIONS': 'Engagement',
      'POST_ENGAGEMENT': 'Engagement',
      'REACH': 'Awareness',
      'IMPRESSIONS': 'Awareness',
    };
    const objectiveName = objectiveDisplayMap[normalizedOptEvent] || 'Traffic';

    const campaignBaseName = `LUMI // ${objectiveName} - ${productName} - ${startDate}`;

    // Determine Meta API objective + optimization_goal
    // Note: LEAD_GENERATION optimization_goal is for Facebook Instant Forms only.
    // For offsite lead conversions, use OFFSITE_CONVERSIONS with LEAD event.
    let metaObjective = 'OUTCOME_TRAFFIC';
    let optimizationGoal = 'LINK_CLICKS';
    let needsPixel = false;
    let conversionEvent = 'PURCHASE';
    // Where the ad actually sends people. Left null for normal website traffic
    // (Meta's default); set explicitly for profile-visit campaigns, which are
    // otherwise indistinguishable from a website campaign at the API level.
    let destinationType: string | null = null;

    if (normalizedOptEvent === 'PURCHASE') {
      metaObjective = 'OUTCOME_SALES';
      optimizationGoal = 'OFFSITE_CONVERSIONS';
      needsPixel = true;
      conversionEvent = 'PURCHASE';
    } else if (normalizedOptEvent === 'LEAD') {
      metaObjective = 'OUTCOME_LEADS';
      optimizationGoal = 'OFFSITE_CONVERSIONS';
      needsPixel = true;
      conversionEvent = 'LEAD';
    } else if (normalizedOptEvent === 'LANDING_PAGE_VIEWS') {
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LANDING_PAGE_VIEWS';
    } else if (normalizedOptEvent === 'LINK_CLICKS') {
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LINK_CLICKS';
    } else if (normalizedOptEvent === 'THRUPLAY') {
      // Video views used to build an awareness campaign. LUMI doesn't run
      // awareness — impressions nobody acts on aren't an outcome — so the
      // closest useful thing is traffic optimized for the click.
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LINK_CLICKS';
    } else if (normalizedOptEvent === 'PROFILE_VISITS') {
      // Profile visits = Traffic objective sent to the Instagram profile.
      // destination_type is what makes that real — without it Meta defaults to
      // WEBSITE and the "profile growth" campaign quietly sends people to the
      // user's website instead of the profile they wanted followers on.
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LINK_CLICKS';
      destinationType = 'INSTAGRAM_PROFILE';
    } else if (normalizedOptEvent === 'CONVERSATIONS') {
      metaObjective = 'OUTCOME_ENGAGEMENT';
      optimizationGoal = 'CONVERSATIONS';
    } else if (normalizedOptEvent === 'POST_ENGAGEMENT') {
      metaObjective = 'OUTCOME_ENGAGEMENT';
      optimizationGoal = 'POST_ENGAGEMENT';
    } else if (normalizedOptEvent === 'REACH' || normalizedOptEvent === 'IMPRESSIONS') {
      // Same rule as THRUPLAY above: no awareness campaigns. A stale template
      // row asking for reach/impressions gets the useful equivalent — traffic
      // optimized for clicks — rather than a campaign that buys eyeballs and
      // reports nothing the user can act on.
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LINK_CLICKS';
    }

    console.log('Final Meta config:', { metaObjective, optimizationGoal, needsPixel, conversionEvent });


    // Fetch pixel if needed for conversion optimization
    let pixelId: string | null = null;
    if (needsPixel) {
      console.log('Fetching Meta pixel for conversion tracking...');
      try {
        const pixelResponse = await fetch(
          `https://graph.facebook.com/v25.0/act_${metaAccountId.replace('act_', '')}/adspixels?fields=id,name&access_token=${metaAccessToken}`
        );
        const pixelData = await pixelResponse.json();
        
        if (pixelData.data && pixelData.data.length > 0) {
          pixelId = pixelData.data[0].id;
          console.log('Found Meta pixel:', pixelId, pixelData.data[0].name);
        } else {
          console.log('No pixel found, falling back to traffic optimization');
          // Fall back to traffic optimization if no pixel is set up
          metaObjective = 'OUTCOME_TRAFFIC';
          optimizationGoal = 'LINK_CLICKS';
          needsPixel = false;
          result.warnings.push('No Meta Pixel found on your ad account. Campaign will optimize for link clicks instead of conversions. Set up a pixel in Meta Ads Manager for conversion tracking.');
        }
      } catch (pixelError) {
        console.error('Error fetching pixel:', pixelError);
        // Fall back to traffic optimization
        metaObjective = 'OUTCOME_TRAFFIC';
        optimizationGoal = 'LINK_CLICKS';
        needsPixel = false;
        result.warnings.push('Could not fetch Meta Pixel. Campaign will optimize for link clicks instead of conversions.');
      }
    }

    // Parse budget (default to $20/day) - improved parsing
    const budgetString = String(answers?.budget || '20').replace(/[$,\s]/g, '');
    const dailyBudgetCents = Math.round((parseInt(budgetString) || 20) * 100);

    // Step 1: Upload all assets to Meta — run in parallel with bounded
    // concurrency so 4+ video uploads don't serialize past the edge runtime
    // wall clock. Each sub-call gets its own timeout so a single hung upload
    // cannot kill the whole publish.
    console.log(`Uploading ${approvedConcepts.length} creative asset(s) to Meta (parallel)...`);
    const uploadedAssets: Array<{ item: ProductionItem; assetId: string; assetType: 'image' | 'video' }> = [];

    async function uploadOne(item: ProductionItem): Promise<void> {
      if (!item.linkedAsset) {
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || 'Unknown',
          error: 'No linked asset found',
        });
        return;
      }
      const conceptTitle = item.concept?.title || 'Unknown';
      try {
        const normalizedStoragePath = item.linkedAsset.storagePath
          ? (item.linkedAsset.storagePath.startsWith(`${brand.id}/`)
            ? item.linkedAsset.storagePath
            : `${brand.id}/${item.linkedAsset.storagePath}`)
          : undefined;

        const uploadResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/upload-creative-to-meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            assetUrl: item.linkedAsset.url,
            assetStoragePath: normalizedStoragePath,
            brandId: brand.id,
            fileName: item.linkedAsset.url?.split('/').pop(),
          }),
          // Video uploads to Meta can take a while; allow up to 90s per asset.
          // No retry — re-uploading a partially-accepted video would duplicate.
          timeoutMs: 90_000,
          retries: 0,
          label: `upload-creative-to-meta(${item.id})`,
        });

        const uploadRawText = await uploadResponse.text();
        let uploadResult: any = null;
        if (uploadRawText) {
          try { uploadResult = JSON.parse(uploadRawText); } catch { uploadResult = null; }
        }

        if (uploadResult?.success && uploadResult?.assetId) {
          uploadedAssets.push({ item, assetId: uploadResult.assetId, assetType: uploadResult.assetType });
          console.log(`Asset uploaded for ${item.id}: ${uploadResult.assetType} - ${uploadResult.assetId}`);
        } else {
          const uploadErrorMessage =
            uploadResult?.error ||
            uploadResult?.message ||
            uploadResult?.details ||
            (!uploadResponse.ok ? `Upload service returned ${uploadResponse.status}` : '') ||
            (uploadRawText?.trim() ? uploadRawText.trim().slice(0, 500) : '') ||
            'Unknown error';
          console.error(`Failed to upload asset for ${item.id}:`, {
            status: uploadResponse.status,
            ok: uploadResponse.ok,
            result: uploadResult,
            raw: uploadRawText?.slice(0, 500) || '',
          });
          result.failedAds.push({ conceptId: item.id, conceptTitle, error: `Asset upload failed: ${uploadErrorMessage}` });
        }
      } catch (uploadError: any) {
        console.error(`Error uploading asset for ${item.id}:`, uploadError);
        result.failedAds.push({ conceptId: item.id, conceptTitle, error: `Asset upload error: ${uploadError?.message || String(uploadError)}` });
      }
    }

    // Bounded concurrency = 3 (keeps memory/CPU sane, still ~3x faster).
    const CONCURRENCY = 3;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, approvedConcepts.length) }, async () => {
      while (cursor < approvedConcepts.length) {
        const next = approvedConcepts[cursor++];
        await uploadOne(next);
      }
    });
    await Promise.all(workers);

    if (uploadedAssets.length === 0) {
      const firstReason = result.failedAds[0]?.error || 'No creative assets could be uploaded.';
      throw new Error(`Failed to upload any creative assets to Meta. ${firstReason}`);
    }


    console.log(`Successfully uploaded ${uploadedAssets.length} of ${approvedConcepts.length} assets`);
    
    if (result.failedAds.length > 0) {
      result.warnings.push(`${result.failedAds.length} asset(s) failed to upload and will be skipped.`);
    }

    // Determine launch status (ACTIVE or PAUSED)
    const launchStatus = answers?.launchStatus === 'active' ? 'ACTIVE' : 'PAUSED';
    console.log('Launch status:', launchStatus);

    // Step 2: Create Campaign
    const accountId = metaAccountId.replace('act_', '');
    
    const campaignResponse = await fetch(
      `https://graph.facebook.com/v25.0/act_${accountId}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: campaignBaseName,
          objective: metaObjective,
          status: launchStatus,
          special_ad_categories: '[]',
          // Meta v24+ requires capitalized string literals for this form field.
          // Lowercase "false" is rejected with error_subcode 4834011.
          is_adset_budget_sharing_enabled: 'False',
          access_token: metaAccessToken
        })
      }
    );

    const campaignData = await campaignResponse.json();
    
    if (campaignData.error) {
      console.error('Campaign creation failed:', campaignData.error);
      throw new Error(`Failed to create campaign: ${campaignData.error.message || 'Unknown error'}`);
    }

    result.campaignId = campaignData.id;
    console.log('Campaign created:', result.campaignId);

    // Step 3: Create Ad Sets
    // Build promoted_object — use custom conversion if Lumi set one up AND it's still valid
    const customConversionId = workspace.custom_conversion_id;
    let promotedObject: Record<string, string> | null = null;
    let validCustomConversion = false;

    if (customConversionId && pixelId) {
      // Validate the custom conversion still exists on Meta AND belongs to this ad account + pixel.
      // Stale/deleted/cross-account IDs throw: "Param promoted_object[custom_conversion_id] must be a valid custom conversion id"
      try {
        const ccCheck = await fetch(
          `https://graph.facebook.com/v25.0/${customConversionId}?fields=id,name,pixel,account_id&access_token=${encodeURIComponent(metaAccessToken)}`
        );
        const ccData = await ccCheck.json();
        const ccPixelId = ccData?.pixel?.id ?? ccData?.pixel_id ?? null;
        const ccAccountId = ccData?.account_id ? String(ccData.account_id) : null;
        const pixelMatches = ccPixelId ? String(ccPixelId) === String(pixelId) : true;
        const accountMatches = ccAccountId ? ccAccountId === String(accountId) : true;

        if (!ccData?.id || ccData?.error) {
          console.warn('Custom conversion not found on Meta, falling back:', ccData?.error?.message || 'not found');
          result.warnings.push('Custom conversion was no longer valid — used standard pixel event instead.');
        } else if (!pixelMatches) {
          console.warn(`Custom conversion ${customConversionId} is on pixel ${ccPixelId}, not selected pixel ${pixelId}. Falling back.`);
          result.warnings.push('Custom conversion belongs to a different pixel — used standard pixel event instead.');
        } else if (!accountMatches) {
          console.warn(`Custom conversion ${customConversionId} belongs to account ${ccAccountId}, not ${accountId}. Falling back.`);
          result.warnings.push('Custom conversion belongs to a different ad account — used standard pixel event instead.');
        } else {
          // Double-check it's listed under this ad account's customconversions (catches permission/visibility gaps)
          const listResp = await fetch(
            `https://graph.facebook.com/v25.0/act_${accountId}/customconversions?fields=id&limit=200&access_token=${encodeURIComponent(metaAccessToken)}`
          );
          const listData = await listResp.json();
          const ids = Array.isArray(listData?.data) ? listData.data.map((c: any) => String(c.id)) : [];
          if (ids.length === 0 || ids.includes(String(customConversionId))) {
            validCustomConversion = true;
          } else {
            console.warn(`Custom conversion ${customConversionId} not visible under act_${accountId}. Falling back.`);
            result.warnings.push('Custom conversion is not available on this ad account — used standard pixel event instead.');
          }
        }
      } catch (e) {
        console.warn('Custom conversion validation failed, falling back:', e);
        result.warnings.push('Could not verify custom conversion — used standard pixel event instead.');
      }
    }

    if (validCustomConversion && pixelId) {
      promotedObject = {
        pixel_id: pixelId,
        custom_conversion_id: customConversionId,
      };
      console.log('Using Lumi custom conversion:', customConversionId);
    } else if (pixelId) {
      promotedObject = {
        pixel_id: pixelId,
        custom_event_type: conversionEvent,
      };
    }

    // Build tracking_specs — ensures "Track website events" is ON for every ad
    // when a pixel is connected. This is independent of optimization goal so we
    // always capture conversion data, even on Traffic / Engagement / Awareness campaigns.
    // NOTE: Meta only supports the `fb_pixel` selector with `offsite_conversion`
    // action types. Pairing it with `link_click` returns
    // "Wrong Conversion Tags ... does not support selector fb_pixel".
    // `link_click` is tracked automatically — no spec needed.
    let trackingSpecs: Array<Record<string, any>> | null = null;
    if (pixelId) {
      trackingSpecs = [
        { 'action.type': ['offsite_conversion'], fb_pixel: [pixelId] },
      ];
    }

    // Build targeting — use location targeting if provided, otherwise default to US broad
    let targeting: any = {
      geo_locations: { countries: ['US'] },
      age_min: 18,
      age_max: 65,
    };

    const locationTargeting = answers?.locationTargeting;
    const locationAddresses = Array.isArray(locationTargeting?.addresses)
      ? locationTargeting.addresses
          .map((addr: unknown) => (typeof addr === 'string' ? addr.trim() : ''))
          .filter((addr: string) => addr.length > 0)
      : [];
    const parsedRadius = Number(locationTargeting?.radius);
    const radiusMiles = Number.isFinite(parsedRadius)
      ? Math.max(1, Math.min(50, parsedRadius))
      : null;
    const hasLocationTargeting = locationAddresses.length > 0 && radiusMiles !== null;

    if (hasLocationTargeting) {
      // Geocode each address to lat/lng using Meta's Location Search API
      const geocodedLocations: Array<{ latitude: number; longitude: number; radius: number; distance_unit: string }> = [];
      const failedAddresses: string[] = [];

      for (const addr of locationAddresses) {
        try {
          const searchUrl = `https://graph.facebook.com/v25.0/search?type=adgeolocation&location_types=["city","zip","region"]&q=${encodeURIComponent(addr)}&access_token=${metaAccessToken}`;
          const geoResponse = await fetch(searchUrl);
          const geoData = await geoResponse.json();

          if (geoData.data && geoData.data.length > 0) {
            const loc = geoData.data[0];
            // Meta's adgeolocation search returns key + type, but for custom_locations we need lat/lng
            // Use the place search API for lat/lng
            const placeUrl = `https://graph.facebook.com/v25.0/search?type=adgeolocation&location_types=["custom_location"]&q=${encodeURIComponent(addr)}&access_token=${metaAccessToken}`;
            const placeResponse = await fetch(placeUrl);
            const placeData = await placeResponse.json();

            if (placeData.data && placeData.data.length > 0 && placeData.data[0].latitude && placeData.data[0].longitude) {
              geocodedLocations.push({
                latitude: placeData.data[0].latitude,
                longitude: placeData.data[0].longitude,
                radius: radiusMiles!,
                distance_unit: 'mile',
              });
              console.log(`Geocoded "${addr}" → lat: ${placeData.data[0].latitude}, lng: ${placeData.data[0].longitude}`);
            } else {
              // Try using the first adgeolocation result directly as a named location
              // Meta also accepts key-based geo targeting for cities/regions
              if (loc.key && loc.type) {
                // Use the structured location key instead of custom lat/lng
                geocodedLocations.push({
                  latitude: loc.latitude || 0,
                  longitude: loc.longitude || 0,
                  radius: radiusMiles!,
                  distance_unit: 'mile',
                });
                if (loc.latitude && loc.longitude) {
                  console.log(`Geocoded "${addr}" via adgeolocation → lat: ${loc.latitude}, lng: ${loc.longitude}`);
                } else {
                  failedAddresses.push(addr);
                  console.warn(`Could not get coordinates for "${addr}" — no lat/lng in adgeolocation result`);
                }
              } else {
                failedAddresses.push(addr);
                console.warn(`Could not geocode "${addr}" — no usable results`);
              }
            }
          } else {
            failedAddresses.push(addr);
            console.warn(`No geocoding results for "${addr}"`);
          }
        } catch (geoError: any) {
          failedAddresses.push(addr);
          console.error(`Geocoding error for "${addr}":`, geoError.message);
        }
      }

      // Remove entries that failed to get coordinates
      const validLocations = geocodedLocations.filter(loc => loc.latitude !== 0 && loc.longitude !== 0);

      if (validLocations.length === 0) {
        // HARD FAIL — location targeting was explicitly requested and we can't resolve any addresses
        throw new Error(
          `Location targeting failed: Could not resolve any of the provided addresses (${failedAddresses.join(', ')}). ` +
          `Please check your addresses and try again. Tip: Use a city name, zip code, or well-known location.`
        );
      }

      if (failedAddresses.length > 0) {
        result.warnings.push(
          `Could not resolve ${failedAddresses.length} address(es): ${failedAddresses.join(', ')}. ` +
          `The remaining ${validLocations.length} location(s) will be used.`
        );
      }

      targeting = {
        geo_locations: { custom_locations: validLocations },
        age_min: 18,
        age_max: 65,
      };
      console.log(`Using radius targeting: ${validLocations.length} location(s), ${radiusMiles} mile radius`);
    }

    // Create Cold Audience Ad Set
    const coldAdSetParams: Record<string, string> = {
      campaign_id: result.campaignId!,
      name: hasLocationTargeting && radiusMiles !== null
        ? `Local - ${radiusMiles}mi - ${productName}`
        : `Cold - Broad - ${productName}`,
      optimization_goal: optimizationGoal,
      billing_event: 'IMPRESSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: dailyBudgetCents.toString(),
      targeting: JSON.stringify(targeting),
      status: launchStatus,
      access_token: metaAccessToken
    };

    // Add end_time only if user explicitly set an end date
    if (answers?.endDate) {
      const endTimestamp = new Date(answers.endDate + 'T23:59:59').toISOString();
      if (new Date(endTimestamp).getTime() <= Date.now()) {
        throw new Error(
          `Your campaign end date (${answers.endDate}) is in the past. Go back to the Ad Schedule step and pick a future end date (or turn off "Set end date" to run continuously).`
        );
      }
      coldAdSetParams.end_time = endTimestamp;
      console.log('Ad set end date:', endTimestamp);
    }

    // Add promoted_object if we have a pixel for conversion tracking
    if (promotedObject) {
      coldAdSetParams.promoted_object = JSON.stringify(promotedObject);
    }

    // Send the ad to the Instagram profile rather than the website when this is
    // a profile-growth campaign.
    if (destinationType) {
      coldAdSetParams.destination_type = destinationType;
    }

    const coldAdSetResponse = await fetch(
      `https://graph.facebook.com/v25.0/act_${accountId}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(coldAdSetParams)
      }
    );

    const coldAdSetData = await coldAdSetResponse.json();
    
    if (coldAdSetData.error) {
      console.error('Cold ad set creation failed:', coldAdSetData.error);

      if (hasLocationTargeting) {
        // HARD FAIL for location targeting — do NOT silently fall back to broad
        const locationErrorMessage = getMetaErrorMessage(coldAdSetData.error);
        throw new Error(
          `Location-targeted ad set failed: ${locationErrorMessage}. ` +
          `Please verify your addresses and radius, then try again.`
        );
      } else {
        const adSetErrorMessage = coldAdSetData.error.error_user_msg || coldAdSetData.error.message || 'Unknown error';
        throw new Error(`Failed to create ad set: ${adSetErrorMessage}`);
      }
    } else {
      result.adSetIds.push(coldAdSetData.id);
      console.log('Cold ad set created:', coldAdSetData.id);
    }

    // Create Warm Retargeting Ad Set (if enabled)
    let warmAdSetId: string | null = null;
    if (answers?.warmRetargeting) {
      // Build targeting with selected custom audiences
      let warmTargeting: any = { 
        geo_locations: { countries: ['US'] },
        age_min: 18,
        age_max: 65
      };
      
      // Add custom audiences if selected
      const selectedAudiences = answers?.selectedAudiences || [];
      if (selectedAudiences.length > 0 && selectedAudiences[0] !== '') {
        warmTargeting.custom_audiences = selectedAudiences.map((id: string) => ({ id }));
        console.log(`Using ${selectedAudiences.length} custom audience(s) for warm targeting`);
      } else {
        // Default to engaged IG/FB audience if no custom audiences
        // This uses flexible_spec for engagement-based targeting
        console.log('No custom audiences selected, using default warm targeting');
      }
      
      const warmAdSetParams: Record<string, string> = {
        campaign_id: result.campaignId!,
        name: `Warm - Retargeting - ${productName}`,
        optimization_goal: optimizationGoal,
        billing_event: 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: Math.round(dailyBudgetCents * 0.5).toString(),
        targeting: JSON.stringify(warmTargeting),
        status: launchStatus,
        access_token: metaAccessToken
      };

      // Add promoted_object if we have a pixel for conversion tracking
      if (promotedObject) {
        warmAdSetParams.promoted_object = JSON.stringify(promotedObject);
      }

      if (destinationType) {
        warmAdSetParams.destination_type = destinationType;
      }

      const warmAdSetResponse = await fetch(
        `https://graph.facebook.com/v25.0/act_${accountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(warmAdSetParams)
        }
      );

      const warmAdSetData = await warmAdSetResponse.json();
      if (!warmAdSetData.error) {
        warmAdSetId = warmAdSetData.id;
        result.adSetIds.push(warmAdSetData.id);
        console.log('Warm ad set created:', warmAdSetData.id);
      } else {
        console.log('Warm ad set skipped:', warmAdSetData.error.message);
        result.warnings.push(`Warm audience ad set could not be created: ${warmAdSetData.error.message}`);
      }
    }

    // Step 4: Create Ads for each uploaded asset
    const primaryAdSetId = result.adSetIds[0];

    for (let i = 0; i < uploadedAssets.length; i++) {
      const { item, assetId, assetType } = uploadedAssets[i];
      const formatPrefix = assetType === 'video' ? 'V' : 'G';
      const descriptor = item.concept?.hookLabel || item.concept?.title || 'Creative';
      const adName = `${formatPrefix} - ${descriptor}`;
      
      // Normalize copy fields - prioritizes angle-level selected copy, then item-level copy
      const copy = normalizeCopy(item, angles, angleCopy, copySelections);
      // Treat copy as missing only if BOTH headline and primary text are empty —
      // Meta requires at least a message (primary text) or a headline on the ad.
      const hasUsableCopy = !!copy && (!!copy.headline?.trim() || !!copy.primaryText?.trim());
      if (!hasUsableCopy) {
        const itemAny = item as any;
        const angleLabel = itemAny?.angleName || itemAny?.angle_name || itemAny?.angle || 'no angle';
        const angleKeyCount = Object.keys(angleCopy || {}).length;
        const detail = angleKeyCount === 0
          ? `no ad copy has been saved for this campaign yet`
          : `couldn't find saved copy for angle "${angleLabel}" (have copy for ${angleKeyCount} angle(s): ${Object.keys(angleCopy).slice(0, 4).join(', ')}${angleKeyCount > 4 ? '…' : ''})`;
        console.error(`No copy found for ${adName} (item.id=${item.id}, angleId=${itemAny?.angleId || itemAny?.angle_id || 'n/a'}, angleName=${angleLabel}). angleCopy keys: ${Object.keys(angleCopy || {}).join(',') || 'none'}`);
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || descriptor,
          error: `Missing ad copy for "${descriptor}" — ${detail}. Open the Copy step and add a headline + primary text for this creative.`,
        });
        continue;
      }

      
      try {
        // Build object_story_spec based on asset type
        let objectStorySpec: any;
        
        if (assetType === 'video') {
          // Fetch video thumbnail from Meta API
          let videoThumbnailUrl = '';
          try {
            const thumbResponse = await fetch(
              `https://graph.facebook.com/v25.0/${assetId}?fields=thumbnails&access_token=${metaAccessToken}`
            );
            const thumbData = await thumbResponse.json();
            if (thumbData.thumbnails?.data?.[0]?.uri) {
              videoThumbnailUrl = thumbData.thumbnails.data[0].uri;
            }
          } catch (e) {
            console.log('Could not fetch video thumbnail, Meta will auto-generate');
          }
          
          const videoData: any = {
            video_id: assetId,
            title: copy.headline || 'Watch Now',
            message: copy.primaryText || '',
            link_description: copy.description || '',
            call_to_action: {
              type: (copy.cta || 'LEARN_MORE').toUpperCase().replace(/ /g, '_'),
              value: { link: destinationUrl }
            }
          };
          
          if (videoThumbnailUrl) {
            videoData.image_url = videoThumbnailUrl;
          }
          
          objectStorySpec = {
            page_id: pageId,
            video_data: videoData
          };
          if (igAccountId) {
            objectStorySpec.instagram_user_id = igAccountId;
          }
        } else {
          objectStorySpec = {
            page_id: pageId,
            link_data: {
              image_hash: assetId,
              link: destinationUrl,
              message: copy.primaryText || '',
              name: copy.headline || '',
              description: copy.description || '',
              call_to_action: {
                type: (copy.cta || 'LEARN_MORE').toUpperCase().replace(/ /g, '_')
              }
            }
          };
          if (igAccountId) {
            objectStorySpec.instagram_user_id = igAccountId;
          }
        }

        // Force-disable Advantage+ creative enhancements including multi-advertiser ads.
        // Meta requires explicit OPT_OUT on every standard enhancement to prevent the
        // "multi-advertiser ads" checkbox from auto-enabling at the ad level.
        // Force-disable Advantage+ creative enhancements. Only keys currently
        // accepted by Meta v25.0 in creative_features_spec are included here.
        // Sending unrecognized keys (e.g. "music", "advantage_plus_creative")
        // causes Meta error #100 and blocks creative creation.
        // Allowed keys: IG_VIDEO_NATIVE_SUBTITLE, IMAGE_ANIMATION,
        // PRODUCT_METADATA_AUTOMATION, PROFILE_CARD,
        // STANDARD_ENHANCEMENTS_CATALOG, TEXT_OVERLAY_TRANSLATION.
        const degreesOfFreedomSpec = {
          creative_features_spec: {
            ig_video_native_subtitle: { enroll_status: 'OPT_OUT' },
            image_animation: { enroll_status: 'OPT_OUT' },
            product_metadata_automation: { enroll_status: 'OPT_OUT' },
            profile_card: { enroll_status: 'OPT_OUT' },
            standard_enhancements_catalog: { enroll_status: 'OPT_OUT' },
            text_overlay_translation: { enroll_status: 'OPT_OUT' },
          }
        };

        // Create ad creative
        const creativeParams: Record<string, string> = {
          name: `Creative - ${adName}`,
          object_story_spec: JSON.stringify(objectStorySpec),
          degrees_of_freedom_spec: JSON.stringify(degreesOfFreedomSpec),
          access_token: metaAccessToken
        };

        const creativeResponse = await fetch(
          `https://graph.facebook.com/v25.0/act_${accountId}/adcreatives`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(creativeParams)
          }
        );

        const creativeData = await creativeResponse.json();
        
        if (creativeData.error) {
          console.error(`Creative creation failed for ${adName}:`, creativeData.error);
          result.failedAds.push({
            conceptId: item.id,
            conceptTitle: item.concept?.title || 'Unknown',
            error: `Creative creation failed: ${getMetaErrorMessage(creativeData.error)}`
          });
          continue;
        }

        const creativeId = creativeData.id;
        console.log(`Creative created for ${adName}:`, creativeId);

        // Create the ad
        const adParams: Record<string, string> = {
          adset_id: primaryAdSetId,
          name: adName,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: launchStatus,
          multi_advertiser_ads: JSON.stringify({ use_multi_advertiser_ads: false }),
          access_token: metaAccessToken,
        };
        if (trackingSpecs) {
          adParams.tracking_specs = JSON.stringify(trackingSpecs);
        }

        const adResponse = await fetch(
          `https://graph.facebook.com/v25.0/act_${accountId}/ads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(adParams),
          }
        );

        const adData = await adResponse.json();
        
        if (adData.error) {
          console.error(`Ad creation failed for ${adName}:`, adData.error);
          result.failedAds.push({
            conceptId: item.id,
            conceptTitle: item.concept?.title || 'Unknown',
            error: `Ad creation failed: ${getMetaErrorMessage(adData.error)}`
          });
          continue;
        }

        result.adIds.push(adData.id);
        console.log(`Ad created: ${adData.id}`);

        // Mirror the ad into the warm retargeting ad set, reusing the same creative
        if (warmAdSetId) {
          try {
            const warmAdParams: Record<string, string> = {
              adset_id: warmAdSetId,
              name: `${adName} - Warm`,
              creative: JSON.stringify({ creative_id: creativeId }),
              status: launchStatus,
              multi_advertiser_ads: JSON.stringify({ use_multi_advertiser_ads: false }),
              access_token: metaAccessToken,
            };
            if (trackingSpecs) {
              warmAdParams.tracking_specs = JSON.stringify(trackingSpecs);
            }
            const warmAdResp = await fetch(
              `https://graph.facebook.com/v25.0/act_${accountId}/ads`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(warmAdParams),
              }
            );
            const warmAdData = await warmAdResp.json();
            if (warmAdData.error) {
              console.error(`Warm ad creation failed for ${adName}:`, warmAdData.error);
              result.warnings.push(`Warm retargeting ad failed for "${adName}": ${getMetaErrorMessage(warmAdData.error)}`);
            } else {
              result.warmAdIds.push(warmAdData.id);
              console.log(`Warm ad created: ${warmAdData.id}`);
            }
          } catch (warmErr: any) {
            console.error(`Warm ad error for ${adName}:`, warmErr);
            result.warnings.push(`Warm retargeting ad error for "${adName}": ${warmErr.message}`);
          }
        }
      } catch (adError: any) {
        console.error(`Error creating ad for ${adName}:`, adError);
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || 'Unknown',
          error: `Ad creation error: ${adError.message}`
        });
      }
    }

    // Step 5: Create ads from additional existing Instagram posts
    const additionalPosts = answers?.additionalPosts || [];
    if (additionalPosts.length > 0 && pageId) {
      console.log(`Creating ${additionalPosts.length} ads from existing Instagram posts...`);

      // Instagram account ID is already loaded from brand at the top of the function
      if (igAccountId) {
        for (const post of additionalPosts) {
          try {
            if (post.instagram_account_id && post.instagram_account_id !== igAccountId) {
              result.failedAds.push({
                conceptId: post.id,
                conceptTitle: `Instagram Post`,
                error: `Existing post skipped: it belongs to a different Instagram account than the one saved on this brand.`,
              });
              continue;
            }

            // Create ad creative using "Use Existing Post" pattern
            const creativeParams: Record<string, string> = {
              name: `Existing Post - ${post.id}`,
              object_id: pageId,
              instagram_user_id: igAccountId,
              source_instagram_media_id: post.id,
              access_token: metaAccessToken,
            };

            const creativeResponse = await fetch(
              `https://graph.facebook.com/v25.0/act_${accountId}/adcreatives`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(creativeParams),
              }
            );
            const creativeData = await creativeResponse.json();

            if (creativeData.error) {
              console.error(`Existing post creative failed (${post.id}):`, creativeData.error);
              result.failedAds.push({
                conceptId: post.id,
                conceptTitle: `Instagram Post`,
                error: `Existing post creative failed: ${getMetaErrorMessage(creativeData.error)}`,
              });
              continue;
            }

            // Create ad in the primary ad set
            const igAdParams: Record<string, string> = {
              adset_id: primaryAdSetId,
              name: `IG Post - ${post.caption?.slice(0, 30) || post.id}`,
              creative: JSON.stringify({ creative_id: creativeData.id }),
              status: launchStatus,
              multi_advertiser_ads: JSON.stringify({ use_multi_advertiser_ads: false }),
              access_token: metaAccessToken,
            };
            if (trackingSpecs) {
              igAdParams.tracking_specs = JSON.stringify(trackingSpecs);
            }

            const adResponse = await fetch(
              `https://graph.facebook.com/v25.0/act_${accountId}/ads`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(igAdParams),
              }
            );
            const adData = await adResponse.json();

            if (adData.error) {
              console.error(`Existing post ad failed (${post.id}):`, adData.error);
              result.failedAds.push({
                conceptId: post.id,
                conceptTitle: `Instagram Post`,
                error: `Existing post ad failed: ${getMetaErrorMessage(adData.error)}`,
              });
              continue;
            }

            result.adIds.push(adData.id);
            console.log(`Existing post ad created: ${adData.id}`);

            // Mirror existing-post ad into the warm retargeting ad set
            if (warmAdSetId) {
              try {
                const warmIgName = `IG Post - ${post.caption?.slice(0, 30) || post.id} - Warm`;
                const warmIgParams: Record<string, string> = {
                  adset_id: warmAdSetId,
                  name: warmIgName,
                  creative: JSON.stringify({ creative_id: creativeData.id }),
                  status: launchStatus,
                  multi_advertiser_ads: JSON.stringify({ use_multi_advertiser_ads: false }),
                  access_token: metaAccessToken,
                };
                if (trackingSpecs) {
                  warmIgParams.tracking_specs = JSON.stringify(trackingSpecs);
                }
                const warmIgResp = await fetch(
                  `https://graph.facebook.com/v25.0/act_${accountId}/ads`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(warmIgParams),
                  }
                );
                const warmIgData = await warmIgResp.json();
                if (warmIgData.error) {
                  console.error(`Warm existing-post ad failed (${post.id}):`, warmIgData.error);
                  result.warnings.push(`Warm retargeting ad failed for IG post ${post.id}: ${getMetaErrorMessage(warmIgData.error)}`);
                } else {
                  result.warmAdIds.push(warmIgData.id);
                  console.log(`Warm existing-post ad created: ${warmIgData.id}`);
                }
              } catch (warmIgErr: any) {
                console.error(`Warm existing-post ad error (${post.id}):`, warmIgErr);
                result.warnings.push(`Warm retargeting ad error for IG post ${post.id}: ${warmIgErr.message}`);
              }
            }
          } catch (postError: any) {
            console.error(`Error creating ad for existing post ${post.id}:`, postError);
            result.failedAds.push({
              conceptId: post.id,
              conceptTitle: `Instagram Post`,
              error: `Existing post error: ${postError.message}`,
            });
          }
        }
      } else {
        result.warnings.push('Instagram account not connected — existing posts were skipped.');
      }
    }

    // Determine overall success - we need at least 1 ad
    result.success = result.adIds.length > 0;

    if (!result.success) {
      // Complete failure - no ads created; surface the exact Meta rejection reason
      console.error('All ads failed. Details:', JSON.stringify(result.failedAds));
      const primaryReason = result.failedAds[0]?.error || 'No ad was created.';
      const buildError = new Error(`Failed to create any ads. ${primaryReason}`) as Error & {
        failedAds?: Array<{ conceptId: string; conceptTitle: string; error: string }>;
      };
      buildError.failedAds = result.failedAds;
      throw buildError;
    }

    // Partial success - save what we have
    const campaignIds = {
      campaign_id: result.campaignId,
      ad_set_id: primaryAdSetId,
      warm_ad_set_id: warmAdSetId,
      ad_set_ids: result.adSetIds,
      ad_ids: result.adIds,
      warm_ad_ids: result.warmAdIds,
      failed_ads: result.failedAds,
      warnings: result.warnings
    };

    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: campaignIds,
        meta_campaign_status: launchStatus === 'ACTIVE' ? 'live' : 'paused',
        meta_errors: result.failedAds.length > 0 ? result.failedAds : null,
        progress_status: 'live',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId);

    console.log('Campaign created successfully:', campaignIds);

    // Build response message
    let message = `Campaign created with ${result.adIds.length} ads.`;
    if (result.failedAds.length > 0) {
      message += ` ${result.failedAds.length} ad(s) failed to create.`;
    }
    if (launchStatus === 'ACTIVE') {
      message += ` Campaign is active — ads will start delivering after Meta approval.`;
    } else {
      message += ` Campaign is paused — activate it in Ads Manager when ready.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: result.campaignId,
        adSetId: primaryAdSetId,
        warmAdSetId,
        adIds: result.adIds,
        warmAdIds: result.warmAdIds,
        totalAdsCreated: result.adIds.length,
        totalAdsFailed: result.failedAds.length,
        failedAds: result.failedAds,
        warnings: result.warnings,
        status: launchStatus === 'ACTIVE' ? 'active' : 'paused',
        message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    const rawMsg = error?.message || String(error) || 'Unknown error';
    console.error('Error building campaign:', rawMsg, error?.stack || '');

    // Fire-and-forget Slack alert with its own short timeout so a slow
    // Slack call can never delay or block our 200 response to the client.
    try {
      const slackCtrl = new AbortController();
      const slackTimer = setTimeout(() => slackCtrl.abort(), 3_000);
      // Intentionally NOT awaited.
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/slack-error-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          category: 'Meta API',
          severity: 'error',
          title: 'Campaign Build Failed',
          message: `Error building Meta campaign: ${rawMsg}`,
          source: 'build-meta-campaign',
        }),
        signal: slackCtrl.signal,
      }).catch(() => { /* ignore */ }).finally(() => clearTimeout(slackTimer));
    } catch { /* ignore */ }

    // Translate raw error shapes into a clear, actionable user message.
    const lower = rawMsg.toLowerCase();
    const isTimeout = /timed out|aborted|timeout|deadline/.test(lower);
    const isNetwork = /network|fetch failed|connection|econnreset|enotfound/.test(lower);
    let friendly = rawMsg;
    if (isTimeout) {
      friendly = `Publishing took too long and was cut off before finishing. This usually means a Meta API call (often a video upload) stalled. Please try again — if it keeps happening, try publishing with fewer creatives at once.`;
    } else if (isNetwork) {
      friendly = `We couldn't reach Meta to finish publishing. ${rawMsg}. Please try again in a moment.`;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: friendly,
        rawError: rawMsg,
        timedOut: isTimeout,
        failedAds: Array.isArray(error?.failedAds) ? error.failedAds : [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }

});
