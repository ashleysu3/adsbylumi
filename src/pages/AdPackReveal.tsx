import { useEffect, useState } from "react";
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
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";

// Reached two ways: same-session, right after PayoffAdScreen (has a real
// anonymous session + brand), or cold from the ad-pack email days later on
// any device (no session at all). Brand data is only fetchable in the
// first case — RLS on `brands` requires auth.uid() = user_id, so a cold
// visitor's client query simply returns nothing. The page has to degrade
// to generic (but still fully functional) copy rather than error out.
export default function AdPackReveal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get("brand");

  const [brandName, setBrandName] = useState<string | null>(null);
  const [packImageUrl, setPackImageUrl] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    document.title = "Your Ad Pack Is Ready | LUMI";
    if (!brandId) return;
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("name, ad_pack_image_url")
        .eq("id", brandId)
        .maybeSingle();
      if (data) {
        setBrandName(data.name || null);
        setPackImageUrl(data.ad_pack_image_url || null);
      }
    })();
  }, [brandId]);

  const goCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      let rewardful_referral = "";
      try {
        if ((window as any).rewardful) {
          rewardful_referral = await Promise.race([
            new Promise<string>((resolve) => {
              (window as any).rewardful("ready", function () {
                resolve((window as any).Rewardful?.referral || "");
              });
            }),
            new Promise<string>((resolve) => setTimeout(() => resolve(""), 3000)),
          ]);
        }
      } catch {
        /* ignore */
      }

      const returnTo = brandId ? `/launch?brand=${brandId}` : undefined;
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
    } catch (err) {
      console.error("[ad-pack-reveal] checkout error", err);
      toast.error("Could not start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <nav className="container mx-auto px-4 py-4">
        <button onClick={() => navigate("/")} className="inline-block">
          <img src={lumiLogo} alt="LUMI" className="h-8 sm:h-10" />
        </button>
      </nav>

      <section className="container mx-auto px-4 pt-6 pb-16 max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="outline" className="mb-4 px-4 py-1 text-xs font-semibold border-primary/30 bg-primary/5">
            {brandName ? `Built for ${brandName}` : "Your ad pack"}
          </Badge>
          <h1 className="font-display text-3xl sm:text-5xl leading-[1.1] mb-4">
            This is what LUMI can do for your business
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            A real, ready-to-run ad — built in about a minute, in your brand's own colors and voice.
          </p>
        </motion.div>

        {/* Payoff visual — the real generated ad if we have it, a video slot once recorded */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10"
        >
          {packImageUrl ? (
            <img
              src={packImageUrl}
              alt="Your ad, built by LUMI"
              className="mx-auto max-w-full sm:max-w-sm rounded-2xl shadow-card border border-border"
            />
          ) : (
            <div className="mx-auto max-w-full sm:max-w-md aspect-video rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <PlayCircle className="w-10 h-10" />
              <p className="text-sm">Video walkthrough coming soon</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Button
            size="lg"
            variant="lumi"
            className="px-10 text-base h-14"
            onClick={goCheckout}
            disabled={checkoutLoading}
          >
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
          <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Secure Stripe checkout · Cancel anytime
          </p>
        </motion.div>
      </section>

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
