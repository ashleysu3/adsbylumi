import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { X, Menu, DollarSign, Clock, BookOpen, Check, ChevronDown, Target, PenTool, Clapperboard, BarChart3, Lightbulb, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import lumiLogo from "@/assets/lumi-logo.png";

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
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem("lumi-banner-dismissed") === "true");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dismissBanner = () => { setBannerDismissed(true); localStorage.setItem("lumi-banner-dismissed", "true"); };

  const goAuth = () => navigate("/auth");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ═══════ STICKY BANNER ═══════ */}
      <AnimatePresence>
        {!bannerDismissed && (
          <motion.div initial={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="bg-gradient-warm text-primary-foreground relative z-[60]">
            <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2.5 text-center text-xs sm:text-sm font-medium">
              <span>🎉 Founders Pricing — Use code <strong>LUMIBETA</strong> for 50% off your first month!</span>
              <button onClick={dismissBanner} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-primary-foreground/20 transition"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ NAV ═══════ */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-md shadow-card border-b border-border" : "bg-transparent"}`}>
        <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:py-4">
          <a href="/"><img src={lumiLogo} alt="LUMI" className="h-8 sm:h-10" /></a>
          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4">
            <button onClick={goAuth} className="text-sm font-medium text-muted-foreground hover:text-foreground transition">Sign In</button>
            <Button variant="lumi" size="sm" onClick={goAuth}>Start Free</Button>
          </div>
          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Menu className="w-6 h-6" /></button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden border-t border-border bg-background overflow-hidden">
              <div className="flex flex-col gap-2 p-4">
                <button onClick={() => { goAuth(); setMobileMenuOpen(false); }} className="text-sm font-medium py-2">Sign In</button>
                <Button variant="lumi" size="sm" onClick={() => { goAuth(); setMobileMenuOpen(false); }}>Start Free</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══════ SECTION 1 — HERO ═══════ */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* BG blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-accent/15 blur-[100px]" />
        </div>
        <div className="relative container mx-auto px-4 text-center py-16 sm:py-24">
          <FadeUp>
            <Badge variant="outline" className="mb-6 text-xs sm:text-sm px-4 py-1.5 border-primary/30 bg-primary/5">✨ Built for coaches, course creators &amp; service providers</Badge>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1] mb-6 max-w-4xl mx-auto">
              Too busy to learn ads.<br />Too smart to waste money on&nbsp;them.
            </h1>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="text-base sm:text-lg text-muted-foreground max-w-[600px] mx-auto mb-8 leading-relaxed">
              LUMI is your AI-powered Meta ads manager. It builds your campaigns, writes your copy, generates your creative strategy, and monitors your results — so you get professional ads without the agency price tag or the learning curve.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              <Button variant="lumi" size="lg" onClick={goAuth} className="w-full sm:w-auto">Start for $48.50/mo <ArrowRight className="w-4 h-4 ml-1" /></Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="w-full sm:w-auto">See How It Works</Button>
            </div>
            <p className="text-xs text-muted-foreground">Use code <strong>LUMIBETA</strong> for 50% off · Founders pricing $97/mo · Cancel anytime</p>
          </FadeUp>
          {/* Hero mockup card */}
          <FadeUp delay={0.45}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="mt-12 mx-auto max-w-sm">
              <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-lumi">
                <p className="font-display text-lg mb-4">Your campaign is ready 🚀</p>
                {["5 ad angles generated", "Copy written for all formats", "Campaign built in Ads Manager"].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-sm text-foreground/80"><Check className="w-4 h-4 text-primary flex-shrink-0" />{t}</div>
                ))}
              </div>
            </motion.div>
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
                {["$3,000/mo agency retainers", "40-hour ad courses that don't run your ads", "Ads Manager overwhelm"].map((t, i) => (
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
              { icon: Clock, title: "DIY takes forever", body: "Ads Manager is complicated. Learning targeting, campaign structure, copywriting, creative strategy — it's a full-time skill set most business owners don't have time to develop." },
              { icon: BookOpen, title: "Courses don't do it for you", body: "You can take every ads course out there and still stare at a blank campaign. Knowledge isn't the same as execution. You need someone to actually build it." },
            ].map((c, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <Card className="h-full border-border hover:shadow-lumi transition-shadow duration-300">
                  <CardContent className="p-6 sm:p-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><c.icon className="w-6 h-6 text-primary" /></div>
                    <h3 className="font-display text-xl mb-2">{c.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{c.body}</p>
                  </CardContent>
                </Card>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.3}><p className="text-center mt-10 text-primary font-semibold text-lg">There's a better way. →</p></FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 4 — THE SOLUTION ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp><Badge variant="outline" className="mx-auto block w-fit mb-4 px-4 py-1 text-xs border-primary/30 bg-primary/5">Introducing LUMI</Badge></FadeUp>
          <FadeUp delay={0.1}><h2 className="font-display text-3xl sm:text-4xl md:text-5xl text-center mb-4 max-w-3xl mx-auto">Your AI ads manager.<br />Minus the agency&nbsp;invoice.</h2></FadeUp>
          <FadeUp delay={0.15}><p className="text-center text-muted-foreground max-w-[600px] mx-auto mb-16">LUMI does what an ads manager does — builds strategy, writes copy, creates your campaign, and watches your results — at a fraction of the cost.</p></FadeUp>

          {/* Features alternating */}
          {[
            {
              headline: "Tell LUMI what you're promoting. It handles the rest.",
              body: "Paste in your offer URL and LUMI analyzes your page, understands your audience, and builds your entire campaign strategy — no briefing docs, no back-and-forth, no waiting.",
              bullets: ["Automatically extracts your offer details", "Builds your audience psychology profile", "Recommends the right campaign structure"],
              mockTitle: "Add What You're Promoting", mockDetails: ["Auto-filled • Click to edit", "Offer URL detected ✅", "Audience mapped"],
            },
            {
              headline: "Multiple angles. Multiple formats. All built for you.",
              body: "LUMI doesn't just write one ad — it generates multiple strategic angles for your offer, then creates talking head scripts, B-roll directions, graphic concepts, and ad copy for every single one.",
              bullets: ["5–8 unique creative angles per campaign", "Talking head scripts with timed text overlays", "B-roll shot lists and graphic briefs", "Primary copy, headlines, and CTAs written"],
              mockTitle: "Creative Angles", mockDetails: ["Problem-Solution · Talking Head", "Social Proof · B-Roll", "Curiosity Gap · Graphic"],
            },
            {
              headline: "It builds your campaign directly in Ads Manager.",
              body: "LUMI doesn't just give you a plan — it executes it. Your campaign gets built inside Meta Ads Manager automatically.",
              bullets: ["Campaign, ad set, and ads created automatically", "Best-practice targeting built in", "Connected directly to your Meta ad account"],
              mockTitle: "Campaign Ready to Launch 🚀", mockDetails: ["Connected to Meta ✅", "3 ad sets configured", "12 ads queued"],
            },
            {
              headline: "LUMI watches your ads so you don't have to.",
              body: "Once your ads are live, LUMI monitors performance, flags creative fatigue, and tells you exactly what to do next — in plain English, not ad jargon.",
              bullets: ["Detects when creative is fatiguing", "Recommends budget adjustments", "Weekly performance digest every Monday", "Plain-English explanations, no jargon"],
              mockTitle: "What LUMI Sees", mockDetails: ["CTR trending ↑ 2.1%", "Creative #3 fatiguing — refresh soon", "Scale budget +20% recommended"],
            },
          ].map((f, i) => {
            const textLeft = i % 2 === 0;
            return (
              <FadeUp key={i} delay={0.05}>
                <div className={`flex flex-col ${textLeft ? "md:flex-row" : "md:flex-row-reverse"} gap-8 md:gap-12 items-center mb-16 md:mb-24 max-w-5xl mx-auto`}>
                  <div className="flex-1 w-full">
                    <h3 className="font-display text-2xl sm:text-3xl mb-3">{f.headline}</h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">{f.body}</p>
                    <ul className="space-y-2">
                      {f.bullets.map((b, j) => <li key={j} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />{b}</li>)}
                    </ul>
                  </div>
                  <div className="flex-1 w-full max-w-sm">
                    <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
                      <p className="font-display text-base mb-3">{f.mockTitle}</p>
                      {f.mockDetails.map((d, j) => <p key={j} className="text-xs text-muted-foreground py-1 border-b border-border last:border-0">{d}</p>)}
                    </div>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* ═══════ SECTION 5 — FEATURE GRID ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-12">Everything you need. Nothing you&nbsp;don't.</h2></FadeUp>
          <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              { emoji: "🎯", title: "Strategy Built In", desc: "Best practices and proven campaign structures baked into every build." },
              { emoji: "✍️", title: "AI Copywriter", desc: "Hooks, primary copy, headlines, and CTAs written for your specific offer." },
              { emoji: "🎬", title: "Creative Briefs", desc: "Full production-ready briefs with scripts, B-roll lists, and graphic specs." },
              { emoji: "📊", title: "Performance Monitoring", desc: "LUMI tracks your metrics and tells you when something needs attention." },
              { emoji: "💡", title: "Creative Fatigue Detection", desc: "Know exactly when your ads are burning out before your results tank." },
              { emoji: "📬", title: "Weekly Digest", desc: "A Monday morning summary of your performance and what to focus on this week." },
            ].map((f, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <Card className="border-border hover:shadow-lumi transition-shadow duration-300">
                  <CardContent className="p-5 sm:p-6 flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0">{f.emoji}</span>
                    <div><h3 className="font-heading text-base font-semibold mb-1">{f.title}</h3><p className="text-sm text-muted-foreground">{f.desc}</p></div>
                  </CardContent>
                </Card>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 6 — PRICING ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-10">Simple pricing. Serious&nbsp;results.</h2></FadeUp>
          <FadeUp delay={0.1}>
            <div className="mx-auto max-w-md">
              <Card variant="gradient" className="overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  <Badge className="bg-destructive/90 text-destructive-foreground mb-4">🔥 Founders Pricing — Limited Time</Badge>

                  {/* Toggle */}
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
                    <button onClick={() => setAnnual(!annual)} className={`relative w-12 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-border"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-primary-foreground shadow transition-transform ${annual ? "translate-x-6" : ""}`} />
                    </button>
                    <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
                    {annual && <Badge variant="secondary" className="text-[10px] ml-1">Best value</Badge>}
                  </div>

                  {/* Price */}
                  {annual ? (
                    <div className="text-center mb-2">
                      <span className="text-muted-foreground line-through text-lg mr-2">$970/yr</span>
                      <span className="font-display text-4xl text-foreground">$776/yr</span>
                      <p className="text-xs text-primary font-medium mt-1">Save $194 — 2 months free · with code LUMIBETA</p>
                    </div>
                  ) : (
                    <div className="text-center mb-2">
                      <span className="text-muted-foreground line-through text-lg mr-2">$97/mo</span>
                      <span className="font-display text-4xl text-foreground">$48.50/mo</span>
                      <p className="text-xs text-primary font-medium mt-1">with code LUMIBETA</p>
                    </div>
                  )}

                  {/* Features */}
                  <ul className="space-y-2 my-6">
                    {["Unlimited campaigns", "AI campaign builder", "Creative angle & copy generation", "Full creative briefs with scripts", "Direct Meta Ads Manager integration", "Performance monitoring & alerts", "Weekly performance digest", "Creative fatigue detection", "Ad Glossary & plain-English insights"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary flex-shrink-0" />{f}</li>
                    ))}
                  </ul>

                  <Button variant="lumi" size="lg" className="w-full" onClick={goAuth}>Get Started for 50% Off <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-3">Cancel anytime. No contracts. Founders pricing locks in your rate.</p>
                </CardContent>
              </Card>
              <p className="text-center text-xs text-muted-foreground mt-6">vs. $2,000–$5,000/mo for an agency · vs. months learning Ads Manager yourself</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 7 — HOW IT WORKS STEPS ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-12">From offer to live ads in&nbsp;minutes</h2></FadeUp>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { emoji: "🔗", title: "Connect your Meta account", desc: "Link LUMI to your Facebook ad account in one click. Takes 2 minutes." },
              { emoji: "📝", title: "Add what you're promoting", desc: "Paste your offer URL. LUMI reads your page and builds your brand and offer profile automatically." },
              { emoji: "✨", title: "LUMI builds your campaign", desc: "Choose your angles, review your copy and creative briefs, and let LUMI build it all in Ads Manager." },
              { emoji: "📈", title: "Watch. Optimize. Grow.", desc: "LUMI monitors your results and tells you exactly what to do next — every single week." },
            ].map((s, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-2xl">{s.emoji}</div>
                  <h3 className="font-heading text-base font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.4}>
            <div className="text-center mt-10">
              <p className="text-muted-foreground mb-3">Ready to try it?</p>
              <Button variant="lumi" size="lg" onClick={goAuth}>Start for 50% Off <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 8 — OBJECTION HANDLING ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-10">We know what you're&nbsp;thinking.</h2></FadeUp>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              { q: "I don't know anything about ads.", a: "Perfect — that's exactly who LUMI is built for. You don't need to know what a campaign objective is or how to set up a pixel. LUMI handles the strategy and structure. You just tell it what you're selling." },
              { q: "I've tried ads before and they didn't work.", a: "Bad results usually come from bad strategy, bad copy, or bad creative — not from ads themselves. LUMI builds campaigns using proven frameworks and monitors them so you can course-correct before you waste your budget." },
              { q: "Can't I just hire someone?", a: "You can — for $2,000–$5,000 a month. LUMI gives you the same strategic output at a fraction of the cost, and you stay in control of your own ad account." },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <ObjectionCard question={item.q} answer={item.a} />
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 9 — FINAL CTA ═══════ */}
      <section className="py-20 sm:py-28 bg-gradient-lumi text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl md:text-5xl mb-4">Your offers deserve better&nbsp;ads.</h2></FadeUp>
          <FadeUp delay={0.1}><p className="text-primary-foreground/80 max-w-lg mx-auto mb-8 text-base sm:text-lg">Stop leaving money on the table. LUMI builds, runs, and optimizes your Meta ads — starting today.</p></FadeUp>
          <FadeUp delay={0.2}>
            <Button size="lg" onClick={goAuth} className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90 rounded-2xl text-base font-semibold shadow-elevated px-8">
              Start for 50% Off with Code LUMIBETA <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-primary-foreground/70 text-xs mt-4">Founders pricing · $48.50/mo · Cancel anytime</p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 10 — FOOTER ═══════ */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={lumiLogo} alt="LUMI" className="h-6" />
            <span>© 2026 LUMI. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => document.querySelector('[class*="bg-muted/30"]:has(h2)')?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground transition">Pricing</button>
            <a href="/auth" className="hover:text-foreground transition">Sign In</a>
            <a href="/partners" className="hover:text-foreground transition">Affiliates</a>
            <a href="/glossary" className="hover:text-foreground transition">Glossary</a>
          </div>
          <span>Questions? <a href="mailto:hello@adsbylumi.com" className="text-primary hover:underline">hello@adsbylumi.com</a></span>
        </div>
      </footer>
    </div>
  );
};

/* ─── Objection Accordion Card ─── */
const ObjectionCard = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-border cursor-pointer" onClick={() => setOpen(!open)}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-heading text-base font-semibold">{question}</h3>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
        </div>
        <AnimatePresence>
          {open && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="text-sm text-muted-foreground mt-3 leading-relaxed overflow-hidden">
              {answer}
            </motion.p>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default Sales;
