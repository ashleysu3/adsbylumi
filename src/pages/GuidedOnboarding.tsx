import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Upload, Image as ImageIcon, Palette, MessageSquare, Brain, Target, Quote, ListChecks, Trash2, Check, Film,
  Pencil, Type, Award, BarChart3, Newspaper, GraduationCap, Users, Briefcase
} from "lucide-react";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { SetupPrompt } from "@/components/SetupPrompt";
import { LumiThinkingInline } from "@/components/LumiThinking";
import { LumiPageLoader } from "@/components/LumiLoader";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { useBrand } from "@/contexts/BrandContext";
import { seedDeferredTask, seedFirstCampaignTasks } from "@/lib/onboarding-tasks";

const STEPS = [
  "Your website",
  "Here's what we found",
  "Your offer",
  "Connect Meta",
  "Strategy & launch",
];
const TOTAL = STEPS.length;
// Remap any historical onboarding_step value into the new 5-step flow.
// Old 8-step flow (1=site, 2=basics, 3=audience, 4=design, 5=proof, 6=offer, 7=meta, 8=strategy)
// Old 6-step flow (1=site, 2=basics, 3=offer, 4=design, 5=meta, 6=strategy)
// We can't distinguish 6-step values 3/5/6 from 8-step — prefer the 8-step interpretation
// since the 6-step variant is older and rarely in-progress now.
const RESUME_REMAP: Record<number, number> = {
  1: 1,
  2: 2, 3: 2, 4: 2, 5: 2,
  6: 3,
  7: 4,
  8: 5,
};

type AssetRow = { id: string; url: string; role: string | null; kept: boolean; source_url?: string | null; signedUrl?: string };

function pathFromUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function domainName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "My brand";
  } catch { return "My brand"; }
}

const WITTY_LINES = [
  "🔍 Snooping through your website (politely)…",
  "🎨 Stealing your color palette — for science…",
  "🧠 Profiling your dream client (in a kind way)…",
  "✍️ Listening for how your brand actually sounds…",
  "💬 Reading every testimonial out loud…",
  "📸 Hunting for logos and pretty photos…",
  "🪄 Cross-referencing with what we know about your space…",
];
const REVEAL_SECTIONS = ["basics", "design", "audience", "proof", "images"] as const;
type RevealKey = typeof REVEAL_SECTIONS[number];
const FIRST_DELAY_MS = 500;
const STAGGER_MS = 800;

export default function GuidedOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addBrandMode = searchParams.get("mode") === "add-brand";
  const { refreshBrands, setActiveBrand } = useBrand();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brand, setBrand] = useState<any>(null);

  // Step 1
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [step1Busy, setStep1Busy] = useState(false);
  // Per-section streaming flags. Each one flips false the moment its extractor settles,
  // so the reveal page can show inline shimmers and swap to real content as data arrives.
  const [extractionPhase, setExtractionPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [loadingBrandBasics, setLoadingBrandBasics] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [loadingProof, setLoadingProof] = useState(false);
  const [loadingAssets, setLoadingAssetsHarvest] = useState(false);
  const step1Fired = useRef(false);

  // Reveal orchestration — placeholder name (domain slug) is INTERNAL ONLY; never shown.
  const placeholderNameRef = useRef<string>("");
  const [revealStartedAt, setRevealStartedAt] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<RevealKey, boolean>>({
    basics: false, design: false, audience: false, proof: false, images: false,
  });
  // Sections whose extractor timed out — we still reveal them, but with a friendly
  // "couldn't pull this one" hint above the editable card.
  const [failed, setFailed] = useState<Record<RevealKey, boolean>>({
    basics: false, design: false, audience: false, proof: false, images: false,
  });
  const [slowMode, setSlowMode] = useState(false);
  const [narrationIdx, setNarrationIdx] = useState(0);

  // Step 2 — review (uses brand state)
  const [proofExtracting, setProofExtracting] = useState(false);

  // Step 3 — offer
  const [offerUrl, setOfferUrl] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerStatusMsg, setOfferStatusMsg] = useState<string | null>(null);

  // Reveal — assets
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [brollIdeas, setBrollIdeas] = useState<any[] | null>(null);
  const assetsInitRef = useRef(false);

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

  // Orchestrated reveal: each section waits for (a) its extractor to settle AND
  // (b) the prior section to reveal, plus a stagger, so it always feels paced.
  const markRevealed = useCallback((k: RevealKey) => {
    setRevealed((r) => (r[k] ? r : { ...r, [k]: true }));
  }, []);

  // basics — gated by brand extractor; also needs min first-delay from start
  useEffect(() => {
    if (!revealStartedAt || revealed.basics) return;
    if (loadingBrandBasics) return;
    const wait = Math.max(0, revealStartedAt + FIRST_DELAY_MS - Date.now());
    const t = setTimeout(() => markRevealed("basics"), wait);
    return () => clearTimeout(t);
  }, [revealStartedAt, loadingBrandBasics, revealed.basics, markRevealed]);

  // design — after basics, same extractor (brand) drives colors/fonts
  useEffect(() => {
    if (!revealed.basics || revealed.design) return;
    if (loadingBrandBasics) return;
    const t = setTimeout(() => markRevealed("design"), STAGGER_MS);
    return () => clearTimeout(t);
  }, [revealed.basics, revealed.design, loadingBrandBasics, markRevealed]);

  // audience — after design
  useEffect(() => {
    if (!revealed.design || revealed.audience) return;
    if (loadingAudience) return;
    const t = setTimeout(() => markRevealed("audience"), STAGGER_MS);
    return () => clearTimeout(t);
  }, [revealed.design, revealed.audience, loadingAudience, markRevealed]);

  // proof — after audience
  useEffect(() => {
    if (!revealed.audience || revealed.proof) return;
    if (loadingProof) return;
    const t = setTimeout(() => markRevealed("proof"), STAGGER_MS);
    return () => clearTimeout(t);
  }, [revealed.audience, revealed.proof, loadingProof, markRevealed]);

  // images — last
  useEffect(() => {
    if (!revealed.proof || revealed.images) return;
    if (loadingAssets) return;
    const t = setTimeout(() => markRevealed("images"), STAGGER_MS);
    return () => clearTimeout(t);
  }, [revealed.proof, revealed.images, loadingAssets, markRevealed]);

  const revealedCount = REVEAL_SECTIONS.filter((k) => revealed[k]).length;
  const allRevealed = revealedCount === REVEAL_SECTIONS.length;

  // ---------- auth + resume ----------
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      // When user explicitly asked to add a new brand, do NOT resume an in-progress one.
      if (!addBrandMode) {
        const { data: existing } = await supabase
          .from("brands").select("*").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1);
        const latest = existing?.[0];
        if (latest && !latest.onboarding_completed_at) {
          setBrandId(latest.id);
          setBrand(latest);
          setWebsiteUrl(latest.website_url || "");
          const stored = latest.onboarding_step || 1;
          const remapped = stored <= 6 && stored in RESUME_REMAP ? RESUME_REMAP[stored] : stored;
          const resumeStep = Math.max(1, Math.min(TOTAL, remapped));
          setStep(resumeStep);
        }
      }
      setCheckingAuth(false);
    })();
  }, [navigate, addBrandMode]);

  const persistStep = useCallback(async (id: string, n: number) => {
    await supabase.from("brands").update({ onboarding_step: n }).eq("id", id);
  }, []);

  const advance = async () => {
    const next = Math.min(TOTAL, step + 1);
    setStep(next);
    if (brandId) await persistStep(brandId, next);
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  // =================== STEP 1 ===================
  const startStep1 = async () => {
    const normalized = normalizeWebsiteUrl(websiteUrl);
    if (!normalized || !normalized.includes(".")) {
      toast.error("Add your website URL");
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
        await supabase.from("brands").update({
          website_url: normalized,
          name: placeholder,
          brand_colors: null,
          brand_fonts: null,
          value_proposition: null,
          target_audience: null,
          brand_voice: null,
          voice_profile: null,
          social_proof: null,
        }).eq("id", id);
        row = { ...row, website_url: normalized, name: placeholder };
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
      setLoadingAssetsHarvest(true);
      setRevealed({ basics: false, design: false, audience: false, proof: false, images: false });
      setFailed({ basics: false, design: false, audience: false, proof: false, images: false });
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
      const assetsSettled = { done: false };
      const clearBrandCap = armCap("extract-brand", ["basics", "design"], setLoadingBrandBasics, brandSettled);
      const clearVoiceCap = armCap("analyze-brand-voice", ["basics"], setLoadingVoice, voiceSettled);
      const clearAudCap = armCap("generate-audience-psychology", ["audience"], setLoadingAudience, audSettled);
      const clearProofCap = armCap("extract-social-proof", ["proof"], setLoadingProof, proofSettled);
      const clearAssetsCap = armCap("harvest-brand-assets", ["images"], setLoadingAssetsHarvest, assetsSettled);

      // extract-brand → colors/logo/fonts/description (the first thing to render)
      const pBrand = supabase.functions.invoke("extract-brand", { body: { url: websiteForCall } }).then(async (r) => {
        const d: any = r.data;
        if (!d || r.error) return;
        const kitPatch: any = {
          user_id: user.id, brand_id: brandIdLocal, source_url: websiteForCall, status: "extracted",
        };
        if (d.colors?.length) kitPatch.colors = d.colors;
        if (d.fonts?.length) kitPatch.fonts = d.fonts;
        if (d.logoUrl) kitPatch.logo_url = d.logoUrl;
        const { error: kitErr } = await supabase
          .from("brand_kits" as any)
          .upsert(kitPatch, { onConflict: "user_id,brand_id" });
        if (kitErr) console.warn("brand_kits upsert failed", kitErr);

        const brandPatch: any = {};
        if (d.name) brandPatch.name = d.name;
        if (d.description) brandPatch.value_proposition = d.description;
        if (Object.keys(brandPatch).length) {
          const { error: brErr } = await supabase.from("brands").update(brandPatch).eq("id", brandIdLocal);
          if (brErr) console.warn("brand update failed", brErr);
          else setBrand((prev: any) => ({ ...(prev || {}), ...brandPatch }));
        }
        if (kitPatch.colors || kitPatch.fonts || kitPatch.logo_url) {
          setBrand((prev: any) => ({
            ...(prev || {}),
            _kit: {
              colors: kitPatch.colors || prev?._kit?.colors,
              fonts: kitPatch.fonts || prev?._kit?.fonts,
              logo_url: kitPatch.logo_url || prev?._kit?.logo_url,
            },
          }));
        }
      }).catch(() => {}).finally(() => { clearBrandCap(); setLoadingBrandBasics(false); });

      const pVoice = pBrand.then(() =>
        supabase.functions.invoke("analyze-brand-voice", { body: { brandId: brandIdLocal } })
          .then(async () => {
            const { data: refreshed } = await supabase.from("brands").select("brand_voice").eq("id", brandIdLocal).maybeSingle();
            if (refreshed?.brand_voice) {
              setBrand((prev: any) => ({ ...(prev || {}), brand_voice: (refreshed as any).brand_voice }));
            }
          })
      ).catch(() => {}).finally(() => { clearVoiceCap(); setLoadingVoice(false); });

      const pAud = pBrand.then(() =>
        supabase.functions.invoke("generate-audience-psychology", { body: { brandId: brandIdLocal } })
          .then(async () => {
            const { data: refreshed } = await supabase.from("brands").select("audience_psychology").eq("id", brandIdLocal).maybeSingle();
            if (refreshed) {
              setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: (refreshed as any).audience_psychology }));
            }
          })
      ).catch(() => {}).finally(() => { clearAudCap(); setLoadingAudience(false); });

      const pProof = pBrand.then(() =>
        supabase.functions.invoke("extract-social-proof", { body: { brandId: brandIdLocal, url: websiteForCall } })
          .then(async () => {
            const { data: refreshed } = await supabase.from("brands").select("social_proof").eq("id", brandIdLocal).maybeSingle();
            if (refreshed) {
              setBrand((prev: any) => ({ ...(prev || {}), social_proof: (refreshed as any).social_proof }));
            }
          })
      ).catch(() => {}).finally(() => { clearProofCap(); setLoadingProof(false); });

      const pAssets = supabase.functions.invoke("harvest-brand-assets", { body: { url: websiteForCall, brandId: brandIdLocal } })
        .catch(() => {})
        .finally(() => { clearAssetsCap(); setLoadingAssetsHarvest(false); });

      // When everything settles, flag the phase as done so the resume logic stops trying.
      Promise.allSettled([pBrand, pVoice, pAud, pProof, pAssets]).then(async () => {
        try {
          const [{ data: b }, { data: k }] = await Promise.all([
            supabase.from("brands").select("*").eq("id", brandIdLocal).maybeSingle(),
            supabase.from("brand_kits" as any).select("colors, fonts, logo_url").eq("brand_id", brandIdLocal).maybeSingle(),
          ]);
          if (b) setBrand((prev: any) => ({ ...(b as any), _kit: k || (prev?._kit ?? null) }));
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
      setLoadingAssetsHarvest(false);
    } finally {
      setStep1Busy(false);
    }
  };

  // =================== Reveal page — keep brand_kit in sync ===================
  useEffect(() => {
    if (step !== 2 || !brandId) return;
    let cancelled = false;
    (async () => {
      const [{ data: b }, { data: k }] = await Promise.all([
        supabase.from("brands").select("*").eq("id", brandId).maybeSingle(),
        supabase.from("brand_kits" as any).select("colors, fonts, logo_url").eq("brand_id", brandId).maybeSingle(),
      ]);
      if (!cancelled && b) setBrand((prev: any) => ({ ...(b as any), _kit: k || prev?._kit || null }));
    })();
    return () => { cancelled = true; };
  }, [step, brandId]);

  const updateBrand = async (patch: Record<string, any>) => {
    if (!brandId) return;
    setBrand((prev: any) => ({ ...(prev || {}), ...patch }));
    // _kit is local-only state (mirrors brand_kits) — never push it to the brands table.
    const { _kit, ...dbPatch } = patch as any;
    if (Object.keys(dbPatch).length) {
      await supabase.from("brands").update(dbPatch).eq("id", brandId);
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

  const submitOfferUrl = async () => {
    if (!brandId) return;
    const normalized = normalizeWebsiteUrl(offerUrl);
    if (!normalized) { toast.error("Add your offer's sales page URL"); return; }
    setOfferBusy(true);
    setOfferStatusMsg("LUMI is reading your offer page…");
    try {
      const { data: existing } = await supabase
        .from("offers").select("id").eq("brand_id", brandId).eq("url", normalized).maybeSingle();
      let offerId = (existing as any)?.id;
      if (!offerId) {
        const { data, error } = await supabase.from("offers").insert({
          brand_id: brandId, url: normalized, name: "New offer",
        }).select().single();
        if (error) throw error;
        offerId = data.id;
      }
      const { data: ex } = await supabase.functions.invoke("extract-offer-info", {
        body: { offerUrl: normalized, offerName: "" },
      });
      if (ex) {
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
        if (Object.keys(mg).length) patch.messaging_guidelines = mg;
        if (e.social_proof) patch.product_psychology = { social_proof: e.social_proof };
        if (Object.keys(patch).length) {
          const { error: upErr } = await supabase.from("offers").update(patch).eq("id", offerId);
          if (upErr) console.warn("offer update failed", upErr);
        }
      }
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

  const updateOffer = async (offerId: string, patch: Record<string, any>) => {
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, ...patch } : o)));
    await supabase.from("offers").update(patch).eq("id", offerId);
  };

  // =================== STEP 4 — assets w/ signed URLs + classify ===================
  const loadAssets = useCallback(async () => {
    if (!brandId) return;
    setAssetsLoading(true);
    try {
      const { data: rows } = await supabase
        .from("brand_assets" as any).select("*")
        .eq("brand_id", brandId).order("created_at", { ascending: false });
      const list = ((rows || []) as unknown) as AssetRow[];
      const paths = list.map((r) => pathFromUrl(r.url));
      const validPaths = paths.filter(Boolean) as string[];
      const signedMap = new Map<string, string>();
      if (validPaths.length) {
        const { data: s } = await supabase.storage.from("brand-assets").createSignedUrls(validPaths, 60 * 60);
        (s || []).forEach((entry: any, i) => {
          if (entry?.signedUrl) signedMap.set(validPaths[i], entry.signedUrl);
        });
      }
      const withSigned = list.map((r) => {
        const p = pathFromUrl(r.url);
        return { ...r, signedUrl: (p && signedMap.get(p)) || r.url };
      });
      setAssets(withSigned);

      const { data: uaRaw } = await supabase
        .from("user_assets" as any).select("*").eq("brand_id", brandId);
      const ua = (uaRaw as any[]) || [];
      const headshotRow = ua.find((a: any) => a.kind === "headshot");
      setHeadshotUrl(headshotRow?.original_url || headshotRow?.cutout_url || null);
      const { data: kit } = await supabase.from("brand_kits" as any)
        .select("logo_url").eq("brand_id", brandId).maybeSingle();
      setLogoUrl((kit as any)?.logo_url || null);
    } finally {
      setAssetsLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    if (step !== 2 || !brandId) return;
    if (assetsInitRef.current) { loadAssets(); return; }
    assetsInitRef.current = true;
    (async () => {
      await loadAssets();
      // Classify any assets without a role
      const { data: needs } = await supabase
        .from("brand_assets" as any).select("id,role").eq("brand_id", brandId);
      const ids = ((needs as any[]) || []).filter((a) => !a.role).map((a) => a.id);
      if (ids.length) {
        setClassifying(true);
        try {
          await supabase.functions.invoke("classify-brand-asset", { body: { brandId, assetIds: ids } });
          await loadAssets();
        } catch { /* ignore */ }
        finally { setClassifying(false); }
      }
      // B-roll ideas
      try {
        const { data } = await supabase.functions.invoke("generate-broll-ideas", { body: { brandId } });
        const ideas = (data as any)?.ideas || (data as any) || null;
        if (Array.isArray(ideas)) setBrollIdeas(ideas.slice(0, 10));
      } catch { /* ignore */ }
    })();
  }, [step, brandId, loadAssets]);

  // Re-load the library once the harvest extractor finishes streaming in new images.
  useEffect(() => {
    if (step !== 2 || !brandId) return;
    if (loadingAssets) return;
    if (!assetsInitRef.current) return;
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAssets]);

  const grouped = useMemo(() => {
    const map: Record<string, AssetRow[]> = {
      logo: [], headshot: [], lifestyle: [], full_body: [], product: [], texture: [], graphic: [], background: [], other: [],
    };
    for (const a of assets) {
      let k = (a.role || "other").toLowerCase();
      // Back-compat: older rows used "background" as a catch-all for lifestyle.
      if (!(k in map)) k = "other";
      map[k].push(a);
    }
    return map;
  }, [assets]);

  const toggleKept = async (id: string, kept: boolean) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, kept } : a)));
    await supabase.from("brand_assets" as any).update({ kept }).eq("id", id);
  };
  const removeAsset = async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("brand_assets" as any).delete().eq("id", id);
  };
  const setRole = async (id: string, role: string) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, role } : a)));
    await supabase.from("brand_assets" as any).update({ role }).eq("id", id);
  };

  const uploadFile = async (
    file: File,
    role: "logo" | "headshot" | "lifestyle" | "full_body" | "product" | "texture" | "graphic" | "background" | "other"
  ) => {
    if (!brandId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${brandId}/${role}-${Date.now()}.${ext}`;
    if (role === "headshot") {
      const { error } = await supabase.storage.from("ad-photos").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); return; }
      const { data: pub } = supabase.storage.from("ad-photos").getPublicUrl(path);
      await supabase.from("user_assets" as any).insert({
        user_id: user.id, brand_id: brandId, kind: "headshot", original_url: pub.publicUrl,
      });
      setHeadshotUrl(pub.publicUrl);
    } else {
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); return; }
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      await supabase.from("brand_assets" as any).insert({
        user_id: user.id, brand_id: brandId, url: pub.publicUrl, role, kept: true,
      });
      if (role === "logo") {
        await supabase.from("brand_kits" as any).upsert(
          { user_id: user.id, brand_id: brandId, logo_url: pub.publicUrl, status: "approved" },
          { onConflict: "brand_id" }
        );
        setLogoUrl(pub.publicUrl);
      }
      await loadAssets();
    }
    toast.success("Uploaded");
  };

  const uploadBroll = async (file: File) => {
    if (!brandId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user.id}/${brandId}/broll-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("broll-library").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    toast.success("B-roll uploaded");
  };

  const uploadAny = async (file: File) => {
    if (file.type.startsWith("video/")) {
      await uploadBroll(file);
    } else {
      await uploadFile(file, "other");
    }
  };

  const saveShotList = async () => {
    if (!brollIdeas?.length) return;
    const list = brollIdeas.map((i: any, idx: number) => {
      const scene = i.scene || i.title || "Shot idea";
      const direction = i.direction || i.description || "";
      const emoji = i.emoji ? `${i.emoji} ` : "";
      return `${idx + 1}. ${emoji}${scene}${direction ? ` — ${direction}` : ""}`;
    }).join("\n");
    await seedDeferredTask({
      title: "Film your suggested b-roll shot list",
      description: list.slice(0, 1500),
      link_to: "/creative-studio",
      brand_id: brandId,
    });
    toast.success("Shot list saved to your tasks");
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
    navigate("/home");
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
        {step > 2 && (
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
        {step === 1 && (
          <div className="min-h-[70vh] flex items-center justify-center py-8">
            <div className="w-full max-w-xl mx-auto">
              <div className="text-center mb-10 animate-fade-in">
                <div className="inline-block mb-8">
                  <span className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600">
                    LUMI
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">
                  Drop your website.<br />
                  <span className="text-muted-foreground">Watch LUMI do the rest.</span>
                </h1>
              </div>

              <div className="rounded-3xl border bg-card shadow-sm p-6 sm:p-8 space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="yourbrand.com"
                    autoFocus
                    className="h-14 text-base rounded-xl"
                    onKeyDown={(e) => { if (e.key === "Enter" && websiteUrl.trim()) startStep1(); }}
                    disabled={step1Busy}
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="add your Instagram (optional)"
                    className="h-12 text-sm rounded-xl bg-muted/30 border-dashed"
                    onKeyDown={(e) => { if (e.key === "Enter" && websiteUrl.trim()) startStep1(); }}
                    disabled={step1Busy}
                  />
                </div>

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
          const colors: string[] = (brand?._kit?.colors as string[] | undefined) || [];
          // Voice tone chips — prefer structured voice_profile.tone_traits, fall back to splitting brand_voice.
          const vp: any = brand?.voice_profile || {};
          let tones: string[] = [];
          if (Array.isArray(vp?.tone_traits)) tones = vp.tone_traits;
          else if (Array.isArray(vp?.tones)) tones = vp.tones;
          else if (Array.isArray(vp?.traits)) tones = vp.traits;
          else if (typeof brand?.brand_voice === "string" && brand.brand_voice.trim()) {
            tones = brand.brand_voice
              .split(/[,;•·\n]+/)
              .map((s: string) => s.trim().replace(/\.+$/, ""))
              .filter((s: string) => s && s.length <= 40)
              .slice(0, 5);
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

          // Proof: count testimonials from social_proof shape (object with .testimonials[], array, or string).
          const sp: any = brand?.social_proof;
          let testimonialCount = 0;
          if (Array.isArray(sp)) testimonialCount = sp.filter(Boolean).length;
          else if (typeof sp === "string" && sp.trim()) testimonialCount = 1;
          else if (sp && typeof sp === "object") {
            const buckets = ["testimonials", "case_studies", "stats", "awards", "press_features", "credentials", "notable_clients"];
            for (const b of buckets) if (Array.isArray(sp[b])) testimonialCount += sp[b].filter(Boolean).length;
          }
          const photosCount = assets.length;

          const brandDisplayName = brand?.name && brand.name !== placeholderNameRef.current ? brand.name : "";
          const siteHost = brand?.website_url ? brand.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

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
                    {allRevealed ? (
                      <>This is you.{brandDisplayName ? <span className="text-muted-foreground"> {brandDisplayName}.</span> : null}</>
                    ) : (
                      <>Watch LUMI read you.</>
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

                {/* One rounded card wrapping all reveals */}
                <div className="rounded-3xl border bg-card shadow-sm p-6 sm:p-8 space-y-6">
                  {/* Your palette */}
                  {revealed.design && (
                    <div className="animate-fade-in space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Palette className="h-4 w-4 text-muted-foreground" /> Your palette
                      </div>
                      {colors.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {colors.slice(0, 8).map((c, i) => (
                            <div key={`${c}-${i}`} className="flex flex-col items-center gap-1.5">
                              <div
                                className="h-14 w-14 rounded-2xl border shadow-sm"
                                style={{ backgroundColor: c }}
                                aria-label={c}
                              />
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">{c.replace("#", "")}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nothing loud came through — we'll use a neutral palette to start.</p>
                      )}
                    </div>
                  )}

                  {revealed.design && (revealed.basics || revealed.audience) && (
                    <div className="h-px bg-border" />
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
                      {idealClient ? (
                        <p className="text-sm text-foreground leading-relaxed">{idealClient}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">We're still shaping the ideal client picture…</p>
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

                  {(revealed.proof || revealed.images) && <div className="h-px bg-border" />}

                  {/* Found on your site */}
                  {(revealed.proof || revealed.images) && (
                    <div className="animate-fade-in space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-muted-foreground" /> Found on your site
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 text-foreground border">
                          {testimonialCount > 0
                            ? `${testimonialCount} testimonial${testimonialCount === 1 ? "" : "s"}`
                            : "No testimonials yet"}
                        </span>
                        <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 text-foreground border">
                          {photosCount > 0
                            ? `${photosCount} photo${photosCount === 1 ? "" : "s"} harvested`
                            : (loadingAssets ? "Harvesting photos…" : "No photos found")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary CTA */}
                <div className="flex justify-center pt-2">
                  <Button
                    onClick={advance}
                    disabled={!allRevealed}
                    className="h-14 px-8 text-base font-semibold rounded-xl text-white border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:opacity-95 transition-opacity shadow-lg shadow-pink-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {allRevealed ? (
                      <>That's me — make my ad <ArrowRight className="h-5 w-5 ml-2" /></>
                    ) : (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Still reading…</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}


        {/* ============== STEP 3 — Offer sales page ============== */}
        {step === 3 && (
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

        {/* ============== STEP 4 — Connect Meta ============== */}
        {step === 4 && (
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

        {/* ============== STEP 8 — Strategy + first campaign ============== */}
        {step === 5 && (() => {
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
