import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, Palette, BarChart3, Shield, Zap, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AnimatedLogo from "@/components/AnimatedLogo";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { motion } from "framer-motion";

const ScrollSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const { ref, isInView } = useScrollAnimation({ threshold: 0.15 });
  
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    
    setTimeout(() => setIsVisible(true), 100);
  }, [navigate]);

  const features = [
    {
      icon: Target,
      title: "Your strategy",
      items: [
        "Answer questions, get a complete campaign plan",
        "Psychology-driven audience targeting",
        "Clear KPIs and benchmarks tailored to your goal",
        "No guesswork — just follow the steps",
      ],
    },
    {
      icon: Palette,
      title: "Your creative",
      items: [
        "Talking-head scripts that convert",
        "B-roll direction and shot lists",
        "Ad copy variations for every funnel stage",
        "Production checklists to stay organized",
      ],
    },
    {
      icon: BarChart3,
      title: "Your performance",
      items: [
        "Plain-language insights on what's working",
        "Spot fatigue before it costs you",
        "Weekly automated reports to your inbox",
        "One-click optimization recommendations",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AnimatedLogo className="w-10 h-10" />
              <span className="font-display text-xl font-bold text-foreground">Your Ad Assistant</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#security" className="text-muted-foreground hover:text-foreground transition-colors">Security</a>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
                className="font-medium text-foreground"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate("/auth")}
                className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-6"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-20 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
            animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-20 right-1/4 w-80 h-80 bg-coral/10 rounded-full blur-3xl"
            animate={{ y: [0, 20, 0], scale: [1.05, 1, 1.05] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <div className="container mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left">
              {/* Tagline */}
              <motion.p 
                className="text-muted-foreground text-lg md:text-xl mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
              >
                The ad assistant that'll take you places
              </motion.p>
              
              {/* Main headline */}
              <motion.h1 
                className="text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-8 text-foreground"
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                Your{" "}
                <span className="inline-flex items-center">
                  <span className="inline-block w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 mx-2 relative">
                    <AnimatedLogo className="w-full h-full" />
                  </span>
                </span>
                {" "}trusted
                <br />
                <span className="text-accent">companion</span>
              </motion.h1>
              
              {/* CTA */}
              <motion.div 
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Button 
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 py-6 text-lg font-semibold shadow-elevated hover:shadow-glow transition-all duration-300 hover:-translate-y-1"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </div>

            {/* Right side - Floating App Preview */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, x: 50 }}
              animate={isVisible ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <motion.div
                className="relative"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Main mockup card */}
                <div className="bg-card rounded-3xl shadow-elevated border border-border/50 p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-accent/60" />
                    <div className="w-3 h-3 rounded-full bg-coral/60" />
                    <div className="w-3 h-3 rounded-full bg-muted" />
                  </div>
                  
                  {/* Dashboard preview */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <AnimatedLogo className="w-8 h-8" />
                      <div className="h-3 bg-muted rounded-full w-32" />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {["Strategy", "Creative", "Data"].map((label, i) => (
                        <div key={label} className={`p-3 rounded-xl ${i === 0 ? 'bg-accent/10 border-2 border-accent' : 'bg-muted/50'}`}>
                          <div className={`text-xs font-medium ${i === 0 ? 'text-accent' : 'text-muted-foreground'}`}>{label}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
                      <div className="h-2 bg-muted rounded-full w-3/4" />
                      <div className="h-2 bg-muted rounded-full w-1/2" />
                      <div className="flex gap-2 mt-3">
                        <div className="h-8 bg-accent rounded-lg flex-1" />
                        <div className="h-8 bg-muted rounded-lg w-20" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating stats card */}
                <motion.div
                  className="absolute -right-4 top-1/4 bg-card rounded-2xl shadow-elevated border border-border/50 p-4"
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">ROAS</div>
                      <div className="font-bold text-foreground">4.2x</div>
                    </div>
                  </div>
                </motion.div>

                {/* Floating notification */}
                <motion.div
                  className="absolute -left-4 bottom-1/4 bg-card rounded-2xl shadow-elevated border border-border/50 p-3"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-accent" />
                    <span className="text-sm font-medium text-foreground">Campaign optimized</span>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          {features.map((feature, index) => (
            <ScrollSection 
              key={feature.title}
              className={`mb-24 last:mb-0`}
              delay={index * 0.1}
            >
              {/* Section header */}
              <div className="text-center mb-12">
                <p className="text-muted-foreground text-lg mb-4">
                  {index === 0 && "Keep everything in one place"}
                  {index === 1 && "Powerful tools made for everyone"}
                  {index === 2 && "Controlled by you, secured by us"}
                </p>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight text-foreground">
                  <span className="inline-flex items-center gap-4">
                    <span className="inline-block w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent/20 relative">
                      <feature.icon className="absolute inset-0 m-auto h-7 w-7 md:h-8 md:w-8 text-accent" />
                    </span>
                    {feature.title}
                  </span>
                </h2>
              </div>
              
              {/* Feature cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {feature.items.map((item, itemIndex) => (
                  <motion.div 
                    key={itemIndex}
                    className="group p-6 rounded-3xl bg-card border border-border/50 hover:border-accent/30 hover:shadow-soft transition-all duration-300"
                    whileHover={{ y: -4 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-accent/20 transition-colors">
                        <CheckCircle className="h-4 w-4 text-accent" />
                      </div>
                      <p className="text-foreground/90 leading-relaxed">{item}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollSection>
          ))}
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 md:py-32 bg-gradient-hero">
        <div className="container mx-auto px-6">
          <ScrollSection className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full mb-6">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Enterprise-grade security</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-6 text-foreground">
              Your data stays
              <span className="text-accent"> yours</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              We never store your ad account credentials. Connect securely through Meta's official OAuth, 
              and revoke access anytime.
            </p>
          </ScrollSection>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Shield, title: "Secure by design", desc: "OAuth 2.0 authentication with Meta" },
              { icon: Zap, title: "Real-time sync", desc: "Data stays fresh, never cached long-term" },
              { icon: Target, title: "You're in control", desc: "Revoke access instantly from settings" },
            ].map((item, index) => (
              <ScrollSection key={index} delay={index * 0.1}>
                <div className="text-center p-8 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </ScrollSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <ScrollSection>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-phantom p-12 md:p-20 text-center">
              {/* Decorative elements */}
              <motion.div 
                className="absolute top-0 right-0 w-64 h-64 bg-background/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 6, repeat: Infinity }}
              />
              <motion.div 
                className="absolute bottom-0 left-0 w-48 h-48 bg-background/10 rounded-full blur-3xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.1, 0.2] }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-accent-foreground mb-4 tracking-tight">
                  Get started with
                  <br />
                  <span className="text-accent-foreground/80">Your Ad Assistant</span>
                </h2>
                
                <p className="text-accent-foreground/80 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                  Join thousands of marketers running smarter Meta campaigns
                </p>
                
                <Button 
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-background text-accent hover:bg-background/90 rounded-full px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                >
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </ScrollSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AnimatedLogo className="w-8 h-8" />
              <span className="font-display font-bold text-foreground">Your Ad Assistant</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Your Ad Assistant. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
