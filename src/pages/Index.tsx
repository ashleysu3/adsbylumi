import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, BarChart3, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-editorial">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center mb-6">
            <Sparkles className="h-16 w-16 text-accent" />
          </div>
          
          <h1 className="text-6xl md:text-7xl font-editorial font-bold tracking-tight">
            Your Ad Assistant
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Elevated, psychology-driven Meta Ads campaigns for coaches, creators, and agencies.
            <span className="block mt-4 text-accent font-medium">
              Vogue meets marketing strategy.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              size="lg"
              className="h-14 px-8 text-lg"
              onClick={() => navigate("/auth")}
            >
              Start Your Journey
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-lg"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-5xl mx-auto">
          {[
            {
              icon: Target,
              title: "Ad Planner",
              description: "Strategy engine that crafts psychology-driven campaign blueprints tailored to your audience.",
            },
            {
              icon: Palette,
              title: "Creative Department",
              description: "Generate scripts, copy, and creative direction for talking-head videos, carousels, and more.",
            },
            {
              icon: BarChart3,
              title: "Performance Fixer",
              description: "KPI tracking, fatigue detection, and optimization guidance powered by Meta API insights.",
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-card/50 backdrop-blur-sm rounded-xl p-8 shadow-editorial hover:shadow-elevated transition-shadow"
              >
                <div className="flex justify-center mb-6">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-center">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-center leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Social Proof Section */}
        <div className="mt-32 text-center space-y-6">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            Trusted by forward-thinking marketers
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["Coaches", "Course Creators", "Service Pros", "Agencies"].map((tag) => (
              <div
                key={tag}
                className="px-6 py-3 bg-card/30 backdrop-blur-sm rounded-full text-sm font-medium border border-border"
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
