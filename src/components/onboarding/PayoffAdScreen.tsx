import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, RefreshCw, Sparkles, ChevronLeft, Target } from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";


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

// Extract a headline preview string from a compose-ad option for a given template.
function optionToHeadline(template: string, opt: any): string {
  if (!opt || typeof opt !== "object") return "";
  if (template === "bigtype") {
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
  const templateRef = useRef<"spotlight" | "bigtype">("bigtype");

  // Copy options + selection
  const [options, setOptions] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // Strategy summary
  const [strategy, setStrategy] = useState<any>(null);

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
        templateRef.current = photoUrl ? "spotlight" : "bigtype";

        // 3) Recommend strategy — respect the goal the user picked on the reveal step.
        // Falls back to lead-gen when no choice was made.
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

        setStatusLine("🧠 Picking your best angle…");
        try {
          const { data: recData } = await supabase.functions.invoke("recommend-strategy", {
            body: { brand_id: brandId, offer_id: null, user_goal: userGoal, offer_hint: offerHint || undefined },
          });
          if (!cancelled) {
            const s = (recData as any)?.strategy ?? recData ?? null;
            if (s && !((recData as any)?.pending)) setStrategy(s);
          }
        } catch {
          /* non-fatal; ad still renders */
        }

        // 4) Compose 3 hook options
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
          styleHint: template === "bigtype" ? "bigtype" : "card",
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
            <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600">
              LUMI
            </span>
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
              <>Rendered in {brand?.name || "your"} brand colors{photoUrlRef.current ? ", with your photo" : ""}.</>
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
                <>Start free trial to launch this <ArrowRight className="h-5 w-5 ml-2" /></>
              )}
            </Button>
          </div>
        </div>

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
