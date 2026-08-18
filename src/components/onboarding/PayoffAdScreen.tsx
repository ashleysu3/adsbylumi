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
import { Loader2, ArrowRight, RefreshCw, ChevronLeft, ImageIcon, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { getTestimonialQuotes, type TestimonialQuote } from "@/lib/social-proof";
import { trackLumiEvent, trackLumiEventOnce } from "@/lib/lumi-pixel";
import lumiLogo from "@/assets/lumi-logo.png";
import { GamePlanCard } from "@/components/ad-kit/GamePlanCard";
import { BuyerPsychology } from "@/components/ad-kit/BuyerPsychology";
import { ScriptBlock } from "@/components/ad-kit/ScriptBlock";
import { VslCloseSection, useKitCheckout } from "@/components/ad-kit/VslClose";
import type { ScriptBeat } from "@/components/ad-kit/types";
import { bestCopyIndex, normalizeDemoDomain } from "@/lib/ad-quality";

// The one copy-only ad template this screen writes for. No graphic renderer
// exists anymore — the visual is a plain feed mock with a placeholder media
// block; the user brings their own photo/video when they get to Creative
// Studio. Keeping a single fixed template keeps the copy shape (and this
// file) simple.
const COPY_TEMPLATE = "spotlight";

type CopyOption = { eyebrow?: string; headline?: string; sub?: string; cta?: string };

interface Props {
  brandId: string;
  brand: any;
  onAdvance: () => void;
  onBack: () => void;
}

export function PayoffAdScreen({ brandId, brand, onAdvance, onBack }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [phase, setPhase] = useState<"loading" | "choosing" | "building" | "ready" | "error">("loading");
  const [statusLine, setStatusLine] = useState("Reading your brand…");
  const [renderErr, setRenderErr] = useState<string | null>(null);

  const [angles, setAngles] = useState<any[]>([]);
  const [chosenAngleIdx, setChosenAngleIdx] = useState<number | null>(null);

  const [options, setOptions] = useState<CopyOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [strategy, setStrategy] = useState<any>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);

  const userGoalRef = useRef("get_leads");
  const offerHintRef = useRef("");
  const offerPsychologyRef = useRef<Record<string, any> | null>(null);
  const chosenAngleRef = useRef<any>(null);
  const offerRowRef = useRef<any>(null);
  const offerUrlRef = useRef("");
  const socialProofRef = useRef<TestimonialQuote | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Bonus creative: a talking-head script, ready without an account.
  const bonusStartedRef = useRef(false);
  const [scriptBeats, setScriptBeats] = useState<ScriptBeat[] | null>(null);
  const [scriptState, setScriptState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Save-in-place: the kit stays on this page.
  const [packFormOpen, setPackFormOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [packState, setPackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [hasAccount, setHasAccount] = useState(false);
  const [packStep, setPackStep] = useState<"email" | "login" | "offer">("email");
  const [checkingAccount, setCheckingAccount] = useState(false);

  const { goCheckout, checkoutLoading } = useKitCheckout(brandId);

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

  const brandSlug = (brand?.name || "lumi-ad").trim().replace(/\s+/g, "-").toLowerCase();

  const rotatedLines = useMemo(
    () => ["🧠 Studying your buyer…", "✍️ Writing three hook angles…", "✨ Almost there…"],
    [],
  );
  const [tickIdx, setTickIdx] = useState(0);
  useEffect(() => {
    if (phase !== "loading" && phase !== "building") return;
    const t = setInterval(() => setTickIdx((i) => (i + 1) % rotatedLines.length), 2000);
    return () => clearInterval(t);
  }, [phase, rotatedLines.length]);
  useEffect(() => {
    if (phase === "loading" || phase === "building") setStatusLine(rotatedLines[tickIdx]);
  }, [tickIdx, phase, rotatedLines]);

  // Write the copy for a chosen angle (or the auto path with none).
  const buildCopy = useCallback(async (angle: any) => {
    try {
      setPhase("building");
      chosenAngleRef.current = angle;
      const userGoal = userGoalRef.current;
      const offerHint = offerHintRef.current;
      const offerRowFull = offerRowRef.current;

      setStatusLine("✍️ Writing your copy…");
      const ctaByGoal: Record<string, string> = {
        booked_calls: "Book your call",
        leads: "Send it to me",
        sales: "Learn more",
      };
      const brief = {
        template: COPY_TEMPLATE,
        format: "single",
        styleHint: COPY_TEMPLATE,
        goal: userGoal,
        concept: brand?.value_proposition || "",
        keyMessage: brand?.value_proposition || "",
        offer: offerHint || "",
        cta: ctaByGoal[userGoal] || "Learn more",
        brandName: brand?.name || "",
      };
      const composeRes = await supabase.functions.invoke("compose-ad", {
        body: {
          brief,
          brandVoice: brand?.voice_profile || brand?.brand_voice || {},
          count: 3,
          audiencePsychology: brand?.audience_psychology || null,
          angle: angle
            ? {
                name: angle.name,
                description: angle.description,
                psychologyTrigger: angle.psychologyTrigger || angle.psychology_trigger || undefined,
              }
            : undefined,
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
      const returned = ((composeRes.data as any)?.options || []) as CopyOption[];
      if (!mountedRef.current) return;
      if (!returned.length) throw new Error("No copy options returned");
      setOptions(returned);
      const bestIdx = bestCopyIndex(COPY_TEMPLATE, returned, {
        brandName: brand?.name,
        offerText: offerHint || offerRowFull?.description || undefined,
      });
      setSelectedIdx(bestIdx);
      setPhase("ready");
      trackLumiEventOnce(`adgen_${brandId}`, "AdGenerated");
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.error("[payoff-ad] copy build failed", e);
      setRenderErr(e?.message || "Something didn't line up");
      setPhase("error");
    }
  }, [brandId, brand]);
  const buildCopyRef = useRef(buildCopy);
  buildCopyRef.current = buildCopy;

  // Boot: brand chrome, strategy, offer psychology, then angles to choose from.
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");

        if ((brand as any)?.instagram_account_name) {
          supabase.functions
            .invoke("fetch-instagram-avatar", {
              body: { brandId, username: (brand as any).instagram_account_name },
            })
            .then(({ data }) => {
              const url = (data as any)?.url;
              if (url && !cancelled) setAvatarUrl(url);
            })
            .catch(() => { /* logo fallback */ });
        } else {
          try {
            const { data: kit } = await supabase
              .from("brand_kits" as any)
              .select("logo_url")
              .eq("brand_id", brandId)
              .maybeSingle();
            if (!cancelled && (kit as any)?.logo_url) setAvatarUrl((kit as any).logo_url);
          } catch { /* no kit yet */ }
        }

        const goalMap: Record<string, string> = {
          booked_calls: "book_calls",
          leads: "get_leads",
          sales: "get_sales",
        };
        const onboardingGoal = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_goal_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_goal ?? null);
        const userGoal = onboardingGoal ? (goalMap[onboardingGoal] || "get_leads") : "get_leads";
        userGoalRef.current = userGoal;

        const offerId: string | null = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_id_${brandId}`)
          : null) || null;
        const offerUrl: string = (typeof window !== "undefined"
          ? localStorage.getItem(`lumi_onboarding_offer_url_${brandId}`)
          : null) ||
          ((brand?.audience_psychology as any)?.onboarding_offer_url ?? "");
        offerUrlRef.current = offerUrl;

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
        offerRowRef.current = offerRowFull;

        const testimonials = getTestimonialQuotes(brand?.social_proof);
        socialProofRef.current = testimonials[0] || null;

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

        setStatusLine("🧠 Finding your three strongest angles…");
        let generatedAngles: any[] = [];
        try {
          const objectiveByGoal: Record<string, string> = {
            get_sales: "sales",
            get_leads: "leads",
            book_calls: "leads",
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
          /* angles are an upgrade, not a gate */
        }
        if (cancelled) return;

        if (generatedAngles.length >= 2) {
          setAngles(generatedAngles);
          setChosenAngleIdx(0);
          setPhase("choosing");
          return; // "Write my ad" click calls buildCopy from here
        }

        await buildCopyRef.current(null);
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

  const generateBonusScript = useCallback(async () => {
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
    } catch (e) {
      console.error("[payoff-ad] script generation failed", e);
      setScriptState("error");
    }
  }, [brandId]);

  useEffect(() => {
    if (phase !== "ready" || bonusStartedRef.current) return;
    bonusStartedRef.current = true;
    generateBonusScript();
  }, [phase, generateBonusScript]);

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

  const showAnother = () => {
    if (options.length < 2) return;
    setSelectedIdx((i) => (i + 1) % options.length);
  };

  const confirmChoices = () => {
    const angle = chosenAngleIdx !== null ? angles[chosenAngleIdx] || null : null;
    void buildCopy(angle);
  };

  // Save-in-place: persist the copy + strategy + script into brands.ad_kit,
  // no image involved — the user brings their own media in Creative Studio.
  const sendAdPack = useCallback(async () => {
    if (packState === "sending" || packState === "sent") return;
    const selectedOption = options[selectedIdx];
    if (!selectedOption) {
      toast.error("No ad copy ready yet — try again in a moment.");
      return;
    }
    if (!leadEmail.trim() || !leadEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setPackState("sending");
    try {
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const kitToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

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

      const adKit: Record<string, any> = {
        copy: { template: COPY_TEMPLATE, option: selectedOption },
        meta: {
          domain: adDomain,
          avatarUrl: avatarUrl || null,
          cta: (typeof selectedOption?.cta === "string" && selectedOption.cta) || null,
        },
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
          ad_kit_token: kitToken,
          ad_kit: adKit,
        })
        .eq("id", brandId);
      if (updateErr) throw updateErr;

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
      if (sendErr) console.warn("[payoff] ad kit email failed to send", sendErr);

      setPackState("sent");
      if (hasAccount) {
        setPackFormOpen(false);
      } else {
        setPackStep("offer");
        setPackFormOpen(true);
        trackLumiEvent("Lead");
      }
      setSearchParams({ kit: kitToken }, { replace: true });
      toast.success(
        hasAccount
          ? "Saved to your account — your brand kit is ready."
          : sendErr
            ? "Saved! We couldn't email the link, but your kit is right here — bookmark this page."
            : "Saved — your private link is on its way to your inbox!",
      );
    } catch (err: any) {
      console.error("[payoff] send ad kit error", err);
      toast.error(err?.message || "Couldn't save your Ad Kit. Please try again.");
      setPackState("error");
    }
  }, [brandId, options, selectedIdx, leadEmail, leadName, packState, setSearchParams, scriptBeats, strategy, hasAccount, brand, avatarUrl]);

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

  const goLogin = useCallback(() => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/auth?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(leadEmail.trim())}`;
  }, [leadEmail]);

  useEffect(() => {
    if (!hasAccount) return;
    if (packState !== "idle") return;
    if (phase !== "ready") return;
    if (!leadEmail.trim() || !options[selectedIdx]) return;
    setPackFormOpen(false);
    sendAdPack();
  }, [hasAccount, packState, phase, leadEmail, options, selectedIdx, sendAdPack]);

  const buyerIdealClient = useMemo(() => {
    const ap = (brand?.audience_psychology as any) || {};
    return (
      (typeof ap.target_audience === "string" && ap.target_audience) ||
      (typeof ap.ideal_client === "string" && ap.ideal_client) ||
      (brand as any)?.target_audience ||
      ""
    );
  }, [brand]);

  const selected = options[selectedIdx];
  const primaryText = selected?.eyebrow || selected?.headline || "";
  const headline = selected?.headline || "";
  const description = selected?.sub || "";
  const cta = selected?.cta || "Learn more";
  const domain = normalizeDemoDomain((brand as any)?.website_url) || "yourbrand.com";

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
              <>Writing you an ad, live.</>
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
              <span>Drop in your own photo or video in Creative Studio when you're ready to launch.</span>
            ) : (
              <span className="text-destructive">{renderErr || "Something didn't line up."}</span>
            )}
          </div>
        </div>

        {/* Choose your angle */}
        {phase === "choosing" && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-3xl border bg-card shadow-sm p-4 sm:p-6 space-y-3">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                The angle
              </div>
              <div className="grid gap-2">
                {angles.map((a, i) => {
                  const active = i === chosenAngleIdx;
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
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={confirmChoices}
              disabled={chosenAngleIdx === null}
              className="w-full h-12 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20 disabled:opacity-60"
            >
              Write my ad <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* A plain Meta-style feed mock — copy only, no rendered graphic. */}
        {phase !== "choosing" && (
          <div className="rounded-3xl border bg-card shadow-sm p-4 sm:p-6">
            <div className="mx-auto rounded-2xl overflow-hidden border border-border bg-background" style={{ maxWidth: 460 }}>
              {/* Profile row */}
              <div className="flex items-center gap-2.5 p-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {(brand?.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{brand?.name || "Your brand"}</div>
                  <div className="text-[11px] text-muted-foreground">Sponsored</div>
                </div>
              </div>

              {/* Primary text */}
              <div className="px-3 pb-3 min-h-[20px] text-sm">
                {phase === "building" || phase === "loading" ? (
                  <span className="inline-block h-4 w-4/5 rounded bg-muted animate-pulse" />
                ) : (
                  primaryText
                )}
              </div>

              {/* Media placeholder */}
              <div className="aspect-square w-full bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs text-center px-6">
                  Your photo or video goes here — add it in Creative Studio
                </span>
              </div>

              {/* Headline / description / CTA */}
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/40">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground truncate">{domain}</div>
                  <div className="text-sm font-semibold truncate">
                    {phase === "building" || phase === "loading" ? (
                      <span className="inline-block h-4 w-32 rounded bg-muted animate-pulse" />
                    ) : (
                      headline
                    )}
                  </div>
                  {description && phase === "ready" && (
                    <div className="text-xs text-muted-foreground truncate">{description}</div>
                  )}
                </div>
                <span className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold">
                  {phase === "ready" ? cta : "…"}
                </span>
              </div>
            </div>

            {/* Hook chips */}
            {options.length > 0 && phase === "ready" && (
              <div className="mt-5 space-y-2">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                  Tap a hook to try it on
                </div>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt, i) => {
                    const label = opt.headline || `Option ${i + 1}`;
                    const active = i === selectedIdx;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(i)}
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
        )}

        {/* Who your buyer is */}
        {phase === "ready" && (
          <div className="pt-2 animate-fade-in">
            <BuyerPsychology idealClient={buyerIdealClient || undefined} ap={brand?.audience_psychology} />
          </div>
        )}

        {/* Game plan strip */}
        {strategy && <GamePlanCard strategy={strategy} variant="compact" />}

        {/* Bonus creative: talking-head script, ready without an account. */}
        {scriptState === "ready" && scriptBeats && (
          <ScriptBlock beats={scriptBeats} variant="compact" onDownload={downloadScript} />
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
                disabled={options.length < 2 || phase !== "ready"}
                className="h-11 rounded-xl"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Show me another
              </Button>
              {packState === "sent" ? (
                <span className="inline-flex items-center justify-center gap-1.5 h-12 px-4 text-sm font-medium text-primary">
                  <Check className="h-4 w-4" />
                  {hasAccount
                    ? leadEmail
                      ? `Saved to ${leadEmail}`
                      : "Saved to your account"
                    : `Saved — link emailed to ${leadEmail}`}
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

        {packState === "sent" && <VslCloseSection brandId={brandId} firstName={leadName.trim().split(" ")[0] || null} />}

        {phase === "error" && (
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOptions([]);
                setRenderErr(null);
                setPhase("loading");
                toast.message("Try again by refreshing this step.");
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
                    account as a new campaign — copy, script and all.
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
