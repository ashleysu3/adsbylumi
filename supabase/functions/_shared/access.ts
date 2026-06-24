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
