import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Target, Palette, BarChart3, Shield, Zap, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    
    // Trigger animations after mount
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
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-phantom flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold">Your Ad Assistant</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#security" className="text-muted-foreground hover:text-foreground transition-colors">Security</a>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
                className="font-medium"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate("/auth")}
                className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6"
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
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float-delayed" />
        </div>
        
        <div className="container mx-auto px-6 relative">
          <div className="text-center max-w-5xl mx-auto">
            {/* Tagline */}
            <p className={`text-muted-foreground text-lg md:text-xl mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              The ad assistant that'll take you places
            </p>
            
            {/* Main headline with inline icon */}
            <h1 className={`text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight mb-8 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              Your{" "}
              <span className="inline-flex items-center">
                <span className="inline-block w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-3xl bg-primary/20 mx-2 relative">
                  <Sparkles className="absolute inset-0 m-auto h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-primary" />
                </span>
              </span>
              {" "}trusted
              <br />
              <span className="text-primary">companion</span>
            </h1>
            
            {/* CTA */}
            <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <Button 
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 py-6 text-lg font-semibold shadow-elevated hover:shadow-glow transition-all duration-300 hover:-translate-y-1"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className={`mb-24 last:mb-0 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
            >
              {/* Section header */}
              <div className="text-center mb-12">
                <p className="text-muted-foreground text-lg mb-4">
                  {index === 0 && "Keep everything in one place"}
                  {index === 1 && "Powerful tools made for everyone"}
                  {index === 2 && "Controlled by you, secured by us"}
                </p>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight">
                  <span className="inline-flex items-center gap-4">
                    <span className="inline-block w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/20 relative">
                      <feature.icon className="absolute inset-0 m-auto h-7 w-7 md:h-8 md:w-8 text-primary" />
                    </span>
                    {feature.title}
                  </span>
                </h2>
              </div>
              
              {/* Feature cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {feature.items.map((item, itemIndex) => (
                  <div 
                    key={itemIndex}
                    className="group p-6 rounded-3xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-soft transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-foreground/90 leading-relaxed">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 md:py-32 bg-gradient-hero">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Enterprise-grade security</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-6">
              Your data stays
              <span className="text-primary"> yours</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              We never store your ad account credentials. Connect securely through Meta's official OAuth, 
              and revoke access anytime.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Shield, title: "Secure by design", desc: "OAuth 2.0 authentication with Meta" },
              { icon: Zap, title: "Real-time sync", desc: "Data stays fresh, never cached long-term" },
              { icon: Target, title: "You're in control", desc: "Revoke access instantly from settings" },
            ].map((item, index) => (
              <div 
                key={index}
                className="text-center p-8 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-phantom p-12 md:p-20 text-center">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4 tracking-tight">
                Get started with
                <br />
                <span className="text-white/80">Your Ad Assistant</span>
              </h2>
              
              <p className="text-white/80 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                Join thousands of marketers running smarter Meta campaigns
              </p>
              
              <Button 
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-white text-primary hover:bg-white/90 rounded-full px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-phantom flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold">Your Ad Assistant</span>
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
