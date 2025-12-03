import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Target, Palette, Rocket, BarChart3, Brain, MessageCircle, CheckCircle, X, Check, Sparkles, ArrowRight, Loader2, Building2, GraduationCap, Zap } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { ParallaxSection } from "@/components/animations/ParallaxSection";
import { StaggerChildren, StaggerItem } from "@/components/animations/StaggerChildren";
import { ScaleOnScroll } from "@/components/animations/ScaleOnScroll";
import { FloatingElement } from "@/components/animations/FloatingElement";
import { MagneticButton, GradientText } from "@/components/animations/SmoothScroll";
import { CursorGlow } from "@/components/animations/CursorTrail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";

interface StepData {
  emoji: string;
  title: string;
  description: string;
  items: string[];
  footer: string;
}

const VerticalStepCard = ({ step, index }: { step: StepData; index: number }) => {
  return (
    <ScrollReveal delay={index * 0.1}>
      <motion.div
        className="relative"
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <motion.div 
            className="flex-shrink-0"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl md:text-4xl">
              {step.emoji}
            </div>
          </motion.div>
          <div className="flex-1">
            <h3 className="font-display text-xl md:text-2xl mb-3">{step.title}</h3>
            <p className="text-base md:text-lg text-muted-foreground mb-4">{step.description}</p>
            <div className="bg-background/80 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                {step.items.map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm md:text-base text-foreground/80">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
                {step.footer}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </ScrollReveal>
  );
};

const Sales = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  const heroOpacity = useTransform(heroProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 0.5], [1, 0.95]);
  const heroY = useTransform(heroProgress, [0, 0.5], [0, 50]);

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
      popular: false,
      features: SUBSCRIPTION_TIERS.solo.features,
      cta: "Get Started",
    },
    {
      key: "creator" as const,
      name: "Creator",
      description: "For growing creators and service providers",
      monthlyPrice: 299,
      annualPrice: 2990,
      popular: true,
      features: SUBSCRIPTION_TIERS.creator.features,
      cta: "Get Started",
    },
    {
      key: "agency" as const,
      name: "Agency",
      description: "For agencies and white-label solutions",
      monthlyPrice: null,
      annualPrice: null,
      popular: false,
      features: SUBSCRIPTION_TIERS.agency.features,
      cta: "Contact Sales",
    },
  ];

  const steps = [
    {
      emoji: "💡",
      title: "STEP 1 — Choose What You Want to Run",
      description: "Skip the guessing, skip the questions you don't understand, skip the \"what objective do I use??\" panic.",
      items: ["Webinar Signups", "Lead Magnet Downloads", "Low-Ticket Product Sales", "Book a Discovery Call", "Traffic to Instagram/Facebook", "Video Views (Trust Builder)"],
      footer: "Your Ad Assistant loads the exact structure Meta prefers in 2025. No thinking required."
    },
    {
      emoji: "🎨",
      title: "STEP 2 — Get Your Full-Funnel Creative Plan",
      description: "Once you enter your offer details… Your Creative Department generates hooks, scripts, b-roll shot lists, pattern interrupts, and curiosity angles.",
      items: ["TOFU ads (Hooks, Scripts, B-roll)", "MOFU ads (Story scripts, Carousels)", "BOFU ads (Offer breakdowns, CTAs)", "Text overlays & variations", "Production checklists", "Psychology-aligned hooks"],
      footer: "Everything you need to record or design the right creative."
    },
    {
      emoji: "🗂",
      title: "STEP 3 — Save Your Campaign & Track Progress",
      description: "Each campaign gets its own workspace, where you can:",
      items: ["Save scripts", "Expand creative", "Regenerate what you don't love", "Store your brand voice", "Upload final videos + graphics", "Check off a production list"],
      footer: "It's like having a creative studio, strategist, and production manager — all inside one tidy space."
    },
    {
      emoji: "🚀",
      title: "STEP 4 — Hit \"Create Campaign\"",
      description: "Your Ad Assistant actually builds the entire campaign in Ads Manager using the Meta API.",
      items: ["Combines your creative with strategy", "Pulls all required fields", "Asks simple questions", "Recommends beginner-friendly settings", "Double-checks everything", "Pushes the campaign live"],
      footer: "You never have to go into Ads Manager. No toggles, no hidden settings."
    },
    {
      emoji: "📊",
      title: "STEP 5 — Get Weekly Guidance",
      description: "Each week, Your Ad Assistant sends you:",
      items: ["Clean performance reports", "CTR, CPC, CPL, CPP, ROAS", "Creative fatigue alerts", "Full-funnel diagnostics", "\"What's working + why\"", "New creative ideas"],
      footer: "This isn't a dashboard. It's a partner."
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Cursor Glow Effect */}
      <CursorGlow />
      
      {/* Header with Login */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.img 
            alt="Your Ad Assistant" 
            className="h-12" 
            src="/lovable-uploads/your-ad-assistant-logo.png"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          />
          <MagneticButton>
            <Button onClick={() => navigate("/auth")} variant="outline">
              Log In / Sign Up
            </Button>
          </MagneticButton>
        </div>
      </motion.header>

      {/* Hero Section with Animated Gradient Background */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated Gradient Mesh Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20" />
          
          <motion.div
            className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px]"
            animate={{
              x: [0, 100, 50, 0],
              y: [0, 50, 100, 0],
              scale: [1, 1.2, 0.9, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/30 blur-[100px]"
            animate={{
              x: [0, -80, -40, 0],
              y: [0, -60, -120, 0],
              scale: [1, 0.9, 1.1, 1],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-[40%] right-[20%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[80px]"
            animate={{
              x: [0, -60, 30, 0],
              y: [0, 80, -40, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[20%] left-[15%] w-[35%] h-[35%] rounded-full bg-coral/15 blur-[90px]"
            animate={{
              x: [0, 70, -30, 0],
              y: [0, -50, 60, 0],
              scale: [1, 0.95, 1.15, 1],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          
          <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />
        </div>
        
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <motion.div 
            className="text-center"
            style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-full mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.span 
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-sm font-medium text-primary">For Coaches, Course Creators + Service Providers</span>
            </motion.div>
            
            <motion.h1 
              className="font-display text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Finally: Meta ads that feel{" "}
              <GradientText>simple, strategic</GradientText>, and actually doable.
            </motion.h1>
            
            <motion.p 
              className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              You don't have to learn ads, to run ads.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-8"
            >
              <MagneticButton>
                <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 shadow-lg">
                  Get Started Free
                </Button>
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating decorative elements */}
        <FloatingElement className="absolute top-1/4 left-[5%] hidden lg:block" delay={0} distance={15}>
          <motion.div 
            className="w-3 h-3 rounded-full bg-primary/60"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </FloatingElement>
        <FloatingElement className="absolute top-1/3 right-[10%] hidden lg:block" delay={0.5} distance={20}>
          <motion.div 
            className="w-2 h-2 rounded-full bg-secondary"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </FloatingElement>
        <FloatingElement className="absolute bottom-1/3 left-[15%] hidden lg:block" delay={1} distance={12}>
          <motion.div 
            className="w-4 h-4 rounded-full bg-accent/50"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </FloatingElement>
        
        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div 
              className="w-1 h-2 rounded-full bg-muted-foreground/50"
              animate={{ y: [0, 8, 0], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-4 bg-muted/30 relative">
        <ParallaxSection className="absolute inset-0 opacity-5" offset={30}>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </ParallaxSection>
        
        <div className="container mx-auto max-w-3xl relative">
          <ScrollReveal>
            <p className="text-lg leading-relaxed text-foreground/90 mb-4 text-center">
              The buttons. The settings. The "random" performance swings. The 47 opinions on TikTok. The fear you'll
              mess something up and waste money.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            <p className="text-xl font-medium text-foreground mt-8 mb-4 text-center">
              Your Ad Assistant takes all that stress and says:{" "}
              <span className="text-primary">"Let me take it from here."</span>
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.3}>
            <p className="text-lg leading-relaxed text-foreground/90 text-center">
              This isn't another marketing course or a complicated dashboard. It's a smart, friendly, hands-on tool that
              walks you through planning, creating, launching, and improving Meta ads — step by step.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.4}>
            <p className="text-lg font-medium text-foreground mt-6 text-center">
              No overwhelm. No guesswork. No Ads Manager spirals.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Key Promise */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <ScaleOnScroll scaleRange={[0.9, 1]}>
            <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-12 rounded-3xl border border-border relative overflow-hidden">
              <ParallaxSection className="absolute inset-0 opacity-30" offset={20}>
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
              </ParallaxSection>
              <p className="text-2xl md:text-3xl font-display leading-relaxed relative z-10">
                If you can paste your url and upload your creative…
                <br />
                <motion.span 
                  className="text-primary text-4xl md:text-5xl inline-block mt-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  Your Ad Assistant does the rest.
                </motion.span>
              </p>
            </div>
          </ScaleOnScroll>
        </div>
      </section>

      {/* Vertical Steps Section */}
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center mb-12">Here's how:</h2>
          </ScrollReveal>
          
          <div className="space-y-8 md:space-y-12">
            {steps.map((step, index) => (
              <VerticalStepCard key={index} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Why It Works */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="font-display text-4xl text-center mb-12">🌟 Why It Works So Well</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-xl text-center text-muted-foreground mb-12">
              Your Ad Assistant is powered by thousands of hours of:
            </p>
          </ScrollReveal>
          <StaggerChildren staggerDelay={0.05} className="grid md:grid-cols-3 gap-4 text-center">
            {["Meta ad strategy", "Creative psychology", "Performance troubleshooting", "Offer mapping", "Funnel breakdown analysis", "Script writing", "Copy frameworks", "Meta best practices", "Seasonality predictions", "Hook libraries", "Niche messaging", "Audience builder logic", "B-roll direction", "High-performing creative systems", "API-backed campaign builds"].map(item => (
              <StaggerItem key={item}>
                <motion.div 
                  className="p-4 bg-muted/30 rounded-lg border border-border"
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <p className="text-sm">{item}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerChildren>
          <ScrollReveal delay={0.3}>
            <p className="text-xl text-center mt-12 font-medium">
              …and all of that lives inside an app that feels simple, warm, and helpful.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Think of it like this */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="font-display text-4xl text-center mb-12">🧠 Think of it like this…</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-xl text-center mb-12">Your Ad Assistant is:</p>
          </ScrollReveal>

          <StaggerChildren staggerDelay={0.1} className="grid md:grid-cols-2 gap-6">
            {[
              { icon: MessageCircle, emoji: "💬", title: "Your strategist", desc: "Telling you exactly which campaign to run." },
              { icon: Palette, emoji: "🎨", title: "Your creative director", desc: "Giving you hooks, scripts, b-roll, and graphics." },
              { icon: Target, emoji: "🎥", title: "Your producer", desc: "Showing you how to film and what to record." },
              { icon: Rocket, emoji: "🛠", title: "Your campaign builder", desc: "Creating everything directly in Ads Manager." },
              { icon: BarChart3, emoji: "📊", title: "Your analyst", desc: "Reviewing your data and telling you what to fix." },
              { icon: Brain, emoji: "✨", title: "Your supportive business bestie", desc: "Encouraging you and keeping things simple." },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <motion.div 
                  className="p-6 bg-background rounded-xl border border-border"
                  whileHover={{ scale: 1.02, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="flex items-start gap-4">
                    <item.icon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-lg mb-2">{item.emoji} {item.title}</p>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerChildren>

          <ScrollReveal delay={0.4}>
            <p className="text-xl text-center mt-12 font-medium">All in one clean, friendly tool.</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-display text-3xl mb-6">🎯 Who It's For</h2>
                <p className="text-lg mb-6">
                  Coaches, course creators, service providers, creators, and small business owners who:
                </p>
                <StaggerChildren staggerDelay={0.08} className="space-y-3">
                  {["Want better ads", "Are tired of guessing", "Want to save time", "Want someone (or something) to tell them what to do", "Want clarity, not chaos", "Want ads that feel doable, not overwhelming", "Want a tool that meets them where they are"].map((item) => (
                    <StaggerItem key={item}>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                        <span>{item}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerChildren>
                <p className="text-lg mt-6 font-medium">
                  If you're ready to run ads with confidence — without becoming a media buyer — this is for you.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div>
                <h2 className="font-display text-3xl mb-6">❌ Who It's Not For</h2>
                <StaggerChildren staggerDelay={0.08} className="space-y-3">
                  {["People looking for hacks", "People who won't record any creative at all", "People who want to manually tweak every toggle", "People who expect results without testing", "Agencies who only run 30-adset Frankenstein structures"].map((item) => (
                    <StaggerItem key={item}>
                      <div className="flex items-start gap-3">
                        <X className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                        <span>{item}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerChildren>
                <p className="text-lg mt-6 font-medium">
                  This is for people who want smart, simple, strategic ads — done the right way.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <ScrollReveal>
              <h2 className="font-display text-4xl md:text-5xl mb-4">
                Simple, transparent pricing
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that fits your business. Upgrade or downgrade anytime.
              </p>
            </ScrollReveal>

            {/* Billing Toggle */}
            <ScrollReveal delay={0.2}>
              <div className="flex items-center justify-center gap-4 mt-8">
                <Label htmlFor="billing-toggle-sales" className={!isAnnual ? "font-medium" : "text-muted-foreground"}>
                  Monthly
                </Label>
                <Switch
                  id="billing-toggle-sales"
                  checked={isAnnual}
                  onCheckedChange={setIsAnnual}
                />
                <Label htmlFor="billing-toggle-sales" className={isAnnual ? "font-medium" : "text-muted-foreground"}>
                  Annual
                </Label>
                {isAnnual && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Save 2 months
                  </Badge>
                )}
              </div>
            </ScrollReveal>
          </div>

          {/* Cost Comparison Section */}
          <ScrollReveal delay={0.15}>
            <div className="mb-16">
              <h3 className="font-display text-2xl md:text-3xl text-center mb-8">
                The smart alternative to expensive agencies & time-consuming courses
              </h3>
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

                {/* Your Ad Assistant Card */}
                <Card className="border-primary bg-primary/5 shadow-md">
                  <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Your Ad Assistant</CardTitle>
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
          </ScrollReveal>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier, index) => (
              <ScrollReveal key={tier.key} delay={0.1 * index}>
                <Card
                  className={`relative flex flex-col h-full ${
                    tier.popular
                      ? "border-primary shadow-lg scale-105"
                      : "border-border"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-4 py-1">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Most Popular
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
                      disabled={loadingTier === tier.key}
                      onClick={() => {
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
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>

          {/* FAQ or Additional Info */}
          <ScrollReveal delay={0.3}>
            <div className="mt-16 text-center">
              <p className="text-muted-foreground">
                All plans include a 14-day free trial. Credit card required, but you won't be charged until your trial ends.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 relative overflow-hidden">
        <ParallaxSection className="absolute inset-0" offset={40}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        </ParallaxSection>
        
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <ScaleOnScroll scaleRange={[0.9, 1]}>
            <motion.h2 
              className="font-display text-5xl mb-8 md:text-6xl"
              whileInView={{ opacity: [0, 1], y: [30, 0] }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              🚀 Ready to run ads with clarity?
            </motion.h2>
          </ScaleOnScroll>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Your Ad Assistant is coming. And it's about to make your business feel lighter, simpler, and more strategic.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.4}>
            <MagneticButton className="inline-block">
              <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 py-6">
                Join the Waitlist
              </Button>
            </MagneticButton>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <motion.footer 
        className="py-12 px-4 border-t border-border"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2025 Your Ad Assistant. All rights reserved.</p>
        </div>
      </motion.footer>
    </div>
  );
};

export default Sales;
