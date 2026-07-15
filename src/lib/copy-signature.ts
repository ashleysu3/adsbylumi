// Deterministic signature for a set of ad-copy variations. The QA preflight
// check compares this against workspace.approved_copy_signature — when the
// copy the user is publishing matches what they already approved, we skip
// re-flagging it for policy/spelling issues.

export type CopyVariationLike = {
  headline?: string;
  primary_text?: string;
  primaryText?: string;
  description?: string;
};

export function normalizeCopyVariations(variations: CopyVariationLike[] | undefined | null) {
  if (!Array.isArray(variations)) return [] as { h: string; p: string; d: string }[];
  return variations
    .map((v) => ({
      h: (v?.headline || "").trim(),
      p: ((v as any)?.primary_text || (v as any)?.primaryText || "").trim(),
      d: (v?.description || "").trim(),
    }))
    .filter((v) => v.h || v.p || v.d)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export async function computeCopySignature(
  variations: CopyVariationLike[] | undefined | null,
): Promise<string> {
  const payload = JSON.stringify(normalizeCopyVariations(variations));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
