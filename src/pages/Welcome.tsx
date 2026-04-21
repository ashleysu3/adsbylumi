import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Building2, Link2, Rocket, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import lumiLogo from "@/assets/lumi-logo.png";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const SESSION_FLAG = "lumi_welcomed";

export default function Welcome() {
  useEffect(() => {
    document.title = "Welcome to LUMI — You're In ✨";

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/welcome`;

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      "Welcome to LUMI — your 7-day free trial has started. Let's set up your brand and launch your first campaign.";

    const alreadyFired = sessionStorage.getItem(SESSION_FLAG);
    if (!alreadyFired && typeof window.fbq === "function") {
      try {
        window.fbq("track", "CompleteRegistration");
      } catch (err) {
        console.error("fbq track failed:", err);
      }
    }
    sessionStorage.setItem(SESSION_FLAG, "true");
  }, []);

  const trialEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as any } },
  };

  const tiles = [
    {
      icon: Building2,
      title: "Tell us about your brand",
      desc: "A 2-minute setup so LUMI knows your voice, offers, and audience.",
    },
    {
      icon: Link2,
      title: "Connect your Meta account",
      desc: "Securely link your ad account so LUMI can launch and learn.",
    },
    {
      icon: Rocket,
      title: "Launch your first campaign",
      desc: "LUMI guides you through strategy, copy, and creative — together.",
    },
  ];

  // Confetti burst pieces
  const confettiPieces = Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.5 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
    color: [
      "hsl(var(--lumi-orange-1))",
      "hsl(var(--lumi-pink-1))",
      "hsl(var(--lumi-purple-1))",
      "hsl(var(--lumi-blue-1))",
    ][i % 4],
  }));

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Soft gradient bloom backdrop */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        aria-hidden
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
             style={{ background: "var(--gradient-warm)" }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-25 blur-3xl"
             style={{ background: "var(--gradient-cool)" }} />
      </div>

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {confettiPieces.map((p) => (
          <motion.div
            key={p.id}
            className="absolute top-0 rounded-sm"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              background: p.color,
            }}
            initial={{ y: -50, opacity: 0, rotate: 0 }}
            animate={{
              y: ["-5vh", "110vh"],
              opacity: [0, 1, 1, 0],
              rotate: p.rotate,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeIn",
            }}
          />
        ))}
      </div>

      {/* Floating sparkles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${(i * 12.7) % 100}%`,
              top: `${15 + ((i * 17.3) % 70)}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
          >
            <Sparkles
              className="text-primary/60"
              style={{ width: 12 + (i % 3) * 6, height: 12 + (i % 3) * 6 }}
            />
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 container mx-auto px-4 pt-8">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <img src={lumiLogo} alt="LUMI" className="h-9" />
        </Link>
      </header>

      <motion.div
        className="relative z-10 container mx-auto px-4 pt-12 sm:pt-16 pb-16 max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            You're officially in
          </div>
        </motion.div>

        {/* Big celebratory headline — matches Sales font-display + gradient */}
        <motion.h1
          variants={itemVariants}
          className="font-display text-5xl sm:text-6xl md:text-7xl leading-[1.05] text-center mb-6 tracking-tight"
        >
          You're in.{" "}
          <span className="block sm:inline">
            Welcome to{" "}
            <span className="bg-gradient-lumi bg-clip-text text-transparent">LUMI</span>.
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-center text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Your 7-day free trial just started — and the fun part begins now. Let's get your brand
          set up so LUMI can start building campaigns that actually feel like you.
        </motion.p>

        {/* Primary CTA — early so excitement converts */}
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-3 mb-16">
          <Button
            asChild
            size="lg"
            className="h-14 px-8 text-base bg-gradient-warm hover:opacity-95 text-white border-0 shadow-lumi rounded-full font-semibold"
          >
            <Link to="/onboarding">
              Let's set up your brand
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Link
            to="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now →
          </Link>
        </motion.div>

        {/* What happens next */}
        <motion.div variants={itemVariants} className="mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground text-center mb-8">
            What happens next
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {tiles.map((tile, i) => (
              <motion.div
                key={tile.title}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                className="relative bg-card border border-border rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all"
              >
                <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-gradient-warm text-white text-sm font-bold flex items-center justify-center shadow-lumi">
                  {i + 1}
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <tile.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg text-foreground mb-2 leading-snug">
                  {tile.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tile.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Trial reassurance card */}
        <motion.div
          variants={itemVariants}
          className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
              <Check className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg text-foreground mb-2">
                Your 7-day free trial is active
              </h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  Full access to every LUMI feature — strategy, creative, and performance
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  No charge until {trialEndDate}
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  Cancel anytime from settings — no awkward emails
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Closing nudge */}
        <motion.p
          variants={itemVariants}
          className="mt-12 text-center text-sm text-muted-foreground"
        >
          Ready when you are. Your first campaign is just a few clicks away. ✨
        </motion.p>
      </motion.div>
    </main>
  );
}
