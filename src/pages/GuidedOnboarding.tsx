import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, ArrowRight, ChevronLeft, CheckCircle2, Sparkles,
  Upload, Image as ImageIcon, User, Palette, MessageSquare, Brain, Target, Quote, ListChecks, Trash2, Check
} from "lucide-react";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { SetupPrompt } from "@/components/SetupPrompt";
import { LumiThinkingInline } from "@/components/LumiThinking";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { useBrand } from "@/contexts/BrandContext";
import { seedDeferredTask, seedFirstCampaignTasks } from "@/lib/onboarding-tasks";

const STEPS = [
  "Business basics",
  "Brand intelligence",
  "Assets",
  "Suggested strategy",
  "First campaign",
];

type BrandRow = any;
type OfferRow = any;
type AssetRow = { id: string; url: string; role: string; kept: boolean; source_url?: string | null };

export default function GuidedOnboarding() {
  const navigate = useNavigate();
  const { refreshBrands, setActiveBrand } = useBrand();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandRow | null>(null);

  // Step 1
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [offerUrlsText, setOfferUrlsText] = useState("");
  const [savingBasics, setSavingBasics] = useState(false);

  // Step 2 — extraction
  const [extracting, setExtracting] = useState(false);
  const [extractDone, setExtractDone] = useState(false);
  const [offers, setOffers] = useState<OfferRow[]>([]);

  // Step 3 — assets
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Step 4 — strategy
  const [strategy, setStrategy] = useState<any>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  // ---------- auth + resume ----------
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      // Resume: find latest brand without onboarding completed
      const { data: existing } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = existing?.[0];
      if (latest && !latest.onboarding_completed_at) {
        setBrandId(latest.id);
        setBrand(latest);
        setBrandName(latest.name || "");
        setWebsiteUrl(latest.website_url || "");
        const resumeStep = Math.max(1, Math.min(5, latest.onboarding_step || 1));
        setStep(resumeStep);
        if (resumeStep >= 2) setExtractDone(true);
      }
      setCheckingAuth(false);
    })();
  }, [navigate]);

  // ---------- persistence helper ----------
  const persistStep = useCallback(async (id: string, n: number) => {
    await supabase.from("brands").update({ onboarding_step: n }).eq("id", id);
  }, []);

  // ---------- STEP 1 ----------
  const handleStep1 = async () => {
    if (!brandName.trim() || !websiteUrl.trim()) {
      toast.error("Business name and website are required");
      return;
    }
    setSavingBasics(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const normalized = normalizeWebsiteUrl(websiteUrl);

      let id = brandId;
      if (!id) {
        const { data, error } = await supabase
          .from("brands")
          .insert({
            user_id: user.id,
            name: brandName.trim(),
            website_url: normalized,
            onboarding_step: 2,
          })
          .select()
          .single();
        if (error) throw error;
        id = data.id;
        setBrand(data);
      } else {
        const { data, error } = await supabase
          .from("brands")
          .update({ name: brandName.trim(), website_url: normalized, onboarding_step: 2 })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        setBrand(data);
      }

      // Offer URLs → offer rows (skip dupes by url)
      const offerUrls = offerUrlsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(normalizeWebsiteUrl);
      if (offerUrls.length) {
        const { data: existing } = await supabase
          .from("offers")
          .select("id,url")
          .eq("brand_id", id);
        const have = new Set((existing || []).map((o: any) => o.url));
        const toInsert = offerUrls
          .filter((u) => !have.has(u))
          .map((u) => ({ brand_id: id!, url: u, name: brandName.trim() }));
        if (toInsert.length) {
          await supabase.from("offers").insert(toInsert);
        }
      }

      setBrandId(id!);
      await refreshBrands();
      setStep(2);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Could not save");
    } finally {
      setSavingBasics(false);
    }
  };

  // ---------- STEP 2 — extraction ----------
  useEffect(() => {
    if (step !== 2 || !brandId || extractDone || extracting) return;
    runExtraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, brandId]);

  const runExtraction = async () => {
    if (!brandId) return;
    setExtracting(true);
    try {
      const websiteForCall = brand?.website_url || normalizeWebsiteUrl(websiteUrl);

      // Fetch offers
      const { data: offerRows } = await supabase
        .from("offers")
        .select("*")
        .eq("brand_id", brandId);
      setOffers(offerRows || []);

      // Fire extractors in parallel — each one writes to brand/offer rows itself.
      const calls: Promise<any>[] = [];
      calls.push(
        supabase.functions.invoke("extract-brand", { body: { url: websiteForCall } })
          .then(async (r) => {
            const d = r.data;
            if (d && !r.error) {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              const kitPatch: any = {
                user_id: user.id,
                brand_id: brandId,
                source_url: websiteForCall,
                status: "extracted",
              };
              if (d.colors?.length) kitPatch.colors = d.colors;
              if (d.fonts?.length) kitPatch.fonts = d.fonts;
              if (d.logoUrl) kitPatch.logo_url = d.logoUrl;
              await supabase.from("brand_kits" as any).upsert(kitPatch, { onConflict: "brand_id" });
            }
          }).catch((e) => console.warn("extract-brand failed", e))
      );
      calls.push(
        supabase.functions.invoke("harvest-brand-assets", { body: { url: websiteForCall, brandId } })
          .catch((e) => console.warn("harvest-brand-assets failed", e))
      );
      calls.push(
        supabase.functions.invoke("analyze-brand-voice", { body: { brandId } })
          .catch((e) => console.warn("analyze-brand-voice failed", e))
      );
      calls.push(
        supabase.functions.invoke("generate-audience-psychology", { body: { brandId } })
          .catch((e) => console.warn("audience psych failed", e))
      );
      for (const o of offerRows || []) {
        calls.push(
          supabase.functions.invoke("extract-offer-info", { body: { offerUrl: o.url, offerName: o.name } })
            .then(async (r) => {
              if (r.data && !r.error) {
                await supabase.from("offers").update({
                  ...(r.data.summary ? { auto_summary: r.data.summary } : {}),
                  ...(r.data.price ? { price: r.data.price } : {}),
                  ...(r.data.name ? { name: r.data.name } : {}),
                }).eq("id", o.id);
              }
            }).catch((e) => console.warn("extract-offer-info failed", e))
        );
        calls.push(
          supabase.functions.invoke("generate-product-psychology", { body: { offerId: o.id, brandId } })
            .catch((e) => console.warn("product psych failed", e))
        );
      }

      await Promise.allSettled(calls);

      // Refetch the brand & offers
      const { data: refreshed } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
      if (refreshed) setBrand(refreshed);
      const { data: offerRows2 } = await supabase.from("offers").select("*").eq("brand_id", brandId);
      setOffers(offerRows2 || []);
      setExtractDone(true);
    } finally {
      setExtracting(false);
    }
  };

  // ---------- STEP 2 — review save helpers ----------
  const updateBrand = async (patch: Record<string, any>) => {
    if (!brandId) return;
    setBrand((prev: any) => ({ ...(prev || {}), ...patch }));
    await supabase.from("brands").update(patch).eq("id", brandId);
  };
  const updateOffer = async (offerId: string, patch: Record<string, any>) => {
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, ...patch } : o)));
    await supabase.from("offers").update(patch).eq("id", offerId);
  };

  // ---------- STEP 3 — assets ----------
  useEffect(() => {
    if (step !== 3 || !brandId) return;
    (async () => {
      const { data } = await supabase
        .from("brand_assets" as any)
        .select("*")
        .order("created_at", { ascending: false });
      setAssets((data as any) || []);
      const { data: uaRaw } = await supabase
        .from("user_assets" as any)
        .select("*")
        .eq("brand_id", brandId);
      const ua = (uaRaw as any[]) || [];
      const headshot = ua.find((a: any) => a.kind === "headshot");
      setHeadshotUrl(headshot?.original_url || headshot?.cutout_url || null);
      const { data: kit } = await supabase
        .from("brand_kits" as any)
        .select("logo_url")
        .eq("brand_id", brandId)
        .maybeSingle();
      setLogoUrl((kit as any)?.logo_url || null);
    })();
  }, [step, brandId]);

  const grouped = useMemo(() => {
    const map: Record<string, AssetRow[]> = { logo: [], background: [], texture: [], graphic: [], lifestyle: [], other: [] };
    for (const a of assets) {
      const k = (a.role || "other").toLowerCase();
      (map[k] || map.other).push(a);
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

  const uploadFile = async (
    file: File,
    role: "logo" | "background" | "headshot" | "graphic" | "lifestyle"
  ) => {
    if (!brandId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${brandId}/${role}-${Date.now()}.${ext}`;
    const bucket = role === "headshot" ? "ad-photos" : "brand-assets";
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = pub.publicUrl;
    if (role === "headshot") {
      await supabase.from("user_assets" as any).insert({
        user_id: user.id, brand_id: brandId, kind: "headshot", original_url: url,
      });
      setHeadshotUrl(url);
    } else if (role === "logo") {
      await supabase.from("brand_kits" as any).upsert(
        { user_id: user.id, brand_id: brandId, logo_url: url, status: "approved" },
        { onConflict: "brand_id" }
      );
      setLogoUrl(url);
      await supabase.from("brand_assets" as any).insert({ user_id: user.id, url, role: "logo", kept: true });
      const { data } = await supabase.from("brand_assets" as any).select("*").order("created_at", { ascending: false });
      setAssets((data as any) || []);
    } else {
      await supabase.from("brand_assets" as any).insert({ user_id: user.id, url, role, kept: true });
      const { data } = await supabase.from("brand_assets" as any).select("*").order("created_at", { ascending: false });
      setAssets((data as any) || []);
    }
    toast.success("Uploaded");
  };

  // ---------- STEP 4 — strategy ----------
  useEffect(() => {
    if (step !== 4 || !brandId || strategy || strategyLoading) return;
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
    } else {
      items.push(
        { title: "Review your suggested strategy" },
        { title: "Pick your starting angle" },
        { title: "Approve your first campaign" },
      );
    }
    await Promise.all(items.map((it) => seedDeferredTask({ ...it, link_to: "/strategy", brand_id: brandId })));
    toast.success("Added to your tasks");
  };

  // ---------- finish helpers ----------
  const finishLater = async (note: string, link_to = "/onboarding") => {
    if (brandId) await persistStep(brandId, step);
    await seedDeferredTask({ title: note, link_to, brand_id: brandId });
    advance();
  };

  const advance = async () => {
    const next = Math.min(5, step + 1);
    setStep(next);
    if (brandId) await persistStep(brandId, next);
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const completeAndGoHome = async () => {
    if (brandId) {
      await supabase
        .from("brands")
        .update({ onboarding_step: 5, onboarding_completed_at: new Date().toISOString() })
        .eq("id", brandId);
      const { data } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
      if (data) setActiveBrand(data);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles")
        .update({ guided_onboarding_step: 5, guided_onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    await refreshBrands();
    toast.success("You're set up. Welcome ✨");
    navigate("/home");
  };

  const startFirstCampaign = async () => {
    await seedFirstCampaignTasks(brandId);
    await completeAndGoHome();
    navigate("/create?onboarding=1");
  };

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
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
            <span>Step {step} of 5 — {STEPS[step - 1]}</span>
            <span>{Math.round((step / 5) * 100)}%</span>
          </div>
          <Progress value={(step / 5) * 100} />
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-lumi-pink-1" /> Let's get the basics</CardTitle>
              <CardDescription>Short and sweet. We'll do the heavy lifting in a second.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Business name *</Label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your business" />
              </div>
              <div className="space-y-2">
                <Label>Website URL *</Label>
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourbrand.com" />
              </div>
              <div className="space-y-2">
                <Label>Offer URL(s) <span className="text-xs text-muted-foreground">(one per line, or comma-separated)</span></Label>
                <Textarea
                  value={offerUrlsText}
                  onChange={(e) => setOfferUrlsText(e.target.value)}
                  placeholder="https://yourbrand.com/offer-1"
                  rows={3}
                />
              </div>
              <div className="pt-2 border-t">
                <Label className="mb-2 block">Connect Meta</Label>
                {brandId ? (
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
                ) : (
                  <SetupPrompt
                    title="Save your basics first"
                    description="Click Continue to create your brand — then connect Meta right here."
                    ctaLabel="Continue"
                    onCta={handleStep1}
                  />
                )}
                {brandId && !brand?.meta_account_id && (
                  <p className="text-xs text-muted-foreground mt-2">Meta is required to launch ads — you can finish this in a second.</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button onClick={handleStep1} disabled={savingBasics}>
                  {savingBasics ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {brandId ? "Continue" : "Save & continue"} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {extracting && (
              <Card>
                <CardContent className="py-10">
                  <LumiThinkingInline isOpen={true} customCopy={["LUMI is reading your site…", "Pulling colors, fonts, and voice…", "Mapping your audience psychology…", "Decoding each offer…"]} />
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Pulling colors, fonts, voice, audience + offer psychology. Takes about a minute.
                  </p>
                </CardContent>
              </Card>
            )}
            {!extracting && (
              <>
                <ReviewDesignCard brand={brand} onSave={updateBrand} />
                <ReviewVoiceCard brand={brand} onSave={updateBrand} />
                <ReviewAudienceCard brand={brand} onSave={updateBrand} />
                <ReviewOffersCard offers={offers} onSave={updateOffer} />
                <ReviewProofCard brand={brand} onSave={updateBrand} />
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => finishLater("Review your brand intelligence", "/brand")}>Finish later</Button>
                    <Button onClick={advance}>Looks good <ArrowRight className="h-4 w-4 ml-1" /></Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Approve your assets</CardTitle>
              <CardDescription>Keep what looks like your brand. Toss what doesn't. Add the missing pieces.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!logoUrl && (
                <SetupPrompt
                  title="Add a logo"
                  description="We use it on every ad — even a transparent PNG works."
                  ctaLabel="Upload logo"
                  onCta={() => document.getElementById("upload-logo")?.click()}
                  autoTask={{ title: "Add a brand logo", link_to: "/brand" }}
                />
              )}
              {!headshotUrl && (
                <SetupPrompt
                  title="Add a headshot"
                  description="A founder/face photo lifts ad performance a lot. Plain backdrop works best."
                  ctaLabel="Upload headshot"
                  onCta={() => document.getElementById("upload-headshot")?.click()}
                  autoTask={{ title: "Add a headshot photo", link_to: "/brand" }}
                />
              )}
              {grouped.background.length === 0 && (
                <SetupPrompt
                  title="Upload a background or two"
                  description="Lifestyle photos, room shots, anything that feels like your world."
                  ctaLabel="Upload background"
                  onCta={() => document.getElementById("upload-bg")?.click()}
                  autoTask={{ title: "Upload a background image", link_to: "/brand" }}
                />
              )}
              {(["logo","background","texture","graphic","lifestyle","other"] as const).map((role) => {
                const list = grouped[role];
                if (!list || list.length === 0) return null;
                return (
                  <div key={role}>
                    <h3 className="text-sm font-semibold capitalize mb-2">{role}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {list.map((a) => (
                        <div key={a.id} className={`group relative rounded-md overflow-hidden border ${a.kept ? "ring-2 ring-lumi-pink-1" : "opacity-60"}`}>
                          <img src={a.url} alt="" className="aspect-square object-cover w-full" />
                          <div className="absolute top-1 right-1 flex gap-1">
                            <button onClick={() => toggleKept(a.id, !a.kept)} className="bg-background/90 rounded-full p-1" title={a.kept ? "Remove from set" : "Keep"}>
                              {a.kept ? <Check className="h-3 w-3" /> : <Check className="h-3 w-3 text-muted-foreground" />}
                            </button>
                            <button onClick={() => removeAsset(a.id)} className="bg-background/90 rounded-full p-1" title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                <UploadBtn id="upload-logo" label="Logo" onFile={(f) => uploadFile(f, "logo")} />
                <UploadBtn id="upload-headshot" label="Headshot" onFile={(f) => uploadFile(f, "headshot")} />
                <UploadBtn id="upload-bg" label="Background" onFile={(f) => uploadFile(f, "background")} />
                <UploadBtn id="upload-lifestyle" label="Lifestyle" onFile={(f) => uploadFile(f, "lifestyle")} />
              </div>

              <SetupPrompt
                title="Plan a quick recording"
                description="A 30s talking-head and a few b-roll clips give LUMI a lot to work with."
                ctaLabel="Add to my tasks"
                onCta={() => {
                  seedDeferredTask({ title: "Record a 30s talking-head + b-roll", link_to: "/creative-studio", brand_id: brandId });
                  toast.success("Added");
                }}
              />

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => finishLater("Finish approving brand assets", "/brand")}>Finish later</Button>
                  <Button onClick={advance}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Suggested starting strategy</CardTitle>
              <CardDescription>A simple plan matched to your offer. We'll drop the steps into your task tray.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {strategyLoading && <LumiThinkingInline label="Thinking through the right play…" />}
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
              {!strategyLoading && !strategy && (
                <SetupPrompt
                  title="We'll suggest one in a moment"
                  description="If this is taking too long, you can finish later — your tasks will still guide you."
                  ctaLabel="Try again"
                  onCta={() => { setStrategy(null); }}
                />
              )}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={async () => { await seedStrategyTasks(); advance(); }}>
                    <ListChecks className="h-4 w-4 mr-1" /> Add to tasks & continue
                  </Button>
                  <Button onClick={advance}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Ready to build your first campaign</CardTitle>
              <CardDescription>You'll be guided step by step — angle, copy, creative, launch — through your task tray.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Pick a campaign angle</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Approve your ad copy</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Approve your first creative</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-600 mt-0.5" /> Launch your first campaign</li>
              </ul>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={back}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={async () => { await seedFirstCampaignTasks(brandId); await completeAndGoHome(); }}>
                    I'll do it later
                  </Button>
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

// ───────────────── Review cards ─────────────────

function ReviewDesignCard({ brand, onSave }: { brand: any; onSave: (p: any) => Promise<void> }) {
  const [colors, setColors] = useState<string>((brand?.brand_colors || []).join(", "));
  const [fonts, setFonts] = useState<string>((brand?.brand_fonts || []).join(", "));
  useEffect(() => {
    setColors((brand?.brand_colors || []).join(", "));
    setFonts((brand?.brand_fonts || []).join(", "));
  }, [brand?.brand_colors, brand?.brand_fonts]);
  const empty = !brand?.brand_colors?.length && !brand?.brand_fonts?.length;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Design guide</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {empty && (
          <p className="text-xs text-muted-foreground">We couldn't read your design system — add what you know and we'll use it.</p>
        )}
        <div>
          <Label className="text-xs">Brand colors (comma-separated hex)</Label>
          <Input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="#000000, #FFFFFF" />
          <div className="flex gap-1 mt-2">
            {(brand?.brand_colors || []).slice(0, 8).map((c: string, i: number) => (
              <div key={i} className="h-6 w-6 rounded border" style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Brand fonts</Label>
          <Input value={fonts} onChange={(e) => setFonts(e.target.value)} placeholder="Inter, Playfair Display" />
        </div>
        <Button size="sm" variant="outline" onClick={() => onSave({
          brand_colors: colors.split(",").map((s) => s.trim()).filter(Boolean),
          brand_fonts: fonts.split(",").map((s) => s.trim()).filter(Boolean),
        })}>Save</Button>
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
          <p className="text-xs text-muted-foreground">Tell us in one paragraph how you sound — warm? punchy? quietly confident?</p>
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
  useEffect(() => {
    const q = brand?.audience_psychology || {};
    setPains((q.pain_points || []).join("\n"));
    setDesires((q.desires || []).join("\n"));
    setObjections((q.objections || []).join("\n"));
  }, [brand?.audience_psychology]);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Audience psychology</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(!p.pain_points || !p.pain_points.length) && (
          <p className="text-xs text-muted-foreground">Even a couple of bullets here makes ads dramatically better.</p>
        )}
        <div>
          <Label className="text-xs">Pain points (one per line)</Label>
          <Textarea rows={3} value={pains} onChange={(e) => setPains(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Desires</Label>
          <Textarea rows={3} value={desires} onChange={(e) => setDesires(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Objections</Label>
          <Textarea rows={3} value={objections} onChange={(e) => setObjections(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => onSave({
          audience_psychology: {
            ...p,
            pain_points: pains.split("\n").map((s) => s.trim()).filter(Boolean),
            desires: desires.split("\n").map((s) => s.trim()).filter(Boolean),
            objections: objections.split("\n").map((s) => s.trim()).filter(Boolean),
          },
        })}>Save</Button>
      </CardContent>
    </Card>
  );
}

function ReviewOffersCard({ offers, onSave }: { offers: any[]; onSave: (id: string, p: any) => Promise<void> }) {
  if (!offers.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Offer psychology</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No offers yet. Add one from the Brand page later — we'll keep going.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Offer psychology</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {offers.map((o) => (
          <OfferRowEditor key={o.id} offer={o} onSave={(p) => onSave(o.id, p)} />
        ))}
      </CardContent>
    </Card>
  );
}

function OfferRowEditor({ offer, onSave }: { offer: any; onSave: (p: any) => Promise<void> }) {
  const [name, setName] = useState(offer.name || "");
  const [summary, setSummary] = useState(offer.auto_summary || "");
  useEffect(() => {
    setName(offer.name || "");
    setSummary(offer.auto_summary || "");
  }, [offer.id, offer.name, offer.auto_summary]);
  return (
    <div className="space-y-2 border-l-2 pl-3">
      <div className="text-xs text-muted-foreground truncate">{offer.url}</div>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Offer name" />
      <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What is this offer? (one paragraph)" />
      <Button size="sm" variant="outline" onClick={() => onSave({ name, auto_summary: summary })}>Save</Button>
    </div>
  );
}

function ReviewProofCard({ brand, onSave }: { brand: any; onSave: (p: any) => Promise<void> }) {
  const initial = Array.isArray(brand?.social_proof)
    ? brand.social_proof.join("\n")
    : (brand?.social_proof || "");
  const [proof, setProof] = useState<string>(initial);
  useEffect(() => {
    const next = Array.isArray(brand?.social_proof) ? brand.social_proof.join("\n") : (brand?.social_proof || "");
    setProof(next);
  }, [brand?.social_proof]);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Quote className="h-4 w-4" /> Social proof</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!proof && (
          <p className="text-xs text-muted-foreground">Even one short testimonial helps. Paste a few — one per line.</p>
        )}
        <Textarea rows={4} value={proof} onChange={(e) => setProof(e.target.value)} placeholder="“This program changed everything.” — Sarah" />
        <Button size="sm" variant="outline" onClick={() => onSave({ social_proof: proof.split("\n").map((s) => s.trim()).filter(Boolean) })}>Save</Button>
      </CardContent>
    </Card>
  );
}

function UploadBtn({ id, label, onFile }: { id: string; label: string; onFile: (f: File) => void }) {
  return (
    <label htmlFor={id} className="cursor-pointer">
      <input
        id={id}
        type="file"
        accept="image/*"
        className="hidden"
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
