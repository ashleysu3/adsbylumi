import { useState, useRef, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Plus, Palette, MessageSquare, Users, Image as ImageIcon, Check, Link2, Sparkles, Rocket, BarChart3, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/animations";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";

/* ---------------- Capture Bar (primary CTA) ---------------- */
const CaptureBar = ({
  websiteRef,
  size = "lg",
}: {
  websiteRef?: React.RefObject<HTMLInputElement>;
  size?: "lg" | "md";
}) => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [ig, setIg] = useState("");
  const [showIg, setShowIg] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const normalized = normalizeWebsiteUrl(url);
    if (!normalized || !normalized.includes(".")) {
      toast.error("Add your website URL to get started");
      return;
    }
    setBusy(true);
    const cleanIg = ig
      .trim()
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/\/+$/, "");
    try {
      sessionStorage.setItem("lumi_prefill_website", normalized);
      if (cleanIg) sessionStorage.setItem("lumi_prefill_instagram", cleanIg);
      else sessionStorage.removeItem("lumi_prefill_instagram");
    } catch { /* ignore */ }
    navigate("/onboarding", { state: { websiteUrl: normalized, instagramHandle: cleanIg } });
  };

  const inputH = size === "lg" ? "h-14 md:h-16 text-base md:text-lg" : "h-12 text-base";
  const btnH = size === "lg" ? "h-14 md:h-16 px-6 md:px-8 text-base md:text-lg" : "h-12 px-5";

  return (
    <form onSubmit={onSubmit} className="w-full max-w-2xl mx-auto">
      <div className={`flex flex-col sm:flex-row items-stretch gap-2 rounded-2xl bg-card border border-border shadow-elevated p-2`}>
        <div className={`flex items-center flex-1 rounded-xl bg-muted/60 px-3 sm:px-4 ${inputH}`}>
          <span className="text-muted-foreground font-mono text-sm mr-1 select-none">https://</span>
          <Input
            ref={websiteRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbrand.com"
            aria-label="Your website URL"
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className={`bg-gradient-lumi text-white font-semibold rounded-xl shadow-glow hover:opacity-95 hover:scale-[1.01] transition-all ${btnH}`}
        >
          {busy ? "Reading…" : (<>Build my first ad <ArrowRight className="ml-2 h-5 w-5" /></>)}
        </Button>
      </div>

      <div className="mt-3 text-center">
        {showIg ? (
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
            <span className="text-muted-foreground text-sm">@</span>
            <Input
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              placeholder="your.instagram"
              aria-label="Instagram handle (optional)"
              className="h-10 rounded-lg bg-muted/40"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowIg(true)}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            add your Instagram — for even sharper copy (optional)
          </button>
        )}
      </div>
    </form>
  );
};

/* ---------------- Reveal cards used inside demo panel ---------------- */
const DemoRevealCard = ({
  icon: Icon,
  title,
  children,
  delay,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  delay: number;
}) => {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className="rounded-xl bg-card border border-border p-4 shadow-card"
    >
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div>{children}</div>
    </motion.div>
  );
};

/* ---------------- Fake "example ads" for marquee ---------------- */
type ExampleAd = { kind: string; render: () => JSX.Element };

const EXAMPLE_ADS: ExampleAd[] = [
  {
    kind: "stat-grid",
    render: () => (
      <div className="h-full w-full flex flex-col p-5 bg-gradient-to-br from-lumi-orange-1 to-lumi-pink-1 text-white">
        <div className="text-xs uppercase tracking-wider opacity-80 mb-2">By the numbers</div>
        <div className="grid grid-cols-2 gap-3 flex-1 items-center">
          <div><div className="text-3xl font-display">312</div><div className="text-xs opacity-90">calls booked</div></div>
          <div><div className="text-3xl font-display">$27k</div><div className="text-xs opacity-90">in 30 days</div></div>
          <div><div className="text-3xl font-display">4.2x</div><div className="text-xs opacity-90">ROAS</div></div>
          <div><div className="text-3xl font-display">0</div><div className="text-xs opacity-90">burnout</div></div>
        </div>
      </div>
    ),
  },
  {
    kind: "big-type",
    render: () => (
      <div className="h-full w-full flex items-center justify-center p-6 bg-warm-black text-warm-white">
        <div className="font-display text-2xl leading-tight text-center">
          Booked out<br/>without a single<br/><span className="text-gradient-lumi">ad dollar.</span>
        </div>
      </div>
    ),
  },
  {
    kind: "testimonial",
    render: () => (
      <div className="h-full w-full flex flex-col justify-between p-5 bg-fog-grey text-warm-black">
        <div className="flex text-lumi-orange-1 gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
        <div className="font-display text-lg leading-snug">"I stopped dreading Ads Manager. LUMI just… gets my brand."</div>
        <div className="text-xs text-muted-foreground">— Maya, business coach</div>
      </div>
    ),
  },
  {
    kind: "offer",
    render: () => (
      <div className="h-full w-full flex flex-col items-center justify-center p-5 bg-gradient-to-br from-lumi-purple-1 to-lumi-blue-1 text-white text-center">
        <div className="text-xs uppercase tracking-widest opacity-90">this week only</div>
        <div className="font-display text-6xl leading-none my-2">40%</div>
        <div className="text-sm opacity-90">off the Booked Solid course</div>
        <div className="mt-4 rounded-full bg-white text-warm-black text-xs font-semibold px-4 py-1.5">Grab your seat</div>
      </div>
    ),
  },
  {
    kind: "checklist",
    render: () => (
      <div className="h-full w-full flex flex-col p-5 bg-warm-white text-warm-black">
        <div className="font-display text-lg mb-3">If any of these are you 👇</div>
        <ul className="space-y-2 text-sm">
          {["You're winging the copy", "You dread opening Ads Manager", "You know your offer converts"].map(t => (
            <li key={t} className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 text-lumi-pink-1 shrink-0" />{t}</li>
          ))}
        </ul>
        <div className="mt-auto pt-3 text-xs text-lumi-orange-1 font-semibold">→ Read yours in 60s</div>
      </div>
    ),
  },
  {
    kind: "webinar",
    render: () => (
      <div className="h-full w-full flex flex-col justify-between p-5 bg-gradient-to-br from-lumi-pink-1 via-lumi-purple-1 to-lumi-blue-1 text-white">
        <div className="text-xs uppercase tracking-widest opacity-90">Free live class</div>
        <div className="font-display text-xl leading-tight">The 3-ad system booking my clients solid</div>
        <div className="text-xs opacity-90">Thursday · 12pm PT · Save your seat →</div>
      </div>
    ),
  },
];

const AdTile = ({ ad }: { ad: ExampleAd }) => (
  <div className="w-[240px] h-[300px] rounded-2xl overflow-hidden shrink-0 shadow-elevated border border-white/10">
    {ad.render()}
  </div>
);

/* ---------------- Page ---------------- */
const Sales = () => {
  const navigate = useNavigate();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const focusHero = () => {
    heroInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => heroInputRef.current?.focus(), 400);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header
        className={`sticky top-0 z-40 transition-all ${
          scrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={lumiLogo} alt="LUMI" className="h-8 w-auto" />
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#who" className="hover:text-foreground transition-colors">Who it's for</a>
            <a href="#why" className="hover:text-foreground transition-colors">Why LUMI</a>
            <button onClick={() => navigate("/auth")} className="hover:text-foreground transition-colors">Sign in</button>
          </nav>
          <Button
            onClick={focusHero}
            className="bg-gradient-lumi text-white rounded-full h-10 px-5 shadow-glow hover:opacity-95"
          >
            Build my first ad
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-10 md:pb-16 text-center">
          <motion.div
            initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full bg-fog-grey border border-border px-4 py-1.5 text-xs md:text-sm text-muted-foreground mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-lumi-pink-1" />
            Free to start · see your ad before you pay
          </motion.div>

          <motion.h1
            initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-4xl md:text-6xl leading-[1.05] tracking-tight text-warm-black"
          >
            Meta ads that <span className="text-gradient-lumi">sound like you</span> — built from your website.
          </motion.h1>

          <motion.p
            initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-5 md:mt-6 text-base md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Drop your link and LUMI reads your brand, writes the copy, designs the creative, and runs your Meta ads.
            Made for coaches and creators who'd rather be coaching than fighting Ads Manager.
          </motion.p>

          <motion.div
            initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 md:mt-10"
          >
            <CaptureBar websiteRef={heroInputRef} />
          </motion.div>

          <motion.p
            initial={prefersReduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-6 text-sm text-muted-foreground"
          >
            No card to begin · 60-second setup · 4,000+ coaches &amp; creators
          </motion.p>
        </div>

        {/* soft glow backdrop */}
        <div aria-hidden className="absolute inset-x-0 -top-24 h-[500px] bg-gradient-lumi opacity-[0.07] blur-3xl pointer-events-none" />
      </section>

      {/* HERO DEMO PANEL */}
      <section className="px-5 md:px-8 pb-16 md:pb-24">
        <ScrollReveal className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-border bg-card shadow-elevated overflow-hidden">
            {/* browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-fog-grey/60">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                <span className="h-3 w-3 rounded-full bg-green-400/70" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground border border-border">
                  <Link2 className="h-3 w-3" />
                  reading yourbrand.com…
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <DemoRevealCard icon={Palette} title="Your palette" delay={0.2}>
                <div className="flex gap-2">
                  {["bg-lumi-orange-1", "bg-lumi-pink-1", "bg-lumi-purple-1", "bg-lumi-blue-1", "bg-warm-black"].map((c) => (
                    <span key={c} className={`h-10 w-10 rounded-lg ${c} shadow-inner`} />
                  ))}
                </div>
              </DemoRevealCard>

              <DemoRevealCard icon={MessageSquare} title="Your voice" delay={0.5}>
                <div className="flex flex-wrap gap-2">
                  {["Warm", "Direct", "No fluff"].map((t) => (
                    <span key={t} className="rounded-full bg-muted px-3 py-1 text-sm">{t}</span>
                  ))}
                </div>
              </DemoRevealCard>

              <DemoRevealCard icon={Users} title="Who you're for" delay={0.8}>
                <p className="text-sm text-foreground leading-relaxed">
                  Coaches drowning in busywork — craves a booked calendar, fears wasted ad spend.
                </p>
              </DemoRevealCard>

              <DemoRevealCard icon={ImageIcon} title="Found on your site" delay={1.1}>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-sm">3 testimonials</span>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm">2 photos</span>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm">your offer</span>
                </div>
              </DemoRevealCard>
            </div>

            {/* Mini ad reveal */}
            <motion.div
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mx-5 md:mx-8 mb-8 rounded-2xl overflow-hidden border border-border shadow-glow"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="bg-warm-black text-warm-white p-8 flex flex-col justify-center min-h-[240px]">
                  <div className="text-xs uppercase tracking-widest text-lumi-pink-2 mb-3">Your first ad, ready</div>
                  <div className="font-display text-3xl md:text-4xl leading-tight">
                    Booked out without a single ad dollar.
                  </div>
                  <button className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-lumi text-white px-4 py-2 text-sm font-semibold">
                    Get the playbook <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 min-h-[240px] flex items-center justify-center">
                  <Sparkles className="h-16 w-16 text-white/80" />
                </div>
              </div>
            </motion.div>
          </div>
        </ScrollReveal>
      </section>

      {/* ADS LIKE THESE (dark rounded) */}
      <section className="px-3 md:px-6">
        <div className="max-w-7xl mx-auto rounded-3xl bg-warm-black text-warm-white py-16 md:py-24 overflow-hidden">
          <ScrollReveal className="text-center px-5 md:px-10 max-w-3xl mx-auto mb-10 md:mb-14">
            <div className="text-xs md:text-sm uppercase tracking-widest text-lumi-pink-2 mb-3">
              You've scrolled past ads like these
            </div>
            <h2 className="font-display text-3xl md:text-5xl leading-tight">
              You just didn't know a coach made them solo.
            </h2>
            <p className="mt-4 text-white/70 max-w-xl mx-auto">
              Real formats LUMI builds — in your colors, your words, your photos. Not a generic template.
            </p>
          </ScrollReveal>

          <div
            className="relative group"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div className="flex gap-5 w-max animate-marquee group-hover:[animation-play-state:paused]">
              {[...EXAMPLE_ADS, ...EXAMPLE_ADS].map((ad, i) => (
                <AdTile key={i} ad={ad} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-5 md:px-8 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
            <div className="text-xs md:text-sm uppercase tracking-widest text-lumi-pink-1 mb-3">
              From link to launched
            </div>
            <h2 className="font-display text-3xl md:text-5xl leading-tight text-warm-black">
              Your ad, in four calm steps.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              No blank page. No Ads Manager maze. You paste one link and watch it happen.
            </p>
          </ScrollReveal>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {[
              {
                n: "01",
                title: "Drop your website",
                body: "Paste your link — that's the entire setup. Add your Instagram for even sharper voice.",
                icon: Link2,
                accent: "from-lumi-orange-1 to-lumi-pink-1",
              },
              {
                n: "02",
                title: "LUMI reads your brand",
                body: "Your colors, fonts, voice, offer, and ideal client — pulled and understood in seconds.",
                icon: Sparkles,
                accent: "from-lumi-pink-1 to-lumi-purple-1",
              },
              {
                n: "03",
                title: "Get your first ad",
                body: "Real copy and creative in your brand. Swipe through hooks until it's perfectly you.",
                icon: ImageIcon,
                accent: "from-lumi-purple-1 to-lumi-blue-1",
              },
              {
                n: "04",
                title: "Launch & let it optimize",
                body: "Connect Meta and go live. LUMI watches performance daily and tells you the one thing to do.",
                icon: BarChart3,
                accent: "from-lumi-blue-1 to-lumi-orange-1",
              },
            ].map((s) => (
              <StaggerItem key={s.n}>
                <Card className="p-6 md:p-8 rounded-2xl border-border shadow-card h-full hover:shadow-elevated transition-shadow">
                  <div className="flex items-start gap-5">
                    <div className={`shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br ${s.accent} flex items-center justify-center text-white shadow-glow`}>
                      <s.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">{s.n}</div>
                      <div className="font-display text-xl md:text-2xl text-warm-black leading-tight">{s.title}</div>
                      <p className="mt-2 text-muted-foreground text-sm md:text-base leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerChildren>

          <ScrollReveal className="mt-14 text-center">
            <CaptureBar size="lg" />
            <p className="mt-4 text-sm text-muted-foreground">
              7-day free trial after your first ad · no card to start
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Simple footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto px-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={lumiLogo} alt="LUMI" className="h-6 w-auto" />
            <span>© {new Date().getFullYear()} LUMI</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/auth" className="hover:text-foreground transition-colors">Sign in</a>
          </div>
        </div>
      </footer>

      {/* marquee keyframes */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default Sales;
