import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  PlayCircle,
  Loader2,
  Target,
  PenTool,
  Clapperboard,
  BarChart3,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { trackLumiEventOnce } from "@/lib/lumi-pixel";
import lumiLogo from "@/assets/lumi-logo.png";
import { useKitCheckout, useVslVideo } from "@/components/ad-kit/VslClose";
import { AdFeedMock } from "@/components/ad-kit/AdFeedMock";
import { BuyerPsychology } from "@/components/ad-kit/BuyerPsychology";
import { GamePlanCard } from "@/components/ad-kit/GamePlanCard";
import { ScriptBlock } from "@/components/ad-kit/ScriptBlock";
import { BrollBlock } from "@/components/ad-kit/BrollBlock";
import { kitHeadline, type KitStrategy, type ScriptBeat } from "@/components/ad-kit/types";

// ---- Kit data shape (whitelisted by the get_ad_kit RPC) ----
type AdKitData = {
  copy?: { template?: string; option?: Record<string, any> } | null;
  script?: ScriptBeat[] | null;
  strategy?: KitStrategy;
  videoUrl?: string | null;
} | null;
type Kit = {
  brand_id: string;
  name: string | null;
  lead_name: string | null;
  ad_pack_image_url: string | null;
  ad_kit: AdKitData;
  audience_psychology: Record<string, any> | null;
  target_audience: string | null;
};

// Reached two ways: same-session right after PayoffAdScreen (?brand=, has a
// real anonymous session), or cold from the Ad Kit email on any device
// (?kit=<token>, zero session). The token path loads through get-ad-kit —
// RLS on `brands` denies anon SELECT entirely, so the token is the one key.
export default function AdPackReveal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandIdParam = searchParams.get("brand");
  const kitToken = searchParams.get("kit");

  const [kit, setKit] = useState<Kit | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [packImageUrl, setPackImageUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const brandId = kit?.brand_id || brandIdParam;

  useEffect(() => {
    document.title = "Your Ad Kit | LUMI";
    if (kitToken) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("get-ad-kit", {
            body: { kitToken },
          });
          if (error || !data?.kit) return; // degrade to generic page below
          const k = data.kit as Kit;
          setKit(k);
          setBrandName(k.name || null);
          setPackImageUrl(k.ad_pack_image_url || null);
          // Return visitors are the highest-intent non-buyers — this event
          // is the retargeting audience for the 50%-off campaign.
          trackLumiEventOnce(`kit_view_${kitToken.slice(0, 8)}`, "ViewContent");
        } catch (err) {
          console.error("[ad-kit] couldn't load kit", err);
        }
      })();
      return;
    }
    if (!brandIdParam) return;
    (async () => {
      // Same-session path: RLS allows the owner to read their own brand.
      const { data } = await supabase
        .from("brands")
        .select("name, ad_pack_image_url, ad_kit, audience_psychology, target_audience, lead_name")
        .eq("id", brandIdParam)
        .maybeSingle();
      if (data) {
        setKit({
          brand_id: brandIdParam,
          name: data.name || null,
          lead_name: (data as any).lead_name || null,
          ad_pack_image_url: data.ad_pack_image_url || null,
          ad_kit: ((data as any).ad_kit as AdKitData) || null,
          audience_psychology: ((data as any).audience_psychology as Record<string, any>) || null,
          target_audience: (data as any).target_audience || null,
        });
        setBrandName(data.name || null);
        setPackImageUrl(data.ad_pack_image_url || null);
      }
    })();
  }, [kitToken, brandIdParam]);

  // Shared with the onboarding save-unfold (VslClose.tsx) so the two funnel
  // closes can never drift apart.
  const vslVideoUrl = useVslVideo();
  const { goCheckout, checkoutLoading } = useKitCheckout(brandId);

  // ---- Kit-derived display pieces (each section renders only when its
  // data exists — a missing piece disappears, it never apologizes) ----
  const firstName = (kit?.lead_name || "").trim().split(" ")[0] || null;
  const copyOption = kit?.ad_kit?.copy?.option;
  const copyTemplate = kit?.ad_kit?.copy?.template;
  const headline = kitHeadline(copyTemplate, copyOption);
  const primaryText = String(copyOption?.sub || headline || "").trim();
  const script = kit?.ad_kit?.script || null;
  const strategyData = kit?.ad_kit?.strategy || null;
  const kitVideoUrl = kit?.ad_kit?.videoUrl || null;
  const ap = kit?.audience_psychology || {};
  const idealClient: string =
    (typeof ap.target_audience === "string" && ap.target_audience) ||
    (typeof ap.ideal_client === "string" && ap.ideal_client) ||
    kit?.target_audience ||
    "";
  const firstPain: string = Array.isArray(ap.pain_points) ? ap.pain_points[0] || "" : "";
  const firstDesire: string = Array.isArray(ap.desires) ? ap.desires[0] || "" : "";
  const hasPsychology = !!(idealClient || firstPain || firstDesire);
  const hasKitContent = !!(packImageUrl || headline || script || strategyData || hasPsychology);

  const ctaButton = (
    <Button size="lg" variant="lumi" className="px-10 text-base h-14" onClick={goCheckout} disabled={checkoutLoading}>
      {checkoutLoading ? (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading...
        </>
      ) : (
        <>
          Get 50% Off My First Month <ArrowRight className="w-5 h-5 ml-1.5" />
        </>
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <nav className="container mx-auto px-4 py-4">
        <button onClick={() => navigate("/")} className="inline-block">
          <img src={lumiLogo} alt="LUMI" className="h-8 sm:h-10" />
        </button>
      </nav>

      {/* ---- Hero: VSL + primary CTA ---- */}
      <section className="container mx-auto px-4 pt-6 pb-14 max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="outline" className="mb-4 px-4 py-1 text-xs font-semibold border-primary/30 bg-primary/5">
            {brandName ? `Built for ${brandName}` : "Your Ad Kit"}
          </Badge>
          <h1 className="font-display text-3xl sm:text-5xl leading-[1.1] mb-4">
            {hasKitContent
              ? `${firstName ? `${firstName}, ` : ""}your Ad Kit is ready.`
              : "This is what LUMI can do for your business"}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            {hasKitContent
              ? "The plan, the creative, and the words — everything below was built from your website, and it's yours."
              : "A real, ready-to-run ad — built in about a minute, in your brand's own colors and voice."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10"
        >
          {vslVideoUrl ? (
            <video
              ref={videoRef}
              src={vslVideoUrl}
              controls
              playsInline
              muted
              autoPlay
              className="mx-auto max-w-full sm:max-w-xl w-full rounded-2xl shadow-card border border-border"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.muted) v.play().catch(() => {});
              }}
            />
          ) : !hasKitContent ? (
            <div className="mx-auto max-w-full sm:max-w-md aspect-video rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <PlayCircle className="w-10 h-10" />
              <p className="text-sm">Video walkthrough coming soon</p>
            </div>
          ) : null}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          {ctaButton}
          <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Secure Stripe checkout · Cancel anytime
          </p>
        </motion.div>
      </section>

      {/* ---- The creative: your ad as it would appear in the feed ---- */}
      {packImageUrl && (
        <section className="py-14 bg-muted/30">
          <div className="container mx-auto px-4 max-w-lg">
            <h2 className="font-display text-2xl sm:text-3xl text-center mb-2">Your ad, in the wild</h2>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Exactly how it would look in the feed.
            </p>
            <AdFeedMock
              brandName={brandName}
              imageUrl={packImageUrl}
              primaryText={primaryText || undefined}
              headline={headline || undefined}
            />
          </div>
        </section>
      )}

      {/* ---- The words: who your buyer is ---- */}
      {hasPsychology && (
        <section className="py-14">
          <div className="container mx-auto px-4 max-w-2xl">
            <BuyerPsychology idealClient={idealClient || undefined} pain={firstPain || undefined} desire={firstDesire || undefined} />
          </div>
        </section>
      )}

      {/* ---- The plan: exactly what LUMI would click in Ads Manager ---- */}
      {strategyData && Array.isArray(strategyData.campaigns) && strategyData.campaigns.length > 0 && (
        <section className="py-14 bg-muted/30">
          <div className="container mx-auto px-4 max-w-2xl">
            <GamePlanCard strategy={strategyData} variant="full" />
          </div>
        </section>
      )}

      {/* ---- The script + video ---- */}
      {(script || hasKitContent) && (
        <section className="py-14">
          <div className="container mx-auto px-4 max-w-2xl space-y-10">
            {script && <ScriptBlock beats={script} variant="full" />}
            {hasKitContent && <BrollBlock videoUrl={kitVideoUrl} pendingNote variant="full" />}
          </div>
        </section>
      )}

      {/* ---- What the app does, then close ---- */}
      <section className="py-14 sm:py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="font-display text-2xl sm:text-3xl text-center mb-10">
            Your strategist, copywriter, media buyer &amp; analyst — in one app
          </h2>
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { icon: Target, title: "Strategy", desc: "Campaign plans built around your offer and audience." },
              { icon: PenTool, title: "Creative", desc: "Scripts, hooks, and ad copy in your brand voice." },
              { icon: Clapperboard, title: "Build", desc: "Campaigns set up directly inside Meta Ads Manager." },
              { icon: BarChart3, title: "Optimize", desc: "Weekly reports, fatigue detection, clear next steps." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="text-center">
                <div className="w-11 h-11 rounded-2xl bg-gradient-lumi flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-heading text-sm font-semibold mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 text-center">
        {ctaButton}
        <p className="text-xs text-muted-foreground mt-3">50% off your first month · then $97/mo · Cancel anytime</p>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} LUMI · Your AI Meta Ads Assistant</p>
        </div>
      </footer>
    </div>
  );
}
