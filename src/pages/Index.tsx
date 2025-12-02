import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Target, BarChart3, Palette, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-secondary px-4 py-2 rounded-full mb-6">
            <span className="text-sm font-medium">Your Ad Assistant</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Tell us what you want to run.
            <br />
            <span className="text-muted-foreground">We'll tell you exactly how.</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your step-by-step guide to setting up, monitoring, and improving Meta ads — 
            with clear KPIs and creative ideas that work.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="playful"
              size="lg"
              className="text-base"
              onClick={() => navigate("/auth")}
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button variant="outline" size="lg" className="text-base">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-secondary py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to run Meta ads confidently.
            </h2>
            <p className="text-lg text-muted-foreground">
              No marketing degree required. Just clear guidance, smart suggestions, and simple tools.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-none shadow-sm">
                  <CardContent className="pt-6">
                    <div className="mb-4 flex justify-center">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-center">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-center">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Stop wasting time figuring out what to do next
            </h2>

            <p className="text-lg text-muted-foreground mb-8">
              Your Ad Assistant turns confusing Meta ads tasks into simple steps — from setup to creative to weekly performance.
            </p>

            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-lg">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="p-8 shadow-lg">
            <CardContent className="space-y-6">
              <div className="bg-secondary rounded-lg p-6">
                <p className="text-sm text-muted-foreground mb-2">Campaign Type</p>
                <p className="text-xl font-semibold">Lead Generation</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Cost per Lead</p>
                  <p className="text-2xl font-bold text-primary">$4.20</p>
                </div>
                <div className="bg-secondary rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">CTR</p>
                  <p className="text-2xl font-bold">2.4%</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  ✨ <strong>What's Working:</strong> Your ad is performing above benchmark. Keep it running and test new variations.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to run ads with confidence?
          </h2>

          <p className="text-xl mb-8 opacity-90">
            Set up your first campaign in minutes. No credit card required.
          </p>

          <Button
            variant="secondary"
            size="lg"
            className="text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            onClick={() => navigate("/auth")}
          >
            Start Your First Campaign
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
