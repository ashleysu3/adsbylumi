import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, ArrowRight, Loader2, X, Building2, GraduationCap, Zap, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { motion } from "framer-motion";
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

  const monthlyPrice = isAnnual ? Math.round(SUBSCRIPTION_TIERS.solo.annualPrice / 12) : SUBSCRIPTION_TIERS.solo.monthlyPrice;

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

      {/* Hero Section */}
      <section className="pt-28 pb-8 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              14-Day Free Trial
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl mb-6 leading-tight">
              Run real ads,{" "}
              <span className="relative inline-block">
                <span className="text-5xl md:text-7xl bg-gradient-to-r from-primary via-pink-500 to-primary bg-[length:200%_auto] animate-[gradient-shift_3s_ease-in-out_infinite] bg-clip-text text-transparent font-bold">
                  without keeping up with Ads Manager
                </span>
                <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-primary via-pink-500 to-primary bg-[length:200%_auto] animate-[gradient-shift_3s_ease-in-out_infinite] rounded-full" />
                <span className="absolute -top-4 -right-6 text-primary animate-pulse text-lg">✦</span>
                <span className="absolute -bottom-4 -left-5 text-pink-500 animate-pulse text-sm" style={{ animationDelay: '150ms' }}>✦</span>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Lumi builds and runs proven Meta ad strategies for coaches, course creators, and service providers—without ever leaving the platform.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Pricing Card */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-background via-background to-primary/5">
              {/* Popular Badge */}
              <div className="absolute top-4 right-4">
                <Badge className="bg-primary text-primary-foreground px-3 py-1">
                  Most Popular
                </Badge>
              </div>

              <CardContent className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                  {/* Left: Price & CTA */}
                  <div className="text-center md:text-left space-y-6">
                    <div>
                      <h2 className="text-2xl font-display mb-2">Solo Plan</h2>
                      <p className="text-muted-foreground">Perfect for coaches, course creators & service providers</p>
                    </div>

                    {/* Price */}
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-center md:justify-start gap-2">
                        <span className="text-6xl md:text-7xl font-bold text-foreground">${monthlyPrice}</span>
                        <span className="text-xl text-muted-foreground">/mo</span>
                      </div>
                      {isAnnual && (
                        <p className="text-sm text-primary font-medium">
                          ${SUBSCRIPTION_TIERS.solo.annualPrice}/year — Save ${(SUBSCRIPTION_TIERS.solo.monthlyPrice * 12) - SUBSCRIPTION_TIERS.solo.annualPrice}
                        </p>
                      )}
                    </div>

                    {/* Billing Toggle */}
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <Label 
                        htmlFor="billing-toggle" 
                        className={`text-sm cursor-pointer ${!isAnnual ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        Monthly
                      </Label>
                      <Switch
                        id="billing-toggle"
                        checked={isAnnual}
                        onCheckedChange={setIsAnnual}
                      />
                      <Label 
                        htmlFor="billing-toggle" 
                        className={`text-sm cursor-pointer ${isAnnual ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        Annual
                      </Label>
                      {isAnnual && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                          2 months free
                        </Badge>
                      )}
                    </div>

                    {/* Ad Spend Cap - Key Selling Point */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-foreground">Up to $3,000/mo in ad spend</p>
                          <p className="text-sm text-muted-foreground">We manage your campaigns, you focus on your business</p>
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        className="w-full text-lg py-6 gap-2 bg-primary hover:bg-primary/90"
                        disabled={loadingTier === "solo"}
                        onClick={() => handleSubscribe("solo")}
                      >
                        {loadingTier === "solo" ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            Start Your Free Trial
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </Button>
                      <p className="text-sm text-muted-foreground text-center">
                        Cancel anytime. No questions asked.
                      </p>
                    </div>
                  </div>

                  {/* Right: Features */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Everything you need:</h3>
                    <ul className="space-y-3">
                      {SUBSCRIPTION_TIERS.solo.features.map((feature, i) => (
                        <motion.li 
                          key={i} 
                          className="flex items-start gap-3"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-foreground">{feature}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Cost Comparison */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="font-display text-2xl md:text-3xl text-center mb-8">
              Compare your options
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {/* Agency */}
              <Card className="border-border bg-muted/20">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-muted-foreground">Hire an Agency</h3>
                  <div>
                    <span className="text-2xl font-bold text-muted-foreground line-through">$2k-$5k+</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      + 15-20% of ad spend
                    </li>
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      6-month contracts
                    </li>
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      One of many clients
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* DIY */}
              <Card className="border-border bg-muted/20">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <GraduationCap className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-muted-foreground">Learn Yourself</h3>
                  <div>
                    <span className="text-2xl font-bold text-muted-foreground line-through">$1k-$3k</span>
                    <span className="text-muted-foreground text-sm"> courses</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      40+ hours to learn
                    </li>
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      Costly trial & error
                    </li>
                    <li className="flex items-center gap-2">
                      <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      Often outdated info
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Lumi */}
              <Card className="border-primary bg-primary/5 shadow-lg">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">Lumi</h3>
                  <div>
                    <span className="text-2xl font-bold text-primary">$147</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  <ul className="text-sm space-y-2 text-left">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      Launch in minutes
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      AI-powered strategy
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      14-day free trial
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Coming Soon Tiers - Condensed */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <p className="text-center text-muted-foreground mb-6">Need more? Additional plans coming soon</p>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Creator */}
              <Card className="border-border/50 bg-muted/10 opacity-60">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-muted-foreground">Creator</h3>
                    <p className="text-sm text-muted-foreground">Up to $10k/mo • 3 brands</p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">Coming Soon</Badge>
                </CardContent>
              </Card>

              {/* Agency */}
              <Card className="border-border/50 bg-muted/10 opacity-60">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-muted-foreground">Agency</h3>
                    <p className="text-sm text-muted-foreground">Unlimited • White-label</p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">Coming Soon</Badge>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ-like reassurance */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-2xl text-center space-y-4">
          <p className="text-muted-foreground">
            Have a promo code? Enter it at checkout.
          </p>
          <Button
            variant="link"
            className="text-primary"
            onClick={() => navigate("/")}
          >
            Learn more about Lumi →
          </Button>
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
