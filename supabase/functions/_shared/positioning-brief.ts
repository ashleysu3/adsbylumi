// Shared helper: turn a campaign template's positioning_brief into a prompt
// block that overrides generic objective→tone mapping in the angle and copy
// generators.
//
// Shape: { angle_intent, awareness_level, say, never_say }

export type PositioningBrief = {
  angle_intent?: string;
  awareness_level?: string;
  say?: string[] | string;
  never_say?: string[] | string;
} | null | undefined;

const toList = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") return [v];
  return [];
};

export function buildPositioningBriefBlock(brief: PositioningBrief): string {
  if (!brief || typeof brief !== "object") return "";
  const intent = String(brief.angle_intent || "").trim();
  const awareness = String(brief.awareness_level || "").trim();
  const say = toList(brief.say);
  const never = toList(brief.never_say);
  if (!intent && !awareness && say.length === 0 && never.length === 0) return "";

  let out =
    "\n\n=== POSITIONING BRIEF (HARD CONSTRAINT — OVERRIDES GENERIC OBJECTIVE→TONE MAPPING) ===\n";
  out +=
    "This brief comes from the chosen strategy template. It defines how every angle, hook, and line of copy in this campaign must read. Treat it as a non-negotiable wrapper around the rest of the brief.\n\n";
  if (intent) out += `ANGLE INTENT:\n${intent}\n\n`;
  if (awareness) out += `AWARENESS LEVEL: ${awareness}\n\n`;
  if (say.length) {
    out += `SAY (must-include language / framing):\n${say.map((s) => `- ${s}`).join("\n")}\n\n`;
  }
  if (never.length) {
    out += `NEVER SAY (banned phrasing / framing — instant fail):\n${never.map((s) => `- ${s}`).join("\n")}\n\n`;
  }
  out +=
    "If anything earlier in this prompt contradicts the POSITIONING BRIEF, the POSITIONING BRIEF wins.\n";
  return out;
}
