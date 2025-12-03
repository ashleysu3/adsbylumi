import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Target, Palette, FolderKanban, Rocket, BarChart3, Brain, MessageCircle, CheckCircle, X } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { ParallaxSection } from "@/components/animations/ParallaxSection";
import { StaggerChildren, StaggerItem } from "@/components/animations/StaggerChildren";
import { ScaleOnScroll } from "@/components/animations/ScaleOnScroll";
import { FloatingElement } from "@/components/animations/FloatingElement";
import { MagneticButton, GradientText } from "@/components/animations/SmoothScroll";
import { CursorGlow } from "@/components/animations/CursorTrail";
import { useRef } from "react";

const Sales = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  const { scrollYProgress: stepsProgress } = useScroll({
    target: stepsRef,
    offset: ["start start", "end end"],
  });
  
  const heroOpacity = useTransform(heroProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 0.5], [1, 0.95]);
  const heroY = useTransform(heroProgress, [0, 0.5], [0, 50]);
  
  const stepsX = useTransform(stepsProgress, [0, 1], ["0%", "-400%"]);
  const progressWidth = useTransform(stepsProgress, [0, 1], ["0%", "100%"]);

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

      {/* Horizontal Scroll Steps Section */}
      <section 
        ref={stepsRef} 
        className="relative bg-muted/30"
        style={{ height: "500vh" }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-border z-20">
            <motion.div 
              className="h-full bg-primary"
              style={{ width: progressWidth }}
            />
          </div>

          {/* Header */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 text-center">
            <h2 className="font-display text-3xl md:text-4xl mb-4">Here's how:</h2>
            <div className="flex gap-2 justify-center">
              {steps.map((_, index) => {
                const stepStart = index / steps.length;
                const stepMid = (index + 0.5) / steps.length;
                return (
                  <motion.div
                    key={index}
                    className="w-3 h-3 rounded-full bg-border"
                    style={{
                      backgroundColor: useTransform(
                        stepsProgress,
                        [stepStart, stepMid],
                        ["hsl(var(--border))", "hsl(var(--primary))"]
                      ),
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Horizontal scrolling container */}
          <motion.div 
            className="flex h-full pt-32 pb-16"
            style={{ x: stepsX }}
          >
            {steps.map((step, index) => {
              const stepStart = index / steps.length;
              const stepEnd = (index + 1) / steps.length;
              
              return (
                <motion.div
                  key={index}
                  className="min-w-full h-full flex items-center justify-center px-4 md:px-8"
                >
                  <motion.div 
                    className="max-w-4xl w-full"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    viewport={{ once: false, amount: 0.5 }}
                  >
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <motion.div 
                        className="flex-shrink-0"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl">
                          {step.emoji}
                        </div>
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="font-display text-2xl md:text-3xl mb-4">{step.title}</h3>
                        <p className="text-lg text-muted-foreground mb-6">{step.description}</p>
                        <div className="bg-background/80 backdrop-blur-sm rounded-xl p-6 border border-border">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {step.items.map((item, i) => (
                              <motion.div 
                                key={i}
                                className="flex items-center gap-2"
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                viewport={{ once: false }}
                              >
                                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>{item}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        <p className="text-lg mt-6 font-medium">{step.footer}</p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Scroll hint */}
          <motion.div 
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-muted-foreground flex items-center gap-2"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span>Scroll to explore steps</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </motion.div>
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

      {/* Pricing */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <ScrollReveal>
            <h2 className="font-display text-4xl mb-6">💵 Simple, Transparent Pricing</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-xl text-muted-foreground mb-8">
              Choose the plan that fits your business. Save 2 months with annual billing.
            </p>
          </ScrollReveal>
          <StaggerChildren staggerDelay={0.15} className="grid md:grid-cols-3 gap-6 mb-8">
            <StaggerItem>
              <motion.div 
                className="p-6 bg-background rounded-xl border border-border h-full"
                whileHover={{ scale: 1.03, y: -10 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <h3 className="font-display text-2xl mb-2">Solo</h3>
                <p className="text-3xl font-bold mb-2">$147<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
                <p className="text-sm text-muted-foreground">1 brand, 1 ad account</p>
              </motion.div>
            </StaggerItem>
            <StaggerItem>
              <motion.div 
                className="p-6 bg-background rounded-xl border-2 border-primary relative h-full"
                whileHover={{ scale: 1.05, y: -10 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.div 
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Most Popular
                </motion.div>
                <h3 className="font-display text-2xl mb-2">Creator</h3>
                <p className="text-3xl font-bold mb-2">$299<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
                <p className="text-sm text-muted-foreground">Up to 3 brands & ad accounts</p>
              </motion.div>
            </StaggerItem>
            <StaggerItem>
              <motion.div 
                className="p-6 bg-background rounded-xl border border-border h-full"
                whileHover={{ scale: 1.03, y: -10 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <h3 className="font-display text-2xl mb-2">Agency</h3>
                <p className="text-3xl font-bold mb-2">Custom</p>
                <p className="text-sm text-muted-foreground">Unlimited + white-label</p>
              </motion.div>
            </StaggerItem>
          </StaggerChildren>
          <ScrollReveal delay={0.3}>
            <MagneticButton className="inline-block">
              <Button size="lg" onClick={() => navigate("/pricing")} variant="outline">
                View Full Pricing Details
              </Button>
            </MagneticButton>
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
