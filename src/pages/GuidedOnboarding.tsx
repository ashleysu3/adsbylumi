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
  "Brand basics",
  "Audience",
  "Design guide & images",
  "Social proof",
  "Your offer",
  "Connect Meta",
  "Strategy & launch",
];
const TOTAL = STEPS.length;
// Old → new step mapping for resume (old 6-step flow → new 8-step flow)
const RESUME_REMAP: Record<number, number> = { 1: 1, 2: 2, 3: 6, 4: 4, 5: 7, 6: 8 };

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
  const [step1Busy, setStep1Busy] = useState(false);
  // 'idle' | 'running' | 'done' — when running we show a full-screen Lumi loader
  // and hide everything else until every extractor settles.
  const [extractionPhase, setExtractionPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [loaderMsg, setLoaderMsg] = useState<string>("");
  const step1Fired = useRef(false);

  // Step 2 — review (uses brand state)
  const [proofExtracting, setProofExtracting] = useState(false);

  // Step 3 — offer
  const [offerUrl, setOfferUrl] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [offerBusy, setOfferBusy] = useState(false);
  const [globalLoaderMsg, setGlobalLoaderMsg] = useState<string | null>(null);

  // Step 4 — assets
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [brollIdeas, setBrollIdeas] = useState<any[] | null>(null);
  const assetsInitRef = useRef(false);

  // Step 6 — strategy
  const [strategy, setStrategy] = useState<any>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

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
        const { data, error } = await supabase.from("brands").insert({
          user_id: user.id, name: placeholder, website_url: normalized, onboarding_step: 1,
        }).select().single();
        if (error) throw error;
        id = data.id; row = data;
        setBrandId(id!); setBrand(row);
      } else if (row?.website_url !== normalized) {
        // Website changed → reset brand identity so old name/colors/etc don't bleed through.
        const placeholder = domainName(normalized);
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
      }

      const websiteForCall = normalized;
      const brandIdLocal = id!;

      // Flip to full-screen loader — hide everything else.
      const wittyLines = [
        "🔍 Snooping through your website (politely)…",
        "🎨 Stealing your color palette — for science…",
        "✍️ Learning how you actually talk…",
        "🧠 Profiling your dream client (in a kind way)…",
        "📸 Hunting for logos and pretty photos…",
        "💬 Reading every testimonial out loud…",
        "✨ Doing our homework so you don't have to…",
      ];
      setLoaderMsg(wittyLines[0]);
      setExtractionPhase('running');
      let lineIdx = 0;
      const rotator = setInterval(() => {
        lineIdx = (lineIdx + 1) % wittyLines.length;
        setLoaderMsg(wittyLines[lineIdx]);
      }, 2800);

      // extract-brand → colors/logo/fonts/description
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
      }).catch(() => {});

      const pVoice = pBrand.then(() =>
        supabase.functions.invoke("analyze-brand-voice", { body: { brandId: brandIdLocal } })
          .then(async () => {
            const { data: refreshed } = await supabase.from("brands").select("brand_voice").eq("id", brandIdLocal).maybeSingle();
            if (refreshed?.brand_voice) {
              setBrand((prev: any) => ({ ...(prev || {}), brand_voice: (refreshed as any).brand_voice }));
            }
          })
      ).catch(() => {});

      const pAud = pBrand.then(() =>
        supabase.functions.invoke("generate-audience-psychology", { body: { brandId: brandIdLocal } })
          .then(async () => {
            const { data: refreshed } = await supabase.from("brands").select("audience_psychology").eq("id", brandIdLocal).maybeSingle();
            if (refreshed) {
              setBrand((prev: any) => ({ ...(prev || {}), audience_psychology: (refreshed as any).audience_psychology }));
            }
          })
      ).catch(() => {});

      // Social proof — runs in parallel with the rest so the user lands on a fully-populated review.
      const pProof = pBrand.then(() =>
        supabase.functions.invoke("extract-social-proof", { body: { brandId: brandIdLocal, url: websiteForCall } })
          .then(async () => {
            const { data: refreshed } = await supabase.from("brands").select("social_proof").eq("id", brandIdLocal).maybeSingle();
            if (refreshed) {
              setBrand((prev: any) => ({ ...(prev || {}), social_proof: (refreshed as any).social_proof }));
            }
          })
      ).catch(() => {});

      const pAssets = supabase.functions.invoke("harvest-brand-assets", { body: { url: websiteForCall, brandId: brandIdLocal } })
        .catch(() => {});

      // When everything settles, dismiss the loader and auto-advance to the review.
      Promise.allSettled([pBrand, pVoice, pAud, pProof, pAssets]).then(async () => {
        clearInterval(rotator);
        // Refresh brand once more so the review screens see latest server state.
        try {
          const [{ data: b }, { data: k }] = await Promise.all([
            supabase.from("brands").select("*").eq("id", brandIdLocal).maybeSingle(),
            supabase.from("brand_kits" as any).select("colors, fonts, logo_url").eq("brand_id", brandIdLocal).maybeSingle(),
          ]);
          if (b) setBrand({ ...(b as any), _kit: k || null });
        } catch { /* ignore */ }
        setExtractionPhase('done');
        setStep(2);
        if (brandIdLocal) await persistStep(brandIdLocal, 2);
      });

      await refreshBrands();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not save");
      step1Fired.current = false;
      setExtractionPhase('idle');
    } finally {
      setStep1Busy(false);
    }
  };

  // =================== STEP review — keep brand_kit in sync ===================
  useEffect(() => {
    if (step < 2 || step > 5 || !brandId) return;
    let cancelled = false;
    (async () => {
      const [{ data: b }, { data: k }] = await Promise.all([
        supabase.from("brands").select("*").eq("id", brandId).maybeSingle(),
        supabase.from("brand_kits" as any).select("colors, fonts, logo_url").eq("brand_id", brandId).maybeSingle(),
      ]);
      if (!cancelled && b) setBrand({ ...(b as any), _kit: k || null });
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

  // =================== STEP 6 — offer ===================
  useEffect(() => {
    if (step !== 6 || !brandId) return;
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
    setGlobalLoaderMsg("LUMI is reading your offer page…");
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
      setGlobalLoaderMsg(null);
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
    if (step !== 4 || !brandId) return;
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

  const saveShotList = async () => {
    if (!brollIdeas?.length) return;
    const list = brollIdeas.map((i: any, idx: number) =>
      `${idx + 1}. ${i.title || i.description || JSON.stringify(i)}`
    ).join("\n");
    await seedDeferredTask({
      title: "Film your suggested b-roll shot list",
      description: list.slice(0, 1500),
      link_to: "/creative-studio",
      brand_id: brandId,
    });
    toast.success("Shot list saved to your tasks");
  };

  // =================== STEP 8 — strategy ===================
  useEffect(() => {
    if (step !== 8 || !brandId || strategy || strategyLoading) return;
    (async () => {
      setStrategyLoading(true);
      try {
        const { data: offerRows } = await supabase
          .from("offers").select("id").eq("brand_id", brandId).limit(1);
        const offerId = offerRows?.[0]?.id;
        const { data, error } = await supabase.functions.invoke("recommend-strategy", {
          body: { brand_id: brandId, offer_id: offerId, user_goal: "leads" },
        });
        if (error) throw error;
        setStrategy(data);
      } catch (e: any) {
        console.error(e);
        toast.error("Couldn't generate a strategy — you can do this later");
      } finally {
        setStrategyLoading(false);
      }
    })();
  }, [step, brandId, strategy, strategyLoading]);

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
    navigate("/create?onboarding=1");
  };

  // ---------- helpers used by the review steps ----------
  const hasProofVal = (v: any): boolean => {
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v).some((x) => hasProofVal(x));
    return String(v).trim().length > 0;
  };
  const hasProof = hasProofVal((brand as any)?.social_proof);

  // Auto-skip social proof step (5) when nothing was found, in whichever direction
  // the user is travelling. We compare to the previous step to figure out direction.
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (step === 5 && !hasProof && extractionPhase !== 'running') {
      const goingForward = step >= prevStepRef.current;
      const target = goingForward ? 6 : 4;
      setStep(target);
      if (brandId) persistStep(brandId, target);
      prevStepRef.current = target;
      return;
    }
    prevStepRef.current = step;
  }, [step, hasProof, extractionPhase, brandId, persistStep]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============ FULL-SCREEN EXTRACTION LOADER ============
  // While LUMI is reading the site, hide the entire onboarding UI and show the loader only.
  if (extractionPhase === 'running') {
    return <LumiPageLoader message={loaderMsg || "LUMI is reading your site…"} />;
  }
  if (globalLoaderMsg) {
    return <LumiPageLoader message={globalLoaderMsg} />;
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
            <span>Step {step} of {TOTAL} — {STEPS[step - 1]}</span>
            <span>{Math.round((step / TOTAL) * 100)}%</span>
          </div>
          <Progress value={(step / TOTAL) * 100} />
        </div>

        {/* ============== STEP 1 — Website only ============== */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-lumi-pink-1" /> Drop your website</CardTitle>
              <CardDescription>One field. LUMI reads it instantly and pulls your brand — voice, audience, colors, the works.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Website URL *</Label>
                <div className="flex gap-2">
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourbrand.com"
                    onKeyDown={(e) => { if (e.key === "Enter") startStep1(); }}
                    disabled={step1Busy}
                  />
                  <Button onClick={startStep1} disabled={step1Busy}>
                    {step1Busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Read my site"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">We'll pull everything and show you the full picture next — you'll be able to edit anything that's off.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== Shared review-step intro banner ============== */}
        {step >= 2 && step <= 5 && (
          <Card className="border-primary/20 bg-primary/5 mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Here's what we gathered ✨
              </CardTitle>
              <CardDescription>
                Pulled straight from your website{brand?.website_url ? ` (${brand.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")})` : ""}. Edit anything that's off — rebrand, outdated copy, new audience — and we'll use the updated version everywhere.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* ============== STEP 2 — Brand basics ============== */}
        {step === 2 && (
          <div className="space-y-4">
            <BrandBasicsCard brand={brand} onSave={updateBrand} />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => finishLater("Review your brand basics", "/brand")}>Finish later</Button>
                <Button onClick={advance}>Looks good <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 3 — Audience ============== */}
        {step === 3 && (
          <div className="space-y-4">
            <ReviewAudienceCard brand={brand} onSave={updateBrand} />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => finishLater("Review your audience", "/brand")}>Finish later</Button>
                <Button onClick={advance}>Looks good <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 4 — Design guide & images ============== */}
        {step === 4 && (
          <div className="space-y-4">
            <ReviewDesignCard brand={brand} onSave={updateBrand} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ImageIcon className="h-4 w-4" /> Brand images</CardTitle>
                <CardDescription>Keep what looks like your brand. Toss what doesn't. Add the missing pieces.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {classifying && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> LUMI is sorting your images by type…
                  </div>
                )}

                {!logoUrl && (
                  <SetupPrompt
                    title="Add a logo"
                    description="We use it on every ad — even a transparent PNG works."
                    ctaLabel="Upload logo"
                    onCta={() => document.getElementById("upload-logo")?.click()}
                    autoTask={{ title: "Add a brand logo", link_to: "/brand" }}
                  />
                )}
                {grouped.headshot.length === 0 && (
                  <SetupPrompt
                    title="Add a headshot"
                    description="A founder/face photo lifts ad performance a lot. Plain backdrop works best."
                    ctaLabel="Upload headshot"
                    onCta={() => document.getElementById("upload-headshot")?.click()}
                    autoTask={{ title: "Add a headshot photo", link_to: "/brand" }}
                  />
                )}
                {grouped.lifestyle.length === 0 && grouped.background.length === 0 && (
                  <SetupPrompt
                    title="Upload a lifestyle photo or backdrop"
                    description="You at work, with clients, behind the scenes — anything that feels like your world."
                    ctaLabel="Upload lifestyle"
                    onCta={() => document.getElementById("upload-lifestyle")?.click()}
                    autoTask={{ title: "Upload a lifestyle photo", link_to: "/brand" }}
                  />
                )}

                {assetsLoading && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading your library…
                  </div>
                )}

                {(() => {
                  const ASSET_CATEGORIES: { key: keyof typeof grouped; label: string; hint: string }[] = [
                    { key: "logo", label: "Logo", hint: "Wordmarks and brand marks. Transparent PNG preferred." },
                    { key: "headshot", label: "Headshot", hint: "Close-up of a face — founder, coach, team." },
                    { key: "full_body", label: "Full body", hint: "Head-to-toe photos. Great for hero shots." },
                    { key: "lifestyle", label: "Lifestyle", hint: "You in context — working, teaching, with clients." },
                    { key: "product", label: "Product", hint: "Physical products, packaging, mockups." },
                    { key: "graphic", label: "Graphics", hint: "Icons, illustrations, charts, UI screenshots." },
                    { key: "texture", label: "Textures", hint: "Abstract surfaces and patterns." },
                    { key: "background", label: "Backgrounds", hint: "Empty scenes — rooms, landscapes — to layer on." },
                    { key: "other", label: "Other", hint: "Anything else we couldn't auto-sort." },
                  ];
                  const ROLE_OPTIONS = ASSET_CATEGORIES.map((c) => ({ value: c.key as string, label: c.label }));
                  return ASSET_CATEGORIES.map(({ key, label, hint }) => {
                    const list = grouped[key];
                    if (!list || list.length === 0) return null;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold">{label} <span className="text-muted-foreground font-normal">· {list.length}</span></h3>
                            <p className="text-xs text-muted-foreground">{hint}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {list.map((a) => (
                            <div key={a.id} className={`group relative rounded-md overflow-hidden border ${a.kept ? "ring-2 ring-lumi-pink-1" : "opacity-60"}`}>
                              {a.signedUrl ? (
                                <img src={a.signedUrl} alt="" className="aspect-square object-cover w-full" loading="lazy" />
                              ) : (
                                <div className="aspect-square bg-muted" />
                              )}
                              <div className="absolute top-1 right-1 flex gap-1">
                                <button onClick={() => toggleKept(a.id, !a.kept)} className="bg-background/90 rounded-full p-1" title={a.kept ? "Remove from set" : "Keep"}>
                                  <Check className={`h-3 w-3 ${a.kept ? "" : "text-muted-foreground"}`} />
                                </button>
                                <button onClick={() => removeAsset(a.id)} className="bg-background/90 rounded-full p-1" title="Delete">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="p-1">
                                <Select value={a.role || "other"} onValueChange={(v) => setRole(a.id, v)}>
                                  <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {ROLE_OPTIONS.map((r) => (
                                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className="pt-3 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add more</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <UploadBtn id="upload-logo" label="+ Logo" onFile={(f) => uploadFile(f, "logo")} />
                    <UploadBtn id="upload-headshot" label="+ Headshot" onFile={(f) => uploadFile(f, "headshot")} />
                    <UploadBtn id="upload-fullbody" label="+ Full body" onFile={(f) => uploadFile(f, "full_body")} />
                    <UploadBtn id="upload-lifestyle" label="+ Lifestyle" onFile={(f) => uploadFile(f, "lifestyle")} />
                    <UploadBtn id="upload-product" label="+ Product" onFile={(f) => uploadFile(f, "product")} />
                    <UploadBtn id="upload-graphic" label="+ Graphic" onFile={(f) => uploadFile(f, "graphic")} />
                    <UploadBtn id="upload-texture" label="+ Texture" onFile={(f) => uploadFile(f, "texture")} />
                    <UploadBtn id="upload-bg" label="+ Background" onFile={(f) => uploadFile(f, "background")} />
                  </div>
                </div>

                {/* B-roll */}
                <div className="pt-4 border-t space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Film className="h-4 w-4" /> B-roll</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UploadBtn id="upload-broll" label="Upload b-roll (mp4)" accept="video/*" onFile={uploadBroll} />
                    <Button variant="outline" size="sm" onClick={saveShotList} disabled={!brollIdeas?.length}>
                      <ListChecks className="h-3 w-3 mr-1" /> Save suggested shot list
                    </Button>
                  </div>
                  {brollIdeas?.length ? (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-1 max-h-44 overflow-auto">
                      <p className="text-xs font-medium mb-1">Suggested shots</p>
                      {brollIdeas.slice(0, 8).map((i: any, idx: number) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          • {i.title || i.description || JSON.stringify(i)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">LUMI is brewing custom b-roll ideas for you…</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => finishLater("Finish your design guide", "/brand")}>Finish later</Button>
                <Button onClick={advance}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 5 — Social proof (auto-skips when empty) ============== */}
        {step === 5 && (
          <div className="space-y-4">
            <ReviewProofCard brand={brand} onSave={updateBrand} loading={proofExtracting} />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => finishLater("Review your social proof", "/brand")}>Finish later</Button>
                <Button onClick={advance}>Looks good <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ============== STEP 6 — Offer sales page ============== */}
        {step === 6 && (
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
                  />
                  <Button onClick={submitOfferUrl} disabled={offerBusy}>
                    {offerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pull offer"}
                  </Button>
                </div>
              </div>

              {offers.length === 0 ? (
                <SetupPrompt
                  title="No offer yet"
                  description="Add at least one sales page so LUMI can write campaigns that actually convert."
                  ctaLabel="Skip for now"
                  onCta={() => finishLater("Add your offer's sales page", "/brand")}
                />
              ) : (
                <div className="space-y-3">
                  {offers.map((o) => (
                    <OfferRowEditor key={o.id} offer={o} brand={brand} onSave={(p) => updateOffer(o.id, p)} setGlobalLoader={setGlobalLoaderMsg} /> 
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => finishLater("Finish your offer setup", "/brand")}>Finish later</Button>
                  <Button onClick={advance}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== STEP 7 — Connect Meta ============== */}
        {step === 7 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Connect Meta</CardTitle>
              <CardDescription>Last setup step. We'll check your Page + Instagram + ad account so launching is one click.</CardDescription>
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
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => finishLater("Connect Meta to launch ads", "/brand")}>Finish later</Button>
                  <Button onClick={advance} disabled={!brand?.meta_account_id}>
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== STEP 8 — Strategy + first campaign ============== */}
        {step === 8 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Your suggested strategy</CardTitle>
              <CardDescription>A starting plan + the exact steps to launch your first campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {strategyLoading && <LumiThinkingInline isOpen={true} customCopy={["Matching the right play to your offer…"]} />}
              {!strategyLoading && strategy && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
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

              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Pick a campaign angle</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Approve your ad copy</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Approve your first creative</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Launch your first campaign</li>
              </ul>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={async () => {
                    await seedFirstCampaignTasks(brandId);
                    await seedStrategyTasks();
                    await completeAndGoHome();
                  }}>I'll do it later</Button>
                  <Button onClick={startFirstCampaign}>
                    Start my first campaign <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ───────────────── small UI helpers ─────────────────

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Audience</CardTitle>
        <CardDescription className="text-xs">Psychology + demographics. Edit anything that's off — these power every ad LUMI writes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <Button size="sm" variant="lumi" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function BrandBasicsCard({ brand, onSave }: { brand: any; onSave: (p: any) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string>(brand?.name || "");
  const [desc, setDesc] = useState<string>(brand?.value_proposition || "");
  const [voice, setVoice] = useState<string>(brand?.brand_voice || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(brand?.name || "");
    setDesc(brand?.value_proposition || "");
    setVoice(brand?.brand_voice || "");
  }, [brand?.id, brand?.name, brand?.value_proposition, brand?.brand_voice]);

  const cancel = () => {
    setEditing(false);
    setName(brand?.name || "");
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
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <div className="text-base font-medium">{name || <span className="italic text-muted-foreground font-normal">Not set</span>}</div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">What you do</Label>
          {editing ? (
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          ) : (
            <p className="text-sm leading-relaxed">{desc || <span className="italic text-muted-foreground">Not set</span>}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand voice</Label>
          {editing ? (
            <Textarea rows={6} value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Warm, witty, never salesy…" />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{voice || <span className="italic text-muted-foreground">Not set</span>}</p>
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

function OfferRowEditor({ offer, brand, onSave, setGlobalLoader }: { offer: any; brand?: any; onSave: (p: any) => Promise<void>; setGlobalLoader?: (m: string | null) => void }) {
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
    setGlobalLoader?.("LUMI is pulling this offer's design guide…");
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
      setGlobalLoader?.(null);
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
                <Button type="button" size="sm" variant="outline" onClick={pullOfferDesign}>
                  <Palette className="h-3 w-3 mr-1" /> Re-pull design from this page
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
                      return (
                        <div key={i} className={`rounded-md border bg-muted/30 border-l-4 ${tint} px-3 py-2`}>
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


function UploadBtn({ id, label, onFile, accept = "image/*" }: { id: string; label: string; onFile: (f: File) => void; accept?: string }) {
  return (
    <label htmlFor={id} className="cursor-pointer">
      <input
        id={id} type="file" accept={accept} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-3 text-xs hover:bg-muted/50">
        <Upload className="h-4 w-4" />
        {label}
      </div>
    </label>
  );
}
