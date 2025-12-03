import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Target, BarChart3, Palette, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { StaggerChildren, StaggerItem } from "@/components/animations/StaggerChildren";
import { ScaleOnScroll } from "@/components/animations/ScaleOnScroll";
import { FloatingElement } from "@/components/animations/FloatingElement";
import { MagneticButton, GradientText } from "@/components/animations/SmoothScroll";
import { ParallaxSection } from "@/components/animations/ParallaxSection";

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
      {/* Hero Section */}
      <section ref={heroRef} className="container mx-auto px-4 py-16 md:py-24 max-w-6xl min-h-[80vh] flex items-center relative">
        <motion.div 
          className="w-full text-center mb-12"
          style={{ opacity: heroOpacity, scale: heroScale }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-full mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="text-sm font-medium">Your Ad Assistant</span>
          </motion.div>

          <motion.h1 
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
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
                className="text-base"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </MagneticButton>

            <MagneticButton>
              <Button variant="outline" size="lg" className="text-base">
                Watch Demo
              </Button>
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Decorative floating elements */}
        <FloatingElement className="absolute top-1/4 left-10 opacity-20 hidden lg:block" delay={0}>
          <div className="w-16 h-16 rounded-full bg-primary/30 blur-xl" />
        </FloatingElement>
        <FloatingElement className="absolute bottom-1/4 right-10 opacity-20 hidden lg:block" delay={1}>
          <div className="w-24 h-24 rounded-full bg-secondary/50 blur-2xl" />
        </FloatingElement>
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
                Your Ad Assistant turns confusing Meta ads tasks into simple steps — from setup to creative to weekly performance.
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
