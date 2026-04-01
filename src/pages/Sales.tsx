import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { X, Menu, DollarSign, Clock, BookOpen, Check, ChevronDown, Target, PenTool, Clapperboard, BarChart3, Lightbulb, Mail, ArrowRight, TrendingUp, RefreshCw, Shield, Lock, Calendar, Sparkles, Rocket, MailCheck, Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";
import foundersPhoto from "@/assets/founders.jpg";

/* ─── Fade-up on scroll wrapper ─── */
const FadeUp = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <motion.div ref={ref} className={className} initial={{ opacity: 0, y: 32 }} animate={visible ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] }}>
      {children}
    </motion.div>
  );
};

const Sales = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem("lumi-banner-dismissed") === "true");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [partnerCode, setPartnerCode] = useState(searchParams.get("code") || "");
  const [partnerCodeValid, setPartnerCodeValid] = useState<boolean | null>(null);

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
  }, []);

  const validatePartnerCode = async (code: string) => {
    if (!code.trim()) { setPartnerCodeValid(null); return; }
    const { data } = await supabase
      .from("partner_access_tokens")
      .select("partner_trial_code")
      .eq("partner_trial_code", code.toUpperCase().trim())
      .maybeSingle();
    setPartnerCodeValid(!!data);
  };

  const dismissBanner = () => { setBannerDismissed(true); localStorage.setItem("lumi-banner-dismissed", "true"); };

  const goAuth = () => navigate("/auth");

  const goCheckout = async () => {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    try {
      const priceId = SUBSCRIPTION_TIERS.solo.monthlyPriceId;

      // Capture Rewardful referral ID if available (with timeout to prevent hanging)
      let rewardful_referral = '';
      try {
        if ((window as any).rewardful) {
          rewardful_referral = await Promise.race([
            new Promise<string>((resolve) => {
              (window as any).rewardful('ready', function() {
                resolve((window as any).Rewardful?.referral || '');
              });
            }),
            new Promise<string>((resolve) => setTimeout(() => resolve(''), 3000)),
          ]);
        }
      } catch { /* ignore */ }

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
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Could not start checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const CheckoutButton = ({ children, className = "", size = "lg" as const, variant = "lumi" as const }: { children: React.ReactNode; className?: string; size?: "lg" | "sm" | "default"; variant?: "lumi" | "default" }) => (
    <Button variant={variant} size={size} className={className} onClick={goCheckout} disabled={checkoutLoading}>
      {checkoutLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</> : children}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ═══════ STICKY BANNER ═══════ */}
      <AnimatePresence>
        {!bannerDismissed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="sticky top-0 z-50 bg-gradient-to-r from-primary to-accent text-primary-foreground">
            <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-4">
              <p className="text-xs sm:text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4" /> <span>Your AI-powered Meta Ads team for just <strong>$97/mo</strong></span></p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" className="text-xs h-7 px-3 font-semibold" onClick={goCheckout} disabled={checkoutLoading}>Start Free Trial</Button>
                <button onClick={dismissBanner} className="text-primary-foreground/60 hover:text-primary-foreground"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ NAVBAR ═══════ */}
      <nav className={`sticky ${bannerDismissed ? 'top-0' : 'top-[40px]'} z-40 transition-all ${scrolled ? 'bg-background/80 backdrop-blur-xl shadow-sm border-b border-border' : ''}`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/"><img src={lumiLogo} alt="LUMI" className="h-8 sm:h-10" /></a>
          <div className="hidden md:flex items-center gap-4">
            <button onClick={goAuth} className="text-sm font-medium text-muted-foreground hover:text-foreground transition">Sign In</button>
            <CheckoutButton size="sm">Start Free Trial</CheckoutButton>
           </div>
           <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Menu className="w-6 h-6" /></button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden border-t border-border bg-background overflow-hidden">
              <div className="flex flex-col gap-2 p-4">
                <button onClick={() => { goAuth(); setMobileMenuOpen(false); }} className="text-sm font-medium py-2">Sign In</button>
                <CheckoutButton size="sm">Start Free Trial</CheckoutButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════ SECTION 1 — HERO ═══════ */}
      <section className="relative pt-16 sm:pt-24 pb-12 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-radial from-primary/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-gradient-radial from-accent/10 to-transparent blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <FadeUp>
            <Badge variant="outline" className="mb-4 px-4 py-1 text-xs font-semibold border-primary/30 bg-primary/5 backdrop-blur-sm rounded-full">✨ Your AI Ad Department — Starting at $97/mo</Badge>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.08] mb-4">
              Your Meta Ads Team — <span className="bg-gradient-lumi bg-clip-text text-transparent">Powered by&nbsp;AI</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="text-base sm:text-lg text-muted-foreground max-w-[540px] mx-auto mb-8 leading-relaxed">
              LUMI plans, writes, builds, and optimizes your Meta ad campaigns — so you can grow without hiring an agency or becoming an ads expert.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="flex justify-center mb-4">
               <CheckoutButton className="px-8 text-base">
                 Start 7-Day Free Trial <ArrowRight className="w-4 h-4 ml-1.5" />
               </CheckoutButton>
             </div>
             <p className="text-xs text-muted-foreground">7-day free trial · $97/mo after · Cancel anytime</p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 2 — SOCIAL PROOF BAR ═══════ */}
      <section className="py-8 bg-muted/50">
        <div className="container mx-auto px-4">
          <FadeUp>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm">
              <span className="text-muted-foreground font-medium">Built for people who are done with:</span>
              <div className="flex flex-wrap justify-center gap-2">
                {["Expensive agency retainers", "40-hour ad courses that don't run your ads", "Ads Manager overwhelm"].map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-destructive/10 text-destructive rounded-full px-3 py-1 text-xs font-medium line-through decoration-destructive/60">❌ {t}</span>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 3 — THE PROBLEM ═══════ */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-12">Running ads shouldn't require a second&nbsp;job</h2></FadeUp>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: DollarSign, title: "Agencies are expensive", body: "A decent Meta ads agency costs $2,000–$5,000 a month. That's before ad spend. For most coaches and course creators, that math doesn't work." },
              { icon: Clock, title: "DIY takes forever", body: "Between courses, YouTube rabbit holes, and deciphering Ads Manager, you're spending hours a week just trying to figure out what to do." },
              { icon: BookOpen, title: "AI alone isn't enough", body: "ChatGPT can write ad copy, but it can't build a strategy, set up your campaigns, or tell you what's actually working." },
            ].map(({ icon: Icon, title, body }, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <Card variant="gradient" className="h-full"><CardContent className="p-6"><Icon className="w-8 h-8 text-primary mb-4 mx-auto" /><h3 className="font-heading text-lg font-semibold text-center mb-2">{title}</h3><p className="text-sm text-muted-foreground text-center leading-relaxed">{body}</p></CardContent></Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 4 — HOW IT WORKS ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp>
            <Badge variant="outline" className="mx-auto mb-4 block w-fit text-xs px-4 py-1.5 border-primary/30 bg-primary/5">What LUMI actually does</Badge>
          </FadeUp>
          <FadeUp delay={0.05}><h2 className="font-display text-3xl sm:text-4xl text-center mb-12 max-w-3xl mx-auto">From strategy to live campaign in&nbsp;minutes</h2></FadeUp>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Target, title: "1. Strategy", desc: "LUMI builds a complete campaign plan based on your offer, audience, and goals — using frameworks from a real ads agency." },
              { icon: PenTool, title: "2. Creative", desc: "Scripts, hooks, headlines, ad copy, and creative direction — all tailored to your brand voice and backed by psychology." },
              { icon: Clapperboard, title: "3. Build", desc: "LUMI sets up your campaigns directly in Meta Ads Manager. Training, cold, and warm audiences — structured like a pro." },
              { icon: BarChart3, title: "4. Optimize", desc: "Real-time performance monitoring, weekly reports, fatigue detection, and clear next steps — LUMI watches so you don't have to." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className="text-center"><div className="w-12 h-12 rounded-2xl bg-gradient-lumi flex items-center justify-center mx-auto mb-4 shadow-lumi"><Icon className="w-6 h-6 text-primary-foreground" /></div><h3 className="font-heading text-base font-semibold mb-2">{title}</h3><p className="text-xs text-muted-foreground leading-relaxed">{desc}</p></div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 4a — DEMO VIDEO ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <FadeUp>
            <Badge variant="outline" className="mx-auto mb-4 block w-fit text-xs px-4 py-1.5 border-primary/30 bg-primary/5">See it in action</Badge>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-8">Watch LUMI build a campaign from&nbsp;scratch</h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="rounded-2xl overflow-hidden shadow-elevated border border-border">
              <div style={{ position: "relative", paddingBottom: "55.42%", height: 0 }}>
                <iframe
                  src="https://www.loom.com/embed/7526d2b5983241978a53d28ce8040852"
                  frameBorder="0"
                  allowFullScreen
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                  title="LUMI Demo"
                />
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 4b — Feature deep-dives ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-4">Everything you need. Nothing&nbsp;extra.</h2></FadeUp>
          <FadeUp delay={0.05}><p className="text-center text-muted-foreground max-w-lg mx-auto mb-12">LUMI replaces your ads manager, your copywriter, and your analyst — all in one place.</p></FadeUp>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { Icon: Lightbulb, title: "Psychology-Driven Copy", desc: "Ad copy built on cognitive triggers and real frameworks — not generic prompts." },
              { Icon: Target, title: "Smart Audience Targeting", desc: "Broad, warm, and retargeting audiences structured the way top agencies run them." },
              { Icon: Clapperboard, title: "Full Creative Briefs", desc: "Scripts, hooks, b-roll directions, and text overlays — everything your content team needs." },
              { Icon: BarChart3, title: "Performance Monitoring", desc: "Real-time KPI tracking with benchmarks. Know exactly what's working and what's not." },
              { Icon: Mail, title: "Weekly Digest Reports", desc: "Automated email reports with plain-English insights and next steps." },
              { Icon: Rocket, title: "Direct Meta Integration", desc: "Build and launch campaigns directly from LUMI — no Ads Manager required." },
            ].map(({ Icon, title, desc }, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <Card className="border-border h-full"><CardContent className="p-5 flex items-start gap-3"><Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /><div><p className="font-heading text-sm font-semibold mb-1">{title}</p><p className="text-xs text-muted-foreground leading-relaxed">{desc}</p></div></CardContent></Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 5 — WHY LUMI ≠ CHATGPT ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp>
            <Badge variant="outline" className="mx-auto mb-4 block w-fit text-xs px-4 py-1.5 border-primary/30 bg-primary/5">The difference that actually matters</Badge>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="font-display text-3xl sm:text-4xl text-center mb-4 max-w-3xl mx-auto">ChatGPT doesn't know what's working on Meta right now. LUMI&nbsp;does.</h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-center text-muted-foreground max-w-[620px] mx-auto mb-12 leading-relaxed">Any AI can write an ad. Not every AI has spent years managing millions of dollars in real ad spend across dozens of industries — and is still actively running campaigns today.</p>
          </FadeUp>

          {/* Comparison table */}
          <FadeUp delay={0.15}>
            <Card variant="gradient" className="max-w-4xl mx-auto overflow-hidden mb-16">
              <CardContent className="p-0">
                <div className="grid grid-cols-2">
                  <div className="p-4 sm:p-5 border-b border-border border-r border-border">
                    <p className="text-sm font-medium text-muted-foreground line-through decoration-destructive/50">Generic AI (ChatGPT, Claude, etc.)</p>
                  </div>
                  <div className="p-4 sm:p-5 border-b border-border">
                    <p className="text-sm font-semibold bg-gradient-lumi bg-clip-text text-transparent">LUMI ✨</p>
                  </div>
                </div>
                {[
                  ["Writes ads based on general knowledge", "Built on strategies proven to convert for coaches and course creators"],
                  ["No idea what Meta's algorithm rewards right now", "Trained on what's actually working on Meta today"],
                  ["Can't build anything in Ads Manager", "Builds and launches your campaign directly in Meta"],
                  ["Doesn't know if your results are good or bad", "Monitors your performance against real benchmarks"],
                  ["Gives you a starting point — you do the rest", "Does the whole job, start to finish"],
                  ["No strategy — just content", "Real campaign strategy, not just words on a screen"],
                  ["Same advice for everyone", "Built around your specific offer, audience, and goals"],
                ].map(([left, right], i) => (
                  <div key={i} className="grid grid-cols-2">
                    <div className="p-4 sm:p-5 border-b border-border border-r border-border flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="flex-shrink-0">❌</span><span>{left}</span>
                    </div>
                    <div className="p-4 sm:p-5 border-b border-border flex items-start gap-2 text-sm font-medium text-foreground">
                      <span className="flex-shrink-0">✅</span><span>{right}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeUp>

          {/* Founder credibility block */}
          <FadeUp delay={0.2}>
            <div className="max-w-[680px] mx-auto text-center mb-12">
              <img src={foundersPhoto} alt="LUMI founders" className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-cover object-[center_70%] mx-auto mb-6 border-4 border-primary/20 shadow-lumi" />
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground mb-3">Built by ad managers. Not just engineers.</p>
              <h3 className="font-display text-2xl sm:text-3xl mb-5">LUMI isn't a chatbot that learned about ads from the&nbsp;internet.</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">It's built on the same frameworks, strategies, and hard-won experience that power a real Meta ads agency — one that has managed millions of dollars in ad spend across dozens of industries and is actively running campaigns for clients right now.</p>
              <p className="text-muted-foreground leading-relaxed mb-6">The difference between a generic AI writing your ads and LUMI building your campaign is the same difference between asking a stranger on the street for directions and hiring a guide who's walked that exact road hundreds of times. The words might look similar. The results won't be.</p>
              <p className="text-xs text-muted-foreground">After Organic · Meta Ads Agency · Est. 2016 · Actively managing campaigns</p>
            </div>
          </FadeUp>

          {/* Three callout pills */}
          <FadeUp delay={0.25}>
            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
              {[
                { Icon: TrendingUp, title: "Millions managed", desc: "Real ad spend. Real results. Real industries." },
                { Icon: RefreshCw, title: "Updated constantly", desc: "Strategies reflect what's working on Meta right now — not last year." },
                { Icon: Shield, title: "Proven frameworks", desc: "Every campaign structure is built the way a senior ads manager would build it." },
              ].map(({ Icon, title, desc }, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-4 sm:p-5 flex items-start gap-3">
                    <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-heading text-sm font-semibold mb-0.5">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={0.3}>
            <p className="text-center text-base sm:text-lg font-semibold max-w-xl mx-auto">You're not getting AI that read about ads. You're getting AI that runs&nbsp;them.</p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 6 — PRICING ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-10">Simple pricing. Serious&nbsp;results.</h2></FadeUp>
          <FadeUp delay={0.1}>
            <div className="mx-auto max-w-md">
              <Card variant="gradient" className="overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  {/* Price — Monthly only */}
                  <div className="text-center mb-2">
                    <span className="font-display text-4xl text-foreground">$97/mo</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 my-6">
                    {["Unlimited campaigns", "AI campaign builder", "Creative angle & copy generation", "Full creative briefs with scripts", "Direct Meta Ads Manager integration", "Performance monitoring & alerts", "Weekly performance digest", "Creative fatigue detection", "Ad Glossary & plain-English insights"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary flex-shrink-0" />{f}</li>
                    ))}
                  </ul>

                  {/* #2 — Ad budget reassurance */}
                  <p className="text-[11px] text-muted-foreground text-center mb-4">You control your ad budget completely — LUMI just manages it smarter. Most beginners start with $10–$20/day.</p>

                  <CheckoutButton className="w-full">
                    {partnerCodeValid ? "Start Your 14-Day Free Trial" : "Start 7-Day Free Trial"} <ArrowRight className="w-4 h-4 ml-1" />
                  </CheckoutButton>
                  {/* #4 — Post-click clarity */}
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    {partnerCodeValid
                      ? "Your 14-day free trial starts now. No charge until the trial ends."
                      : "7-day free trial · No charge until day 8 · Cancel anytime"}
                  </p>

                  {/* Partner code input */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center mb-2">Have a partner code?</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code (e.g. SARAH14)"
                        value={partnerCode}
                        onChange={(e) => {
                          setPartnerCode(e.target.value);
                          setPartnerCodeValid(null);
                        }}
                        onBlur={() => validatePartnerCode(partnerCode)}
                        className="text-sm uppercase"
                      />
                    </div>
                    {partnerCodeValid === true && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Gift className="w-3 h-3" /> Partner code applied — 14-day free trial!</p>
                    )}
                    {partnerCodeValid === false && partnerCode && (
                      <p className="text-xs text-destructive mt-1">Code not found. Check spelling and try again.</p>
                    )}
                  </div>

                  {/* #3 — Locked-in founders rate callout */}
                  <div className="mt-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 p-3 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-foreground leading-relaxed">Sign up today and this is your rate forever. No price increases. Ever.</p>
                  </div>

                </CardContent>
              </Card>
            </div>
          </FadeUp>

          {/* FAQ */}
          <FadeUp delay={0.15}>
            <div className="mt-16 max-w-2xl mx-auto">
              <h3 className="font-display text-xl text-center mb-6">Common Questions</h3>
              <div className="space-y-4">
                {[
                  { q: "Do I need ads experience?", a: "Not at all. LUMI walks you through everything — from strategy to launch. If you can answer a few questions about your business, LUMI handles the rest." },
                  { q: "Will LUMI run my ads for me?", a: "Yes. LUMI builds your campaigns, sets targeting, writes your copy, and monitors performance. You review and approve, LUMI does the heavy lifting." },
                  { q: "What kind of results can I expect?", a: "Results vary by offer and audience, but LUMI uses the same frameworks and strategies that have generated results across dozens of industries. You'll have a structured campaign running from day one." },
                  { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no commitments. Cancel from your account settings whenever you want." },
                  { q: "What if I already have campaigns running?", a: "LUMI can monitor and optimize existing campaigns too. Connect your Meta account and LUMI starts analyzing immediately." },
                ].map(({ q, a }, i) => (
                  <details key={i} className="group border border-border rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-sm font-medium hover:bg-muted/30 transition">
                      {q}
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>
                  </details>
                ))}
              </div>
            </div>
          </FadeUp>

          {/* Mid CTA */}
          <FadeUp delay={0.2}>
            <div className="text-center mt-10">
              <p className="text-muted-foreground mb-3">Ready to try it?</p>
               <CheckoutButton>Start Free Trial — Founder Pricing <ArrowRight className="w-4 h-4 ml-1" /></CheckoutButton>
               <p className="text-[11px] text-muted-foreground mt-2">7-day free trial · Founder pricing $97/mo after · Cancel anytime</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 7 — FINAL CTA ═══════ */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground rounded-t-[40px]">
        <div className="container mx-auto px-4 text-center">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl mb-4">Stop overthinking your ads. Start&nbsp;running&nbsp;them.</h2></FadeUp>
          <FadeUp delay={0.1}><p className="text-primary-foreground/80 max-w-lg mx-auto mb-8 text-base sm:text-lg">Stop leaving money on the table. LUMI builds, runs, and optimizes your Meta ads — starting today.</p></FadeUp>
          <FadeUp delay={0.2}>
            <Button size="lg" onClick={goCheckout} disabled={checkoutLoading} className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90 rounded-2xl text-base font-semibold shadow-elevated px-8">
              {checkoutLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</> : <>Get Started — Founder Pricing <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={lumiLogo} alt="LUMI" className="h-5" />
            <span>© {new Date().getFullYear()} After Organic. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <a href="/partners" className="hover:text-foreground transition">Partners</a>
            <a href="/refer" className="hover:text-foreground transition">Refer & Earn</a>
            <a href="/glossary" className="hover:text-foreground transition">Glossary</a>
            <a href="mailto:support@adsbylumi.com" className="hover:text-foreground transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Sales;
