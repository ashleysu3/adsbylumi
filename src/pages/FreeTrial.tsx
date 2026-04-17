import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  Sparkles,
  Target,
  PenTool,
  Clapperboard,
  BarChart3,
  Loader2,
  Shield,
  CreditCard,
  CalendarClock,
  Gift,
  Zap,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { toast } from "sonner";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import lumiLogo from "@/assets/lumi-logo.png";

/* ─── Fade-up on scroll wrapper ─── */
const FadeUp = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
};

const FreeTrial = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [partnerCode, setPartnerCode] = useState(searchParams.get("code") || "");
  const [partnerCodeValid, setPartnerCodeValid] = useState<boolean | null>(null);

  // SEO
  useEffect(() => {
    document.title = "Start Your 7-Day Free Trial | LUMI Meta Ads Assistant";

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setMeta(
      "description",
      "Try LUMI free for 7 days. AI builds, writes, and optimizes your Meta ad campaigns. No credit card games — cancel anytime."
    );

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://adsbylumi.com/freetrial");
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-validate partner code from URL
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setPartnerCode(codeFromUrl);
      validatePartnerCode(codeFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePartnerCode = async (code: string) => {
    if (!code.trim()) {
      setPartnerCodeValid(null);
      return;
    }
    const { data } = await supabase
      .from("partner_access_tokens")
      .select("partner_trial_code")
      .eq("partner_trial_code", code.toUpperCase().trim())
      .maybeSingle();
    setPartnerCodeValid(!!data);
  };

  const goCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const priceId = SUBSCRIPTION_TIERS.solo.monthlyPriceId;

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

      const { data, error } = await supabase.functions.invoke("create-guest-checkout", {
        body: {
          priceId,
          rewardful_referral,
          partnerCode: partnerCodeValid ? partnerCode.toUpperCase().trim() : undefined,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Could not start checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const CheckoutButton = ({
    children,
    className = "",
    size = "lg" as const,
    variant = "lumi" as const,
  }: {
    children: React.ReactNode;
    className?: string;
    size?: "lg" | "sm" | "default";
    variant?: "lumi" | "default";
  }) => (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={goCheckout}
      disabled={checkoutLoading}
    >
      {checkoutLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ═══════ NAVBAR ═══════ */}
      <nav
        className={`sticky top-0 z-40 transition-all ${
          scrolled ? "bg-background/80 backdrop-blur-xl shadow-sm border-b border-border" : ""
        }`}
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/">
            <img src={lumiLogo} alt="LUMI" className="h-8 sm:h-10" />
          </a>
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              Sign In
            </button>
            <CheckoutButton size="sm">Start Free Trial</CheckoutButton>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-border bg-background overflow-hidden"
            >
              <div className="flex flex-col gap-2 p-4">
                <button
                  onClick={() => {
                    navigate("/auth");
                    setMobileMenuOpen(false);
                  }}
                  className="text-sm font-medium py-2"
                >
                  Sign In
                </button>
                <CheckoutButton size="sm">Start Free Trial</CheckoutButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-12 sm:pt-20 pb-12 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-radial from-primary/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-gradient-radial from-accent/10 to-transparent blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <FadeUp>
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1 text-xs font-semibold border-primary/30 bg-primary/5 backdrop-blur-sm rounded-full"
            >
              <Gift className="w-3.5 h-3.5 mr-1.5 inline" /> 7 Days Free · Cancel Anytime
            </Badge>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.08] mb-4">
              Try Your AI Meta Ads Team{" "}
              <span className="bg-gradient-lumi bg-clip-text text-transparent">Free for 7 Days</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="text-base sm:text-lg text-muted-foreground max-w-[560px] mx-auto mb-8 leading-relaxed">
              Plan, build, write, and optimize Meta ad campaigns with LUMI — your AI ad
              department. Full access for 7 days. No commitment. Cancel in one click.
            </p>
          </FadeUp>
          <FadeUp delay={0.25}>
            <div className="flex justify-center mb-3">
              <CheckoutButton className="px-8 text-base">
                Start My 7-Day Free Trial <ArrowRight className="w-4 h-4 ml-1.5" />
              </CheckoutButton>
            </div>
            <p className="text-xs text-muted-foreground">
              7-day free trial · $97/mo after · Cancel anytime
            </p>
          </FadeUp>

          {/* Trust strip */}
          <FadeUp delay={0.35}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" /> Secure Stripe checkout
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-primary" /> Reminder before trial ends
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-primary" /> Setup in under 10 minutes
              </span>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ WHAT YOU GET ═══════ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <FadeUp>
            <Badge
              variant="outline"
              className="mx-auto mb-4 block w-fit text-xs px-4 py-1.5 border-primary/30 bg-primary/5"
            >
              What's included in your trial
            </Badge>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-12 max-w-2xl mx-auto">
              Full access. Every feature. Zero training wheels.
            </h2>
          </FadeUp>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              "AI campaign strategy built for your offer & audience",
              "Scripts, hooks, headlines & ad copy — written for you",
              "Direct campaign build inside Meta Ads Manager",
              "Performance tracking with weekly insight reports",
              "Audience psychology profiles for every offer",
              "Creative refresh prompts when ads start to fatigue",
              "1 brand · 1 ad account · unlimited generations",
              "Cancel in one click — no calls, no email chains",
            ].map((feat, i) => (
              <FadeUp key={i} delay={i * 0.04}>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-background border border-border">
                  <div className="w-6 h-6 rounded-full bg-gradient-lumi flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                  </div>
                  <p className="text-sm leading-relaxed">{feat}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW THE TRIAL WORKS ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <FadeUp>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-4">
              How your free trial works
            </h2>
          </FadeUp>
          <FadeUp delay={0.05}>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-12">
              Honest, simple, and built so you can decide on your own time.
            </p>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: CreditCard,
                title: "Day 0 — Sign up",
                body: "Add your card to start your trial. You won't be charged today. Setup takes under 10 minutes.",
              },
              {
                icon: Sparkles,
                title: "Days 1–6 — Use everything",
                body: "Build campaigns, generate creative, connect Meta, run real ads. Full Solo plan, no limits.",
              },
              {
                icon: CalendarClock,
                title: "Day 7 — You decide",
                body: "We'll email a reminder before your trial ends. Stay for $97/mo or cancel in one click.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <Card variant="gradient" className="h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-lumi flex items-center justify-center mb-4 shadow-lumi">
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-heading text-lg font-semibold mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </CardContent>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ WHAT LUMI DOES ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp>
            <Badge
              variant="outline"
              className="mx-auto mb-4 block w-fit text-xs px-4 py-1.5 border-primary/30 bg-primary/5"
            >
              The four jobs LUMI handles
            </Badge>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-12 max-w-3xl mx-auto">
              Your strategist, copywriter, media buyer & analyst — in one app
            </h2>
          </FadeUp>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Target,
                title: "Strategy",
                desc: "Complete campaign plans built around your offer, audience, and goals.",
              },
              {
                icon: PenTool,
                title: "Creative",
                desc: "Scripts, hooks, headlines, and ad copy — tailored to your brand voice.",
              },
              {
                icon: Clapperboard,
                title: "Build",
                desc: "Campaigns set up directly in Meta — training, cold, and warm structured like a pro.",
              },
              {
                icon: BarChart3,
                title: "Optimize",
                desc: "Real-time tracking, weekly reports, fatigue detection, and clear next steps.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-lumi flex items-center justify-center mx-auto mb-4 shadow-lumi">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-heading text-base font-semibold mb-2">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <FadeUp>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-12">
              Built for creators who actually run real businesses
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <TestimonialCarousel />
          </FadeUp>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <FadeUp>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-12">
              Free trial questions, answered
            </h2>
          </FadeUp>
          <div className="space-y-4">
            {[
              {
                q: "Will I be charged today?",
                a: "No. You add a card to start your trial, but the first charge of $97 happens on day 8 — only if you stay.",
              },
              {
                q: "How do I cancel?",
                a: "Settings → Subscription → Cancel. One click. No call, no email thread, no guilt trip.",
              },
              {
                q: "What happens to my campaigns if I cancel?",
                a: "Any campaigns LUMI built live inside your own Meta Ads Manager. They stay running and stay yours. You just lose access to LUMI's planning, creative, and optimization tools.",
              },
              {
                q: "Do I need ads experience?",
                a: "No. LUMI is built for coaches, course creators, and service providers who don't want to become Meta Ads experts. We assume you're starting from zero.",
              },
              {
                q: "Do I need a Meta Ads Manager account?",
                a: "Yes — LUMI builds inside your own Meta account so you stay in full control. We'll walk you through connecting it during setup.",
              },
              {
                q: "What's included after the trial?",
                a: "The Solo plan: 1 brand, 1 ad account, full strategy + creative + build + optimization. $97/month, cancel anytime.",
              },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 0.04}>
                <details className="group rounded-2xl border border-border bg-background p-5 open:shadow-card">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <span className="font-heading font-semibold text-base">{item.q}</span>
                    <span className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.a}</p>
                </details>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PARTNER CODE + FINAL CTA ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <FadeUp>
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1 text-xs font-semibold border-primary/30 bg-primary/5 backdrop-blur-sm rounded-full"
            >
              ✨ Last step
            </Badge>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="font-display text-3xl sm:text-5xl mb-4">
              Your AI ad team is ready when you are
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-muted-foreground mb-8">
              7 days free. Full access. Cancel any time, no awkward conversations.
            </p>
          </FadeUp>

          <FadeUp delay={0.15}>
            <div className="max-w-sm mx-auto mb-6">
              <label className="block text-xs font-medium text-muted-foreground mb-2 text-left">
                Partner or referral code (optional)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  onBlur={() => validatePartnerCode(partnerCode)}
                  className="text-sm"
                />
              </div>
              {partnerCodeValid === true && (
                <p className="text-xs text-primary mt-2 text-left">
                  ✓ Partner code applied at checkout
                </p>
              )}
              {partnerCodeValid === false && partnerCode.trim() !== "" && (
                <p className="text-xs text-destructive mt-2 text-left">
                  Code not recognized — you can still continue
                </p>
              )}
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <CheckoutButton className="px-10 text-base">
              Start My 7-Day Free Trial <ArrowRight className="w-4 h-4 ml-1.5" />
            </CheckoutButton>
            <p className="text-xs text-muted-foreground mt-3">
              $97/mo after trial · Cancel anytime · Secure Stripe checkout
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} LUMI · Your AI Meta Ads Assistant</p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <a href="/" className="hover:text-foreground transition">Home</a>
            <a href="/pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="/cancellation-policy" className="hover:text-foreground transition">
              Cancellation Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FreeTrial;
