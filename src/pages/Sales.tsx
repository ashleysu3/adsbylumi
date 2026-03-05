import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { X, Menu, DollarSign, Clock, BookOpen, Check, ChevronDown, Target, PenTool, Clapperboard, BarChart3, Lightbulb, Mail, ArrowRight, TrendingUp, RefreshCw, Shield, Lock, Calendar, Sparkles, Rocket, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem("lumi-banner-dismissed") === "true");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  

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
              <span>🎉 Founders Pricing — Use code <strong>LUMIBETA</strong> for 50% off forever!</span>
              <button onClick={dismissBanner} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-primary-foreground/20 transition"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ NAV ═══════ */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-md shadow-card border-b border-border" : "bg-transparent"}`}>
        <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:py-4">
          <a href="/"><img src={lumiLogo} alt="LUMI" className="h-8 sm:h-10" /></a>
          <div className="hidden md:flex items-center gap-4">
            <button onClick={goAuth} className="text-sm font-medium text-muted-foreground hover:text-foreground transition">Sign In</button>
            <Button variant="lumi" size="sm" onClick={goAuth}>Start Free</Button>
          </div>
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
            <p className="text-base sm:text-lg text-muted-foreground max-w-[600px] mx-auto mb-4 leading-relaxed">
              LUMI is your AI-powered Meta ads manager. It builds your campaigns, writes your copy, generates your creative strategy, and monitors your results — so you get professional ads without the agency price tag or the learning curve.
            </p>
          </FadeUp>
          {/* #5 — Never run ads before? badge */}
          <FadeUp delay={0.25}>
            <Badge variant="outline" className="mb-6 text-xs px-4 py-1.5 border-border bg-muted/50 text-muted-foreground">🙋 Never run an ad before? Perfect. You'll skip all the bad habits.</Badge>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <Button variant="lumi" size="lg" onClick={goAuth} className="w-full sm:w-auto">Start for $48.50/mo <ArrowRight className="w-4 h-4 ml-1" /></Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="w-full sm:w-auto">See How It Works</Button>
            </div>
            <p className="text-xs text-muted-foreground">Use code <strong>LUMIBETA</strong> for 50% off forever · Founders pricing $48.50/mo · Cancel anytime</p>
            {/* #4 — Post-click clarity */}
            <p className="text-[11px] text-muted-foreground mt-1">You'll create your account, enter code LUMIBETA, and be inside LUMI in under 2 minutes.</p>
            {/* #8 — Support reassurance */}
            <p className="text-[11px] text-muted-foreground mt-1">Questions along the way? Real humans. Real answers. <a href="mailto:hello@adsbylumi.com" className="text-primary hover:underline">hello@adsbylumi.com</a></p>
          </FadeUp>
          {/* Hero mockup card — #1 coaching context */}
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

          {/* Features alternating — #1 coaching context mockups */}
          {[
            {
              headline: "Tell LUMI what you're promoting. It handles the rest.",
              body: "Paste in your offer URL and LUMI analyzes your page, understands your audience, and builds your entire campaign strategy — no briefing docs, no back-and-forth, no waiting.",
              bullets: ["Automatically extracts your offer details", "Builds your audience psychology profile", "Recommends the right campaign structure"],
              mockTitle: "12-Week Business Coaching Program", mockDetails: ["Auto-filled from URL • Click to edit", "Offer type: Coaching ✅", "Audience: Aspiring entrepreneurs"],
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
              mockTitle: "Signature Course Launch — Lead Generation 🚀", mockDetails: ["Connected to Meta ✅", "3 ad sets configured", "12 ads queued"],
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

      {/* ═══════ SECTION 4.5 — SEE IT IN ACTION ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-3">See LUMI in action</h2></FadeUp>
          <FadeUp delay={0.05}><p className="text-center text-muted-foreground max-w-[500px] mx-auto mb-12">This is what building a campaign actually looks like.</p></FadeUp>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Card 1 */}
            <FadeUp delay={0.1}>
              <div className="text-center">
                <p className="text-xs font-semibold text-primary mb-2">Step 1</p>
                <h3 className="font-heading text-base font-semibold mb-4">LUMI generates your angles</h3>
                <Card className="border-primary/20 shadow-card overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    {[
                      { angle: "Problem-Solution", format: "Talking Head" },
                      { angle: "Social Proof", format: "B-Roll" },
                      { angle: "Curiosity Gap", format: "Graphic" },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border">
                        <span className="text-sm font-medium">{a.angle}</span>
                        <Badge variant="secondary" className="text-[10px]">{a.format}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground mt-3">Multiple strategic angles, built around your specific offer</p>
              </div>
            </FadeUp>
            {/* Card 2 */}
            <FadeUp delay={0.15}>
              <div className="text-center">
                <p className="text-xs font-semibold text-primary mb-2">Step 2</p>
                <h3 className="font-heading text-base font-semibold mb-4">Your full creative brief</h3>
                <Card className="border-primary/20 shadow-card overflow-hidden">
                  <CardContent className="p-4 text-left space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hook</p>
                      <p className="text-sm font-medium">"I wasted $3K on ads before I figured this out…"</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Script</p>
                      <p className="text-xs text-muted-foreground">0:00 — Open with the hook, direct to camera…</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Visual Direction</p>
                      <p className="text-xs text-muted-foreground">Bright, casual setting. Laptop visible. Confident energy.</p>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground mt-3">Ready to hand to a UGC creator or record yourself</p>
              </div>
            </FadeUp>
            {/* Card 3 */}
            <FadeUp delay={0.2}>
              <div className="text-center">
                <p className="text-xs font-semibold text-primary mb-2">Step 3</p>
                <h3 className="font-heading text-base font-semibold mb-4">Campaign live in Meta</h3>
                <Card className="border-primary/20 shadow-card overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-display text-base">Signature Course Launch 🚀</p>
                    <Badge className="bg-green-500/15 text-green-700 border-green-500/30 text-xs">Connected to Meta ✅</Badge>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">3 ad sets configured</p>
                      <p className="text-xs text-muted-foreground">12 ads ready to launch</p>
                    </div>
                    <div className="rounded-lg bg-primary/10 text-primary text-xs font-semibold py-2 text-center">Build Campaign</div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground mt-3">LUMI builds it in Ads Manager — you just review and go</p>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 5 — FEATURE GRID ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/20">
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

      {/* ═══════ SECTION 5.5 — WHY NOT CHATGPT ═══════ */}
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
                  <Badge className="bg-destructive/90 text-destructive-foreground mb-4">🔥 Founders Pricing — Limited Time</Badge>

                  {/* Price — Monthly only */}
                  <div className="text-center mb-2">
                    <span className="text-muted-foreground line-through text-lg mr-2">$97/mo</span>
                    <span className="font-display text-4xl text-foreground">$48.50/mo</span>
                    <p className="text-xs text-primary font-medium mt-1">with code LUMIBETA</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 my-6">
                    {["Unlimited campaigns", "AI campaign builder", "Creative angle & copy generation", "Full creative briefs with scripts", "Direct Meta Ads Manager integration", "Performance monitoring & alerts", "Weekly performance digest", "Creative fatigue detection", "Ad Glossary & plain-English insights"].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary flex-shrink-0" />{f}</li>
                    ))}
                  </ul>

                  {/* #2 — Ad budget reassurance */}
                  <p className="text-[11px] text-muted-foreground text-center mb-4">You control your ad budget completely — LUMI just manages it smarter. Most beginners start with $10–$20/day.</p>

                  <Button variant="lumi" size="lg" className="w-full" onClick={goAuth}>Get Started for 50% Off <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  {/* #4 — Post-click clarity */}
                  <p className="text-[11px] text-muted-foreground text-center mt-2">You'll create your account, enter code LUMIBETA, and be inside LUMI in under 2 minutes.</p>

                  {/* #3 — Locked-in founders rate callout */}
                  <div className="mt-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 p-3 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-foreground leading-relaxed">Sign up today and this is your rate forever. No price increases. Ever.</p>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center mt-3">Cancel anytime. No contracts.</p>
                </CardContent>
              </Card>
              <p className="text-center text-xs text-muted-foreground mt-6">vs. $2,000–$5,000/mo for an agency · vs. months learning Ads Manager yourself</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 7 — HOW IT WORKS STEPS ═══════ */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-12">From offer to live ads in&nbsp;minutes</h2></FadeUp>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { emoji: "🔗", title: "Connect your Meta account", desc: "Link LUMI to your Facebook ad account in one click. Takes 2 minutes." },
              { emoji: "📝", title: "Add what you're promoting", desc: "Paste your offer URL. LUMI reads your page and builds your brand and offer profile automatically." },
              /* #10 — Updated Step 3 copy */
              { emoji: "✨", title: "LUMI builds your campaign", desc: "Review your angles, read through the ad copy LUMI wrote for you, and approve your campaign. LUMI handles the technical build inside Meta — no Ads Manager required." },
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
              <p className="text-[11px] text-muted-foreground mt-2">You'll create your account, enter code LUMIBETA, and be inside LUMI in under 2 minutes.</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 7.5 — YOUR FIRST WEEK ═══════ */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <FadeUp><h2 className="font-display text-3xl sm:text-4xl text-center mb-3">Here's what your first week looks&nbsp;like</h2></FadeUp>
          <FadeUp delay={0.05}><p className="text-center text-muted-foreground mb-12">From zero to live ads — faster than you'd think.</p></FadeUp>
          <div className="max-w-[600px] mx-auto">
            {[
              { day: "Day 1", icon: Sparkles, text: "Connect your Meta account, add your offer, and meet LUMI. The whole setup takes about 20 minutes." },
              { day: "Day 2", icon: Target, text: "Review the campaign strategy and creative angles LUMI built for your specific offer. Tweak anything you want." },
              { day: "Day 3", icon: Clapperboard, text: "Get your creative brief — scripts, shot lists, graphic specs. Hand it to a creator or record it yourself." },
              { day: "Day 5", icon: Rocket, text: "Your campaign goes live inside Meta. LUMI handles the technical build." },
              { day: "Day 7", icon: MailCheck, text: "Your first weekly digest lands in your inbox. Plain English. Here's what's working, here's what to do next." },
            ].map((step, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className="flex gap-4 mb-8 last:mb-0">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-5 h-5 text-primary" />
                    </div>
                    {i < 4 && <div className="w-px flex-1 bg-border mt-2" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-semibold text-primary mb-1">{step.day}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
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
            <p className="text-primary-foreground/70 text-xs mt-3">Founders pricing · $48.50/mo · Cancel anytime</p>
            <p className="text-primary-foreground/60 text-[11px] mt-1">You'll create your account, enter code LUMIBETA, and be inside LUMI in under 2 minutes.</p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════ SECTION 10 — FOOTER ═══════ */}
      {/* #9 — Affiliates link removed */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={lumiLogo} alt="LUMI" className="h-6" />
            <span>© 2026 LUMI. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => document.querySelector('[class*="bg-muted/30"]:has(h2)')?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground transition">Pricing</button>
            <a href="/auth" className="hover:text-foreground transition">Sign In</a>
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
