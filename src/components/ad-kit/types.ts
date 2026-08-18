// Shared shapes for the Ad Kit — the single source of truth consumed by both
// the onboarding payoff (live build) and /your-ad-pack (the saved kit page).
// Mirrors what PayoffAdScreen persists into brands.ad_kit at capture.

export type ScriptBeat = { line: string; category: string; seconds: number };

export type KitCampaign = {
  name?: string;
  objective?: string;
  audience?: string;
  creative_brief?: string;
};

export type KitStrategy = {
  title?: string | null;
  intro?: string | null;
  campaigns?: KitCampaign[] | null;
} | null;

export type KitCopy = {
  template?: string;
  option?: Record<string, any>;
} | null;

// Plain-English translations of Meta campaign objectives — always shown NEXT
// TO the raw value, never instead of it. The novice reads the left side; the
// person who knows Ads Manager verifies the right side.
export const OBJECTIVE_PLAIN: Record<string, string> = {
  OUTCOME_LEADS: "Bring you leads",
  OUTCOME_SALES: "Drive sales",
  OUTCOME_AWARENESS: "Get you seen",
  OUTCOME_TRAFFIC: "Send people to your page",
  OUTCOME_ENGAGEMENT: "Start conversations",
};

// A compose-ad option's headline lives in different slots depending on the
// template it was written for.
export const SEGMENTED_HEADLINE_TEMPLATES = new Set([
  "bigtype", "framed", "markeroverlay", "solidstatement",
]);

export function kitHeadline(template: string | undefined, opt: Record<string, any> | undefined | null): string {
  if (!opt) return "";
  if (template && SEGMENTED_HEADLINE_TEMPLATES.has(template)) {
    return [opt.headlinePre, opt.headlineHL, opt.headlinePost].filter(Boolean).join(" ").trim();
  }
  if (template === "starquote") {
    return [opt.quotePre, opt.quoteHL, opt.quotePost].filter(Boolean).join(" ").trim();
  }
  return String(opt.headline || opt.quote || "").trim();
}
