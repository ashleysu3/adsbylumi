import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Building2, Link2, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SparkleIcon } from "@/components/SparkleIcon";
import lumiLogo from "@/assets/lumi-logo.png";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const SESSION_FLAG = "lumi_welcomed";

export default function Welcome() {
  // SEO + tracking
  useEffect(() => {
    document.title = "Welcome to Lumi";

    // Canonical link
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/welcome`;

    // Meta description
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = "Welcome to Lumi — your 7-day free trial has started. Let's set up your brand and launch your first campaign.";

    // Fire Meta Pixel CompleteRegistration once per session
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
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  const tiles = [
    {
      icon: Building2,
      title: "Tell us about your brand",
      desc: "A 2-minute setup so Lumi knows your voice, offers, and audience.",
    },
    {
      icon: Link2,
      title: "Connect your Meta account",
      desc: "Securely link your ad account so Lumi can launch and learn.",
    },
    {
      icon: Rocket,
      title: "Launch your first campaign",
      desc: "Lumi guides you through strategy, copy, and creative — together.",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-lumi-purple-1/10 px-4 py-12 sm:py-20 relative overflow-hidden">
      {/* Decorative sparkles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              y: [0, -40],
            }}
            transition={{
              duration: 3,
              delay: i * 0.2,
              repeat: Infinity,
              repeatDelay: 4,
            }}
            style={{
              left: `${(i * 8.3) % 100}%`,
              top: `${(i * 13.7) % 80 + 10}%`,
            }}
          >
            <Sparkles className="h-4 w-4 text-primary/40" />
          </motion.div>
        ))}
      </div>

      <motion.div
        className="relative max-w-3xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo */}
        <motion.div variants={itemVariants} className="flex justify-center mb-8">
          <img src={lumiLogo} alt="Lumi" className="h-12" />
        </motion.div>

        {/* Headline card */}
        <motion.div
          variants={itemVariants}
          className="text-center bg-card/60 backdrop-blur-sm border border-border rounded-3xl p-8 sm:p-12 shadow-elevated"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-lumi-purple-1/20 mb-6"
          >
            <SparkleIcon size="lg" state="idle" />
          </motion.div>

          <h1 className="text-4xl sm:text-5xl font-serif font-medium tracking-tight text-foreground mb-4">
            You're in. Welcome to Lumi.
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Your 7-day free trial just started. Let's get your brand set up so Lumi can start
            building campaigns that actually feel like you.
          </p>
        </motion.div>

        {/* Next steps tiles */}
        <motion.div variants={itemVariants} className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-center mb-6">
            What happens next
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {tiles.map((tile, i) => (
              <motion.div
                key={tile.title}
                variants={itemVariants}
                className="bg-card border border-border rounded-2xl p-5 hover:shadow-elevated transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {i + 1}
                  </div>
                  <tile.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{tile.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tile.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div variants={itemVariants} className="mt-10 text-center space-y-4">
          <Button asChild variant="lumi" size="lg" className="h-12 px-8 text-base">
            <Link to="/onboarding">
              Let's set up your brand
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <div>
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </Link>
          </div>
        </motion.div>

        {/* Footer reassurance */}
        <motion.p
          variants={itemVariants}
          className="mt-12 text-center text-xs text-muted-foreground"
        >
          Your trial started today. You won't be charged until {trialEndDate}.
        </motion.p>
      </motion.div>
    </main>
  );
}
