import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { trackLumiEvent } from "@/lib/lumi-pixel";
import { toast } from "sonner";

// The funnel close, shared by the kit page hero and the onboarding
// save-unfold so the two can never drift apart: guest checkout with
// Rewardful attribution, and the VSL video (loaded via an edge function —
// a cold visitor has no way to satisfy site_settings' authenticated-only
// read policy).

export function useVslVideo() {
  const [vslVideoUrl, setVslVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("get-vsl-video");
        if (data?.url) setVslVideoUrl(data.url);
      } catch (err) {
        console.error("[ad-kit] couldn't load VSL video", err);
      }
    })();
  }, []);
  return vslVideoUrl;
}

export function useKitCheckout(brandId?: string | null) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);

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
      trackLumiEvent("InitiateCheckout");
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
      console.error("[ad-kit] checkout error", err);
      toast.error("Could not start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  return { goCheckout, checkoutLoading };
}

// The section that unfolds under a freshly saved kit: the VSL + the 50%-off
// close. Buying lives here — after the save, never instead of it.
export function VslCloseSection({
  brandId,
  firstName,
}: {
  brandId?: string | null;
  firstName?: string | null;
}) {
  const vslVideoUrl = useVslVideo();
  const { goCheckout, checkoutLoading } = useKitCheckout(brandId);

  return (
    <div className="rounded-3xl border bg-card shadow-sm p-6 sm:p-8 text-center space-y-5 animate-fade-in">
      <h2 className="font-display text-2xl sm:text-3xl">
        {firstName ? `${firstName}, want this running by tonight?` : "Want this running by tonight?"}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Everything above is yours to keep. Here's exactly what happens when LUMI takes it from
        here — targeting, budget, launch, and the daily watching — so you never open Ads Manager
        again.
      </p>
      {vslVideoUrl && (
        <video
          src={vslVideoUrl}
          controls
          playsInline
          className="mx-auto max-w-full sm:max-w-xl w-full rounded-2xl shadow-card border border-border"
        />
      )}
      <div>
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
      </div>
    </div>
  );
}
