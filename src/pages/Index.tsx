import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowRight, Target, BarChart3, Palette, CheckCircle2, Check, X, Building2, GraduationCap, Zap, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, useScroll, useTransform } from "framer-motion";
import { SUBSCRIPTION_TIERS } from "@/lib/subscription-tiers";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { StaggerChildren, StaggerItem } from "@/components/animations/StaggerChildren";
import { ScaleOnScroll } from "@/components/animations/ScaleOnScroll";
import { FloatingElement } from "@/components/animations/FloatingElement";
import { MagneticButton, GradientText } from "@/components/animations/SmoothScroll";
import { ParallaxSection } from "@/components/animations/ParallaxSection";
import { CursorGlow } from "@/components/animations/CursorTrail";

// Pricing Cards Component
const PricingCards = ({ navigate }: { navigate: (path: string) => void }) => {
  const [isAnnual, setIsAnnual] = useState(false);

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

  return (
    <ScrollReveal delay={0.2}>
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <Label htmlFor="billing-toggle-main" className={!isAnnual ? "font-medium" : "text-muted-foreground"}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle-main"
          checked={isAnnual}
          onCheckedChange={setIsAnnual}
        />
        <Label htmlFor="billing-toggle-main" className={isAnnual ? "font-medium" : "text-muted-foreground"}>
          Annual
        </Label>
        {isAnnual && (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Save 2 months
          </Badge>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <Card
            key={tier.key}
            className={`relative flex flex-col ${
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
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
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
                onClick={() => {
                  if (tier.key === "agency") {
                    window.location.href = "mailto:hello@afterorganic.com?subject=Agency Plan Inquiry";
                  } else {
                    navigate("/auth");
                  }
                }}
              >
                {tier.cta}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollReveal>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const features = [
    {
      icon: Target,
      title: "Ad Planner",
      description:
        "Answer a few questions and get a clear, step-by-step strategy for your goal — no guesswork.",
    },
    {
      icon: Palette,
      title: "Creative Department",
      description:
        "Get talking-head scripts, b-roll direction, text overlays, and ad copy ideas based on what's working now.",
    },
    {
      icon: BarChart3,
      title: "Performance Fixer",
      description:
        "Understand your KPIs in plain language and get simple next steps to improve results.",
    },
  ];

  const benefits = [
    "Stop second-guessing your campaign setup",
    "Know exactly what's working and what needs attention",
    "Get creative ideas without scrolling for hours",
    "Stay on track with automated weekly reports",
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Cursor Glow Effect */}
      <CursorGlow />
      
      {/* Hero Section with Animated Gradient Background */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated Gradient Mesh Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20" />
          
          {/* Animated gradient orbs */}
          <motion.div
            className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px]"
            animate={{
              x: [0, 100, 50, 0],
              y: [0, 50, 100, 0],
              scale: [1, 1.2, 0.9, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/30 blur-[100px]"
            animate={{
              x: [0, -80, -40, 0],
              y: [0, -60, -120, 0],
              scale: [1, 0.9, 1.1, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute top-[40%] right-[20%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[80px]"
            animate={{
              x: [0, -60, 30, 0],
              y: [0, 80, -40, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-[20%] left-[15%] w-[35%] h-[35%] rounded-full bg-coral/15 blur-[90px]"
            animate={{
              x: [0, 70, -30, 0],
              y: [0, -50, 60, 0],
              scale: [1, 0.95, 1.15, 1],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Noise texture overlay for depth */}
          <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />
        </div>
        
        {/* Content */}
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <motion.div 
            className="w-full text-center"
            style={{ opacity: heroOpacity, scale: heroScale }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-full mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <motion.span 
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-sm font-medium">Lumi</span>
            </motion.div>

            <motion.h1 
              className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Tell us what you want to run.
              <br />
              <span className="text-muted-foreground">We'll tell you <GradientText>exactly how</GradientText>.</span>
            </motion.h1>

            <motion.p 
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Your step-by-step guide to setting up, monitoring, and improving Meta ads — 
              with clear KPIs and creative ideas that work.
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <MagneticButton>
                <Button
                  variant="playful"
                  size="lg"
                  className="text-base shadow-lg"
                  onClick={() => navigate("/auth")}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </MagneticButton>

              <MagneticButton>
                <Button variant="outline" size="lg" className="text-base bg-background/50 backdrop-blur-sm">
                  Watch Demo
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
        <FloatingElement className="absolute bottom-1/4 right-[8%] hidden lg:block" delay={1.5} distance={18}>
          <motion.div 
            className="w-2.5 h-2.5 rounded-full bg-coral/60"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3.5, repeat: Infinity }}
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

      {/* Features Section */}
      <section className="bg-secondary py-16 md:py-24 relative">
        <ParallaxSection className="absolute inset-0 opacity-10" offset={20}>
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-primary rounded-full blur-3xl" />
        </ParallaxSection>
        
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything you need to run Meta ads confidently.
              </h2>
              <p className="text-lg text-muted-foreground">
                No marketing degree required. Just clear guidance, smart suggestions, and simple tools.
              </p>
            </div>
          </ScrollReveal>

          <StaggerChildren staggerDelay={0.15} className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <StaggerItem key={feature.title}>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="border-none shadow-sm h-full">
                      <CardContent className="pt-6">
                        <div className="mb-4 flex justify-center">
                          <motion.div 
                            className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center"
                            whileHover={{ rotate: 5, scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <Icon className="h-6 w-6 text-primary" />
                          </motion.div>
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-center">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-center">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerChildren>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <ScrollReveal direction="left">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Stop wasting time figuring out what to do next
              </h2>

              <p className="text-lg text-muted-foreground mb-8">
                Lumi turns confusing Meta ads tasks into simple steps — from setup to creative to weekly performance.
              </p>

              <StaggerChildren staggerDelay={0.1} className="space-y-4">
                {benefits.map((benefit, index) => (
                  <StaggerItem key={index}>
                    <motion.div 
                      className="flex items-start gap-3"
                      whileHover={{ x: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-lg">{benefit}</span>
                    </motion.div>
                  </StaggerItem>
                ))}
              </StaggerChildren>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right">
            <ScaleOnScroll scaleRange={[0.95, 1]}>
              <Card className="p-8 shadow-lg">
                <CardContent className="space-y-6">
                  <motion.div 
                    className="bg-secondary rounded-lg p-6"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <p className="text-sm text-muted-foreground mb-2">Campaign Type</p>
                    <p className="text-xl font-semibold">Lead Generation</p>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.div 
                      className="bg-secondary rounded-lg p-4"
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <p className="text-xs text-muted-foreground mb-1">Cost per Lead</p>
                      <p className="text-2xl font-bold text-primary">$4.20</p>
                    </motion.div>
                    <motion.div 
                      className="bg-secondary rounded-lg p-4"
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <p className="text-xs text-muted-foreground mb-1">CTR</p>
                      <p className="text-2xl font-bold">2.4%</p>
                    </motion.div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      ✨ <strong>What's Working:</strong> Your ad is performing above benchmark. Keep it running and test new variations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </ScaleOnScroll>
          </ScrollReveal>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 md:py-24 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that fits your business. Upgrade or downgrade anytime.
              </p>
            </div>
          </ScrollReveal>

          {/* Cost Comparison */}
          <ScrollReveal delay={0.1}>
            <div className="mb-16">
              <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">
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

                {/* Lumi Card */}
                <Card className="border-primary bg-primary/5 shadow-md">
                  <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Lumi</CardTitle>
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
          <PricingCards navigate={navigate} />

          {/* Trial Info */}
          <ScrollReveal delay={0.3}>
            <div className="mt-12 text-center">
              <p className="text-muted-foreground">
                All plans include a 14-day free trial. Credit card required, but you won't be charged until your trial ends.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16 md:py-24 relative overflow-hidden">
        <ParallaxSection className="absolute inset-0" offset={30}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl" />
        </ParallaxSection>
        
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to run ads with confidence?
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p className="text-xl mb-8 opacity-90">
              Set up your first campaign in minutes. No credit card required.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <MagneticButton className="inline-block">
              <Button
                variant="secondary"
                size="lg"
                className="text-base shadow-xl hover:shadow-2xl transition-all"
                onClick={() => navigate("/auth")}
              >
                Start Your First Campaign
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </MagneticButton>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
};

export default Index;
