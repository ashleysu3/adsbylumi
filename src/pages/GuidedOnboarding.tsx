import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2, ArrowRight, ChevronLeft, CheckCircle2, Sparkles,
  MessageSquare, Brain, Target, Quote, ListChecks, Check,
  Pencil, Award, BarChart3, Newspaper, GraduationCap, Users, Briefcase, Lock
} from "lucide-react";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { PayoffAdScreen } from "@/components/onboarding/PayoffAdScreen";
import { OnboardingLoadingOverlay } from "@/components/onboarding/OnboardingLoadingOverlay";
import { SetupPrompt } from "@/components/SetupPrompt";
import { LumiThinkingInline } from "@/components/LumiThinking";
import { LumiPageLoader } from "@/components/LumiLoader";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { useBrand } from "@/contexts/BrandContext";
import { seedDeferredTask, seedFirstCampaignTasks } from "@/lib/onboarding-tasks";
import { getTestimonialQuotes } from "@/lib/social-proof";
import lumiLogo from "@/assets/lumi-logo.png";

const STEPS = [
  "Your website",
  "Here's what we found",
  "Your first ad",
  "Your offer",
  "Connect Meta",
  "Strategy & launch",
];
const TOTAL = STEPS.length;
// Goal-specific copy for the "give us a link" follow-up — a real URL beats a
// hand-typed description: LUMI reads the actual page (extract-offer-info) for
// a real price/page_goal, which is what lets recommend-strategy pick a lead
// vs. sales campaign correctly instead of guessing from free text. Only shown
// for goals tied to a real page (booked_calls/leads/sales) — "followers" has
// no page to send people to, so it gets a different follow-up question below.
const AD_LINK_COPY: Record<"booked_calls" | "leads" | "sales", { label: string; placeholder: string }> = {
  booked_calls: {
    label: "Link to your booking page",
    placeholder: "https://yourbrand.com/book-a-call",
  },
  leads: {
    label: "Link to the page where they get it",
    placeholder: "https://yourbrand.com/free-guide",
  },
  sales: {
    label: "Link to your sales page",
    placeholder: "https://yourbrand.com/the-program",
  },
};

function domainName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "My brand";
  } catch { return "My brand"; }
}

const WITTY_LINES = [
  "🔍 Getting the lay of your site…",
  "🧠 Mapping out your dream client…",
  "✍️ Learning how your brand actually sounds…",
  "💬 Digging up your testimonials…",
  "🪄 Comparing notes with brands like yours…",
];
const REVEAL_SECTIONS = ["basics", "audience", "proof"] as const;
type RevealKey = typeof REVEAL_SECTIONS[number];
const FIRST_DELAY_MS = 500;
const STAGGER_MS = 800;

export default function GuidedOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const addBrandMode = searchParams.get("mode") === "add-brand";
  // Saving an Ad Kit stamps ?kit= onto THIS url (save-in-place, no redirect).
  // If someone later lands here cold with that param — refresh, bookmark,
  // shared link — their anonymous session is likely gone, so resolve it to
  // the permanent token page instead of restarting onboarding. Captured at
  // mount only: the in-session stamp must NOT bounce them away mid-flow.
  const kitParamAtMountRef = useRef<string | null>(searchParams.get("kit"));
  useEffect(() => {
    const kitParam = kitParamAtMountRef.current;
    if (kitParam) navigate(`/your-ad-pack?kit=${kitParam}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { refreshBrands, setActiveBrand } = useBrand();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brand, setBrand] = useState<any>(null);

  // Step 1
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [showIgField, setShowIgField] = useState(false);
  const [step1Busy, setStep1Busy] = useState(false);
  // Per-section streaming flags. Each one flips false the moment its extractor settles,
  // so the reveal page can show inline shimmers and swap to real content as data arrives.
  const [extractionPhase, setExtractionPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [loadingBrandBasics, setLoadingBrandBasics] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [loadingProof, setLoadingProof] = useState(false);
  const step1Fired = useRef(false);

  // Reveal orchestration — placeholder name (domain slug) is INTERNAL ONLY; never shown.
  const placeholderNameRef = useRef<string>("");
  const [revealStartedAt, setRevealStartedAt] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<RevealKey, boolean>>({
    basics: false, audience: false, proof: false,
  });
  // Sections whose extractor timed out — we still reveal them, but with a friendly
  // "couldn't pull this one" hint above the editable card.
  const [failed, setFailed] = useState<Record<RevealKey, boolean>>({
    basics: false, audience: false, proof: false,
  });
  const [slowMode, setSlowMode] = useState(false);
  const [narrationIdx, setNarrationIdx] = useState(0);
  // Escape hatch: after ~25s (or as soon as we have colors OR a real brand name)
  // we unlock the CTA so the user is never stranded on "Still reading…".
  const [phaseTimedOut, setPhaseTimedOut] = useState(false);

  // Concurrent engagement questions — asked while extraction runs so total time to
  // first ad ≈ slowest extractor. Answers flow into recommend-strategy + copy gen.
  type GoalChoice = "booked_calls" | "leads" | "sales" | "followers";
  const [goalChoice, setGoalChoice] = useState<GoalChoice | null>(null);
  // For booked_calls/leads/sales, a real link to the offer page — read via
  // extract-offer-info into a real `offers` row (name/description/price_point/
  // page_goal), which is what lets recommend-strategy pick lead vs. sales
  // deterministically instead of guessing from hand-typed text.
  const [offerHintUrl, setOfferHintUrl] = useState("");
  const [offerLinkBusy, setOfferLinkBusy] = useState(false);
  // The offer-specific psychology (objections, what finally convinces them,
  // etc.) — generated the moment a real link is in, so it's ready to show on
  // THIS reveal page instead of only grounding copy invisibly downstream.
  const [offerPsychology, setOfferPsychology] = useState<Record<string, any> | null>(null);
  const [offerPsychologyLoading, setOfferPsychologyLoading] = useState(false);
  // For the "followers" bucket, which has no offer page to read — a binary
  // split so recommend-strategy gets an explicit signal instead of guessing
  // DM vs. general growth from free text (the actual bug being fixed here).
  type FollowersIntent = "engagement" | "dms";
  const [followersIntent, setFollowersIntent] = useState<FollowersIntent | null>(null);
  const goalPersistedRef = useRef(false);

  // Step 2 — review (uses brand state)
  const [proofExtracting, setProofExtracting] = useState(false);

  // Step 3 — offer
  const [offerUrl, setOfferUrl] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerStatusMsg, setOfferStatusMsg] = useState<string | null>(null);

  // Strategy
  const [strategy, setStrategy] = useState<any>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  // Rotate witty narration while extraction runs
  useEffect(() => {
    if (extractionPhase !== 'running') return;
    const t = setInterval(() => setNarrationIdx((i) => (i + 1) % WITTY_LINES.length), 1800);
    return () => clearInterval(t);
  }, [extractionPhase]);

  // Slow-mode kicks in after ~15s of still-running extraction so a sluggish
  // network reads as patient, not broken.
  useEffect(() => {
    if (extractionPhase !== 'running') { setSlowMode(false); return; }
    const t = setTimeout(() => setSlowMode(true), 15_000);
    return () => clearTimeout(t);
  }, [extractionPhase]);

  // Phase-level escape hatch: no matter what, after ~25s we let the user proceed
  // so a slow Firecrawl / engine scrape can never trap them on this screen.
  useEffect(() => {
    if (extractionPhase !== 'running') { setPhaseTimedOut(false); return; }
    const t = setTimeout(() => setPhaseTimedOut(true), 25_000);
    return () => clearTimeout(t);
  }, [extractionPhase]);

  // Orchestrated reveal: each section waits for (a) its extractor to settle AND
  // (b) the prior section to reveal, plus a stagger, so it always feels paced.
  const markRevealed = useCallback((k: RevealKey) => {
    setRevealed((r) => (r[k] ? r : { ...r, [k]: true }));
  }, []);

  // Streamed reveal: each card animates in the moment its OWN extractor settles,
  // independent of the others, so total wait ≈ slowest single extractor.
  // FIRST_DELAY_MS gives the header a beat before the first pop-in.
  useEffect(() => {
    if (!revealStartedAt || revealed.basics) return;
    if (loadingBrandBasics) return;
    const wait = Math.max(0, revealStartedAt + FIRST_DELAY_MS - Date.now());
    const t = setTimeout(() => markRevealed("basics"), wait);
    return () => clearTimeout(t);
  }, [revealStartedAt, loadingBrandBasics, revealed.basics, markRevealed]);

  useEffect(() => {
    if (!revealStartedAt || revealed.audience) return;
    if (loadingAudience) return;
    // Only reveal once the psychology is actually grounded (real source material,
    // not the deliberately-generic fallback used when a site can't be read) —
    // never a vague "we're still shaping this" placeholder. If the first pass
    // isn't grounded, this effect simply waits; it re-fires when the background
    // read-site-context enrichment (if it lands) replaces brand.audience_psychology
    // with a grounded version. If neither ever grounds, the card just never
    // reveals — the user still isn't blocked, since canContinue has its own
    // escape hatches, and the "who do you serve" input above covers the gap.
    const ap: any = brand?.audience_psychology;
    if (!ap?._grounded) return;
    const t = setTimeout(() => markRevealed("audience"), 0);
    return () => clearTimeout(t);
  }, [revealStartedAt, loadingAudience, revealed.audience, markRevealed, brand?.audience_psychology]);

  useEffect(() => {
    if (!revealStartedAt || revealed.proof) return;
    if (loadingProof) return;
    const t = setTimeout(() => markRevealed("proof"), 0);
    return () => clearTimeout(t);
  }, [revealStartedAt, loadingProof, revealed.proof, markRevealed]);

  const revealedCount = REVEAL_SECTIONS.filter((k) => revealed[k]).length;
  const allRevealed = revealedCount === REVEAL_SECTIONS.length;
  // The user is held on the reading screen (feature loading overlay up) until
  // EVERY extractor has settled or the hard cap fires — no half-read brands
  // sliding into the first ad.
  const hasCoreBrandData = !!(brand?.name && brand.name !== placeholderNameRef.current);
  const stillExtracting =
    loadingBrandBasics || loadingVoice || loadingAudience || loadingProof;
  // Once every extractor has settled ('done'), the user must be able to move on
  // even if a single card never revealed (e.g. audience psychology came back
  // ungrounded) — otherwise they're trapped on the reading screen forever.
  const canContinue = phaseTimedOut || extractionPhase === 'done' || (allRevealed && !stillExtracting);
  // Fallback state: extraction finished but produced nothing useful (no colors
  // AND no real brand name AND no audience picture). We show a friendly nudge
  // instead of a spinning card.
  const extractionEmpty =
    (extractionPhase === 'done' || phaseTimedOut) &&
    !hasCoreBrandData &&
    !brand?.audience_psychology;

  // ---------- auth + resume ----------
  const autoStartFiredRef = useRef(false);
  useEffect(() => {
    (async () => {
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Ad-first flow: mint an anonymous session so onboarding + first-ad
        // render before any sign-up. Account creation happens later at the
        // "Get 50% off to launch this" step (anonymous → permanent upgrade).
        const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr || !anon?.user) {
          const status = (anonErr as any)?.status ?? "unknown";
          const code = (anonErr as any)?.code ?? (anonErr as any)?.name ?? "unknown";
          const msg = anonErr?.message || "no user returned";
          // Log the raw error so we can distinguish captcha blocks, disabled
          // anonymous sign-ins, rate limits, and DB trigger failures.
          console.error("[onboarding] signInAnonymously failed", { status, code, message: msg, error: anonErr });
          toast.error(`Couldn't start your session (${status}): ${msg}`, { duration: 10000 });
          setCheckingAuth(false);
          return;
        }
        user = anon.user;
      }
      // Prefill from homepage capture bar. Router state is the primary source
      // (survives without storage); sessionStorage is a fallback for reloads.
      const navState: any = (location.state as any) || {};
      let prefillWebsite = "";
      let prefillInstagram = "";
      try {
        prefillWebsite = navState.websiteUrl || sessionStorage.getItem("lumi_prefill_website") || "";
        prefillInstagram = navState.instagramHandle || sessionStorage.getItem("lumi_prefill_instagram") || "";
      } catch { /* ignore */ }
      // Ad-first flow: if they arrived with a fresh website from the homepage,
      // always start fresh toward a new first ad — never resume an old brand.
      // When explicitly adding a new brand, also skip resume.
      let resumedExisting = false;
      if (!addBrandMode && !prefillWebsite) {
        const { data: existing } = await supabase
          .from("brands").select("*").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1);
        const latest = existing?.[0];
        if (latest && !latest.onboarding_completed_at) {
          resumedExisting = true;
          setBrandId(latest.id);
          setBrand(latest);
          setWebsiteUrl(latest.website_url || "");
          // Never resume into the legacy offer/Meta/strategy steps (4–6). Land the
          // user on the website step so they always continue toward their first ad.
          setStep(1);
        }
      }
      if (!resumedExisting && prefillWebsite) {
        setWebsiteUrl(prefillWebsite);
        if (prefillInstagram) { setInstagramHandle(prefillInstagram); setShowIgField(true); }
        autoStartFiredRef.current = true;
        try {
          sessionStorage.removeItem("lumi_prefill_website");
          sessionStorage.removeItem("lumi_prefill_instagram");
        } catch { /* ignore */ }
      }
      setCheckingAuth(false);
    })();
  }, [navigate, addBrandMode]);

  // Auto-fire step 1 when arriving with a prefilled website (homepage capture bar).
  useEffect(() => {
    if (checkingAuth) return;
    if (!autoStartFiredRef.current) return;
    if (step !== 1) { autoStartFiredRef.current = false; return; }
    if (!websiteUrl) return;
    if (step1Fired.current || step1Busy) return;
    autoStartFiredRef.current = false;
    startStep1();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAuth, websiteUrl, step]);

  const persistStep = useCallback(async (id: string, n: number) => {
    await supabase.from("brands").update({ onboarding_step: n }).eq("id", id);
  }, []);

  const advance = async () => {
    const next = Math.min(TOTAL, step + 1);
    setStep(next);
    if (brandId) await persistStep(brandId, next);
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  // Basic sanity check on the URL: must have a hostname with a TLD like ".com".
  // Catches typos like "notasite" or "http://localhost" so we don't spend 40s
  // scraping something that will never resolve.
  const isLikelyLiveSite = (url: string): boolean => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (!host.includes(".")) return false;
      const tld = host.split(".").pop() || "";
      return /^[a-z]{2,24}$/i.test(tld);
    } catch {
      return false;
    }
  };

  // =================== STEP 1 ===================
  const startStep1 = async () => {
    const normalized = normalizeWebsiteUrl(websiteUrl);
    if (!normalized || !isLikelyLiveSite(normalized)) {
      toast.error("That doesn't look like a live site — check the URL");
      return;
    }
    if (step1Fired.current) return;
    step1Fired.current = true;
    setStep1Busy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      // Create brand row if not yet
      let id = brandId;
      let row = brand;
      if (!id) {
        const placeholder = domainName(normalized);
        placeholderNameRef.current = placeholder;
        const igClean = instagramHandle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
        const insertRow: any = { user_id: user.id, name: placeholder, website_url: normalized, onboarding_step: 1 };
        if (igClean) insertRow.instagram_account_name = igClean;
        const { data, error } = await supabase.from("brands").insert(insertRow).select().single();
        if (error) throw error;
        id = data.id; row = data;
        setBrandId(id!); setBrand(row);
      } else if (row?.website_url !== normalized) {
        // Website changed → reset brand identity so old name/colors/etc don't bleed through.
        const placeholder = domainName(normalized);
        placeholderNameRef.current = placeholder;
        // NOTE: brand_colors/brand_fonts used to be in this update but those
        // columns don't exist in the schema — PostgREST rejected the whole
        // update with a 400, so none of this reset ever actually applied.
        // Colors live in brand_kits, which extract-brand overwrites anyway.
        const { error: resetErr } = await supabase.from("brands").update({
          website_url: normalized,
          name: placeholder,
          value_proposition: null,
          target_audience: null,
          brand_voice: null,
          voice_profile: null,
          social_proof: null,
          // audience_psychology carries onboarding answers keyed to the OLD
          // site (onboarding_goal / onboarding_offer_url) — must not survive.
          audience_psychology: null,
        }).eq("id", id);
        if (resetErr) console.warn("[onboarding] brand reset on website change failed", resetErr);
        // Offers extracted from the old site would otherwise survive and
        // recommend-strategy trusts them blindly — producing a strategy and
        // ad copy about the previous business under the new brand's name.
        // Archive rather than delete so nothing user-visible is destroyed.
        const { error: offersErr } = await supabase
          .from("offers")
          .update({ archived: true, archived_at: new Date().toISOString() })
          .eq("brand_id", id)
          .eq("archived", false);
        if (offersErr) console.warn("[onboarding] offer archive on website change failed", offersErr);
        try {
          localStorage.removeItem(`lumi_onboarding_goal_${id}`);
          localStorage.removeItem(`lumi_onboarding_followers_intent_${id}`);
          localStorage.removeItem(`lumi_onboarding_offer_url_${id}`);
          localStorage.removeItem(`lumi_onboarding_offer_id_${id}`);
          localStorage.removeItem(`lumi_onboarding_offer_hint_${id}`);
        } catch { /* storage unavailable — non-blocking */ }
        row = { ...row, website_url: normalized, name: placeholder, audience_psychology: null };
        setBrand(row);
      } else {
        placeholderNameRef.current = domainName(normalized);
      }

      const websiteForCall = normalized;
      const brandIdLocal = id!;

      // Mark all sections as loading and immediately move the user to the reveal page.
      // They watch each section populate as its extractor resolves — no blocking screen.
      setLoadingBrandBasics(true);
      setLoadingVoice(true);
      setLoadingAudience(true);
      setLoadingProof(true);
      setRevealed({ basics: false, audience: false, proof: false });
      setFailed({ basics: false, audience: false, proof: false });
      setSlowMode(false);
      setRevealStartedAt(Date.now());
      setNarrationIdx(0);
      setExtractionPhase('running');
      setStep(2);
      if (brandIdLocal) persistStep(brandIdLocal, 2);

      // Hard-cap each extractor at ~40s. If it hasn't resolved by then we stop
      // waiting, surface a friendly "couldn't pull this one" hint, and let the
      // user keep going. The actual promise can still resolve later and update
      // state — the cap only governs UX, never cancels work.
      const HARD_CAP_MS = 40_000;
      const armCap = (
        label: string,
        sections: RevealKey[],
        setLoading: (b: boolean) => void,
        settled: { done: boolean },
      ) => {
        const timer = setTimeout(() => {
          if (settled.done) return;
          console.warn(`[onboarding] extractor timed out after ${HARD_CAP_MS}ms: ${label}`);
          setFailed((f) => {
            const next = { ...f };
            for (const s of sections) next[s] = true;
            return next;
          });
          setLoading(false);
        }, HARD_CAP_MS);
        return () => { settled.done = true; clearTimeout(timer); };
      };

      const brandSettled = { done: false };
      const voiceSettled = { done: false };
      const audSettled = { done: false };
      const proofSettled = { done: false };
      const clearBrandCap = armCap("extract-brand", ["basics"], setLoadingBrandBasics, brandSettled);
      const clearVoiceCap = armCap("analyze-brand-voice", ["basics"], setLoadingVoice, voiceSettled);
      const clearAudCap = armCap("generate-audience-psychology", ["audience"], setLoadingAudience, audSettled);
      const clearProofCap = armCap("extract-social-proof", ["proof"], setLoadingProof, proofSettled);

      // extract-brand → name/description (the first thing to render)
      const pBrand = supabase.functions.invoke("extract-brand", { body: { url: websiteForCall } }).then(async (r) => {
        const d: any = r.data;
        if (!d || r.error) return;
        // Backend detected a bot-protection wall (Cloudflare/Wix/Squarespace/etc).
        // Mark basics + design as failed immediately so the reveal shows the
        // friendly fallback ("we couldn't fully read your site") without waiting
        // the full 25s escape-hatch timer.
        if (d.blocked) {
          console.warn("[onboarding] extract-brand returned blocked:true — using fallback flow");
          setFailed((f) => ({ ...f, basics: true }));
          // Still capture og:title/description if the server managed to read them.
          const brandPatch: any = {};
          if (d.name) brandPatch.name = d.name;
          if (d.description) brandPatch.value_proposition = d.description;
          if (Object.keys(brandPatch).length) {
            await supabase.from("brands").update(brandPatch).eq("id", brandIdLocal);
            setBrand((prev: any) => ({ ...(prev || {}), ...brandPatch }));
          }
          return;
        }
        const brandPatch: any = {};
        if (d.name) brandPatch.name = d.name;
        if (d.description) brandPatch.value_proposition = d.description;
        if (Object.keys(brandPatch).length) {
          const { error: brErr } = await supabase.from("brands").update(brandPatch).eq("id", brandIdLocal);
          if (brErr) console.warn("brand update failed", brErr);
          else setBrand((prev: any) => ({ ...(prev || {}), ...brandPatch }));
        }
      }).catch(() => {}).finally(() => { clearBrandCap(); setLoadingBrandBasics(false); });

      // Fire all extractors IN PARALLEL — total wait ≈ slowest one, not the sum.
      // Each one settles its own reveal flag independently so cards pop in as they arrive.
      // The Instagram handle (optional capture-bar field) feeds voice AND audience
      // psychology — captions are often closer to how a brand talks to its people
      // than the website is. Previously collected and never passed anywhere.
      const igForExtractors = instagramHandle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "") || undefined;
      const pVoice = supabase.functions.invoke("analyze-brand-voice", { body: { brandId: brandIdLocal, instagramHandle: igForExtractors } })
        .then(async () => {
          const { data: refreshed } = await supabase.from("brands").select("brand_voice, voice_profile").eq("id", brandIdLocal).maybeSingle();
          if (refreshed) {
            setBrand((prev: any) => ({ ...(prev || {}), ...(refreshed as any) }));
          }
        }).catch(() => {}).finally(() => { clearVoiceCap(); setLoadingVoice(false); });

      const pAud = supabase.functions.invoke("generate-audience-psychology", { body: { brandId: brandIdLocal, instagramHandle: igForExtractors } })
        .then(async () => {
          const { data: refreshed } = await supabase.from("brands").select("audience_psychology").eq("id", brandIdLocal).maybeSingle();
          if (refreshed) {
            setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: (refreshed as any).audience_psychology }));
          }
        }).catch(() => {}).finally(() => { clearAudCap(); setLoadingAudience(false); });

      const pProof = supabase.functions.invoke("extract-social-proof", { body: { brandId: brandIdLocal, url: websiteForCall } })
        .then(async () => {
          const { data: refreshed } = await supabase.from("brands").select("social_proof").eq("id", brandIdLocal).maybeSingle();
          if (refreshed) {
            setBrand((prev: any) => ({ ...(prev || {}), social_proof: (refreshed as any).social_proof }));
          }
        }).catch(() => {}).finally(() => { clearProofCap(); setLoadingProof(false); });

      // Background enrichment: reads the site like a human (via the engine's real
      // browser, multi-page — home/about/offers/results) and feeds real text +
      // screenshots to a vision model for a much juicier audience_psychology than
      // the single-homepage-fetch above can produce. Deliberately NOT in the
      // Promise.allSettled gate below — it can take longer than the 25s escape
      // hatch, so it must never delay "make my ad". It's a pure upgrade: when it
      // lands (even after the user has moved on), it silently improves brand
      // state for the next screen/regeneration. Safe no-op if the engine can't
      // read the site or isn't deployed yet — existing audience data is untouched.
      // CHAINED AFTER pAud on purpose: both write brands.audience_psychology, and
      // firing them in parallel was a last-writer-wins race — the single-homepage
      // generic profile could silently clobber this richer one. Sequencing makes
      // "read-site-context strictly enriches" actually true.
      pAud.then(() => supabase.functions.invoke("read-site-context", { body: { brandId: brandIdLocal } }))
        .then(async (r) => {
          if (r?.data?.success) {
            const { data: refreshed } = await supabase
              .from("brands").select("audience_psychology, target_audience").eq("id", brandIdLocal).maybeSingle();
            if (refreshed) {
              setBrand((prev: any) => ({
                ...(prev || {}),
                audience_psychology: (refreshed as any).audience_psychology,
                target_audience: (refreshed as any).target_audience,
              }));
            }
          }
        })
        .catch(() => {});

      // When everything settles, flag the phase as done so the resume logic stops trying.
      Promise.allSettled([pBrand, pVoice, pAud, pProof]).then(async () => {
        try {
          const { data: b } = await supabase.from("brands").select("*").eq("id", brandIdLocal).maybeSingle();
          if (b) setBrand((prev: any) => ({ ...(prev || {}), ...(b as any) }));
        } catch { /* ignore */ }
        setExtractionPhase('done');
      });

      await refreshBrands();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not save");
      step1Fired.current = false;
      setExtractionPhase('idle');
      setLoadingBrandBasics(false);
      setLoadingVoice(false);
      setLoadingAudience(false);
      setLoadingProof(false);
    } finally {
      setStep1Busy(false);
    }
  };

  const updateBrand = async (patch: Record<string, any>) => {
    if (!brandId) return;
    setBrand((prev: any) => ({ ...(prev || {}), ...patch }));
    if (Object.keys(patch).length) {
      await supabase.from("brands").update(patch).eq("id", brandId);
    }
  };

  // =================== STEP 3 — offer ===================
  useEffect(() => {
    if (step !== 3 || !brandId) return;
    (async () => {
      const { data } = await supabase.from("offers").select("*").eq("brand_id", brandId);
      setOffers(data || []);
    })();
  }, [step, brandId]);

  // Shared by the Step 3 "pull my offer" flow and the onboarding ad-link
  // question — reads the real page via extract-offer-info and patches an
  // existing `offers` row with name/description/price_point/page_goal, the
  // exact signals recommend-strategy needs to pick lead vs. sales correctly.
  const applyExtractedOfferInfo = async (offerId: string, normalizedUrl: string) => {
    const { data: ex } = await supabase.functions.invoke("extract-offer-info", {
      body: { offerUrl: normalizedUrl, offerName: "" },
    });
    if (!ex) return;
    const e: any = ex;
    const patch: any = {};
    if (e.name) patch.name = e.name;
    if (e.description) patch.description = e.description;
    if (e.price_point) patch.price_point = e.price_point;
    if (e.target_outcome) patch.target_outcome = e.target_outcome;
    if (e.suggested_page_goal) patch.page_goal = e.suggested_page_goal;
    // Offer-specific audience psychology — layers on top of brand-level psychology.
    const oap: any = {};
    if (Array.isArray(e.pain_points_addressed)) oap.pain_points = e.pain_points_addressed;
    if (Array.isArray(e.key_benefits)) oap.desires = e.key_benefits;
    if (Array.isArray(e.objections_addressed)) oap.objections = e.objections_addressed;
    if (Array.isArray(e.emotional_hooks)) oap.emotional_hooks = e.emotional_hooks;
    if (e.target_audience_indicators) oap.target_audience = e.target_audience_indicators;
    if (Object.keys(oap).length) patch.offer_audience_psychology = oap;
    // Messaging guidelines + product psychology for downstream creative.
    const mg: any = {};
    if (Array.isArray(e.unique_selling_points)) mg.unique_selling_points = e.unique_selling_points;
    if (Array.isArray(e.cta_language)) mg.cta_language = e.cta_language;
    if (e.tone_and_voice) mg.tone_and_voice = e.tone_and_voice;
    if (Array.isArray(e.raw_copy_highlights)) mg.raw_copy_highlights = e.raw_copy_highlights;
    if (Array.isArray(e.key_benefits)) mg.key_benefits = e.key_benefits;
    if (Array.isArray(e.pain_points_addressed)) mg.pain_points = e.pain_points_addressed;
    if (Array.isArray(e.objections_addressed)) mg.objections_addressed = e.objections_addressed;
    if (Array.isArray(e.emotional_hooks)) mg.emotional_hooks = e.emotional_hooks;
    if (e.social_proof) mg.social_proof = e.social_proof;
    if (Object.keys(mg).length) patch.messaging_guidelines = mg;
    if (e.page_excerpt) {
      patch.page_excerpt = e.page_excerpt;
      patch.page_extracted_at = new Date().toISOString();
    }
    if (e.social_proof) patch.product_psychology = { social_proof: e.social_proof };
    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase.from("offers").update(patch).eq("id", offerId);
      if (upErr) console.warn("offer update failed", upErr);
    }
  };

  const findOrCreateOffer = async (normalizedUrl: string): Promise<string> => {
    const { data: existing } = await supabase
      .from("offers").select("id").eq("brand_id", brandId).eq("url", normalizedUrl).maybeSingle();
    if ((existing as any)?.id) return (existing as any).id;
    const { data, error } = await supabase.from("offers").insert({
      brand_id: brandId, url: normalizedUrl, name: "New offer",
    }).select().single();
    if (error) throw error;
    return data.id;
  };

  const submitOfferUrl = async () => {
    if (!brandId) return;
    const normalized = normalizeWebsiteUrl(offerUrl);
    if (!normalized) { toast.error("Add your offer's sales page URL"); return; }
    setOfferBusy(true);
    setOfferStatusMsg("LUMI is reading your offer page…");
    try {
      const offerId = await findOrCreateOffer(normalized);
      await applyExtractedOfferInfo(offerId, normalized);
      const { data: refreshed } = await supabase.from("offers").select("*").eq("brand_id", brandId);
      setOffers(refreshed || []);
      setOfferUrl("");
      toast.success("Offer pulled");
    } catch (e: any) {
      toast.error(e.message || "Couldn't pull the offer");
    } finally {
      setOfferBusy(false);
      setOfferStatusMsg(null);
    }
  };

  // The onboarding ad-link question (booked_calls/leads/sales goals) — same
  // read-the-real-page mechanism as submitOfferUrl above, but fired on blur
  // during Step 2 instead of a dedicated Step 3 screen, and non-blocking:
  // the "Continue to my ad" CTA only requires the URL itself, not this
  // extraction finishing (see answeredRequirement below).
  const submitAdLink = async () => {
    const raw = offerHintUrl.trim();
    if (!brandId || !raw) return;
    const normalized = normalizeWebsiteUrl(raw);
    if (!normalized) return;
    try {
      localStorage.setItem(`lumi_onboarding_offer_url_${brandId}`, normalized);
      const currentAp = (brand?.audience_psychology as any) || {};
      const nextAp = { ...currentAp, onboarding_offer_url: normalized };
      await supabase.from("brands").update({ audience_psychology: nextAp }).eq("id", brandId);
      setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: nextAp }));
    } catch { /* non-blocking */ }

    // Both reads only need the URL itself, not each other's result — run
    // them concurrently so the psychology section isn't waiting behind the
    // offers-row extraction for no reason.
    setOfferLinkBusy(true);
    setOfferPsychologyLoading(true);
    const [offerResult, psychResult] = await Promise.allSettled([
      (async () => {
        const offerId = await findOrCreateOffer(normalized);
        await applyExtractedOfferInfo(offerId, normalized);
        return offerId;
      })(),
      supabase.functions.invoke("generate-offer-psychology", {
        body: { brand_id: brandId, offer_url: normalized, user_goal: goalChoice || undefined },
      }),
    ]);
    if (offerResult.status === "fulfilled") {
      localStorage.setItem(`lumi_onboarding_offer_id_${brandId}`, offerResult.value);
    } else {
      console.warn("[onboarding] ad-link offer extraction failed", offerResult.reason);
    }
    setOfferLinkBusy(false);
    if (psychResult.status === "fulfilled") {
      setOfferPsychology((psychResult.value?.data as any)?.offer_psychology || null);
    } else {
      console.warn("[onboarding] offer psychology generation failed", psychResult.reason);
    }
    setOfferPsychologyLoading(false);
  };

  const updateOffer = async (offerId: string, patch: Record<string, any>) => {
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, ...patch } : o)));
    await supabase.from("offers").update(patch).eq("id", offerId);
  };

  // =================== STEP 5 — strategy choice ===================
  type StrategyChoice = null | "offer" | "goal";
  const [strategyChoice, setStrategyChoice] = useState<StrategyChoice>(null);
  const [chosenGoal, setChosenGoal] = useState<string | null>(null);
  const [pickingGoal, setPickingGoal] = useState(false);
  const [chosenOfferId, setChosenOfferId] = useState<string | null>(null);

  const runRecommendStrategy = async (opts: { offer_id?: string | null; user_goal: string }) => {
    if (!brandId) return;
    setStrategy(null);
    setStrategyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-strategy", {
        body: { brand_id: brandId, offer_id: opts.offer_id || null, user_goal: opts.user_goal },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.pending) {
        setStrategy({
          pending: true,
          name: "Custom strategy in the works",
          description:
            "Your setup is unique enough that LUMI flagged it for a human review. We'll have a tailored plan ready for you shortly — you can keep going in the meantime.",
        });
      } else {
        const s = (data as any)?.strategy ?? data;
        setStrategy({ ...s, personalized_intro: (data as any)?.personalized_intro });
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Couldn't generate a strategy — you can do this later");
    } finally {
      setStrategyLoading(false);
    }
  };


  const seedStrategyTasks = async () => {
    const items: { title: string; description?: string }[] = [];
    const next = strategy?.next_steps || strategy?.recommended_steps || strategy?.steps;
    if (Array.isArray(next) && next.length) {
      for (const it of next.slice(0, 6)) {
        items.push({ title: typeof it === "string" ? it : (it.title || it.label || "Strategy step") });
      }
    }
    await Promise.all(items.map((it) => seedDeferredTask({ ...it, link_to: "/strategy", brand_id: brandId })));
  };

  // ---------- finish helpers ----------
  const finishLater = async (note: string, link_to = "/onboarding") => {
    if (brandId) await persistStep(brandId, step);
    await seedDeferredTask({ title: note, link_to, brand_id: brandId });
    advance();
  };

  const completeAndGoHome = async () => {
    if (brandId) {
      await supabase.from("brands")
        .update({ onboarding_step: TOTAL, onboarding_completed_at: new Date().toISOString() })
        .eq("id", brandId);
      const { data } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
      if (data) setActiveBrand(data);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles")
        .update({ guided_onboarding_step: TOTAL, guided_onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    await refreshBrands();
    toast.success("You're set up. Welcome ✨");
    navigate("/studio");
  };

  const startFirstCampaign = async () => {
    await seedFirstCampaignTasks(brandId);
    await seedStrategyTasks();
    await completeAndGoHome();
    const params = new URLSearchParams({ onboarding: "1" });
    const strategyName = strategy?.name || strategy?.title;
    if (strategyName) params.set("strategy", String(strategyName));
    if (strategy?.id) params.set("strategy_id", String(strategy.id));
    if (chosenOfferId) params.set("offer_id", chosenOfferId);
    if (chosenGoal) params.set("goal", chosenGoal);
    navigate(`/create?${params.toString()}`);
  };

  const skipStrategyForLater = async () => {
    await seedFirstCampaignTasks(brandId);
    await seedDeferredTask({
      title: "Pick your first campaign strategy",
      link_to: "/strategy",
      brand_id: brandId,
    });
    await completeAndGoHome();
  };


  // ---------- helpers used by the reveal page ----------
  const hasProofVal = (v: any): boolean => {
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v).some((x) => hasProofVal(x));
    return String(v).trim().length > 0;
  };
  const hasProof = hasProofVal((brand as any)?.social_proof);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {step > 3 && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3 gap-3">
              <span className="truncate">Step {step} of {TOTAL} — {STEPS[step - 1]}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums">{Math.round((step / TOTAL) * 100)}%</span>
                <button
                  type="button"
                  onClick={() => finishLater(`Finish your ${STEPS[step - 1].toLowerCase()} setup`, "/dashboard")}
                  className="text-xs text-muted-foreground/80 underline-offset-2 hover:underline hover:text-foreground transition-colors"
                >
                  I'll finish setup later
                </button>
              </div>
            </div>
            <Progress value={(step / TOTAL) * 100} />
          </div>
        )}

        {/* ============== STEP 1 — Website only ============== */}
        {step === 1 && (autoStartFiredRef.current || step1Busy) && (
          <OnboardingLoadingOverlay visible statusLabel="Opening your site…" />
        )}
        {step === 1 && !autoStartFiredRef.current && !step1Busy && (
          <div className="min-h-[70vh] flex items-center justify-center py-8">
            <div className="w-full max-w-xl mx-auto">
              <div className="text-center mb-10 animate-fade-in">
                <div className="inline-block mb-8">
                  <img src={lumiLogo} alt="Lumi" className="h-14 object-contain mx-auto" />
                </div>

                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                  Drop your website.<br />
                  <span className="text-muted-foreground">Watch LUMI do the rest.</span>
                </h1>
              </div>

              <div className="rounded-3xl border bg-card shadow-sm p-6 sm:p-8 space-y-5 animate-fade-in">
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="yourbrand.com"
                  autoFocus
                  className="h-14 text-base rounded-xl"
                  onKeyDown={(e) => { if (e.key === "Enter" && websiteUrl.trim()) startStep1(); }}
                  disabled={step1Busy}
                />

                {showIgField ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">@</span>
                    <Input
                      value={instagramHandle}
                      onChange={(e) => setInstagramHandle(e.target.value)}
                      placeholder="your.instagram"
                      className="h-12 text-sm rounded-xl bg-muted/30"
                      onKeyDown={(e) => { if (e.key === "Enter" && websiteUrl.trim()) startStep1(); }}
                      disabled={step1Busy}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowIgField(true)}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                    + add your Instagram (optional)
                  </button>
                )}

                <Button
                  onClick={startStep1}
                  disabled={step1Busy || !websiteUrl.trim()}
                  className="w-full h-14 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20"
                >
                  {step1Busy ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Reading your brand…</>
                  ) : (
                    <>Read my brand <ArrowRight className="h-5 w-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 2 — Reveal page (streams in live) ============== */}
        {step === 2 && (() => {
          // Voice tone chips — prefer structured, standalone descriptors.
          // analyze-brand-voice actually writes this array as `tone_descriptors`
          // (see supabase/functions/analyze-brand-voice), each entry a short
          // adjective meant to stand alone ("warm", "no-nonsense", "editorial").
          // The old code checked tone_traits/tones/traits — none of which the
          // backend ever writes — so it always fell through to splitting the
          // narrative `brand_voice` SENTENCE on commas, which produces fragments
          // that only make sense read together, not as standalone chips.
          const vp: any = brand?.voice_profile || {};
          let tones: string[] = [];
          if (Array.isArray(vp?.tone_descriptors)) tones = vp.tone_descriptors;
          else if (Array.isArray(vp?.tone_traits)) tones = vp.tone_traits;
          else if (Array.isArray(vp?.tones)) tones = vp.tones;
          else if (Array.isArray(vp?.traits)) tones = vp.traits;
          // Last-resort fallback only — a comma-split sentence can still read as
          // connected fragments, so cap it at 3 short words instead of 5 longer
          // clauses to reduce how often that shows through.
          else if (typeof brand?.brand_voice === "string" && brand.brand_voice.trim()) {
            tones = brand.brand_voice
              .split(/[,;•·\n]+/)
              .map((s: string) => s.trim().replace(/\.+$/, ""))
              .filter((s: string) => s && s.length <= 20)
              .slice(0, 3);
          }
          tones = tones.filter(Boolean).slice(0, 5);

          const ap: any = brand?.audience_psychology || {};
          const idealClient: string =
            (typeof ap.target_audience === "string" && ap.target_audience) ||
            (typeof ap.ideal_client === "string" && ap.ideal_client) ||
            brand?.target_audience ||
            "";
          const firstPain: string = Array.isArray(ap.pain_points) ? (ap.pain_points[0] || "") : "";
          const firstDesire: string = Array.isArray(ap.desires) ? (ap.desires[0] || "") : "";

          // Proof + photos: show a REAL taste (1-3 photos, 1-2 testimonial quotes),
          // then tease anything beyond that as a reason to start the trial — same
          // "never announce an absence" principle as before, just with actual
          // previews instead of bare counts. See getTestimonialQuotes/
          // PHOTO_PREVIEW_ROLES above for why both shapes of social_proof are
          // normalized and why photos are role-filtered.
          const testimonialItems = getTestimonialQuotes(brand?.social_proof);
          const TESTIMONIAL_FREE_COUNT = 2;
          const testimonialsShown = testimonialItems.slice(0, TESTIMONIAL_FREE_COUNT);
          const testimonialTeaser = testimonialItems[TESTIMONIAL_FREE_COUNT] || null;
          const testimonialRemaining = Math.max(0, testimonialItems.length - TESTIMONIAL_FREE_COUNT - (testimonialTeaser ? 1 : 0));


          const brandDisplayName = brand?.name && brand.name !== placeholderNameRef.current ? brand.name : "";
          const siteHost = brand?.website_url ? brand.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

          return (
            <>
              <OnboardingLoadingOverlay
                visible={!canContinue}
                statusLabel={slowMode ? "Almost there — the deep read takes a beat longer." : WITTY_LINES[narrationIdx]}
              />
              <div className="min-h-[70vh] py-4">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-3 animate-fade-in">
                  <div className="inline-block">
                    <img src={lumiLogo} alt="Lumi" className="h-7 object-contain mx-auto" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                    {allRevealed ? (
                      <>This is you.{brandDisplayName ? <span className="text-muted-foreground"> {brandDisplayName}.</span> : null}</>
                    ) : (
                      <>Reading your brand.</>
                    )}
                  </h1>
                  <div className="min-h-[24px] text-sm text-muted-foreground">
                    {allRevealed ? (
                      <>Everything below came from {siteHost || "your site"}. Ready when you are.</>
                    ) : slowMode ? (
                      <span className="animate-fade-in">Almost there — the deep read takes a beat longer.</span>
                    ) : (
                      <span key={narrationIdx} className="animate-fade-in inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {WITTY_LINES[narrationIdx]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Live progress bar — always visible so the card never feels stuck. */}
                <div className="space-y-2" aria-hidden={allRevealed}>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 transition-all duration-500 ease-out"
                      style={{ width: `${Math.round((revealedCount / REVEAL_SECTIONS.length) * 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-medium">
                    {[
                      { key: "basics", label: "Voice", loading: loadingBrandBasics },
                      { key: "audience", label: "Audience", loading: loadingAudience },
                      { key: "proof", label: "Proof", loading: loadingProof },
                    ].map((s) => {
                      // Reflects whether the NETWORK CALL settled, not whether we chose
                      // to reveal its content — a quality-gated section (e.g. audience,
                      // withheld until it's genuinely grounded) shouldn't spin forever
                      // here just because we're deliberately not showing it yet below.
                      const done = !s.loading;
                      return (
                        <span
                          key={s.key}
                          className={
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border " +
                            (done
                              ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                              : "bg-muted border-border text-muted-foreground")
                          }
                        >
                          {done ? "✓" : <Loader2 className="h-2.5 w-2.5 animate-spin" />} {s.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Concurrent engagement card — placed ABOVE the reveal card, in a
                    fixed position, so it never gets pushed down the page as reveal
                    cards pop in below it while the user is typing. Runs while
                    extraction is still working so the wait feels like collaboration,
                    not staring at a spinner. Answers persist into
                    brand.audience_psychology + target_audience and localStorage so
                    PayoffAd + recommend-strategy pick them up. */}
                <div className="rounded-3xl border bg-gradient-to-br from-orange-500/5 via-pink-500/5 to-purple-600/5 p-6 sm:p-8 space-y-5 animate-fade-in">
                  <div>
                    <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                      While LUMI reads…
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      What do you want more of right now?
                    </h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {([
                      { id: "booked_calls", label: "Booked calls" },
                      { id: "leads", label: "Leads & email signups" },
                      { id: "sales", label: "Course or launch sales" },
                      { id: "followers", label: "More followers & DMs" },
                    ] as { id: GoalChoice; label: string }[]).map((opt) => {
                      const selected = goalChoice === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={async () => {
                            setGoalChoice(opt.id);
                            if (brandId && !goalPersistedRef.current) {
                              goalPersistedRef.current = true;
                              try {
                                localStorage.setItem(`lumi_onboarding_goal_${brandId}`, opt.id);
                                const currentAp = (brand?.audience_psychology as any) || {};
                                const nextAp = { ...currentAp, onboarding_goal: opt.id };
                                await supabase.from("brands").update({ audience_psychology: nextAp }).eq("id", brandId);
                                setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: nextAp }));
                              } catch { /* non-blocking */ }
                            } else if (brandId) {
                              localStorage.setItem(`lumi_onboarding_goal_${brandId}`, opt.id);
                              const currentAp = (brand?.audience_psychology as any) || {};
                              const nextAp = { ...currentAp, onboarding_goal: opt.id };
                              supabase.from("brands").update({ audience_psychology: nextAp }).eq("id", brandId);
                            }
                          }}
                          className={
                            "text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all " +
                            (selected
                              ? "border-pink-500 bg-white shadow-md text-foreground"
                              : "border-border bg-white/60 hover:border-pink-500/40 hover:bg-white text-foreground")
                          }
                          aria-pressed={selected}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* booked_calls/leads/sales: a real link, not a freeform "who's
                      your ideal client" essay — LUMI reads the actual page
                      (extract-offer-info) for a real price/page_goal, which is
                      what lets recommend-strategy pick lead vs. sales campaign
                      correctly instead of guessing. Required once a goal in
                      this group is picked — see answeredRequirement below. */}
                  {goalChoice && goalChoice !== "followers" && (
                    <div className="space-y-2 pt-1 animate-fade-in">
                      <label htmlFor="offer-url" className="text-sm font-semibold text-foreground">
                        {AD_LINK_COPY[goalChoice].label}
                      </label>
                      <Input
                        id="offer-url"
                        type="url"
                        inputMode="url"
                        value={offerHintUrl}
                        onChange={(e) => setOfferHintUrl(e.target.value)}
                        onBlur={submitAdLink}
                        placeholder={AD_LINK_COPY[goalChoice].placeholder}
                        className="rounded-xl"
                      />
                      {offerLinkBusy && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" /> Reading your page…
                        </p>
                      )}
                    </div>
                  )}

                  {/* "followers" is the one goal with no page to send someone to —
                      a binary split so recommend-strategy gets an explicit signal
                      (DM funnel vs. growth/awareness funnel) instead of guessing
                      from free text, which is what was silently over-recommending
                      the DM strategy for plain lead-magnet offers before. */}
                  {goalChoice === "followers" && (
                    <div className="space-y-2 pt-1 animate-fade-in">
                      <label className="text-sm font-semibold text-foreground">
                        Want more followers &amp; engagement, or more DMs?
                      </label>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {([
                          { id: "engagement", label: "Followers & engagement" },
                          { id: "dms", label: "DMs" },
                        ] as { id: FollowersIntent; label: string }[]).map((opt) => {
                          const selected = followersIntent === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setFollowersIntent(opt.id);
                                if (!brandId) return;
                                localStorage.setItem(`lumi_onboarding_followers_intent_${brandId}`, opt.id);
                                const currentAp = (brand?.audience_psychology as any) || {};
                                const nextAp = { ...currentAp, onboarding_followers_intent: opt.id };
                                supabase.from("brands").update({ audience_psychology: nextAp }).eq("id", brandId);
                                setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: nextAp }));
                              }}
                              className={
                                "text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all " +
                                (selected
                                  ? "border-pink-500 bg-white shadow-md text-foreground"
                                  : "border-border bg-white/60 hover:border-pink-500/40 hover:bg-white text-foreground")
                              }
                              aria-pressed={selected}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* One rounded card wrapping all reveals */}
                <div className="rounded-3xl border bg-card shadow-sm p-6 sm:p-8 space-y-6 min-h-[200px]">
                  {revealedCount === 0 && (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="flex gap-3">
                        {[0,1,2,3,4].map((i) => (
                          <div key={i} className="h-14 w-14 rounded-2xl bg-muted" />
                        ))}
                      </div>
                      <div className="h-3 w-48 bg-muted rounded mt-6" />
                      <div className="flex gap-2">
                        {[0,1,2].map((i) => (
                          <div key={i} className="h-6 w-20 rounded-full bg-muted" />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Your voice */}
                  {revealed.basics && (
                    <div className="animate-fade-in space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" /> Your voice
                      </div>
                      {tones.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tones.map((t, i) => (
                            <span
                              key={`${t}-${i}`}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-600/10 border border-pink-500/20 text-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : brand?.brand_voice ? (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{brand.brand_voice}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Your tone is still coming through…</p>
                      )}
                    </div>
                  )}

                  {revealed.audience && <div className="h-px bg-border" />}

                  {/* Who you're for */}
                  {revealed.audience && (
                    <div className="animate-fade-in space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Target className="h-4 w-4 text-muted-foreground" /> Who you're for
                      </div>
                      {idealClient && (
                        <p className="text-sm text-foreground leading-relaxed">{idealClient}</p>
                      )}
                      {(firstPain || firstDesire) && (
                        <div className="grid sm:grid-cols-2 gap-3 pt-1">
                          {firstPain && (
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Pain point</div>
                              <div className="text-sm text-foreground leading-snug">{firstPain}</div>
                            </div>
                          )}
                          {firstDesire && (
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Desire</div>
                              <div className="text-sm text-foreground leading-snug">{firstDesire}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Why they'll say yes — offer-specific objections LUMI
                      already anticipated, styled in this brand's own colors,
                      not LUMI's. Only for goals with a real offer link
                      (booked_calls/leads/sales, gated in submitAdLink above)
                      — "followers" has no offer page to ground this in. */}
                  {goalChoice && goalChoice !== "followers" && (offerPsychology || offerPsychologyLoading) && (
                    <>
                      <div className="h-px bg-border" />
                      <div className="animate-fade-in space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Sparkles className="h-4 w-4 text-muted-foreground" /> Why they'll say yes
                        </div>
                        {offerPsychologyLoading && !offerPsychology && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading what's stopping them from buying…
                          </div>
                        )}
                        {Array.isArray(offerPsychology?.specific_hesitations) && offerPsychology.specific_hesitations.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                              What's stopping them — until now
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {offerPsychology.specific_hesitations.slice(0, 4).map((h: string, i: number) => (
                                <div
                                  key={i}
                                  className="rounded-2xl p-3 text-sm text-foreground leading-snug border-l-4"
                                  style={{
                                    borderLeftColor: "#ec4899",
                                    backgroundColor: "rgba(236,72,153,0.06)",
                                  }}
                                >
                                  {h}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {offerPsychology?.what_finally_convinces && (
                          <p className="text-sm text-foreground leading-relaxed">
                            <span className="font-semibold">What gets them to yes: </span>
                            {offerPsychology.what_finally_convinces}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {revealed.proof && showFoundSection && <div className="h-px bg-border" />}

                  {/* Found on your site — a real taste (up to 3 photos, up to 2
                      testimonials), never a bare count and never an announced
                      absence. Anything beyond the free preview is teased with a
                      blur + lock rather than hidden outright, so "start your
                      trial to see the rest" reads as a reason to convert, not
                      a wall. Renders nothing at all if there's genuinely
                      nothing found and nothing still in flight. */}
                  {revealed.proof && showFoundSection && (
                    <div className="animate-fade-in space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-muted-foreground" /> Found on your site
                      </div>

                      {testimonialsShown.length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-2">
                          {testimonialsShown.map((t, i) => (
                            <div key={i} className="rounded-2xl bg-muted/40 p-3 space-y-1">
                              <Quote className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-sm text-foreground leading-snug line-clamp-3">{t.text}</p>
                              {t.attribution && (
                                <p className="text-[11px] text-muted-foreground font-medium">— {t.attribution}</p>
                              )}
                            </div>
                          ))}
                          {testimonialTeaser && (
                            <div className="relative rounded-2xl bg-muted/40 p-3 overflow-hidden">
                              <Quote className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <p className="text-sm text-foreground/60 leading-snug line-clamp-3 blur-[3px] select-none">
                                {testimonialTeaser.text}
                              </p>
                              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <Lock className="h-3 w-3" />
                                  {testimonialRemaining > 0 ? `+${testimonialRemaining + 1} more` : "1 more"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {(photoTeaser || testimonialTeaser) && (
                        <p className="text-[11px] text-muted-foreground text-center pt-1">
                          Unlock everything we found when you sign up — 50% off your first month.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Primary CTA — once a goal is picked, its follow-up (link or
                    followers sub-choice) is required before continuing. Skipping
                    the goal picker entirely still falls back to "leads" with no
                    requirement, same as before, so the user is never trapped. */}
                <div className="flex flex-col items-center gap-2 pt-2">
                  {canContinue && !goalChoice && (
                    <p className="text-xs text-muted-foreground animate-fade-in">
                      No goal picked? We'll aim for leads &amp; booked calls — you can change it anytime.
                    </p>
                  )}
                  {canContinue && goalChoice && !(goalChoice === "followers" ? !!followersIntent : !!offerHintUrl.trim()) && (
                    <p className="text-xs text-muted-foreground animate-fade-in">
                      {goalChoice === "followers" ? "Pick one above to continue" : "Add a link above to continue"}
                    </p>
                  )}
                  <Button
                    onClick={async () => {
                      // Default to a sensible lead-gen goal so the user is never trapped.
                      if (!goalChoice) {
                        const fallback: GoalChoice = "leads";
                        setGoalChoice(fallback);
                        if (brandId) {
                          try {
                            localStorage.setItem(`lumi_onboarding_goal_${brandId}`, fallback);
                            const currentAp = (brand?.audience_psychology as any) || {};
                            const nextAp = { ...currentAp, onboarding_goal: fallback };
                            supabase.from("brands").update({ audience_psychology: nextAp }).eq("id", brandId);
                            setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: nextAp }));
                          } catch { /* non-blocking */ }
                        }
                      }
                      advance();
                    }}
                    disabled={!canContinue || (!!goalChoice && !(goalChoice === "followers" ? !!followersIntent : !!offerHintUrl.trim()))}
                    className="h-14 px-8 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {canContinue ? (
                      <>That's me — make my ad <ArrowRight className="h-5 w-5 ml-2" /></>
                    ) : (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Still reading…</>
                    )}
                  </Button>
                </div>
              </div>
              </div>
            </>
          );
        })()}


        {/* ============== STEP 3 — Offer sales page ============== */}
        {/* ============== STEP 3 — Payoff: real ad in their brand ============== */}
        {step === 3 && brandId && (
          <PayoffAdScreen
            brandId={brandId}
            brand={brand}
            onAdvance={advance}
            onBack={back}
          />
        )}

        {/* ============== STEP 4 — Offer sales page ============== */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Your offer</CardTitle>
              <CardDescription>Drop your sales page URL — we'll pull the offer for you. No paragraph to write.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sales page URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)}
                    placeholder="https://yourbrand.com/program"
                    onKeyDown={(e) => { if (e.key === "Enter") submitOfferUrl(); }}
                    disabled={offerBusy}
                  />
                  <Button onClick={submitOfferUrl} disabled={offerBusy}>
                    {offerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pull offer"}
                  </Button>
                </div>
              </div>

              {offerBusy && offerStatusMsg && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {offerStatusMsg}
                </div>
              )}

              {offers.length === 0 && !offerBusy ? (
                <SetupPrompt
                  title="No offer yet"
                  description="Add at least one sales page so LUMI can write campaigns that actually convert."
                  ctaLabel="Skip for now"
                  onCta={() => finishLater("Add your offer's sales page", "/dashboard")}
                />
              ) : (
                <div className="space-y-3">
                  {offers.map((o) => (
                    <OfferRowEditor key={o.id} offer={o} brand={brand} onSave={(p) => updateOffer(o.id, p)} />
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  
                  <Button onClick={advance}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== STEP 5 — Connect Meta ============== */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Connect Meta <span className="text-xs font-normal text-muted-foreground ml-1">· optional</span></CardTitle>
              <CardDescription>
                Connect now, or later when you launch your first campaign — totally up to you. If you connect now, LUMI will check your Page, Instagram, and ad account so launching is one click.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {brandId && (
                <MetaAccountConnect
                  brandId={brandId}
                  currentAccountId={brand?.meta_account_id}
                  currentPageId={brand?.meta_page_id}
                  currentPageName={brand?.meta_page_name}
                  currentInstagramId={brand?.instagram_account_id}
                  currentInstagramName={brand?.instagram_account_name}
                  onUpdate={async () => {
                    const { data } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
                    if (data) setBrand(data);
                  }}
                />
              )}
              <p className="text-xs text-muted-foreground">
                If your Instagram is connected to your Page but not added to your ad account, LUMI will detect it and offer a one-click fix.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => finishLater("Connect Meta when you're ready to launch", "/dashboard")}
                  >
                    Skip for now
                  </Button>
                  <Button onClick={advance}>
                    {brand?.meta_account_id ? "Continue" : "Continue without connecting"} <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== STEP 6 — Strategy + first campaign ============== */}
        {step === 6 && (() => {
          const primaryOffer = offers?.[0];
          const offerName = primaryOffer?.name || "your offer";
          const GOAL_OPTIONS: { value: string; label: string; hint: string }[] = [
            { value: "promote_offer", label: "Promote a specific offer", hint: "Course, program, product, package." },
            { value: "get_leads", label: "Get leads", hint: "Email opt-ins from a freebie or waitlist." },
            { value: "book_calls", label: "Book sales calls", hint: "Discovery / strategy / consult calls." },
            { value: "dm_leads", label: "Get DM conversations", hint: "Trigger Instagram/Messenger DMs." },
            { value: "grow_social", label: "Grow my social following", hint: "Boost reach and follows on IG/FB." },
            { value: "local", label: "Drive local visits", hint: "Local-business foot traffic and calls." },
            { value: "event_location", label: "Fill an event or location", hint: "Workshop, retreat, in-person event." },
          ];

          // ── A) Initial choice screen ─────────────────────────────────
          if (!strategyChoice && !strategy && !strategyLoading) {
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-lumi-pink-1" /> Ready to build your first campaign?</CardTitle>
                  <CardDescription>Pick how you want LUMI to plan it. You can change directions anytime.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setChosenOfferId(primaryOffer?.id || null);
                      setChosenGoal("promote_offer");
                      setStrategyChoice("offer");
                      runRecommendStrategy({ offer_id: primaryOffer?.id || null, user_goal: "promote_offer" });
                    }}
                    disabled={!primaryOffer}
                    className="w-full text-left rounded-lg border p-4 hover:bg-muted/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={primaryOffer ? { borderLeftWidth: 4, borderLeftColor: "var(--brand-accent)" } : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommended</div>
                        <div className="font-semibold text-base">Build a plan around {offerName}</div>
                        <p className="text-sm text-muted-foreground mt-1">LUMI will craft a campaign tuned to promote this offer.</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    </div>
                    {!primaryOffer && <p className="text-xs text-muted-foreground mt-2 italic">Add an offer in the previous step to enable this.</p>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPickingGoal(true)}
                    className="w-full text-left rounded-lg border p-4 hover:bg-muted/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-base">I have a different goal</div>
                        <p className="text-sm text-muted-foreground mt-1">Lead with a goal — leads, calls, DMs, local visits, or event fills.</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    </div>
                  </button>

                  {pickingGoal && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 animate-fade-in">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-1">Pick a goal</div>
                      {GOAL_OPTIONS.map((g) => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => {
                            setChosenGoal(g.value);
                            setChosenOfferId(g.value === "promote_offer" ? (primaryOffer?.id || null) : null);
                            setStrategyChoice("goal");
                            setPickingGoal(false);
                            runRecommendStrategy({
                              offer_id: g.value === "promote_offer" ? (primaryOffer?.id || null) : null,
                              user_goal: g.value,
                            });
                          }}
                          className="w-full text-left rounded-md border bg-background p-3 hover:bg-muted/40 transition"
                        >
                          <div className="font-medium text-sm">{g.label}</div>
                          <p className="text-xs text-muted-foreground mt-0.5">{g.hint}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                    <button
                      type="button"
                      onClick={skipStrategyForLater}
                      className="text-xs text-muted-foreground/80 hover:text-foreground underline-offset-2 hover:underline transition-colors"
                    >
                      Skip for now — I'll set this up later
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          // ── B) Recommended plan + single CTA ──────────────────────────
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Your suggested strategy</CardTitle>
                <CardDescription>A starting plan + the exact steps to launch your first campaign.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {strategyLoading && <LumiThinkingInline isOpen={true} customCopy={["Matching the right play to your goal…"]} />}
                {!strategyLoading && strategy && (
                  <div
                    className="rounded-lg border bg-muted/30 p-4 space-y-2"
                    style={{ borderLeftWidth: 4, borderLeftColor: "var(--brand-accent)" }}
                  >
                    <h3 className="font-semibold">{strategy.name || strategy.title || "Your starting strategy"}</h3>
                    {strategy.description && <p className="text-sm text-muted-foreground">{strategy.description}</p>}
                    {strategy.why_it_works && (
                      <p className="text-sm"><span className="font-medium">Why it works: </span>{strategy.why_it_works}</p>
                    )}
                    {Array.isArray(strategy.campaigns) && strategy.campaigns.length > 0 && (
                      <ul className="text-sm list-disc pl-5 space-y-1">
                        {strategy.campaigns.slice(0, 5).map((c: any, i: number) => (
                          <li key={i}>{c.name || c.objective || JSON.stringify(c)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!strategyLoading && (
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Pick a campaign angle</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Approve your ad copy</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Approve your first creative</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Launch your first campaign</li>
                  </ul>
                )}

                <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStrategy(null);
                      setStrategyChoice(null);
                      setChosenGoal(null);
                      setChosenOfferId(null);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Change choice
                  </Button>
                  <Button
                    onClick={startFirstCampaign}
                    disabled={strategyLoading}
                    style={brand?._kit?.colors?.[0] ? { backgroundColor: brand._kit.colors[0], color: "#fff", borderColor: brand._kit.colors[0] } : undefined}
                  >
                    Start my first campaign <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

// ───────────────── small UI helpers ─────────────────

const SKELETON_LABELS: Record<string, { title: string; rows: number }> = {
  basics: { title: "Brand basics", rows: 3 },
  design: { title: "Design guide", rows: 2 },
  audience: { title: "Audience", rows: 4 },
  proof: { title: "Social proof", rows: 2 },
  images: { title: "Brand images", rows: 3 },
};

function TimeoutNotice({ label }: { label: string }) {
  return (
    <div className="mb-2 rounded-md border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 animate-fade-in">
      <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>We couldn't grab {label} from your site — no big deal, you can fill it in below. Takes about 10 seconds.</span>
    </div>
  );
}

function RevealGate({ revealed, kind, children }: { revealed: boolean; kind: keyof typeof SKELETON_LABELS; children: React.ReactNode }) {
  if (revealed) {
    return <div className="animate-fade-in">{children}</div>;
  }
  const meta = SKELETON_LABELS[kind];
  return (
    <Card aria-busy="true" className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-muted shimmer" />
          <div className="h-4 w-32 rounded bg-muted shimmer" />
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">{meta.title}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: meta.rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-muted shimmer" />
            <div className="h-4 w-full rounded bg-muted shimmer" />
            {i % 2 === 0 && <div className="h-4 w-2/3 rounded bg-muted shimmer" />}
          </div>
        ))}
      </CardContent>
      <style>{`
        .shimmer{position:relative;overflow:hidden}
        .shimmer::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,hsl(var(--foreground)/0.06),transparent);animation:shimmer 1.4s infinite}
        @keyframes shimmer{100%{transform:translateX(100%)}}
      `}</style>
    </Card>
  );
}

function Typewriter({ text, speed = 18 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <>{text.slice(0, n)}{n < text.length && <span className="opacity-60">▍</span>}</>;
}



function SectionShell({
  loading,
  loadingMsg,
  children,
}: {
  loading: boolean;
  loadingMsg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {loading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="animate-pulse">{loadingMsg}</span>
        </div>
      )}
      <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {children}
      </div>
    </div>
  );
}

function RevealRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border p-3 bg-card">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {value ? (
        <div className="text-sm">{value}</div>
      ) : (
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
      )}
    </div>
  );
}

function ReviewDesignCard({ brand, onSave }: { brand: any; onSave: (p: any) => Promise<void> }) {
  const kitColors: string[] = brand?._kit?.colors || [];
  const kitFonts: string[] = brand?._kit?.fonts || [];
  const [editing, setEditing] = useState(false);
  const [colors, setColors] = useState<string>(kitColors.join(", "));
  const [fonts, setFonts] = useState<string>(kitFonts.join(", "));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setColors((brand?._kit?.colors || []).join(", "));
    setFonts((brand?._kit?.fonts || []).join(", "));
  }, [brand?._kit?.colors, brand?._kit?.fonts]);

  const parsedColors = (editing ? colors.split(",").map((s) => s.trim()).filter(Boolean) : kitColors);
  const parsedFonts = (editing ? fonts.split(",").map((s) => s.trim()).filter(Boolean) : kitFonts);

  const save = async () => {
    if (!brand?.id || !brand?.user_id) return;
    setSaving(true);
    try {
      const patch: any = {
        user_id: brand.user_id,
        brand_id: brand.id,
        colors: colors.split(",").map((s) => s.trim()).filter(Boolean),
        fonts: fonts.split(",").map((s) => s.trim()).filter(Boolean),
        status: "confirmed",
      };
      const { error } = await supabase
        .from("brand_kits" as any)
        .upsert(patch, { onConflict: "user_id,brand_id" });
      if (error) throw error;
      await onSave({ _kit: { ...(brand?._kit || {}), colors: patch.colors, fonts: patch.fonts } });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Design guide</CardTitle>
          <CardDescription className="text-xs">Pulled from your website — edit anything that's off.</CardDescription>
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7">
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Colors */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Palette className="h-3 w-3" /> Brand colors
          </div>
          {parsedColors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {parsedColors.slice(0, 12).map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border bg-card p-2">
                  <div className="h-8 w-8 rounded shrink-0 border" style={{ background: c }} />
                  <span className="text-xs font-mono uppercase truncate">{c}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No colors found — add your own below.</p>
          )}
          {editing && (
            <Input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="#000000, #FFFFFF" className="mt-2" />
          )}
        </div>

        {/* Fonts */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Type className="h-3 w-3" /> Brand fonts
          </div>
          {parsedFonts.length > 0 ? (
            <div className="space-y-2">
              {parsedFonts.slice(0, 4).map((f, i) => (
                <div key={i} className="rounded-md border bg-card px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{f}</div>
                  <div className="text-xl leading-tight" style={{ fontFamily: `'${f}', system-ui, sans-serif` }}>
                    The quick brown fox
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No fonts detected — add your own below.</p>
          )}
          {editing && (
            <Input value={fonts} onChange={(e) => setFonts(e.target.value)} placeholder="Inter, Playfair Display" className="mt-2" />
          )}
        </div>

        {editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="lumi" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setColors(kitColors.join(", ")); setFonts(kitFonts.join(", ")); }}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewVoiceCard({ brand, onSave }: { brand: any; onSave: (p: any) => Promise<void> }) {
  const [voice, setVoice] = useState<string>(brand?.brand_voice || "");
  useEffect(() => setVoice(brand?.brand_voice || ""), [brand?.brand_voice]);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Brand voice</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!brand?.brand_voice && (
          <p className="text-xs text-muted-foreground">Edit the auto-pulled voice if it's slightly off.</p>
        )}
        <Textarea rows={5} value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Warm, witty, never salesy…" />
        <Button size="sm" variant="outline" onClick={() => onSave({ brand_voice: voice })}>Save</Button>
      </CardContent>
    </Card>
  );
}

function ReviewAudienceCard({ brand, onSave }: { brand: any; onSave: (p: any) => Promise<void> }) {
  const p = brand?.audience_psychology || {};
  const [pains, setPains] = useState<string>((p.pain_points || []).join("\n"));
  const [desires, setDesires] = useState<string>((p.desires || []).join("\n"));
  const [objections, setObjections] = useState<string>((p.objections || []).join("\n"));
  const [demographics, setDemographics] = useState<string>(
    typeof p.demographics === "string"
      ? p.demographics
      : (p.demographics ? JSON.stringify(p.demographics, null, 2) : "")
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const q = brand?.audience_psychology || {};
    setPains((q.pain_points || []).join("\n"));
    setDesires((q.desires || []).join("\n"));
    setObjections((q.objections || []).join("\n"));
    setDemographics(
      typeof q.demographics === "string"
        ? q.demographics
        : (q.demographics ? JSON.stringify(q.demographics, null, 2) : "")
    );
  }, [brand?.audience_psychology]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        audience_psychology: {
          ...p,
          pain_points: pains.split("\n").map((s) => s.trim()).filter(Boolean),
          desires: desires.split("\n").map((s) => s.trim()).filter(Boolean),
          objections: objections.split("\n").map((s) => s.trim()).filter(Boolean),
          demographics: demographics.trim() || null,
        },
      });
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  };

  const [editing, setEditing] = useState(false);
  const painList = pains.split("\n").map((s) => s.trim()).filter(Boolean);
  const desireList = desires.split("\n").map((s) => s.trim()).filter(Boolean);
  const objectionList = objections.split("\n").map((s) => s.trim()).filter(Boolean);

  const cancel = () => {
    const q = brand?.audience_psychology || {};
    setPains((q.pain_points || []).join("\n"));
    setDesires((q.desires || []).join("\n"));
    setObjections((q.objections || []).join("\n"));
    setDemographics(
      typeof q.demographics === "string"
        ? q.demographics
        : (q.demographics ? JSON.stringify(q.demographics, null, 2) : "")
    );
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Audience</CardTitle>
          <CardDescription className="text-xs">Psychology + demographics. Edit anything that's off — these power every ad LUMI writes.</CardDescription>
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7">
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <PersonaSummary
          demographics={demographics}
          topDesire={desireList[0]}
          topPain={painList[0]}
        />

        {editing ? (
          <>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Demographics</Label>
              <Textarea rows={3} value={demographics} onChange={(e) => setDemographics(e.target.value)} placeholder="Women, 30–45, US/Canada, mid-career, $80k+ household income, lives in a metro area…" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pain points (one per line)</Label>
              <Textarea rows={4} value={pains} onChange={(e) => setPains(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Desires</Label>
              <Textarea rows={4} value={desires} onChange={(e) => setDesires(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Objections</Label>
              <Textarea rows={4} value={objections} onChange={(e) => setObjections(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="lumi" onClick={async () => { await save(); setEditing(false); }} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <AudienceSection icon={Users} label="Demographics" emptyHint="Add who they are — age, location, lifestyle." onEdit={() => setEditing(true)}>
              {demographics ? (
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{demographics}</p>
              ) : null}
            </AudienceSection>

            <AudienceSection icon={Target} label="Pain points" count={painList.length} emptyHint="What keeps them stuck or up at night?" onEdit={() => setEditing(true)}>
              {painList.length > 0 && (
                <ul className="space-y-1.5">
                  {painList.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug text-foreground/85">
                      <span className="mt-2 h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: "var(--brand-accent)" }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AudienceSection>

            <AudienceSection icon={Sparkles} label="Desires" count={desireList.length} emptyHint="What outcome would feel like a win?" onEdit={() => setEditing(true)}>
              {desireList.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {desireList.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-xs text-foreground/85"
                      style={{ borderColor: "var(--brand-accent)" }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </AudienceSection>

            <AudienceSection icon={MessageSquare} label="Objections" count={objectionList.length} emptyHint="Why might they hesitate to buy?" onEdit={() => setEditing(true)}>
              {objectionList.length > 0 && (
                <ul className="space-y-1.5">
                  {objectionList.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug text-foreground/85">
                      <span className="text-muted-foreground shrink-0">·</span>
                      <span className="italic">"{item}"</span>
                    </li>
                  ))}
                </ul>
              )}
            </AudienceSection>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AudienceSection({
  icon: Icon,
  label,
  count,
  emptyHint,
  onEdit,
  children,
}: {
  icon: any;
  label: string;
  count?: number;
  emptyHint?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  const hasContent = !!children && (Array.isArray(children) ? children.some(Boolean) : true);
  return (
    <div
      className="rounded-lg border bg-muted/30 p-4 space-y-2"
      style={{ borderLeftWidth: 4, borderLeftColor: "var(--brand-accent)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
          {typeof count === "number" && count > 0 && (
            <span className="text-muted-foreground/60">· {count}</span>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            Edit
          </button>
        )}
      </div>
      {hasContent ? (
        children
      ) : (
        <p className="text-xs italic text-muted-foreground">{emptyHint || "Nothing yet."}</p>
      )}
    </div>
  );
}

function BrandBasicsCard({ brand, placeholderName, onSave }: { brand: any; placeholderName?: string; onSave: (p: any) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  // Treat the domain-slug placeholder as "no name yet" — never show it to the user.
  const rawName: string = brand?.name || "";
  const isPlaceholderName = !!placeholderName && rawName.trim().toLowerCase() === placeholderName.trim().toLowerCase();
  const realName = isPlaceholderName ? "" : rawName;

  const [name, setName] = useState<string>(realName);
  const [desc, setDesc] = useState<string>(brand?.value_proposition || "");
  const [voice, setVoice] = useState<string>(brand?.brand_voice || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(realName);
    setDesc(brand?.value_proposition || "");
    setVoice(brand?.brand_voice || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand?.id, brand?.name, brand?.value_proposition, brand?.brand_voice]);

  const cancel = () => {
    setEditing(false);
    setName(realName);
    setDesc(brand?.value_proposition || "");
    setVoice(brand?.brand_voice || "");
  };
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ name, value_proposition: desc, brand_voice: voice });
      toast.success("Saved");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Brand basics</CardTitle>
          <CardDescription className="text-xs">Name, what you do, and how you sound.</CardDescription>
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7">
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand name</Label>
          {editing ? (
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your brand" />
          ) : realName ? (
            <div className="text-base font-medium animate-fade-in"><Typewriter text={realName} /></div>
          ) : (
            <div className="text-base font-medium text-muted-foreground italic">
              Your brand <button type="button" onClick={() => setEditing(true)} className="not-italic text-xs ml-2 underline text-primary">add a name</button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">What you do</Label>
          {editing ? (
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          ) : desc ? (
            <p className="text-sm leading-relaxed animate-fade-in"><Typewriter text={desc} /></p>
          ) : (
            <p className="text-sm leading-relaxed"><span className="italic text-muted-foreground">Not set</span></p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand voice</Label>
          {editing ? (
            <Textarea rows={6} value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Warm, witty, never salesy…" />
          ) : voice ? (
            <blockquote
              className="relative rounded-lg border-l-4 bg-muted/30 px-5 py-4 text-base md:text-lg leading-relaxed italic text-foreground/90 whitespace-pre-wrap"
              style={{
                borderLeftColor: "var(--brand-accent)",
                fontFamily: brand?._kit?.fonts?.[0]
                  ? `"${brand._kit.fonts[0]}", Georgia, serif`
                  : 'Georgia, "Times New Roman", serif',
              }}
            >
              <Quote className="absolute -top-2 -left-2 h-5 w-5 opacity-40" style={{ color: "var(--brand-accent)" }} />
              {voice}
            </blockquote>
          ) : (
            <p className="text-sm leading-relaxed"><span className="italic text-muted-foreground">Not set</span></p>
          )}
        </div>
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="lumi" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OfferRowEditor({ offer, brand, onSave }: { offer: any; brand?: any; onSave: (p: any) => Promise<void> }) {
  const [name, setName] = useState(offer.name || "");
  const [description, setDescription] = useState(offer.description || "");
  const [price, setPrice] = useState(offer.price_point || "");
  const [outcome, setOutcome] = useState(offer.target_outcome || "");
  const useBrandStyle = offer.use_brand_style_defaults !== false;
  const [styleOverride, setStyleOverride] = useState(!useBrandStyle);
  const so = offer.style_overrides || {};
  const [colors, setColors] = useState<string>((so.colors || []).join(", "));
  const [fonts, setFonts] = useState<string>((so.fonts || []).join(", "));
  const [designPulled, setDesignPulled] = useState(false);
  const [pullingDesign, setPullingDesign] = useState(false);

  const oap = offer.offer_audience_psychology || {};
  const [pains, setPains] = useState<string>((oap.pain_points || []).join("\n"));
  const [desires, setDesires] = useState<string>((oap.desires || []).join("\n"));
  const [objections, setObjections] = useState<string>((oap.objections || []).join("\n"));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(offer.name || "");
    setDescription(offer.description || "");
    setPrice(offer.price_point || "");
    setOutcome(offer.target_outcome || "");
    setStyleOverride(offer.use_brand_style_defaults === false);
    setColors(((offer.style_overrides || {}).colors || []).join(", "));
    setFonts(((offer.style_overrides || {}).fonts || []).join(", "));
    const q = offer.offer_audience_psychology || {};
    setPains((q.pain_points || []).join("\n"));
    setDesires((q.desires || []).join("\n"));
    setObjections((q.objections || []).join("\n"));
  }, [offer.id]);

  const brandColors: string[] = brand?._kit?.colors || [];
  const brandFonts: string[] = brand?._kit?.fonts || [];
  const brandPains: string[] = brand?.audience_psychology?.pain_points || [];
  const brandDesires: string[] = brand?.audience_psychology?.desires || [];
  const brandObjections: string[] = brand?.audience_psychology?.objections || [];

  const parsedColors = colors.split(",").map((s) => s.trim()).filter(Boolean);
  const parsedFonts = fonts.split(",").map((s) => s.trim()).filter(Boolean);

  const pullOfferDesign = async () => {
    if (!offer.url) { toast.error("This offer has no URL to pull from"); return; }
    setPullingDesign(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-brand", { body: { url: offer.url } });
      if (error) throw error;
      const d: any = data || {};
      const pulledColors: string[] = Array.isArray(d.colors) ? d.colors.filter(Boolean) : [];
      const pulledFonts: string[] = Array.isArray(d.fonts) ? d.fonts.filter(Boolean) : [];
      if (pulledColors.length) setColors(pulledColors.join(", "));
      if (pulledFonts.length) setFonts(pulledFonts.join(", "));
      setDesignPulled(true);
      if (pulledColors.length || pulledFonts.length) {
        toast.success("Pulled this offer's design guide");
      } else {
        toast.message("Couldn't detect colors or fonts on that page");
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't pull design from this page");
    } finally {
      setPullingDesign(false);
    }
  };

  const onToggleStyle = (next: boolean) => {
    setStyleOverride(next);
    if (next && !designPulled && !colors.trim() && !fonts.trim() && offer.url) {
      pullOfferDesign();
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        description,
        price_point: price,
        target_outcome: outcome,
        use_brand_style_defaults: !styleOverride,
        style_overrides: styleOverride ? { colors: parsedColors, fonts: parsedFonts } : {},
        offer_audience_psychology: {
          ...oap,
          pain_points: pains.split("\n").map((s) => s.trim()).filter(Boolean),
          desires: desires.split("\n").map((s) => s.trim()).filter(Boolean),
          objections: objections.split("\n").map((s) => s.trim()).filter(Boolean),
        },
      });
      toast.success("Offer saved");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="text-xs text-muted-foreground truncate">{offer.url}</div>
        <CardTitle className="text-base">{name || "Untitled offer"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Core offer info */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Offer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Offer name" />
          </div>
          <div>
            <Label className="text-xs">Price</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$297 or $97/mo" />
          </div>
        </div>
        <div>
          <Label className="text-xs">What this offer is</Label>
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this offer?" />
        </div>
        <div>
          <Label className="text-xs">Target outcome (before → after)</Label>
          <Textarea rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Before: … After: …" />
        </div>

        {/* Design guide */}
        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium"><Palette className="h-4 w-4" /> Design guide</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {styleOverride ? "Custom colors & fonts for this offer." : "Using your brand's default design guide."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor={`style-${offer.id}`} className="text-xs">Custom</Label>
              <Switch id={`style-${offer.id}`} checked={styleOverride} onCheckedChange={onToggleStyle} />
            </div>
          </div>

          {!styleOverride ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {brandColors.slice(0, 8).map((c, i) => (
                  <div key={i} className="h-6 w-6 rounded border" style={{ background: c }} title={c} />
                ))}
                {brandColors.length === 0 && <span className="text-xs text-muted-foreground italic">No brand colors set yet.</span>}
              </div>
              {brandFonts.length > 0 && (
                <div className="text-xs text-muted-foreground">Fonts: <span className="font-medium text-foreground">{brandFonts.join(", ")}</span></div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Offer colors (comma-separated hex)</Label>
                <Input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="#000000, #FFFFFF" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {parsedColors.slice(0, 12).map((c, i) => (
                    <div key={i} className="h-7 w-7 rounded border" style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Offer fonts</Label>
                <Input value={fonts} onChange={(e) => setFonts(e.target.value)} placeholder="Inter, Playfair Display" />
              </div>
              {offer.url && (
                <Button type="button" size="sm" variant="outline" onClick={pullOfferDesign} disabled={pullingDesign}>
                  {pullingDesign ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Palette className="h-3 w-3 mr-1" />}
                  {pullingDesign ? "Pulling design…" : "Re-pull design from this page"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Offer-specific audience psychology */}
        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium"><Brain className="h-4 w-4" /> Audience psychology for this offer</div>
            <p className="text-xs text-muted-foreground mt-0.5">Layers on top of your brand-level audience. Add what's specific to <span className="italic">this</span> offer.</p>
          </div>

          {(brandPains.length > 0 || brandDesires.length > 0 || brandObjections.length > 0) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View brand-level psychology (inherited)</summary>
              <div className="mt-2 grid sm:grid-cols-3 gap-2">
                <div><div className="font-medium mb-1">Pains</div><ul className="space-y-0.5 text-muted-foreground">{brandPains.slice(0,4).map((p,i)=>(<li key={i}>• {p}</li>))}</ul></div>
                <div><div className="font-medium mb-1">Desires</div><ul className="space-y-0.5 text-muted-foreground">{brandDesires.slice(0,4).map((p,i)=>(<li key={i}>• {p}</li>))}</ul></div>
                <div><div className="font-medium mb-1">Objections</div><ul className="space-y-0.5 text-muted-foreground">{brandObjections.slice(0,4).map((p,i)=>(<li key={i}>• {p}</li>))}</ul></div>
              </div>
            </details>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Pain points (one per line)</Label>
              <Textarea rows={4} value={pains} onChange={(e) => setPains(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Desires / benefits</Label>
              <Textarea rows={4} value={desires} onChange={(e) => setDesires(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Objections</Label>
              <Textarea rows={4} value={objections} onChange={(e) => setObjections(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <Button size="sm" variant="lumi" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Save offer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function ReviewProofCard({ brand, onSave, loading }: { brand: any; onSave: (p: any) => Promise<void>; loading?: boolean }) {
  const sp = brand?.social_proof;
  const [editing, setEditing] = useState(false);

  // Normalize into grouped sections
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {
      testimonials: [], case_studies: [], stats: [], awards: [], press_features: [], credentials: [], notable_clients: [],
    };
    if (!sp) return g;
    if (typeof sp === "string") { g.testimonials = [sp]; return g; }
    if (Array.isArray(sp)) { g.testimonials = sp.filter(Boolean); return g; }
    if (typeof sp === "object") {
      for (const k of Object.keys(g)) {
        if (Array.isArray((sp as any)[k])) g[k] = (sp as any)[k].filter(Boolean);
      }
    }
    return g;
  }, [sp]);

  const flatten = (sp: any): string => {
    if (!sp) return "";
    if (typeof sp === "string") return sp;
    if (Array.isArray(sp)) return sp.filter(Boolean).map((x) => typeof x === "string" ? x : (x?.quote || x?.title || JSON.stringify(x))).join("\n");
    const lines: string[] = [];
    const push = (label: string, items: any[]) => {
      items.filter(Boolean).forEach((it) => {
        if (typeof it === "string") lines.push(`${label}: ${it}`);
        else if (it?.quote) lines.push(`${label}: "${it.quote}"${it.attribution ? ` — ${it.attribution}` : ""}${it.result ? ` (${it.result})` : ""}`);
        else if (it?.outlet) lines.push(`${label}: ${it.outlet}${it.context ? ` — ${it.context}` : ""}`);
        else if (it?.title) lines.push(`${label}: ${it.title}`);
        else if (it?.name) lines.push(`${label}: ${it.name}`);
      });
    };
    push("Testimonial", groups.testimonials);
    push("Case study", groups.case_studies);
    push("Stat", groups.stats);
    push("Award", groups.awards);
    push("Press", groups.press_features);
    push("Credential", groups.credentials);
    push("Client", groups.notable_clients);
    return lines.join("\n");
  };

  const [proof, setProof] = useState<string>(flatten(sp));
  useEffect(() => { setProof(flatten(sp)); }, [sp]);

  const renderItem = (it: any): { primary: string; secondary?: string } => {
    if (typeof it === "string") return { primary: it };
    if (it?.quote) return { primary: `"${it.quote}"`, secondary: [it.attribution, it.result].filter(Boolean).join(" • ") };
    if (it?.outlet) return { primary: it.outlet, secondary: it.context };
    if (it?.title) return { primary: it.title, secondary: it.detail };
    if (it?.name) return { primary: it.name, secondary: it.detail };
    if (it?.value) return { primary: it.value, secondary: it.label };
    return { primary: String(it) };
  };

  const sections: { key: keyof typeof groups; label: string; icon: any; tint: string }[] = [
    { key: "testimonials", label: "Testimonials", icon: Quote, tint: "border-l-primary" },
    { key: "case_studies", label: "Case studies", icon: Briefcase, tint: "border-l-primary" },
    { key: "stats", label: "Stats & results", icon: BarChart3, tint: "border-l-emerald-500" },
    { key: "awards", label: "Awards", icon: Award, tint: "border-l-amber-500" },
    { key: "press_features", label: "Press features", icon: Newspaper, tint: "border-l-sky-500" },
    { key: "credentials", label: "Credentials", icon: GraduationCap, tint: "border-l-violet-500" },
    { key: "notable_clients", label: "Notable clients", icon: Users, tint: "border-l-rose-500" },
  ];

  const totalItems = sections.reduce((n, s) => n + (groups[s.key]?.length || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Quote className="h-4 w-4" /> Social proof</CardTitle>
          <CardDescription className="text-xs">Pulled from your website — testimonials, press, stats and awards we could find.</CardDescription>
        </div>
        {!editing && totalItems > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7">
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Pulling testimonials, press and stats from your site…
          </div>
        )}

        {!editing && totalItems > 0 && (
          <div className="space-y-4">
            {sections.map(({ key, label, icon: Icon, tint }) => {
              const items = groups[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Icon className="h-3 w-3" /> {label}
                    <span className="text-muted-foreground/60">· {items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((it, i) => {
                      const { primary, secondary } = renderItem(it);
                      const usesBrand = key === "testimonials" || key === "case_studies";
                      return (
                        <div
                          key={i}
                          className={`rounded-md border bg-muted/30 border-l-4 ${usesBrand ? "" : tint} px-3 py-2`}
                          style={usesBrand ? { borderLeftColor: "var(--brand-accent)" } : undefined}
                        >
                          <div className="text-sm leading-snug">{primary}</div>
                          {secondary && <div className="text-xs text-muted-foreground mt-0.5">{secondary}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!editing && totalItems === 0 && !loading && (
          <p className="text-xs text-muted-foreground italic">Nothing yet — click Edit to add testimonials, stats, or press.</p>
        )}

        {editing && (
          <>
            <p className="text-xs text-muted-foreground">One per line. Prefix with a category if you'd like (e.g. <span className="font-mono">Testimonial: …</span>).</p>
            <Textarea
              rows={Math.min(14, Math.max(6, proof.split("\n").length + 1))}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder={'"This program changed everything." — Sarah'}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="lumi" onClick={async () => {
                await onSave({ social_proof: proof.split("\n").map((s) => s.trim()).filter(Boolean) });
                setEditing(false);
              }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setProof(flatten(sp)); }}>Cancel</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BrandHeroCard({ brand }: { brand: any }) {
  const logo: string | undefined = brand?._kit?.logo_url || brand?.logo_url || undefined;
  const colors: string[] = (brand?._kit?.colors || []).slice(0, 6);
  const fonts: string[] = brand?._kit?.fonts || [];
  const name: string = brand?.name && brand.name.trim() ? brand.name : "Your brand";
  const tagline: string = brand?.value_proposition || "";
  const headingFont = fonts[0] ? `"${fonts[0]}", system-ui, sans-serif` : undefined;
  const accent = colors[0];

  return (
    <Card
      className="relative overflow-hidden border-0"
      style={{
        background: accent
          ? `linear-gradient(135deg, ${accent}14 0%, ${accent}05 60%, transparent 100%)`
          : undefined,
      }}
    >
      {accent && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: accent }}
        />
      )}
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start gap-4">
          {logo ? (
            <div className="shrink-0 h-16 w-16 rounded-xl bg-background border flex items-center justify-center overflow-hidden p-2">
              <img src={logo} alt={`${name} logo`} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div
              className="shrink-0 h-16 w-16 rounded-xl flex items-center justify-center text-xl font-semibold text-white"
              style={{ backgroundColor: accent || "hsl(var(--primary))" }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              Here's
            </div>
            <h2
              className="text-2xl md:text-3xl font-semibold leading-tight truncate"
              style={{ fontFamily: headingFont, color: accent || undefined }}
            >
              {name}
            </h2>
            {tagline && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{tagline}</p>
            )}
          </div>
        </div>

        {colors.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Palette</span>
            {colors.map((c, i) => (
              <div
                key={`${c}-${i}`}
                className="group relative h-8 w-8 rounded-md border shadow-sm"
                style={{ backgroundColor: c }}
                title={c}
              >
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {c}
                </span>
              </div>
            ))}
          </div>
        )}

        {fonts.length > 0 && (
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</span>
            {fonts.slice(0, 2).map((f, i) => (
              <span
                key={`${f}-${i}`}
                className="text-sm text-foreground/80"
                style={{ fontFamily: `"${f}", system-ui, sans-serif` }}
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonaSummary({ demographics, topDesire, topPain }: { demographics?: string; topDesire?: string; topPain?: string }) {
  if (!demographics && !topDesire && !topPain) return null;
  const who = (demographics || "").split(/[\n.]/)[0]?.trim();
  return (
    <div
      className="rounded-lg border bg-muted/30 p-4 space-y-2"
      style={{ borderLeftWidth: 4, borderLeftColor: "var(--brand-accent)" }}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Users className="h-3 w-3" /> Persona at a glance
      </div>
      {who && (
        <div className="text-sm">
          <span className="font-medium">Who:</span> <span className="text-foreground/80">{who}</span>
        </div>
      )}
      {topDesire && (
        <div className="text-sm">
          <span className="font-medium">Wants:</span> <span className="text-foreground/80">{topDesire}</span>
        </div>
      )}
      {topPain && (
        <div className="text-sm">
          <span className="font-medium">Struggles with:</span> <span className="text-foreground/80">{topPain}</span>
        </div>
      )}
    </div>
  );
}




function UploadBtn({ id, label, onFile, accept = "image/*", multiple = false }: { id: string; label: string; onFile: (f: File) => void; accept?: string; multiple?: boolean }) {
  return (
    <label htmlFor={id} className="cursor-pointer">
      <input
        id={id} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          files.forEach((f) => onFile(f));
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-6 text-xs hover:bg-muted/50">
        <Upload className="h-4 w-4" />
        {label}
      </div>
    </label>
  );
}
