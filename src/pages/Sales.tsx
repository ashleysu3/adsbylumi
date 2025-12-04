import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { CheckCircle, X, Check, Sparkles, ArrowRight, Lightbulb, Heart, Zap, Eye, BarChart3, Calendar, Users, FileText, Upload, Settings, Send } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { ParallaxSection } from "@/components/animations/ParallaxSection";
import { StaggerChildren, StaggerItem } from "@/components/animations/StaggerChildren";
import { ScaleOnScroll } from "@/components/animations/ScaleOnScroll";
import { FloatingElement } from "@/components/animations/FloatingElement";
import { MagneticButton, GradientText } from "@/components/animations/SmoothScroll";
import { CursorGlow } from "@/components/animations/CursorTrail";
import lumiLogo from "@/assets/lumi-logo.png";
import lumiBulb from "@/assets/lumi-bulb.png";

interface StepData {
  number: string;
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
}

const StepCard = ({ step, index }: { step: StepData; index: number }) => {
  return (
    <ScrollReveal delay={index * 0.1}>
      <motion.div
        className="relative"
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="bg-card rounded-3xl p-8 md:p-10 border border-border shadow-card hover:shadow-lumi transition-shadow duration-300">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                {step.icon}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">
                  {step.number}
                </Badge>
              </div>
              <h3 className="font-display text-xl md:text-2xl mb-3 text-foreground">{step.title}</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">{step.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {step.details.map((detail, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground/80">{detail}</span>
                  </div>
                ))}
              </div>
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
  
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  const heroOpacity = useTransform(heroProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 0.5], [1, 0.95]);
  const heroY = useTransform(heroProgress, [0, 0.5], [0, 50]);

  const steps: StepData[] = [
    {
      number: "STEP 1",
      title: "Choose your campaign type",
      description: "Skip the tech stress. Just tell Lumi what you want to run. Lumi already knows the correct objective, optimization, placements, and structure.",
      details: [
        "Lead magnet",
        "Webinar",
        "Low-ticket product",
        "Discovery call",
        "IG traffic",
        "Video views (trust builder)"
      ],
      icon: <Lightbulb className="w-7 h-7" />
    },
    {
      number: "STEP 2",
      title: "Lumi creates your full Customer Journey creative",
      description: "Lumi generates a complete Grow → Nurture → Convert creative system for you. Plus scripts, b-roll lists, overlays, copy variations, and psychology-backed messaging.",
      details: [
        "Grow — Hooks, intros, b-roll openings",
        "Nurture — Stories, teaching carousels",
        "Convert — Offer breakdowns, CTAs",
        "Scripts & production checklists"
      ],
      icon: <Heart className="w-7 h-7" />
    },
    {
      number: "STEP 3",
      title: "Build your Lumi Workspace",
      description: "Organized. Cozy. Clear. A space to save creative, track production, upload assets, and review your Grow/Nurture/Convert mix.",
      details: [
        "Save creative",
        "Track your production",
        "Upload assets",
        "Review your Customer Journey mix",
        "Save multiple versions",
        "Expand or regenerate ideas"
      ],
      icon: <FileText className="w-7 h-7" />
    },
    {
      number: "STEP 4",
      title: "Upload your creative & let Lumi build the campaign",
      description: "Lumi asks a few easy questions — budget, dates, naming, enhancements, retargeting. Then Lumi builds your full campaign inside Ads Manager — for you.",
      details: [
        "Campaign → ad set → ads → creative",
        "Copy → CTA all configured",
        "Correct best practices applied",
        "You don't open Ads Manager"
      ],
      icon: <Upload className="w-7 h-7" />
    },
    {
      number: "STEP 5",
      title: "Weekly Insights",
      description: "Lumi checks your ads weekly with KPI breakdowns, creative fatigue alerts, Customer Journey performance, and psychology insights. Written like Lumi is sitting next to you over coffee.",
      details: [
        "KPI breakdown",
        "Creative fatigue alerts",
        "Journey stage performance",
        "New creative recommendations",
        "Your next 3 steps",
        "Psychology insights"
      ],
      icon: <BarChart3 className="w-7 h-7" />
    }
  ];

  const whyLumiWorks = [
    "Lumi builds your ads for you.",
    "Lumi understands buyer psychology.",
    "Lumi uses Customer Journey creative.",
    "Lumi leverages Meta's automated sequencing.",
    "Lumi keeps things simple.",
    "Lumi stays up-to-date.",
    "Lumi is built for real humans."
  ];

  const whoItsFor = [
    "Coaches",
    "Course creators",
    "Service providers",
    "Digital product creators",
    "Small business owners"
  ];

  const whoItsNotFor = [
    "People looking for hacks",
    "People who won't record anything",
    "People who want to micromanage settings"
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <CursorGlow />
      
      {/* Header */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.img
            alt="Lumi"
            className="h-10 md:h-12"
            src={lumiLogo}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          />
          <MagneticButton>
            <Button onClick={() => navigate("/auth")} variant="outline" className="rounded-full">
              Log In / Sign Up
            </Button>
          </MagneticButton>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-20">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/30" />
          
          <motion.div
            className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/15 blur-[120px]"
            animate={{
              x: [0, 100, 50, 0],
              y: [0, 50, 100, 0],
              scale: [1, 1.2, 0.9, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[100px]"
            animate={{
              x: [0, -80, -40, 0],
              y: [0, -60, -120, 0],
              scale: [1, 0.9, 1.1, 1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <motion.div
            className="text-center"
            style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          >
            {/* Logo/Brand Mark */}
            <motion.div
              className="inline-flex items-center justify-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <img src={lumiBulb} alt="Lumi" className="w-16 h-16 object-contain" />
            </motion.div>
            
            <motion.h1
              className="font-display text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Meta Ads, <GradientText>Simplified.</GradientText>
            </motion.h1>
            
            <motion.p
              className="text-xl md:text-2xl text-foreground/90 max-w-2xl mx-auto leading-relaxed mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Lumi builds your Meta ads for you — the right way.
            </motion.p>
            
            <motion.p
              className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Strategy, creative, setup, psychology, and publishing…
              <br />
              All handled automatically using up-to-date Meta best practices.
              <br />
              <span className="font-medium text-foreground/80">No Ads Manager required.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <MagneticButton>
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="text-lg px-8 py-6 rounded-full shadow-lumi lumi-button-glow"
                >
                  Join the Lumi Waitlist
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <FloatingElement className="absolute top-1/4 left-[5%] hidden lg:block" delay={0} distance={15}>
          <motion.div
            className="w-3 h-3 rounded-full bg-primary/60"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </FloatingElement>
        <FloatingElement className="absolute top-1/3 right-[10%] hidden lg:block" delay={0.5} distance={20}>
          <motion.div
            className="w-2 h-2 rounded-full bg-accent"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </FloatingElement>
        
        {/* Scroll Indicator */}
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

      {/* Pain Relief Section */}
      <section className="py-24 px-4 bg-muted/30 relative">
        <ParallaxSection className="absolute inset-0 opacity-5" offset={30}>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </ParallaxSection>
        
        <div className="container mx-auto max-w-3xl relative">
          <ScrollReveal>
            <p className="text-xl md:text-2xl leading-relaxed text-foreground/90 text-center font-medium">
              If advertising has ever made you feel{" "}
              <span className="text-primary">stressed</span>,{" "}
              <span className="text-primary">confused</span>,{" "}
              <span className="text-primary">intimidated</span>, or one wrong click away from chaos…
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            <p className="text-2xl md:text-3xl font-display text-center mt-8 mb-4">
              Lumi is here to <GradientText>turn on the light.</GradientText>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* "Your offer goes in" Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center mb-8">
              Your offer goes in. Lumi builds everything else.
            </h2>
          </ScrollReveal>
          
          <ScrollReveal delay={0.1}>
            <div className="bg-card rounded-3xl p-8 md:p-12 border border-border shadow-card">
              <p className="text-lg text-center mb-8 text-muted-foreground">
                You choose your offer. Lumi:
              </p>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {[
                  "picks the right campaign type",
                  "builds the strategy",
                  "gives you all your creative",
                  "helps you produce it",
                  "walks you through uploading it",
                  "configures all the settings",
                  "builds the entire campaign inside Ads Manager"
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-center mt-8 text-lg font-medium text-foreground">
                You don't need to know ads.{" "}
                <span className="text-primary">Lumi takes over</span> — clearly, calmly, and correctly.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* "Built for people" Section */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl mb-8">
              Built for people who do not want Ads Manager in their life.
            </h2>
          </ScrollReveal>
          
          <ScrollReveal delay={0.1}>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Ads Manager changes weekly. Buttons move. Settings rename themselves. 
              Placements shift. Optimizations come and go.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            <p className="text-xl font-medium text-primary">
              Lumi fixes that.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.3}>
            <p className="text-lg text-foreground/90 mt-6">
              Lumi doesn't just give advice — <strong>Lumi does the building.</strong>
            </p>
            <p className="text-muted-foreground mt-2">
              Everything is set up correctly, based on today's best practices, buyer psychology, and Meta's automated sequencing.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* How Lumi Works - 5 Steps */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <div className="text-center mb-16">
              <Badge variant="secondary" className="bg-primary/10 text-primary mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                How Lumi Works
              </Badge>
              <h2 className="font-display text-4xl md:text-5xl">
                Five simple steps to ads that work.
              </h2>
            </div>
          </ScrollReveal>
          
          <div className="space-y-6">
            {steps.map((step, index) => (
              <StepCard key={index} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Customer Journey Explanation */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center mb-12">
              The Customer Journey: <GradientText>Grow → Nurture → Convert</GradientText>
            </h2>
          </ScrollReveal>
          
          <div className="grid md:grid-cols-3 gap-6">
            <ScrollReveal delay={0.1}>
              <Card className="bg-card border-border h-full">
                <CardHeader className="text-center pb-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <Eye className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle className="text-xl text-emerald-600">Grow</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">Reach new people</p>
                  <p className="text-sm">
                    Hooks, intros, b-roll openings, early curiosity content to attract new eyes.
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
            
            <ScrollReveal delay={0.2}>
              <Card className="bg-card border-border h-full">
                <CardHeader className="text-center pb-2">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                    <Heart className="w-7 h-7 text-amber-600" />
                  </div>
                  <CardTitle className="text-xl text-amber-600">Nurture</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">Build trust</p>
                  <p className="text-sm">
                    Stories, teaching carousels, frameworks, value-forward videos to deepen understanding.
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
            
            <ScrollReveal delay={0.3}>
              <Card className="bg-card border-border h-full">
                <CardHeader className="text-center pb-2">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl text-primary">Convert</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">Inspire action</p>
                  <p className="text-sm">
                    Offer breakdowns, benefits carousels, CTA-focused ads to guide ready buyers.
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Why Lumi Works */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center mb-12">
              Why Lumi Works
            </h2>
          </ScrollReveal>
          
          <StaggerChildren staggerDelay={0.08} className="space-y-4">
            {whyLumiWorks.map((item, i) => (
              <StaggerItem key={i}>
                <motion.div
                  className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border"
                  whileHover={{ x: 5, backgroundColor: "hsl(var(--primary) / 0.05)" }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-lg">{item}</span>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12">
            <ScrollReveal direction="left">
              <div>
                <h2 className="font-display text-3xl mb-6 flex items-center gap-3">
                  <Check className="w-8 h-8 text-primary" />
                  Who Lumi Is For
                </h2>
                <StaggerChildren staggerDelay={0.08} className="space-y-3">
                  {whoItsFor.map((item, i) => (
                    <StaggerItem key={i}>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-lg">{item}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerChildren>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div>
                <h2 className="font-display text-3xl mb-6 flex items-center gap-3">
                  <X className="w-8 h-8 text-destructive" />
                  Who Lumi Is NOT For
                </h2>
                <StaggerChildren staggerDelay={0.08} className="space-y-3">
                  {whoItsNotFor.map((item, i) => (
                    <StaggerItem key={i}>
                      <div className="flex items-start gap-3">
                        <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <span className="text-lg">{item}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerChildren>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Beta Announcement */}
      <section className="py-32 px-4 relative overflow-hidden">
        <ParallaxSection className="absolute inset-0" offset={40}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        </ParallaxSection>
        
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <ScaleOnScroll scaleRange={[0.9, 1]}>
            <motion.div
              className="bg-card rounded-3xl p-10 md:p-16 border border-border shadow-elevated"
              whileInView={{ opacity: [0, 1], y: [30, 0] }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge variant="secondary" className="bg-primary/10 text-primary mb-6">
                <Sparkles className="w-3 h-3 mr-1" />
                Coming January 2026
              </Badge>
              
              <h2 className="font-display text-4xl md:text-5xl mb-6">
                Lumi Opens in January
              </h2>
              
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Waitlist members get first access as Lumi rolls out.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <MagneticButton>
                  <Button
                    size="lg"
                    onClick={() => navigate("/auth")}
                    className="text-lg px-8 py-6 rounded-full shadow-lumi lumi-button-glow"
                  >
                    Join the Lumi Waitlist
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </MagneticButton>
              </div>
            </motion.div>
          </ScaleOnScroll>
        </div>
      </section>

      {/* Final Light Message */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Lightbulb className="w-6 h-6 text-primary" />
              <span className="text-lg font-medium text-primary">Ready to light things up?</span>
            </div>
            <p className="text-muted-foreground">
              Grow → Nurture → Convert: Lumi has everything covered.
            </p>
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
          <p>© 2025 Lumi. All rights reserved.</p>
        </div>
      </motion.footer>
    </div>
  );
};

export default Sales;
