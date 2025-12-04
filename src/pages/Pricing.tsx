import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, ArrowRight, Loader2, X, Building2, GraduationCap, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import lumiLogo from "@/assets/lumi-logo.png";

export default function Pricing() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tierKey: "solo" | "creator") => {
    try {
      setLoadingTier(tierKey);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to subscribe");
        navigate("/auth");
        return;
      }

      const tier = SUBSCRIPTION_TIERS[tierKey];
      const priceId = isAnnual ? tier.annualPriceId : tier.monthlyPriceId;

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoadingTier(null);
    }
  };

  const tiers = [
    {
      key: "solo" as const,
      name: "Solo",
      description: "Perfect for solo coaches and course creators",
      monthlyPrice: 147,
      annualPrice: 1470,
      popular: true,
      comingSoon: false,
      features: SUBSCRIPTION_TIERS.solo.features,
      cta: "Get Started",
    },
    {
      key: "creator" as const,
      name: "Creator",
      description: "For growing creators and service providers",
      monthlyPrice: 299,
      annualPrice: 2990,
      popular: false,
      comingSoon: true,
      features: SUBSCRIPTION_TIERS.creator.features,
      cta: "Coming Soon",
    },
    {
      key: "agency" as const,
      name: "Agency",
      description: "For agencies and white-label solutions",
      monthlyPrice: null,
      annualPrice: null,
      popular: false,
      comingSoon: true,
      features: SUBSCRIPTION_TIERS.agency.features,
      cta: "Coming Soon",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <img
            src={lumiLogo}
            alt="Lumi"
            className="h-12 cursor-pointer"
            onClick={() => navigate("/")}
          />
          <Button onClick={() => navigate("/auth")} variant="outline">
            Log In / Sign Up
          </Button>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business. Upgrade or downgrade anytime.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <Label htmlFor="billing-toggle" className={!isAnnual ? "font-medium" : "text-muted-foreground"}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
              />
              <Label htmlFor="billing-toggle" className={isAnnual ? "font-medium" : "text-muted-foreground"}>
                Annual
              </Label>
              {isAnnual && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Save 2 months
                </Badge>
              )}
            </div>
          </div>

          {/* Cost Comparison Section */}
          <div className="mb-16">
            <h2 className="font-display text-2xl md:text-3xl text-center mb-8">
              The smart alternative to expensive agencies & time-consuming courses
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Agency Card */}
              <Card className="border-border bg-muted/30 opacity-80">
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl text-muted-foreground">Hire an Agency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center mb-4">
                    <span className="text-2xl font-bold text-muted-foreground line-through">$2,000 - $5,000+</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>+ 10-20% of ad spend fees</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>6-month contracts typical</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>You're one of many clients</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>No control over your strategy</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Course Card */}
              <Card className="border-border bg-muted/30 opacity-80">
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <GraduationCap className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl text-muted-foreground">Learn It Yourself</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center mb-4">
                    <span className="text-2xl font-bold text-muted-foreground line-through">$500 - $3,000</span>
                    <span className="text-muted-foreground"> course</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>40+ hours just to learn basics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>10-20 hrs/week to implement</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>Costly trial & error mistakes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>Information often outdated</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Lumi Card */}
              <Card className="border-primary bg-primary/5 shadow-md">
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Lumi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center mb-4">
                    <span className="text-2xl font-bold text-primary">Starting at $147</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Launch campaigns in minutes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>AI-powered strategy & creative</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Psychology-driven approach</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="font-medium">14-day free trial included</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier) => (
              <Card
                key={tier.key}
                className={`relative flex flex-col ${
                  tier.popular
                    ? "border-primary shadow-lg scale-105"
                    : "border-border"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Available Now
                    </Badge>
                  </div>
                )}
                {tier.comingSoon && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary" className="px-4 py-1">
                      Coming Soon
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-display">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="text-center mb-6">
                    {tier.monthlyPrice ? (
                      <>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold">
                            ${isAnnual ? Math.round(tier.annualPrice! / 12) : tier.monthlyPrice}
                          </span>
                          <span className="text-muted-foreground">/mo</span>
                        </div>
                        {isAnnual && (
                          <p className="text-sm text-muted-foreground mt-1">
                            ${tier.annualPrice}/year billed annually
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="text-2xl font-bold text-muted-foreground">
                        Custom Pricing
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full gap-2"
                    variant={tier.popular ? "default" : "outline"}
                    size="lg"
                    disabled={loadingTier === tier.key || tier.comingSoon}
                    onClick={() => {
                      if (tier.comingSoon) return;
                      if (tier.key === "agency") {
                        window.location.href = "mailto:hello@afterorganic.com?subject=Agency Plan Inquiry";
                      } else {
                        handleSubscribe(tier.key);
                      }
                    }}
                  >
                    {loadingTier === tier.key ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        {tier.cta}
                        {!tier.comingSoon && <ArrowRight className="w-4 h-4" />}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Promo Code Info */}
          <div className="mt-12 max-w-md mx-auto text-center">
            <p className="text-sm text-muted-foreground">
              Have a promo code? You can enter it on the checkout page.
            </p>
          </div>

          {/* FAQ or Additional Info */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground">
              All plans include a 14-day free trial. Credit card required, but you won't be charged until your trial ends.
            </p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => navigate("/")}
            >
              Learn more about Lumi
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Lumi. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
