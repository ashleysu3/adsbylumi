import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, RefreshCw, Sparkles, ChevronLeft, Target, Download, Mic, Film, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import type { RenderOverlay } from "@/lib/ffmpeg-renderer";
import { getTestimonialQuotes, type TestimonialQuote } from "@/lib/social-proof";
import lumiLogo from "@/assets/lumi-logo.png";

type ScriptBeat = { line: string; category: string; seconds: number };

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
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [statusLine, setStatusLine] = useState<string>("Reading your brand kit…");
  const [images, setImages] = useState<RenderImage[]>([]);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Lead-magnet path: email this ad pack instead of (or before) paying.
  const [packFormOpen, setPackFormOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [packState, setPackState] = useState<"idle" | "sending" | "sent" | "error">("idle");

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

      // lead-magnet-assets (not brand-assets, which isn't a public bucket —
      // an email client has no Supabase session, so a private-bucket URL
      // would never load). RLS requires the uploader's own uid as the
      // first path segment (see BrandImageLibrary.tsx's identical
      // convention for brand-assets) — brandId alone isn't enough.
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw new Error("Not signed in");
      const path = `${userId}/${brandId}/ad-pack-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("lead-magnet-assets")
        .upload(path, blob, { cacheControl: "3600", upsert: true, contentType: "image/png" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("lead-magnet-assets").getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("brands")
        .update({
          lead_email: leadEmail.trim(),
          lead_name: leadName.trim() || null,
          ad_pack_image_url: pub.publicUrl,
        })
        .eq("id", brandId);
      if (updateErr) throw updateErr;

      const { error: sendErr } = await supabase.functions.invoke("send-ad-pack-email", {
        body: { brand_id: brandId },
      });
      if (sendErr) throw sendErr;

      setPackState("sent");
      toast.success("Check your inbox — your ad pack is on its way!");
    } catch (err: any) {
      console.error("[payoff] send ad pack error", err);
      toast.error(err?.message || "Couldn't send your ad pack. Please try again.");
      setPackState("error");
    }
  }, [brandId, images, leadEmail, leadName, packState]);

  const startTrialCheckout = useCallback(async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      // After Stripe returns to /auth?paid=true, sign-up upgrades the anonymous
      // user in place (keeping this brand + ad), then routes to /launch so they
      // can push the ad they just built live.
      const returnTo = `/launch?brand=${brandId}`;
      let rewardful_referral = "";
      try {
        if ((window as any).rewardful) {
          rewardful_referral = await Promise.race([
            new Promise<string>((resolve) => {
              (window as any).rewardful("ready", function () {
                resolve((window as any).Rewardful?.referral || "");
              });
            }),
            new Promise<string>((resolve) => setTimeout(() => resolve(""), 2500)),
          ]);
        }
      } catch { /* ignore */ }

      const { data, error } = await supabase.functions.invoke("create-guest-checkout", {
        body: {
          priceId: SUBSCRIPTION_TIERS.solo.monthlyPriceId,
          rewardful_referral,
          returnTo,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Checkout didn't return a URL");
      }
    } catch (err: any) {
      console.error("[payoff] checkout error", err);
      toast.error("Could not start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  }, [brandId, checkoutLoading]);

  // Prepared inputs
  const engineColorsRef = useRef<EngineColors>(DEFAULT_ENGINE_COLORS);
  const fontsRef = useRef<{ displayFamily?: string; bodyFamily?: string }>({});
  const logoUrlRef = useRef<string | undefined>(undefined);
  const photoUrlRef = useRef<string | undefined>(undefined);
  const templateRef = useRef<"testimonial" | PhotoTemplate | "checklist" | "bigtype">("bigtype");
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
  const bonusStartedRef = useRef(false);
  const [scriptBeats, setScriptBeats] = useState<ScriptBeat[] | null>(null);
  const [scriptState, setScriptState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [videoState, setVideoState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoCredit, setVideoCredit] = useState<{ name: string; url: string | null } | null>(null);

  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);

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
    const colorsForEngine = {
      ...colors,
      primary: colors.accent, secondary: colors.pop,
      cta: colors.accent, ctaBg: colors.accent, ctaText: colors.bg,
      button: colors.accent, buttonBg: colors.accent, buttonText: colors.bg,
      badge: colors.accent, badgeBg: colors.accent, badgeText: colors.bg,
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
    const { data, error } = await supabase.functions.invoke("generate-ad", { body });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return ((data as any)?.images || []) as RenderImage[];
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

  // Boot: fetch kit + photo, run recommend-strategy, compose 3 hooks, render first ad
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");

        // 1) Brand kit
        setStatusLine("🎨 Loading your palette…");
        const { data: kit } = await supabase
          .from("brand_kits" as any)
          .select("colors, fonts, logo_url")
          .eq("brand_id", brandId)
          .maybeSingle();
        engineColorsRef.current = toEngineColors((kit as any)?.colors);
        fontsRef.current = toFontsPayload((kit as any)?.fonts);
        logoUrlRef.current = (kit as any)?.logo_url || undefined;

        // 2) Photo pick from brand_assets (harvested by harvest-brand-assets)
        let photoUrl: string | undefined;
        try {
          const { data: rows } = await supabase
            .from("brand_assets" as any)
            .select("id,url,role,kept")
            .eq("brand_id", brandId)
            .order("created_at", { ascending: false });
          const kept = ((rows || []) as any[]).filter((r) => r.kept !== false);
          // Priority: full_body, lifestyle, photo, headshot, then anything image-like left.
          const priority = ["full_body", "lifestyle", "photo", "headshot"];
          let chosen: any = null;
          for (const p of priority) {
            chosen = kept.find((r) => r.role === p);
            if (chosen) break;
          }
          if (!chosen) chosen = kept.find((r) => PHOTO_ROLES.has(r.role));
          if (chosen) {
            const p = pathFromUrl(chosen.url);
            if (p) {
              const { data: s } = await supabase.storage
                .from("brand-assets")
                .createSignedUrl(p, 60 * 60);
              photoUrl = s?.signedUrl || chosen.url;
            } else {
              photoUrl = chosen.url;
            }
          }
        } catch {
          /* brand_assets may not exist; keep photoUrl undefined */
        }
        photoUrlRef.current = photoUrl;

        // 3) Goal + offer hint — read before the template decision below, since
        // a real offer hint unlocks the checklist template as a text-only option.
        const goalMap: Record<string, string> = {
          booked_calls: "book_calls",
          leads: "get_leads",
          sales: "get_sales",
          followers: "grow_audience",
        };
        const onboardingGoal = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_goal_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_goal ?? null);
        const userGoal = onboardingGoal ? (goalMap[onboardingGoal] || "get_leads") : "get_leads";
        userGoalRef.current = userGoal;

        // The user's own words on what actually happens when someone clicks —
        // collected on the reveal step (see OFFER_HINT_COPY in
        // GuidedOnboarding.tsx). Without this, there's no `offers` row yet
        // (that step comes AFTER the ad in the old flow) and both
        // recommend-strategy and compose-ad had nothing but an abstract goal
        // to work with, which is what produced generic, CTA-less copy.
        const offerHint: string = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_hint_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_offer_hint ?? "");
        offerHintRef.current = offerHint;

        // An optional link to the actual sales/webinar/opt-in page — when given,
        // generate-offer-psychology reads the real page instead of just the
        // hand-typed hint, the same lever generate-audience-psychology uses
        // against the main site.
        const offerUrl: string = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_url_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_offer_url ?? "");

        // Pick the strongest template this specific brand can support, instead of
        // always defaulting to the same one:
        //   1) A real testimonial from their own site — social proof beats everything.
        //   2) A strong photo of them/their work — faces convert better than text alone.
        //   3) A real offer to list out — checklist beats a bare headline.
        //   4) Otherwise, bold text-only copy — no invented props or stock-feeling photos.
        const testimonials = getTestimonialQuotes(brand?.social_proof);
        socialProofRef.current = testimonials[0] || null;
        templateRef.current = socialProofRef.current
          ? "testimonial"
          : photoUrl
            ? pickPhotoTemplate(brandId)
            : offerHint
              ? "checklist"
              : "bigtype";

        // 4) Ground the copy in this specific offer, not just an abstract goal —
        // run alongside strategy recommendation since neither depends on the other.
        // Cached server-side per offer hint, so re-renders ("show me another")
        // and later steps (the b-roll script) don't re-spend AI credits on it.
        setStatusLine("🧠 Picking your best angle…");
        const [strategyResult, offerPsychologyResult] = await Promise.allSettled([
          supabase.functions.invoke("recommend-strategy", {
            body: { brand_id: brandId, offer_id: null, user_goal: userGoal, offer_hint: offerHint || undefined },
          }),
          offerHint || offerUrl
            ? supabase.functions.invoke("generate-offer-psychology", {
                body: { brand_id: brandId, offer_hint: offerHint || undefined, offer_url: offerUrl || undefined, user_goal: userGoal },
              })
            : Promise.resolve(null),
        ]);
        if (!cancelled && strategyResult.status === "fulfilled" && strategyResult.value) {
          const recData = strategyResult.value.data;
          const s = (recData as any)?.strategy ?? recData ?? null;
          if (s && !((recData as any)?.pending)) setStrategy(s);
        }
        if (offerPsychologyResult.status === "fulfilled" && offerPsychologyResult.value) {
          offerPsychologyRef.current = (offerPsychologyResult.value.data as any)?.offer_psychology || null;
        }

        // 5) Compose 3 hook options
        setStatusLine("✍️ Writing three hook angles…");
        const template = templateRef.current;
        // A goal-appropriate default CTA — still far better than always
        // "Learn more" even when there's no offerHint, and compose-ad's own
        // prompt (which explicitly matches the CTA to the real offer once
        // offerContext is present) takes precedence over this when it can.
        const ctaByGoal: Record<string, string> = {
          booked_calls: "Book your call",
          leads: "Send it to me",
          sales: "Learn more",
          followers: "DM me",
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
            // compose-ad reads offer details from `offerContext`, not `brief.offer`
            // (brief.offer was a no-op — always "" before this fix). Only sent
            // when we actually have something, so buildContextBlock's own
            // truthiness check correctly skips it otherwise.
            offerContext: offerHint ? { description: offerHint } : undefined,
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
        if (cancelled) return;
        if (!returned.length) throw new Error("No copy options returned");
        setOptions(returned);
        setSelectedIdx(0);

        // 5) Render first ad
        setStatusLine("🖼️ Rendering your first ad…");
        const imgs = await callRender(returned[0]);
        if (cancelled) return;
        setImages(imgs);
        setPhase("ready");
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

  const template = templateRef.current;
  const heroImage = images[0];

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
            ) : phase === "error" ? (
              <>Almost — one more try?</>
            ) : (
              <>Making you an ad, live.</>
            )}
          </h1>
          <div className="min-h-[24px] text-sm text-muted-foreground">
            {phase === "loading" ? (
              <span className="inline-flex items-center gap-2 animate-fade-in">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {statusLine}
              </span>
            ) : phase === "ready" ? (
              <>
                Rendered in {brand?.name || "your"} brand colors
                {templateRef.current === "testimonial"
                  ? ", built around a real testimonial from your site"
                  : photoUrlRef.current
                    ? ", with your photo"
                    : ""}
                .
              </>
            ) : (
              <span className="text-destructive">{renderErr || "Something didn't line up."}</span>
            )}
          </div>
        </div>

        {/* Ad hero */}
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
                {phase === "loading" ? (
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
        </div>

        {/* Game plan strip */}
        {strategy && (
          <div className="rounded-2xl border bg-muted/30 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-xl bg-background border">
                <Target className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                  Your game plan is ready
                </div>
                <div className="text-sm font-semibold text-foreground mt-0.5 truncate">
                  {strategy?.name || strategy?.title || "Recommended campaign"}
                </div>
                {(strategy?.description || strategy?.personalized_intro) && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {strategy?.personalized_intro || strategy?.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bonus creatives: talking-head script + b-roll ad, ready without an account */}
        {(scriptState === "loading" || videoState === "loading") && (
          <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 animate-fade-in">
            <Loader2 className="h-3 w-3 animate-spin" /> Also brewing: a talking-head script + a b-roll ad…
          </div>
        )}

        {scriptState === "ready" && scriptBeats && (
          <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> Talking-head script — read this on camera
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {scriptBeats.map((b) => b.line).join(" ")}
            </p>
            <button
              onClick={downloadScript}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              <Download className="h-3.5 w-3.5" /> Download this script
            </button>
          </div>
        )}

        {videoState === "ready" && videoUrl && (
          <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              <Film className="h-3.5 w-3.5" /> Your b-roll ad
            </div>
            <video
              src={videoUrl}
              controls
              muted
              loop
              className="w-full rounded-xl bg-black mx-auto"
              style={{ maxWidth: 460 }}
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <a
                href={videoUrl}
                download={`${brandSlug}-broll-ad.mp4`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                <Download className="h-3.5 w-3.5" /> Download this video
              </a>
              {videoCredit && (
                videoCredit.url ? (
                  <a
                    href={videoCredit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-foreground transition"
                  >
                    Footage via {videoCredit.name}
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Footage via {videoCredit.name}</span>
                )
              )}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={onBack} className="sm:w-auto">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
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
            <Button
              onClick={startTrialCheckout}
              disabled={phase !== "ready" || checkoutLoading}
              className="h-12 px-6 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Opening checkout…</>
              ) : (
                <>Get 50% off to launch this <ArrowRight className="h-5 w-5 ml-2" /></>
              )}
            </Button>
          </div>
        </div>

        {/* Lead magnet: email this pack instead of paying right now */}
        {phase === "ready" && images[0] && (
          <div className="text-center pt-1">
            {!packFormOpen && packState !== "sent" && (
              <button
                type="button"
                onClick={() => setPackFormOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
              >
                Not ready to start? Get this ad pack emailed to you instead
              </button>
            )}
            {packFormOpen && packState !== "sent" && (
              <div className="mt-3 max-w-sm mx-auto flex flex-col gap-2">
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
                />
                <Button
                  onClick={sendAdPack}
                  disabled={packState === "sending"}
                  variant="outline"
                  className="h-10 rounded-xl"
                >
                  {packState === "sending" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" /> Email me this ad pack</>
                  )}
                </Button>
              </div>
            )}
            {packState === "sent" && (
              <p className="text-xs text-primary inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Sent to {leadEmail} — check your inbox
              </p>
            )}
          </div>
        )}

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
      </div>
    </div>
  );
}
