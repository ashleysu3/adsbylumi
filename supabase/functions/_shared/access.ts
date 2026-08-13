// Shared access helpers for edge functions.
// Allows admins (role = 'admin' in public.user_roles) to act on any brand —
// used to support admin impersonation in the LUMI admin console.

export async function isAdminUser(sb: any, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    return !!data;
  } catch (_e) {
    return false;
  }
}

// True if the user owns the brand OR is an admin.
export async function canAccessBrand(
  sb: any,
  brandUserId: string | null | undefined,
  callerUserId: string | null | undefined,
): Promise<boolean> {
  if (!callerUserId) return false;
  if (brandUserId && brandUserId === callerUserId) return true;
  return await isAdminUser(sb, callerUserId);
}

/**
 * Hard tenancy guard for creative generation.
 *
 * Concepts/angles must NEVER be generated with another brand's (or another
 * brand's offer's) context. Callers pass brandId/offerId in the request body,
 * so we re-verify server-side that:
 *   1. the caller owns (or admins) the brand, and
 *   2. the offer, when supplied, belongs to that same brand.
 *
 * Returns { ok: true, brand, offer } or { ok: false, status, error }.
 */
export async function assertBrandOfferAccess(
  sb: any,
  callerUserId: string | null | undefined,
  brandId: string | null | undefined,
  offerId?: string | null,
): Promise<
  | { ok: true; brand: any | null; offer: any | null }
  | { ok: false; status: number; error: string }
> {
  if (!brandId) {
    // No brand context supplied — nothing to leak, but an offer without a brand
    // can't be verified, so refuse to use it.
    if (offerId) {
      return { ok: false, status: 400, error: 'brandId is required when offerId is provided' };
    }
    return { ok: true, brand: null, offer: null };
  }

  const { data: brand } = await sb
    .from('brands')
    .select('id, user_id, name')
    .eq('id', brandId)
    .maybeSingle();

  if (!brand) {
    return { ok: false, status: 404, error: 'Brand not found' };
  }

  const allowed = await canAccessBrand(sb, brand.user_id, callerUserId);
  if (!allowed) {
    return { ok: false, status: 403, error: 'You do not have access to this brand' };
  }

  let offer: any = null;
  if (offerId) {
    const { data: offerRow } = await sb
      .from('offers')
      .select('id, brand_id, name')
      .eq('id', offerId)
      .maybeSingle();

    if (!offerRow) {
      return { ok: false, status: 404, error: 'Offer not found' };
    }
    if (offerRow.brand_id !== brandId) {
      // This is the cross-brand leak we must never allow through.
      return { ok: false, status: 403, error: 'Offer does not belong to this brand' };
    }
    offer = offerRow;
  }

  return { ok: true, brand, offer };
}
