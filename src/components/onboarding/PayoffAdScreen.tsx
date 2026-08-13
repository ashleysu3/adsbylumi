import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ArrowRight, RefreshCw, Sparkles, ChevronLeft, Target, Download, Mic, Film, Mail, Check, ImagePlus, Type } from "lucide-react";
import { toast } from "sonner";
import type { RenderOverlay } from "@/lib/ffmpeg-renderer";
import { getTestimonialQuotes, type TestimonialQuote } from "@/lib/social-proof";
import { trackLumiEvent, trackLumiEventOnce } from "@/lib/lumi-pixel";
import lumiLogo from "@/assets/lumi-logo.png";
import { GamePlanCard } from "@/components/ad-kit/GamePlanCard";
import { BuyerPsychology } from "@/components/ad-kit/BuyerPsychology";
import { ScriptBlock } from "@/components/ad-kit/ScriptBlock";
import { BrollBlock } from "@/components/ad-kit/BrollBlock";
import { VslCloseSection, useKitCheckout } from "@/components/ad-kit/VslClose";
import type { ScriptBeat } from "@/components/ad-kit/types";
import {
  rankPhotoCandidates,
  bestCopyIndex,
  guardPalette,
  readableTextOn,
  normalizeDemoDomain,
} from "@/lib/ad-quality";


// Coerce however brand_kits.colors is shaped (array of hexes from extract-brand,
// or the {bg, ink, accent, pop, highlight, cream} object the Style page saves)
// into the shape the render engine expects.
type EngineColors = { bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string };
const DEFAULT_ENGINE_COLORS: EngineColors = {
  bg: "#ffffff", ink: "#111111", accent: "#f43f5e",
  pop: "#f97316", highlight: "#a855f7", cream: "#fdf7f2",
};

function normalizeHex(h: any): string | null {
  if (typeof h !== "string") return null;
  const t = h.trim();
  const m = t.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  return "#" + m[1].toLowerCase();
}
function luma(h: string): number {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
// True when the kit contains at least one valid hex at all — extraction has
// written *something*. Gates the retry loop: keep waiting only while the kit
// is genuinely empty (extract-brand may still be running).
function hasAnyColors(kitColors: any): boolean {
  if (Array.isArray(kitColors)) return kitColors.some((h) => normalizeHex(h));
  if (kitColors && typeof kitColors === "object") {
    const o: any = kitColors;
    return [
      o.bg, o.background, o.ink, o.textPrimary, o.accent,
      o.primary, o.pop, o.secondary, o.highlight, o.cream,
    ].some((v) => normalizeHex(v));
  }
  return false;
}

// True when the kit has at least one color that will actually READ as a
// brand color in the render — mid-luminance, same band toEngineColors uses
// to pick accents. Extraction can "succeed" with a neutrals-only palette
// (whites/creams/black — seen live with adsbylumi.com itself), which renders
// visually identical to no branding at all. The caption must not claim
// "your brand colors" in that case.
function hasVividColors(kitColors: any): boolean {
  const isVivid = (v: any) => {
    const h = normalizeHex(v);
    if (!h) return false;
    const l = luma(h);
    return l > 0.15 && l < 0.85;
  };
  if (Array.isArray(kitColors)) return kitColors.some(isVivid);
  if (kitColors && typeof kitColors === "object") {
    const o: any = kitColors;
    return [o.accent, o.primary, o.pop, o.secondary, o.highlight].some(isVivid);
  }
  return false;
}

function toEngineColors(kitColors: any): EngineColors {
  if (kitColors && !Array.isArray(kitColors) && typeof kitColors === "object") {
    const o: any = kitColors;
    return {
      bg: normalizeHex(o.bg) || normalizeHex(o.background) || DEFAULT_ENGINE_COLORS.bg,
      ink: normalizeHex(o.ink) || normalizeHex(o.textPrimary) || DEFAULT_ENGINE_COLORS.ink,
      accent: normalizeHex(o.accent) || normalizeHex(o.primary) || DEFAULT_ENGINE_COLORS.accent,
      pop: normalizeHex(o.pop) || normalizeHex(o.secondary) || normalizeHex(o.accent) || DEFAULT_ENGINE_COLORS.pop,
      highlight: normalizeHex(o.highlight) || DEFAULT_ENGINE_COLORS.highlight,
      cream: normalizeHex(o.cream) || DEFAULT_ENGINE_COLORS.cream,
    };
  }
  if (Array.isArray(kitColors)) {
    const hexes = kitColors.map(normalizeHex).filter(Boolean) as string[];
    if (!hexes.length) return DEFAULT_ENGINE_COLORS;
    const sortedByLuma = [...hexes].sort((a, b) => luma(a) - luma(b));
    const darkest = sortedByLuma[0];
    const lightest = sortedByLuma[sortedByLuma.length - 1];
    // Prefer a mid-luminance color for accent; skip near-black and near-white.
    const mids = hexes.filter((h) => { const l = luma(h); return l > 0.15 && l < 0.85; });
    const accent = mids[0] || hexes[0];
    const pop = mids.find((h) => h !== accent) || mids[0] || accent;
    const highlight = mids.find((h) => h !== accent && h !== pop) || pop;
    return {
      bg: luma(lightest) > 0.82 ? lightest : "#ffffff",
      ink: luma(darkest) < 0.28 ? darkest : "#111111",
      accent,
      pop,
      highlight,
      cream: DEFAULT_ENGINE_COLORS.cream,
    };
  }
  return DEFAULT_ENGINE_COLORS;
}

function toFontsPayload(kitFonts: any): { displayFamily?: string; bodyFamily?: string } {
  if (!kitFonts) return {};
  if (Array.isArray(kitFonts)) {
    const list = kitFonts.filter((f: any) => typeof f === "string" && f.trim());
    return { displayFamily: list[0], bodyFamily: list[1] || list[0] };
  }
  if (typeof kitFonts === "object") {
    return {
      displayFamily: kitFonts.displayFamily || kitFonts.display?.family,
      bodyFamily: kitFonts.bodyFamily || kitFonts.body?.family,
    };
  }
  return {};
}

function pathFromUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type RenderImage = { placement: string; width: number; height: number; base64: string; label?: string };

// Wait until the rendered ad has actually decoded before revealing it, so the
// payoff moment never flashes a half-painted image on a projector.
async function waitForDecode(img?: RenderImage): Promise<void> {
  if (!img?.base64 || typeof window === "undefined") return;
  await new Promise<void>((resolve) => {
    const el = new Image();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    el.onload = finish;
    el.onerror = finish;
    setTimeout(finish, 4000);
    el.src = `data:image/png;base64,${img.base64}`;
  });
}

// One stop on the build's progress rail: ✓ done, spinner in flight, dim dot queued.
function RailItem({ label, done, active }: { label: string; done: boolean; active?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 " +
        (done ? "text-foreground" : active ? "" : "opacity-50")
      }
    >
      {done ? (
        <Check className="h-3 w-3 text-primary" />
      ) : active ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span className="h-1 w-1 rounded-full bg-current inline-block" />
      )}
      {label}
    </span>
  );
}

// generate-creative-angles returns psychologyTrigger as a raw data path
// ("pain_points.my ad results are inconsistent and I don't understand why…").
// The buyer's-own-words part is the proof the angle isn't generic — show it as
// a quote, with a short human label as the chip, never the raw key in caps.
function parseAngleTrigger(trigger: unknown): { label: string; insight?: string } | null {
  if (typeof trigger !== "string" || !trigger.trim()) return null;
  const t = trigger.trim();
  const labels: Record<string, string> = {
    pain_points: "Pain point",
    painpoints: "Pain point",
    desires: "Desire",
    objections: "Objection",
    motivations: "Motivation",
    hesitations: "Hesitation",
    identity: "Identity",
  };
  const m = t.match(/^([a-z_ ]+)\.(.+)$/i);
  if (m) {
    const key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    return { label: labels[key] || "Buyer psychology", insight: m[2].trim() };
  }
  if (t.length <= 40) return { label: t };
  return { label: "Buyer psychology", insight: t };
}

// "Why this copy works" — computed from the actual option + the psychology it
// was written from. Pure rules, no AI call: every claim here must be checkable
// against the copy on screen, or it reads as filler and burns trust.
function computeCopyAnnotations(
  option: any,
  ap: any,
  voiceRaw: any,
): { label: string; detail: string }[] {
  if (!option) return [];
  const texts = Object.values(option).filter((v) => typeof v === "string") as string[];
  const joined = texts.join(" ").trim();
  if (!joined) return [];
  const out: { label: string; detail: string }[] = [];

  // Feed copy is skimmed mid-scroll, not read like an email.
  const sentences = joined.split(/[.!?…]+/).map((s) => s.trim()).filter(Boolean);
  const avgWords = sentences.length
    ? sentences.reduce((n, s) => n + s.split(/\s+/).length, 0) / sentences.length
    : 0;
  if (avgWords > 0 && avgWords <= 12) {
    out.push({
      label: "Built to skim",
      detail: `Short lines (~${Math.round(avgWords)} words each) — readable mid-scroll, no wall of text.`,
    });
  }

  // Quote back the strongest pain/desire the copy actually echoes — the
  // overlap check keeps this honest (≥2 meaningful shared words, not vibes).
  const stop = new Set([
    "your", "that", "this", "with", "from", "they", "them", "have", "what",
    "when", "will", "just", "like", "into", "more", "been", "their", "about",
    "youre", "dont", "cant", "every", "without", "because",
  ]);
  const words = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/)
        .filter((w) => w.length > 3 && !stop.has(w)),
    );
  const copyWords = words(joined);
  const bestEcho = (arr: any, label: string, lead: string) => {
    if (!Array.isArray(arr)) return;
    let best: { text: string; hits: number } | null = null;
    for (const item of arr) {
      if (typeof item !== "string" || !item.trim()) continue;
      let hits = 0;
      for (const w of words(item)) if (copyWords.has(w)) hits++;
      if (hits >= 2 && (!best || hits > best.hits)) best = { text: item.trim(), hits };
    }
    if (best) {
      // The psychology arrays often store items already wrapped in quotes —
      // strip those so we don't render doubled quote marks.
      const bare = best.text.replace(/^["'“”‘’\s]+|["'“”‘’\s;,]+$/g, "");
      const quote = bare.length > 90 ? bare.slice(0, 87) + "…" : bare;
      out.push({ label, detail: `${lead} “${quote}”` });
    }
  };
  bestEcho(ap?.pain_points || ap?.painPoints, "Names their pain", "Speaks straight to:");
  bestEcho(ap?.desires, "Sells the after", "Points at what they want:");

  // Emoji presence/restraint — only claimed when their own voice supports it.
  const voice = JSON.stringify(voiceRaw || "").toLowerCase();
  const hasEmoji = /\p{Extended_Pictographic}/u.test(joined);
  if (hasEmoji && /(warm|playful|fun|friendly|bold|energetic)/.test(voice)) {
    out.push({ label: "Emoji, on voice", detail: "Used sparingly — matches the warmth in your brand voice." });
  } else if (!hasEmoji && /(direct|no-nonsense|professional|clean|minimal)/.test(voice)) {
    out.push({ label: "No emoji clutter", detail: "Matches your direct, no-nonsense voice." });
  }

  // One clear ask — decision fatigue is the silent conversion killer.
  const ctaText = typeof option.cta === "string" ? option.cta.trim() : "";
  if (ctaText) {
    out.push({ label: "One clear ask", detail: `“${ctaText}” — a single action, nothing competing with it.` });
  }

  return out.slice(0, 4);
}

const PHOTO_ROLES = new Set(["photo", "lifestyle", "full_body", "headshot"]);

// When a photo is available, rotate across every photo-forward template
// instead of always defaulting to "spotlight" — deterministic per brand
// (stable across re-renders/hook swaps for one visitor) but varied across
// different visitors.
const PHOTO_TEMPLATES = ["spotlight", "framed"] as const;
type PhotoTemplate = typeof PHOTO_TEMPLATES[number];
function pickPhotoTemplate(seed: string): PhotoTemplate {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PHOTO_TEMPLATES[Math.abs(hash) % PHOTO_TEMPLATES.length];
}

// Extract a headline preview string from a compose-ad option for a given template.
function optionToHeadline(template: string, opt: any): string {
  if (!opt || typeof opt !== "object") return "";
  if (template === "bigtype" || template === "framed") {
    return [opt.headlinePre, opt.headlineHL, opt.headlinePost].filter(Boolean).join(" ").trim();
  }
  return String(opt.headline || opt.quote || "").trim();
}

interface Props {
  brandId: string;
  brand: any;
  onAdvance: () => void;
  onBack: () => void;
}

export function PayoffAdScreen({ brandId, brand, onAdvance, onBack }: Props) {
  const [, setSearchParams] = useSearchParams();
  // loading → (choosing → building) → ready. "choosing" is the new two-tap
  // moment — pick the angle, pick the photo — that turns "a machine made me
  // an ad" into "I made this ad." If angle generation fails we skip straight
  // to the old auto-build path; the user is never trapped behind a choice.
  const [phase, setPhase] = useState<"loading" | "choosing" | "building" | "ready" | "error">("loading");
  const [angles, setAngles] = useState<any[]>([]);
  const [chosenAngleIdx, setChosenAngleIdx] = useState<number | null>(null);
  const [photoCandidates, setPhotoCandidates] = useState<{ url: string; label?: string }[]>([]);
  // index into photoCandidates, or -1 for "bold text, no photo"
  const [chosenPhotoIdx, setChosenPhotoIdx] = useState<number>(-1);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [statusLine, setStatusLine] = useState<string>("Reading your brand kit…");
  const [images, setImages] = useState<RenderImage[]>([]);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [usedRealColors, setUsedRealColors] = useState(false);
  // The palette actually driving the render, surfaced as tappable dots so a
  // weak/wrong extraction is a ten-second fix in the moment — not homework
  // on a page an anonymous onboarding visitor can't even reach yet.
  const [palette, setPalette] = useState<EngineColors | null>(null);
  const [paletteDirty, setPaletteDirty] = useState(false);
  const [savingPalette, setSavingPalette] = useState(false);
  // Demo safety net: when the entered website matches a pinned demo domain we
  // reveal the hand-approved ad instead of whatever the live run produced.
  // The live run still happens in the background — press "D" to toggle.
  const pinnedRef = useRef<{ images: RenderImage[]; copy?: any; template?: string } | null>(null);
  const [pinnedActive, setPinnedActive] = useState(false);
  const liveImagesRef = useRef<RenderImage[]>([]);
  const [isAdminViewer, setIsAdminViewer] = useState(false);

  // Save-in-place: the kit stays on this page. Saving emails the private
  // /your-ad-pack?kit= link and stamps ?kit= onto THIS url (no navigation —
  // the redundant "here's your kit again" redirect is exactly what we killed).
  const [packFormOpen, setPackFormOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [packState, setPackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // Signed-in (non-anonymous) users already have an account — their kit gets
  // pulled straight into it instead of asking them for an email to save it.
  const [hasAccount, setHasAccount] = useState(false);
  // Save flow inside the dialog: ask for the email → either "you already have
  // an account, log in and we'll pull this kit in" or "sent — here's 50% off".
  const [packStep, setPackStep] = useState<"email" | "login" | "offer">("email");
  const [checkingAccount, setCheckingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (cancelled || !user || (user as any).is_anonymous || !user.email) return;
      setHasAccount(true);
      setLeadEmail((prev) => prev || user.email || "");
      const metaName =
        (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || "";
      if (metaName) setLeadName((prev) => prev || metaName);
    })();
    return () => { cancelled = true; };
  }, []);

  // Admins get the demo controls: pin the ad on screen, toggle pinned vs live.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user || (user as any).is_anonymous) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled && role) setIsAdminViewer(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // "D" flips between the pinned demo ad and the live render (admins only).
  useEffect(() => {
    if (!isAdminViewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "d" && e.key !== "D") return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      if (!pinnedRef.current?.images?.length || !liveImagesRef.current.length) return;
      setPinnedActive((wasPinned) => {
        setImages(wasPinned ? liveImagesRef.current : pinnedRef.current!.images);
        return !wasPinned;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdminViewer]);


  // The quiet "ready to launch now?" path for hot buyers — same shared
  // checkout the kit page uses. Buying otherwise lives AFTER the save.
  const { goCheckout, checkoutLoading } = useKitCheckout(brandId);

  // Prepared inputs
  const engineColorsRef = useRef<EngineColors>(DEFAULT_ENGINE_COLORS);
  const fontsRef = useRef<{ displayFamily?: string; bodyFamily?: string }>({});
  const logoUrlRef = useRef<string | undefined>(undefined);
  // The brand's Instagram profile pic, re-hosted server-side into a stable
  // URL — used as the feed-post avatar on the kit page, preferred over the
  // logo. Fetched fire-and-forget during boot so it's usually ready by save.
  const avatarUrlRef = useRef<string | undefined>(undefined);
  const photoUrlRef = useRef<string | undefined>(undefined);
  // A background/texture image from their site for the big area behind the
  // card — deliberately never the same asset as the portrait in the circle.
  const backgroundUrlRef = useRef<string | undefined>(undefined);

  const templateRef = useRef<PhotoTemplate | "checklist" | "bigtype">("bigtype");
  const socialProofRef = useRef<TestimonialQuote | null>(null);
  const offerPsychologyRef = useRef<Record<string, any> | null>(null);

  // Copy options + selection
  const [options, setOptions] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // Strategy summary
  const [strategy, setStrategy] = useState<any>(null);

  // Bonus creatives: a talking-head script + a b-roll ad assembled from stock
  // footage, both usable without creating an account. Neither blocks the main
  // ad/CTA — they load in the background and simply don't appear if they fail
  // or if there's no stock footage on file yet.
  const userGoalRef = useRef<string>("get_leads");
  const offerHintRef = useRef<string>("");
  // Context Phase B (buildAd) needs after the user makes their choices —
  // captured by the boot effect so the build callback works from refs alone.
  const onboardingGoalRef = useRef<string | null>(null);
  const followersIntentRef = useRef<string | null>(null);
  const offerUrlRef = useRef<string>("");
  const offerRowRef = useRef<any>(null);
  const chosenAngleRef = useRef<any>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const bonusStartedRef = useRef(false);
  const [scriptBeats, setScriptBeats] = useState<ScriptBeat[] | null>(null);
  const [scriptState, setScriptState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [videoState, setVideoState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoCredit, setVideoCredit] = useState<{ name: string; url: string | null } | null>(null);
  // Raw mp4 blob kept for the Ad Kit upload — the object URL above only
  // works in this tab; the kit page needs a real public URL.
  const videoBlobRef = useRef<Blob | null>(null);
  const kitVideoUploadedRef = useRef(false);

  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

  // Defined AFTER the copy/strategy/script state it snapshots — a useCallback
  // deps array evaluates at render time, and referencing a `const` state
  // binding above its declaration is a TDZ error.
  const sendAdPack = useCallback(async () => {
    if (packState === "sending" || packState === "sent") return;
    const heroImage = images[0];
    if (!heroImage?.base64) {
      toast.error("No ad ready to send yet — try again in a moment.");
      return;
    }
    if (!leadEmail.trim() || !leadEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setPackState("sending");
    try {
      // base64 -> Blob, same pattern used for approved-render uploads elsewhere.
      const bin = atob(heroImage.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });

      // lead-magnet-assets. RLS requires the uploader's own uid as the first
      // path segment (see BrandImageLibrary.tsx's identical convention for
      // brand-assets) — brandId alone isn't enough.
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw new Error("Not signed in");
      const path = `${userId}/${brandId}/ad-pack-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("lead-magnet-assets")
        .upload(path, blob, { cacheControl: "3600", upsert: true, contentType: "image/png" });
      if (upErr) throw upErr;
      // The bucket is private on Lovable (owner-only read policies were applied,
      // but the public flag never was), so a getPublicUrl link 404s ("Bucket
      // not found") for the cold email/token visitor with no session — which
      // was showing a broken image on the kit page and in the email. A signed
      // URL is pre-authorized and loads with no session; a long expiry keeps
      // the lead magnet alive. (Making the bucket public is the clean fix, but
      // this must work today without waiting on a deploy.)
      const { data: pub } = supabase.storage.from("lead-magnet-assets").getPublicUrl(path);
      let imageUrl = pub.publicUrl;
      try {
        const { data: signed } = await supabase.storage
          .from("lead-magnet-assets")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) imageUrl = signed.signedUrl;
      } catch { /* fall back to the public URL */ }

      // Mint the kit token — the one key that opens /your-ad-pack?kit=…
      // from the email, on any device, with no session.
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const kitToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // The domain the ad clicks through to, and a logo for the feed-post
      // avatar — snapshotted here because the token-gated kit RPC returns
      // only whitelisted columns, not the brand's website or logo. Derived
      // from the real offer link first, then the brand site.
      const adDomain: string | null = (() => {
        const raw =
          offerRowRef.current?.url ||
          offerUrlRef.current ||
          (brand as any)?.website_url ||
          (brand as any)?.website ||
          "";
        if (!raw) return null;
        try {
          return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })();

      // Snapshot everything the kit page shows — these live only in React
      // state otherwise and would be gone by the time the email is opened.
      const selectedOption = options[selectedIdx] || null;
      const adKit: Record<string, any> = {
        copy: selectedOption ? { template: templateRef.current, option: selectedOption } : null,
        // Brand chrome for the feed-post mock on the kit page. Instagram
        // profile pic first (most recognizable), brand logo as the fallback.
        meta: {
          domain: adDomain,
          avatarUrl: avatarUrlRef.current || logoUrlRef.current || null,
          cta: (typeof selectedOption?.cta === "string" && selectedOption.cta) || null,
        },
        // Which angle they chose — the kit page can name it, and it's the
        // seed data for knowing which angles actually convert.
        angle: chosenAngleRef.current
          ? {
              name: chosenAngleRef.current.name || null,
              psychologyTrigger:
                chosenAngleRef.current.psychologyTrigger ||
                chosenAngleRef.current.psychology_trigger ||
                null,
            }
          : null,
        script: scriptBeats && scriptBeats.length ? scriptBeats : null,
        strategy: strategy
          ? {
              title: strategy.personalized_title || strategy.name || null,
              intro: strategy.personalized_intro || strategy.description || null,
              campaigns: Array.isArray(strategy.campaigns) ? strategy.campaigns : null,
            }
          : null,
      };

      const { error: updateErr } = await supabase
        .from("brands")
        .update({
          lead_email: leadEmail.trim(),
          lead_name: leadName.trim() || null,
          ad_pack_image_url: imageUrl,
          ad_kit_token: kitToken,
          ad_kit: adKit,
        })
        .eq("id", brandId);
      if (updateErr) throw updateErr;

      // List add is marketing, not delivery — a Flodesk hiccup must never
      // block the kit email. Fire-and-forget; the kit email itself always
      // goes out from LUMI via Resend below. Existing account holders are
      // already customers, so they skip the lead list entirely.
      if (!hasAccount) {
        supabase.functions
          .invoke("sync-flodesk", {
            body: {
              email: leadEmail.trim(),
              firstName: leadName.trim().split(" ")[0] || undefined,
              segment: "ad_kit",
            },
          })
          .then(({ error }) => {
            if (error) console.warn("[payoff] flodesk sync failed", error);
          })
          .catch((e) => console.warn("[payoff] flodesk sync failed", e));
      }

      const { error: sendErr } = await supabase.functions.invoke("send-ad-pack-email", {
        body: { brand_id: brandId },
      });
      if (sendErr) throw sendErr;

      setPackState("sent");
      // Signed-in users are done. Leads stay in the dialog for the 50% offer,
      // which replaces the old "ready to launch this now?" text link.
      if (hasAccount) {
        setPackFormOpen(false);
      } else {
        setPackStep("offer");
        setPackFormOpen(true);
        trackLumiEvent("Lead");
      }
      // Save-in-place: the kit stays right here. Stamp the token onto this
      // URL (replace, not push — no back-button trap) so a refresh or a
      // bookmark of THIS page resolves to the permanent kit link, and let
      // the VSL + 50% close unfold below instead of navigating away.
      setSearchParams({ kit: kitToken }, { replace: true });
      toast.success(
        hasAccount
          ? "Saved to your account — your brand kit is ready."
          : "Saved — your private link is on its way to your inbox!",
      );
    } catch (err: any) {
      console.error("[payoff] send ad kit error", err);
      toast.error(err?.message || "Couldn't save your Ad Kit. Please try again.");
      setPackState("error");
    }
  }, [brandId, images, leadEmail, leadName, packState, setSearchParams, options, selectedIdx, scriptBeats, strategy, hasAccount]);

  // Step 1 of the save dialog: does this email already have a LUMI account?
  // If it does, we don't email them a lead-magnet link — we send them to log
  // in and pull the kit straight into their account.
  const handleSaveSubmit = useCallback(async () => {
    const email = leadEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setCheckingAccount(true);
    try {
      const { data } = await supabase.functions.invoke("check-account-exists", {
        body: { email },
      });
      if (data?.exists) {
        setPackStep("login");
        return;
      }
    } catch (e) {
      console.warn("[payoff] account check failed, continuing as lead", e);
    } finally {
      setCheckingAccount(false);
    }
    await sendAdPack();
  }, [leadEmail, sendAdPack]);

  // Log in, land back on this exact kit — the signed-in auto-save effect above
  // then pulls everything into their account.
  const goLogin = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/auth?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(leadEmail.trim())}`;
  }, [leadEmail]);

  // Signed-in users never see the save prompt — as soon as the ad is ready,
  // the kit gets pulled into their account automatically.
  useEffect(() => {
    if (!hasAccount) return;
    if (packState !== "idle") return;
    if (phase !== "ready") return;
    if (!leadEmail.trim() || !images[0]?.base64) return;
    setPackFormOpen(false);
    sendAdPack();
  }, [hasAccount, packState, phase, leadEmail, images, sendAdPack]);


  const brandSlug = (brand?.name || "lumi-ad").trim().replace(/\s+/g, "-").toLowerCase();

  const rotatedLines = useMemo(
    () => [
      "🎨 Loading your palette…",
      "✍️ Writing three hook angles…",
      "🖼️ Rendering your first ad…",
      "✨ Almost there…",
    ],
    [],
  );
  const [tickIdx, setTickIdx] = useState(0);
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => setTickIdx((i) => (i + 1) % rotatedLines.length), 2000);
    return () => clearInterval(t);
  }, [phase, rotatedLines.length]);
  useEffect(() => {
    if (phase === "loading") setStatusLine(rotatedLines[tickIdx]);
  }, [tickIdx, phase, rotatedLines]);

  const callRender = useCallback(async (copy: any): Promise<RenderImage[]> => {
    const colors = engineColorsRef.current;
    // Every label the engine paints onto a chip/card gets a text color derived
    // from what's UNDER it, never from `bg` — that's how white-on-cream copy
    // shipped. Card surface = cream, so headline/body tokens use ink.
    const onAccent = readableTextOn(colors.accent);
    const onCard = readableTextOn(colors.cream);
    const colorsForEngine = {
      ...colors,
      primary: colors.accent, secondary: colors.pop,
      cta: colors.accent, ctaBg: colors.accent, ctaText: onAccent,
      button: colors.accent, buttonBg: colors.accent, buttonText: onAccent,
      badge: colors.accent, badgeBg: colors.accent, badgeText: onAccent,
      // Text tokens — whichever name the engine reaches for, it reads.
      text: onCard, textPrimary: onCard, textSecondary: onCard,
      heading: onCard, headline: onCard, title: onCard, body: onCard,
      subhead: onCard, sub: onCard, eyebrow: colors.accent,
      card: colors.cream, cardBg: colors.cream, cardText: onCard,
      surface: colors.cream, surfaceText: onCard,
      onBg: readableTextOn(colors.bg),
    };
    const brandKit = {
      colors: colorsForEngine,
      palette: colorsForEngine,
      fonts: fontsRef.current,
      logoUrl: logoUrlRef.current,
    };
    const template = templateRef.current;
    const photo = photoUrlRef.current
      ? { url: photoUrlRef.current, removeBackground: false }
      : undefined;
    const body: Record<string, any> = {
      template,
      brandKit,
      copy,
      placements: ["feed"],
      style: {},
    };
    if (photo) body.photo = photo;
    // The big image behind the card must never be the same shot as the little
    // circle portrait. Prefer a real background/texture from their site, then
    // a different photo of theirs, and otherwise fall back to their accent
    // color rather than duplicating the portrait.
    const bgUrl = backgroundUrlRef.current;
    if (bgUrl && bgUrl !== photoUrlRef.current) {
      body.backgroundUrl = bgUrl;
    } else {
      body.style = { ...(body.style || {}), backgroundColor: colors.accent };
      body.backgroundColor = colors.accent;
    }

    // One silent retry — a single flaky render should never become the error
    // screen a first-time visitor (or a demo audience) sees.
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-ad", { body });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        const imgs = ((data as any)?.images || []) as RenderImage[];
        if (!imgs.length) throw new Error("No image returned");
        return imgs;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Render failed");
  }, []);

  const rerenderWith = useCallback(
    async (idx: number) => {
      if (!options[idx]) return;
      setRendering(true);
      setRenderErr(null);
      try {
        const imgs = await callRender(options[idx]);
        setImages(imgs);
      } catch (e: any) {
        setRenderErr(e?.message || "Render failed");
      } finally {
        setRendering(false);
      }
    },
    [options, callRender],
  );

  const updatePaletteColor = (key: keyof EngineColors, value: string) => {
    const next = { ...(palette || engineColorsRef.current), [key]: value };
    setPalette(next);
    engineColorsRef.current = next;
    setPaletteDirty(true);
  };

  const applyPalette = useCallback(async () => {
    if (!palette) return;
    setSavingPalette(true);
    try {
      // Persist first so every later render — the emailed ad pack, post-signup
      // ads, the Style page — uses the user's corrected colors, not just this
      // one preview.
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        const { error: kitErr } = await supabase
          .from("brand_kits" as any)
          .upsert(
            { user_id: userId, brand_id: brandId, colors: palette as any },
            { onConflict: "user_id,brand_id" },
          );
        if (kitErr) console.warn("[payoff-ad] palette persist failed", kitErr);
      }
      setUsedRealColors(true);
      setPaletteDirty(false);
      await rerenderWith(selectedIdx);
    } catch (e: any) {
      console.warn("[payoff-ad] palette apply failed", e);
      toast.error("Couldn't update the colors — try again?");
    } finally {
      setSavingPalette(false);
    }
  }, [palette, brandId, rerenderWith, selectedIdx]);

  // Pin the ad currently on screen as the hand-approved demo result for this
  // brand's domain. Admin-only; the row is what every later visit to that
  // domain reveals instead of a fresh (and possibly weak) render.
  const [pinning, setPinning] = useState(false);
  const pinCurrentAd = useCallback(async () => {
    const domain = normalizeDemoDomain((brand as any)?.website_url);
    if (!domain) {
      toast.error("This brand has no website on file — can't pin it.");
      return;
    }
    if (!images.length) {
      toast.error("Nothing to pin yet.");
      return;
    }
    setPinning(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("demo_pinned_ads" as any).upsert(
        {
          domain,
          label: brand?.name || domain,
          template: templateRef.current,
          copy: options[selectedIdx] || null,
          images: images as any,
          active: true,
          created_by: userRes?.user?.id || null,
        },
        { onConflict: "domain" },
      );
      if (error) throw error;
      pinnedRef.current = { images, copy: options[selectedIdx], template: templateRef.current };
      toast.success(`Pinned as the demo ad for ${domain}`);
    } catch (e: any) {
      console.error("[payoff-ad] pin failed", e);
      toast.error(e?.message || "Couldn't pin this ad");
    } finally {
      setPinning(false);
    }
  }, [brand, images, options, selectedIdx]);

  // Phase B of the build: compose the copy and render the ad. Runs either from
  // the user's "Build my ad" click (with their chosen angle + photo) or straight
  // from boot when angle generation came back empty — so the old auto-build path
  // still exists and nobody gets trapped behind a choice screen with no options.
  // Reads refs, not boot-effect locals, because a click handler can't see those.
  const buildAd = useCallback(async (angle: any | null, photoUrl: string | undefined) => {
    setPhase("building");
    setRenderErr(null);
    try {
      chosenAngleRef.current = angle;
      photoUrlRef.current = photoUrl;
      const offerHint = offerHintRef.current;
      const offerRowFull = offerRowRef.current;
      const userGoal = userGoalRef.current;
      const onboardingGoal = onboardingGoalRef.current;
      const followersIntent = followersIntentRef.current;

      // Template decision happens HERE, not in boot — it depends on whether the
      // user picked a photo. Same priority order as before the choice flow:
      // photo beats checklist beats bigtype.
      templateRef.current = photoUrl
        ? pickPhotoTemplate(brandId)
        : (offerHint || offerRowFull?.url || offerUrlRef.current)
          ? "checklist"
          : "bigtype";
      const template = templateRef.current;

      setStatusLine("✍️ Writing your copy…");
      // A goal-appropriate default CTA — still far better than always
      // "Learn more" even when there's no offerHint, and compose-ad's own
      // prompt (which explicitly matches the CTA to the real offer once
      // offerContext is present) takes precedence over this when it can.
      const ctaByGoal: Record<string, string> = {
        booked_calls: "Book your call",
        leads: "Send it to me",
        sales: "Learn more",
        followers: followersIntent === "dms" ? "DM me" : "Follow me",
      };
      const brief = {
        template,
        format: "single",
        styleHint: template,
        goal: userGoal,
        concept: brand?.value_proposition || "",
        keyMessage: brand?.value_proposition || "",
        offer: offerHint || "",
        cta: ctaByGoal[onboardingGoal || ""] || "Learn more",
        brandName: brand?.name || "",
      };
      const composeRes = await supabase.functions.invoke("compose-ad", {
        body: {
          brief,
          brandVoice: brand?.voice_profile || brand?.brand_voice || {},
          count: 3,
          audiencePsychology: brand?.audience_psychology || null,
          // The chosen angle constrains every option compose-ad writes — this
          // is the whole point of the choice screen. Omitted on the fallback
          // auto path, where compose-ad picks its own angle like it always did.
          angle: angle
            ? {
                name: angle.name,
                description: angle.description,
                psychologyTrigger: angle.psychologyTrigger || angle.psychology_trigger || undefined,
              }
            : undefined,
          // compose-ad reads offer details from `offerContext`, not `brief.offer`
          // (brief.offer was a no-op — always "" before this fix). Only sent
          // when we actually have something, so buildContextBlock's own
          // truthiness check correctly skips it otherwise. The real offers-row
          // fields (name/price/page_goal/url) previously never traveled here —
          // the copy was writing to a description with no idea what it costs
          // or what the page asks people to do.
          offerContext: offerRowFull || offerHint
            ? {
                name: offerRowFull?.name || undefined,
                description: offerHint || offerRowFull?.description || undefined,
                price: offerRowFull?.price_point || undefined,
                type: offerRowFull?.page_goal || undefined,
                url: offerRowFull?.url || undefined,
              }
            : undefined,
          offerPsychology: offerPsychologyRef.current || undefined,
          socialProofContext: socialProofRef.current
            ? { quote: socialProofRef.current.text, attribution: socialProofRef.current.attribution }
            : undefined,
          brandContext: {
            name: brand?.name,
            idealClient: brand?.target_audience || brand?.value_proposition,
            voiceNotes: brand?.voice_profile || brand?.brand_voice,
          },
        },
      });
      if (composeRes.error) throw composeRes.error;
      if ((composeRes.data as any)?.error) throw new Error((composeRes.data as any).error);
      const returned = ((composeRes.data as any)?.options || []) as any[];
      if (!mountedRef.current) return;
      if (!returned.length) throw new Error("No copy options returned");
      setOptions(returned);
      // Default to the strongest option instead of always option 0 — the
      // model returns them unordered and option 0 is often the weakest.
      const bestIdx = bestCopyIndex(template, returned, {
        brandName: brand?.name,
        offerText: offerHint || offerRowFull?.description || undefined,
      });
      setSelectedIdx(bestIdx);

      setStatusLine("🖼️ Rendering your first ad…");
      const imgs = await callRender(returned[bestIdx]);
      if (!mountedRef.current) return;
      liveImagesRef.current = imgs;
      const pinned = pinnedRef.current;
      const reveal = pinned?.images?.length ? pinned.images : imgs;
      setPinnedActive(!!pinned?.images?.length);
      await waitForDecode(reveal[0]);
      if (!mountedRef.current) return;
      setImages(reveal);
      setPhase("ready");
      // Once per brand per browser session — the payoff moment is the
      // key retargeting signal (people who saw their ad and left).
      trackLumiEventOnce(`adgen_${brandId}`, "AdGenerated");
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.error("[payoff-ad] build failed", e);
      // A pinned demo ad exists — never show the error screen on stage.
      if (pinnedRef.current?.images?.length) {
        setPinnedActive(true);
        setImages(pinnedRef.current.images);
        setPhase("ready");
        return;
      }
      setRenderErr(e?.message || "Something didn't line up");
      setPhase("error");
    }
  }, [brandId, brand, callRender]);
  const buildAdRef = useRef(buildAd);
  buildAdRef.current = buildAd;

  // Boot: fetch kit + photo, run recommend-strategy, compose 3 hooks, render first ad
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");

        // 0a) Pinned demo ad for this domain, if one exists. Fetched first so
        // it's in hand before the live run finishes (or fails).
        try {
          const domain = normalizeDemoDomain((brand as any)?.website_url);
          if (domain) {
            const { data: pin } = await supabase
              .from("demo_pinned_ads" as any)
              .select("images, copy, template")
              .eq("domain", domain)
              .eq("active", true)
              .maybeSingle();
            const pinImgs = ((pin as any)?.images || []) as RenderImage[];
            if (!cancelled && Array.isArray(pinImgs) && pinImgs.length) {
              pinnedRef.current = {
                images: pinImgs,
                copy: (pin as any)?.copy || null,
                template: (pin as any)?.template || undefined,
              };
            }
          }
        } catch { /* pinned ads are a safety net, never a gate */ }


        // 0) Instagram avatar for the feed-post mock — kicked off first and
        // never awaited, so the 2–4s scrape/re-host overlaps the whole build
        // and is usually ready by the time they save. Falls back to the logo
        // if there's no handle or the pic can't be fetched.
        if ((brand as any)?.instagram_account_name) {
          supabase.functions
            .invoke("fetch-instagram-avatar", {
              body: { brandId, username: (brand as any).instagram_account_name },
            })
            .then(({ data }) => {
              const url = (data as any)?.url;
              if (url && !cancelled) avatarUrlRef.current = url;
            })
            .catch(() => { /* logo fallback */ });
        }

        // 1) Brand kit. extract-brand runs fire-and-forget back in step 1 and
        // nothing awaits it, so a fast visitor can get here before colors
        // exist — retry for a bit rather than silently rendering the default
        // palette under a caption that claims "your brand colors."
        setStatusLine("🎨 Loading your palette…");
        let kit: any = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 4000));
          if (cancelled) return;
          const { data, error } = await supabase
            .from("brand_kits" as any)
            .select("colors, fonts, logo_url")
            .eq("brand_id", brandId)
            .maybeSingle();
          if (error) {
            console.warn("[payoff-ad] brand_kits fetch failed", error);
            continue;
          }
          kit = data;
          if (hasAnyColors(kit?.colors)) break;
        }
        if (cancelled) return;
        // Extraction can hand back an unusable pair (white ink on white bg, a
        // washed-out accent). guardPalette keeps it on-brand where it can and
        // only falls back where the render would otherwise be unreadable.
        engineColorsRef.current = guardPalette(toEngineColors(kit?.colors));
        fontsRef.current = toFontsPayload(kit?.fonts);
        logoUrlRef.current = kit?.logo_url || undefined;
        setUsedRealColors(hasVividColors(kit?.colors));
        setPalette(engineColorsRef.current);

        // 2) Photo candidates from brand_assets (harvested by harvest-brand-assets).
        // Top 3 by the same role priority as before — the user picks one (or
        // uploads their own, or goes bold-text) instead of us guessing.
        let candidates: { url: string; label?: string }[] = [];
        try {
          const { data: rows } = await supabase
            .from("brand_assets" as any)
            .select("id,url,role,kept")
            .eq("brand_id", brandId)
            .order("created_at", { ascending: false });
          const kept = ((rows || []) as any[]).filter((r) => r.kept !== false);
          const priority = ["full_body", "lifestyle", "photo", "headshot"];
          const ranked: any[] = [];
          for (const p of priority) {
            for (const r of kept) if (r.role === p && !ranked.includes(r)) ranked.push(r);
          }
          for (const r of kept) if (PHOTO_ROLES.has(r.role) && !ranked.includes(r)) ranked.push(r);
          for (const r of ranked.slice(0, 8)) {
            const p = pathFromUrl(r.url);
            if (p) {
              const { data: s } = await supabase.storage
                .from("brand-assets")
                .createSignedUrl(p, 60 * 60);
              candidates.push({ url: s?.signedUrl || r.url });
            } else {
              candidates.push({ url: r.url });
            }
          }
          // Measure before trusting: drop favicons, sprites, tiny thumbnails
          // and extreme banners, then keep the three strongest. When nothing
          // clears the bar we fall through with zero candidates and the build
          // picks a text-forward template instead of framing a bad image.
          const scored = await rankPhotoCandidates(candidates);
          candidates = scored.slice(0, 3).map((s) => ({ url: s.url, label: s.label }));
        } catch {
          /* brand_assets may not exist; keep candidates empty */
        }
        if (cancelled) return;
        setPhotoCandidates(candidates);
        setChosenPhotoIdx(candidates.length ? 0 : -1);
        // The auto path (angle generation unavailable) uses the best candidate,
        // same behavior as before this screen learned to ask.
        const photoUrl: string | undefined = candidates[0]?.url;
        photoUrlRef.current = photoUrl;

        // 3) Goal + offer — read before the template decision below, since a
        // real offer unlocks the checklist template as a text-only option.
        const goalMap: Record<string, string> = {
          booked_calls: "book_calls",
          leads: "get_leads",
          sales: "get_sales",
        };
        const onboardingGoal = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_goal_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_goal ?? null);
        // "followers" isn't one objective — onboarding asks a binary follow-up
        // (more DMs vs. more followers/engagement) so recommend-strategy gets
        // an explicit signal instead of guessing from free text, which is what
        // was silently over-picking a DM strategy for plain free/lead offers.
        const followersIntent = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_followers_intent_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_followers_intent ?? null);
        const userGoal = onboardingGoal === "followers"
          ? (followersIntent === "dms" ? "dm_leads" : "grow_social")
          : (onboardingGoal ? (goalMap[onboardingGoal] || "get_leads") : "get_leads");
        userGoalRef.current = userGoal;
        onboardingGoalRef.current = onboardingGoal;
        followersIntentRef.current = followersIntent;

        // A real `offers` row created from onboarding's "give us a link"
        // question (booked_calls/leads/sales goals) — extract-offer-info
        // already read the real page into it (name/description/price_point/
        // page_goal). Passing its id lets recommend-strategy detect the
        // objective from that real data instead of guessing from free text.
        const offerId: string | null = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_id_${brandId}`)
          : null) || null;

        // An optional link to the actual sales/webinar/opt-in page — when given,
        // generate-offer-psychology reads the real page instead of just the
        // hand-typed hint, the same lever generate-audience-psychology uses
        // against the main site.
        const offerUrl: string = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_url_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_offer_url ?? "");
        offerUrlRef.current = offerUrl;

        // The real offer's description grounds the copy — the modern
        // replacement for the old free-text "what do they get" hint, which no
        // longer exists as an onboarding question now that a link is required
        // instead. Falls back to the legacy hint for any session already in
        // flight when this shipped.
        let offerDescription = "";
        let offerRowFull: any = null;
        if (offerId) {
          try {
            const { data: offerRow } = await supabase
              .from("offers")
              .select("name, description, price_point, page_goal, url")
              .eq("id", offerId)
              .maybeSingle();
            offerRowFull = offerRow || null;
            offerDescription = offerRow?.description || "";
          } catch { /* best-effort */ }
        }
        const offerHint: string = offerDescription || ((typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_hint_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_offer_hint ?? ""));
        offerHintRef.current = offerHint;

        // Pick the strongest template this specific brand can support, instead of
        // always defaulting to the same one:
        //   1) A strong photo of them/their work — faces convert better than text
        //      alone, and read more premium than a text-on-color testimonial card.
        //   2) A real offer to list out — checklist beats a bare headline.
        //   3) Otherwise, bold text-only copy — no invented props or stock-feeling photos.
        // Deliberately NOT auto-selecting the testimonial template here even when a
        // real quote exists — Ashley's call, it doesn't read premium enough for the
        // first ad someone sees. The quote itself is still pulled below and fed into
        // the copywriting step (socialProofContext), so it can still ground the
        // headline/body — it just isn't the visual layout anymore.
        const testimonials = getTestimonialQuotes(brand?.social_proof);
        socialProofRef.current = testimonials[0] || null;
        // Template decision moved into buildAd — it depends on the PHOTO the
        // user picks, which hasn't happened yet at this point in the flow.

        // 4) Ground the copy in this specific offer, not just an abstract goal —
        // run alongside strategy recommendation since neither depends on the other.
        // Cached server-side per offer hint, so re-renders ("show me another")
        // and later steps (the b-roll script) don't re-spend AI credits on it.
        setStatusLine("🧠 Picking your best angle…");
        const [strategyResult, offerPsychologyResult] = await Promise.allSettled([
          supabase.functions.invoke("recommend-strategy", {
            body: { brand_id: brandId, offer_id: offerId, user_goal: userGoal, offer_hint: offerHint || undefined },
          }),
          offerHint || offerUrl
            ? supabase.functions.invoke("generate-offer-psychology", {
                body: { brand_id: brandId, offer_hint: offerHint || undefined, offer_url: offerUrl || undefined, user_goal: userGoal },
              })
            : Promise.resolve(null),
        ]);
        let strategyLocal: any = null;
        if (!cancelled && strategyResult.status === "fulfilled" && strategyResult.value) {
          const recData = strategyResult.value.data;
          const s = (recData as any)?.strategy ?? recData ?? null;
          if (s && !((recData as any)?.pending)) { setStrategy(s); strategyLocal = s; }
        }
        if (offerPsychologyResult.status === "fulfilled" && offerPsychologyResult.value) {
          offerPsychologyRef.current = (offerPsychologyResult.value.data as any)?.offer_psychology || null;
        }
        offerRowRef.current = offerRowFull;

        // 5) Three angles for the user to choose from — generate-creative-angles
        // is the same engine Creative Studio uses (copywriting frameworks +
        // awareness levels), grounded in the audience + offer psychology that
        // just resolved. The user picking the angle beats us guessing: they know
        // which conversation their buyers are actually having.
        setStatusLine("🧠 Finding your three strongest angles…");
        let generatedAngles: any[] = [];
        try {
          const objectiveByGoal: Record<string, string> = {
            get_sales: "sales",
            get_leads: "leads",
            book_calls: "leads",
            dm_leads: "engagement",
            grow_social: "awareness",
          };
          const { data: angleData, error: angleErr } = await supabase.functions.invoke(
            "generate-creative-angles",
            {
              body: {
                brandId,
                offerId: offerId || undefined,
                brandName: brand?.name || "",
                audiencePsychology: brand?.audience_psychology || null,
                offerAudiencePsychology: offerPsychologyRef.current || undefined,
                offerData: offerRowFull || (offerHint ? { description: offerHint } : undefined),
                strategyData: strategyLocal || undefined,
                maxAngles: 3,
                campaignObjective: objectiveByGoal[userGoal] || "leads",
              },
            },
          );
          if (!angleErr && !(angleData as any)?.error) {
            generatedAngles = (((angleData as any)?.angles || []) as any[]).slice(0, 3);
          }
        } catch {
          /* fall through to the auto build — angles are an upgrade, not a gate */
        }
        if (cancelled) return;

        if (generatedAngles.length >= 2) {
          setAngles(generatedAngles);
          setChosenAngleIdx(0);
          setPhase("choosing");
          return; // the user's "Build my ad" click calls buildAd from here
        }

        // Angle generation unavailable or too thin to be a real choice —
        // auto-build exactly like the pre-choice flow did.
        await buildAdRef.current(null, photoUrlRef.current);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[payoff-ad] boot failed", e);
        setRenderErr(e?.message || "Something didn't line up");
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // Pick a stock clip whose categories best match the script's beats and burn
  // the beats in as timed captions, looping the clip to cover the full script.
  const assembleBrollVideo = useCallback(async (beats: ScriptBeat[]) => {
    setVideoState("loading");
    try {
      const { data: rows, error } = await supabase
        .from("stock_broll_clips" as any)
        .select("video_url, categories, credit_name, credit_url")
        .limit(200);
      if (error) throw error;
      const pool = (rows as any[]) || [];
      if (!pool.length) {
        setVideoState("idle");
        return;
      }

      const tally: Record<string, number> = {};
      for (const b of beats) tally[b.category] = (tally[b.category] || 0) + 1;
      const rankedCategories = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
      let clip: any = null;
      for (const cat of [...rankedCategories, "misc"]) {
        clip = pool.find((c) => Array.isArray(c.categories) && c.categories.includes(cat));
        if (clip) break;
      }
      if (!clip) clip = pool[0];

      const { data: signed } = await supabase.storage
        .from("stock-broll")
        .createSignedUrl(clip.video_url, 60 * 30);
      const clipUrl = signed?.signedUrl;
      if (!clipUrl) throw new Error("Could not sign stock clip URL");

      let t = 0;
      const overlays: RenderOverlay[] = beats.map((b, i) => {
        const startSeconds = t;
        const endSeconds = t + b.seconds;
        t = endSeconds;
        const type: RenderOverlay["type"] = i === 0 ? "hook" : i === beats.length - 1 ? "cta" : undefined;
        return { text: b.line, startSeconds, endSeconds, type };
      });

      const { renderVideoWithText, DEFAULT_RENDER_STYLE } = await import("@/lib/ffmpeg-renderer");
      const blob = await renderVideoWithText({
        videoUrl: clipUrl,
        overlays,
        style: DEFAULT_RENDER_STYLE,
        loopVideo: true,
      });
      videoBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setVideoCredit(clip.credit_name ? { name: clip.credit_name, url: clip.credit_url || null } : null);
      setVideoState("ready");
      // Read by Auth.tsx right after signup completes, to nudge them toward
      // swapping this stock footage for their own once they have an account.
      try {
        if (typeof window !== "undefined" && brandId) {
          localStorage.setItem(`lumi_onboarding_broll_ready_${brandId}`, "1");
        }
      } catch { /* localStorage unavailable — non-fatal, just skip the nudge */ }
    } catch (e) {
      console.error("[payoff-ad] b-roll video assembly failed", e);
      setVideoState("error");
    }
  }, [brandId]);

  // Upload the finished video into the lead's Ad Kit. The kit email never
  // waits for this slow asset — whichever finishes second (the video render
  // or the email capture) triggers the upload, and the kit page simply shows
  // the video from then on.
  const persistKitVideo = useCallback(async () => {
    const blob = videoBlobRef.current;
    if (!blob || kitVideoUploadedRef.current || packState !== "sent") return;
    kitVideoUploadedRef.current = true;
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return;
      const path = `${userId}/${brandId}/ad-kit-video-${Date.now()}.mp4`;
      const { error: upErr } = await supabase.storage
        .from("lead-magnet-assets")
        .upload(path, blob, { cacheControl: "3600", upsert: true, contentType: "video/mp4" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("lead-magnet-assets").getPublicUrl(path);
      // Merge, don't overwrite — ad_kit already holds copy/script/strategy
      // from the capture write. Single writer in practice (this tab).
      const { data: row } = await supabase.from("brands").select("ad_kit").eq("id", brandId).maybeSingle();
      const merged = { ...(((row as any)?.ad_kit as Record<string, any>) || {}), videoUrl: pub.publicUrl };
      const { error: patchErr } = await supabase.from("brands").update({ ad_kit: merged as any }).eq("id", brandId);
      if (patchErr) throw patchErr;
    } catch (e) {
      kitVideoUploadedRef.current = false; // allow the next trigger to retry
      console.warn("[payoff-ad] kit video persist failed", e);
    }
  }, [brandId, packState]);

  useEffect(() => {
    if (videoState === "ready" && packState === "sent") persistKitVideo();
  }, [videoState, packState, persistKitVideo]);

  const generateBonusCreatives = useCallback(async () => {
    setScriptState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-script", {
        body: {
          brand_id: brandId,
          user_goal: userGoalRef.current,
          offer_hint: offerHintRef.current || undefined,
          offer_psychology: offerPsychologyRef.current || undefined,
        },
      });
      if (error) throw error;
      const beats = (data as any)?.beats as ScriptBeat[] | undefined;
      if (!Array.isArray(beats) || !beats.length) throw new Error("No script beats returned");
      setScriptBeats(beats);
      setScriptState("ready");
      assembleBrollVideo(beats);
    } catch (e) {
      console.error("[payoff-ad] script generation failed", e);
      setScriptState("error");
    }
  }, [brandId, assembleBrollVideo]);

  // Fires once, right after the main ad is ready — never blocks or delays it.
  useEffect(() => {
    if (phase !== "ready" || bonusStartedRef.current) return;
    bonusStartedRef.current = true;
    generateBonusCreatives();
  }, [phase, generateBonusCreatives]);

  const downloadScript = () => {
    if (!scriptBeats) return;
    const text = scriptBeats.map((b) => b.line).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brandSlug}-talking-head-script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showAnother = async () => {
    if (!options.length) return;
    const next = (selectedIdx + 1) % options.length;
    setSelectedIdx(next);
    await rerenderWith(next);
  };

  const pickHook = async (idx: number) => {
    if (idx === selectedIdx) return;
    setSelectedIdx(idx);
    await rerenderWith(idx);
  };

  // Upload a photo from the choice screen. Same storage path + brand_assets
  // row as BrandImageLibrary, so re-runs and post-signup renders see it too —
  // the upload becomes a permanent brand asset, not a one-off.
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadChoicePhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingPhoto(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${brandId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      // Store the public-style URL like BrandImageLibrary does — the boot's
      // candidate loader derives the storage path back out of it to re-sign.
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      await supabase
        .from("brand_assets" as any)
        .insert({ user_id: userId, brand_id: brandId, url: pub.publicUrl, source_url: null, role: "photo" });
      // Render with a signed URL — the bucket is private for anonymous sessions.
      const { data: s } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60);
      if (!s?.signedUrl) throw new Error("Couldn't read the upload back");
      setPhotoCandidates((prev) => {
        const next = [{ url: s.signedUrl, label: "Your upload" }, ...prev].slice(0, 4);
        return next;
      });
      setChosenPhotoIdx(0);
    } catch (e: any) {
      console.warn("[payoff-ad] photo upload failed", e);
      toast.error(e?.message || "Upload didn't take — try another photo?");
    } finally {
      setUploadingPhoto(false);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
    }
  };

  const confirmChoices = () => {
    const angle = chosenAngleIdx !== null ? angles[chosenAngleIdx] || null : null;
    const photoUrl = chosenPhotoIdx >= 0 ? photoCandidates[chosenPhotoIdx]?.url : undefined;
    void buildAd(angle, photoUrl);
  };

  const template = templateRef.current;
  const heroImage = images[0];

  // The buyer-psychology reveal — the moment that sells (seeing their own buyer
  // described better than they could). Same shared component the kit page uses.
  const buyerIdealClient = useMemo(() => {
    const ap = (brand?.audience_psychology as any) || {};
    return (
      (typeof ap.target_audience === "string" && ap.target_audience) ||
      (typeof ap.ideal_client === "string" && ap.ideal_client) ||
      (brand as any)?.target_audience ||
      ""
    );
  }, [brand]);

  const annotations = useMemo(
    () =>
      computeCopyAnnotations(
        options[selectedIdx],
        brand?.audience_psychology,
        brand?.voice_profile || brand?.brand_voice,
      ),
    [options, selectedIdx, brand],
  );

  // The progress rail is a status, not decoration — visible only while
  // something is genuinely still cooking, gone the moment everything's done.
  const railVisible =
    phase === "building" ||
    (phase === "ready" && (scriptState === "loading" || videoState === "loading"));

  return (
    <div className="min-h-[70vh] py-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3 animate-fade-in">
          <div className="inline-block">
            <img src={lumiLogo} alt="Lumi" className="h-7 object-contain mx-auto" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            {phase === "ready" ? (
              <>Meet your first ad.</>
            ) : phase === "choosing" ? (
              <>Pick your angle.</>
            ) : phase === "error" ? (
              <>Almost — one more try?</>
            ) : (
              <>Making you an ad, live.</>
            )}
          </h1>
          <div className="min-h-[24px] text-sm text-muted-foreground">
            {phase === "loading" || phase === "building" ? (
              <span className="inline-flex items-center gap-2 animate-fade-in">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {statusLine}
              </span>
            ) : phase === "choosing" ? (
              <span className="animate-fade-in">
                Three ways into your buyer's head — you know them best.
              </span>
            ) : phase === "ready" ? (
              <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                <span>
                  {usedRealColors ? (
                    <>
                      Rendered in {brand?.name || "your"} brand colors
                      {photoUrlRef.current ? ", with your photo" : ""}.
                    </>
                  ) : (
                    <>These aren't quite your colors? Tap a dot to fix them —</>
                  )}
                </span>
                {palette && (
                  <span className="inline-flex items-center gap-1.5 align-middle">
                    {(["accent", "pop", "highlight", "bg"] as (keyof EngineColors)[]).map((k) => (
                      <label
                        key={k}
                        className="h-6 w-6 rounded-full border border-border shadow-sm cursor-pointer relative inline-block hover:scale-110 transition-transform"
                        style={{ backgroundColor: palette[k] }}
                        title={k === "bg" ? "Background color" : `${k.charAt(0).toUpperCase() + k.slice(1)} color`}
                      >
                        <input
                          type="color"
                          value={palette[k]}
                          onChange={(e) => updatePaletteColor(k, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label={k === "bg" ? "Change background color" : `Change ${k} color`}
                        />
                      </label>
                    ))}
                    {paletteDirty && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={applyPalette}
                        disabled={savingPalette || rendering}
                        className="h-7 text-xs ml-1"
                      >
                        {savingPalette || rendering ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Update my ad
                      </Button>
                    )}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-destructive">{renderErr || "Something didn't line up."}</span>
            )}
          </div>
        </div>

        {/* Progress rail: the kit assembling itself, one piece at a time */}
        {railVisible && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground animate-fade-in">
            <RailItem label="plan" done={!!strategy} active={!strategy} />
            <RailItem label="copy" done={options.length > 0} active={phase === "building" && !options.length} />
            <RailItem label="graphic" done={images.length > 0} active={phase === "building" && options.length > 0 && !images.length} />
            <RailItem label="script" done={scriptState === "ready"} active={scriptState === "loading"} />
            <RailItem label="b-roll" done={videoState === "ready"} active={videoState === "loading"} />
          </div>
        )}

        {/* Choose your angle + photo — the build waits on this. The user knows
            which conversation their buyers are having better than we do. */}
        {phase === "choosing" && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-3xl border bg-card shadow-sm p-4 sm:p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                The angle
              </div>
              <div className="grid gap-2">
                {angles.map((a, i) => {
                  const active = i === chosenAngleIdx;
                  const trig = parseAngleTrigger(a.psychologyTrigger || a.psychology_trigger);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setChosenAngleIdx(i)}
                      className={
                        "text-left rounded-2xl border p-4 transition " +
                        (active
                          ? "border-transparent ring-2 ring-pink-500/70 bg-muted/40 shadow-sm"
                          : "border-border hover:bg-muted/40")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{a.name}</div>
                          {a.description && (
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">
                              {a.description}
                            </p>
                          )}
                        </div>
                        {active && <Check className="h-4 w-4 shrink-0 text-pink-500 mt-0.5" />}
                      </div>
                      {trig && (
                        <div className="mt-2.5 flex items-start gap-2">
                          <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {trig.label}
                          </span>
                          {trig.insight && (
                            <p className="text-xs italic text-muted-foreground leading-snug">
                              “{trig.insight}”
                            </p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border bg-card shadow-sm p-4 sm:p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                The visual
              </div>
              <div className="flex flex-wrap gap-3">
                {photoCandidates.map((c, i) => {
                  const active = chosenPhotoIdx === i;
                  return (
                    <button
                      key={`${i}-${c.url}`}
                      type="button"
                      onClick={() => setChosenPhotoIdx(i)}
                      className={
                        "relative h-24 w-24 rounded-2xl overflow-hidden border transition " +
                        (active ? "ring-2 ring-pink-500/70 border-transparent" : "border-border hover:opacity-90")
                      }
                    >
                      <img
                        src={c.url}
                        alt={c.label || `Photo option ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {active && (
                        <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-pink-500 text-white flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => uploadFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="h-24 w-24 rounded-2xl border border-dashed border-border hover:bg-muted/40 transition flex flex-col items-center justify-center gap-1 text-muted-foreground"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  <span className="text-[10px] font-medium">Upload</span>
                </button>
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadChoicePhoto(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => setChosenPhotoIdx(-1)}
                  className={
                    "h-24 w-24 rounded-2xl border transition flex flex-col items-center justify-center gap-1 " +
                    (chosenPhotoIdx === -1
                      ? "ring-2 ring-pink-500/70 border-transparent bg-muted/40 text-foreground"
                      : "border-border hover:bg-muted/40 text-muted-foreground")
                  }
                >
                  <Type className="h-5 w-5" />
                  <span className="text-[10px] font-medium">Bold text</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {photoCandidates.length
                  ? "Photos pulled from your site — or upload your own, or go bold text-only."
                  : "Upload a photo of you or your work — or go bold text-only. Both convert."}
              </p>
            </div>

            <Button
              onClick={confirmChoices}
              disabled={chosenAngleIdx === null || uploadingPhoto}
              className="w-full h-12 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20 disabled:opacity-60"
            >
              Build my ad <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Ad hero */}
        {phase !== "choosing" && (
        <div className="rounded-3xl border bg-card shadow-sm p-4 sm:p-6">
          <div
            className="relative mx-auto rounded-2xl overflow-hidden bg-muted"
            style={{ maxWidth: 460, aspectRatio: "1 / 1" }}
          >
            {rendering && (
              <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Rendering…
                </div>
              </div>
            )}
            {heroImage ? (
              <img
                src={`data:image/png;base64,${heroImage.base64}`}
                alt="Your first ad"
                className="w-full h-full object-contain animate-fade-in"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {phase === "loading" || phase === "building" ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {renderErr || "No preview yet"}
                  </span>
                )}
              </div>
            )}
          </div>

          {heroImage && phase === "ready" && (
            <div className="mt-3 flex justify-center">
              <a
                href={`data:image/png;base64,${heroImage.base64}`}
                download={`${brandSlug}-ad.png`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                <Download className="h-3.5 w-3.5" /> Download this graphic
              </a>
            </div>
          )}

          {/* Demo controls — admins only, invisible to every real visitor. */}
          {isAdminViewer && phase === "ready" && (
            <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5">
                {pinnedActive ? "Showing pinned demo ad" : "Showing live render"}
              </span>
              {pinnedRef.current?.images?.length && liveImagesRef.current.length ? (
                <span className="opacity-70">press D to switch</span>
              ) : null}
              <button
                type="button"
                onClick={pinCurrentAd}
                disabled={pinning}
                className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                {pinning ? "Pinning…" : "Pin this ad for demos"}
              </button>
            </div>
          )}

          {/* Hook chips */}
          {options.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Tap a hook to try it on
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map((opt, i) => {
                  const label = optionToHeadline(template, opt) || `Option ${i + 1}`;
                  const active = i === selectedIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => pickHook(i)}
                      disabled={rendering}
                      className={
                        "text-left px-3 py-1.5 rounded-full text-xs font-medium border transition " +
                        (active
                          ? "bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white border-transparent shadow-sm"
                          : "bg-background hover:bg-muted/60 text-foreground border-border")
                      }
                      title={label}
                    >
                      <span className="line-clamp-1 max-w-[280px] inline-block align-middle">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Why this copy works — rule-based, checkable against the copy on
              screen. Teaches the craft while proving the copy isn't generic. */}
          {phase === "ready" && annotations.length > 0 && (
            <div className="mt-5 space-y-2 animate-fade-in">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Why this copy works
              </div>
              <div className="grid gap-1.5">
                {annotations.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium">{a.label}.</span>{" "}
                      <span className="text-muted-foreground">{a.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Who your buyer is — shown right after they meet their ad, before the
            plan. This is the selling moment: their buyer, described better than
            they'd describe it themselves. Same component as the kit page;
            rendered bare (it brings its own cards) with a little breathing room. */}
        {phase === "ready" && (
          <div className="pt-2 animate-fade-in">
            <BuyerPsychology idealClient={buyerIdealClient || undefined} ap={brand?.audience_psychology} />
          </div>
        )}

        {/* Game plan strip (shared ad-kit component, compact variant) */}
        {strategy && <GamePlanCard strategy={strategy} variant="compact" />}

        {/* Bonus creatives: talking-head script + b-roll ad, ready without an
            account. Their in-flight status lives on the progress rail above. */}
        {scriptState === "ready" && scriptBeats && (
          <ScriptBlock beats={scriptBeats} variant="compact" onDownload={downloadScript} />
        )}

        {videoState === "ready" && videoUrl && (
          <BrollBlock
            videoUrl={videoUrl}
            credit={videoCredit}
            downloadName={`${brandSlug}-broll-ad.mp4`}
            variant="compact"
          />
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={onBack} className="sm:w-auto">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {phase !== "choosing" && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Button
              variant="outline"
              onClick={showAnother}
              disabled={rendering || options.length < 2}
              className="h-11 rounded-xl"
            >
              <RefreshCw className={"h-4 w-4 mr-2 " + (rendering ? "animate-spin" : "")} />
              Show me another
            </Button>
            {packState === "sent" ? (
              <span className="inline-flex items-center justify-center gap-1.5 h-12 px-4 text-sm font-medium text-primary">
                <Check className="h-4 w-4" />
                {hasAccount ? "Saved to your account" : `Saved — link emailed to ${leadEmail}`}
              </span>
            ) : hasAccount ? (
              <span className="inline-flex items-center justify-center gap-1.5 h-12 px-4 text-sm font-medium text-muted-foreground">
                {packState === "sending" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Adding to your account…</>
                ) : (
                  "Saving to your account…"
                )}
              </span>
            ) : (
              <Button
                onClick={() => setPackFormOpen(true)}
                disabled={phase !== "ready"}
                className="h-12 px-6 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Save my Ad Kit <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            )}

          </div>
          )}
        </div>

        {/* The 50% offer now lives inside the save dialog, right after the kit
            is sent — no competing text link out here. */}


        {/* Saved → the close unfolds right here. No redirect, no re-reveal. */}
        {packState === "sent" && <VslCloseSection brandId={brandId} firstName={leadName.trim().split(" ")[0] || null} />}

        {phase === "error" && (
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImages([]);
                setOptions([]);
                setRenderErr(null);
                setPhase("loading");
                // Re-trigger boot via key reset — easier: reload the mount by calling rerenderWith after a small delay
                // Simplest here: full page reload of this section by asking user to advance manually.
                toast.message("Try again by tapping Show me another once things load.");
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {/* Save dialog — three steps: email → (log in) or (sent + 50% off). */}
        <Dialog open={packFormOpen && !hasAccount} onOpenChange={setPackFormOpen}>
          <DialogContent className="sm:max-w-md">
            {packStep === "email" && (
              <>
                <DialogHeader>
                  <DialogTitle>Save my Ad Kit</DialogTitle>
                  <DialogDescription>
                    Drop your email — if you already have a LUMI account we'll pull this kit
                    straight in. If not, we'll send you your private link.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Your name"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    className="h-10 text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="you@email.com"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    className="h-10 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && packState !== "sending" && !checkingAccount) {
                        handleSaveSubmit();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSaveSubmit}
                    disabled={packState === "sending" || checkingAccount}
                    className="h-11 rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity"
                  >
                    {packState === "sending" || checkingAccount ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                    ) : (
                      <><Mail className="h-4 w-4 mr-2" /> Save my Ad Kit</>
                    )}
                  </Button>
                </div>
              </>
            )}

            {packStep === "login" && (
              <>
                <DialogHeader>
                  <DialogTitle>You already have a LUMI account 💜</DialogTitle>
                  <DialogDescription>
                    Log in with {leadEmail.trim()} and we'll drop this whole Ad Kit into your
                    account as a new campaign — copy, script, creative and all.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={goLogin}
                    className="h-11 rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity"
                  >
                    Log in & save to my account <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 text-sm"
                    onClick={() => setPackStep("email")}
                  >
                    Use a different email
                  </Button>
                </div>
              </>
            )}

            {packStep === "offer" && (
              <>
                <DialogHeader>
                  <DialogTitle>Your Ad Kit is on its way ✨</DialogTitle>
                  <DialogDescription>
                    We just emailed your private link to {leadEmail.trim()}. Ready to actually
                    launch it? Get 50% off your first month and we'll build it with you.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={goCheckout}
                    disabled={checkoutLoading}
                    className="h-11 rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity"
                  >
                    {checkoutLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening checkout…</>
                    ) : (
                      <>Get 50% off my first month <ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 text-sm"
                    onClick={() => setPackFormOpen(false)}
                  >
                    Maybe later — keep browsing my kit
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
