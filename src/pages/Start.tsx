import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShimmer } from "@/components/GradientShimmer";
import { PlusCircle, RefreshCw, BarChart3, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import lumiLogo from "@/assets/lumi-logo.png";

interface ActionOption {
  id: "create" | "update" | "results";
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  route: string;
}

export default function Start() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [hasActiveCampaigns, setHasActiveCampaigns] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  useEffect(() => {
    checkUserState();
  }, []);

  const checkUserState = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check for brand
      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!brandData) {
        navigate("/onboarding");
        return;
      }

      setBrand(brandData);

      // Check for active campaigns
      const { data: campaigns } = await supabase
        .from("campaign_workspaces")
        .select("id")
        .eq("brand_id", brandData.id)
        .eq("archived", false)
        .limit(1);

      setHasActiveCampaigns((campaigns?.length || 0) > 0);
    } catch (error) {
      console.error("Error checking user state:", error);
    } finally {
      setLoading(false);
    }
  };

  const actionOptions: ActionOption[] = [
    {
      id: "create",
      title: "Create a new ad",
      description: "Start fresh with a new campaign from scratch",
      icon: <PlusCircle className="h-7 w-7" />,
      enabled: true,
      route: "/create",
    },
    {
      id: "update",
      title: "Update an existing ad",
      description: "Add new creative or tweak an active campaign",
      icon: <RefreshCw className="h-7 w-7" />,
      enabled: hasActiveCampaigns,
      route: "/campaigns",
    },
    {
      id: "results",
      title: "Check results",
      description: "See how your campaigns are performing",
      icon: <BarChart3 className="h-7 w-7" />,
      enabled: hasActiveCampaigns,
      route: "/data",
    },
  ];

  const handleOptionClick = (option: ActionOption) => {
    if (option.enabled) {
      navigate(option.route);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center px-4">
        {/* Lumi greeting */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <img 
              src={lumiLogo} 
              alt="Lumi" 
              className="h-12 w-12 rounded-full"
            />
            <Sparkles className="h-5 w-5 text-lumi-pink-1 animate-pulse" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            What do you want to do today?
          </h1>
          <p className="text-muted-foreground text-lg">
            Hi{brand?.name ? `, ${brand.name.split(' ')[0]}` : ''}! Let's make some magic happen.
          </p>
        </motion.div>

        {/* Action cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl"
        >
          {actionOptions.map((option, index) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
            >
              <Card
                className={cn(
                  "relative overflow-hidden cursor-pointer transition-all duration-300 border-2",
                  option.enabled
                    ? "hover:border-primary hover:shadow-lg hover:shadow-primary/10"
                    : "opacity-50 cursor-not-allowed",
                  hoveredOption === option.id && option.enabled
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-border"
                )}
                onClick={() => handleOptionClick(option)}
                onMouseEnter={() => setHoveredOption(option.id)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                {/* Gradient overlay for recommended option */}
                {option.id === "create" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-lumi-orange-1/5 via-lumi-pink-1/5 to-lumi-purple-1/5 pointer-events-none" />
                )}
                
                <CardContent className="p-6 text-center">
                  <div
                    className={cn(
                      "mx-auto mb-4 h-14 w-14 rounded-full flex items-center justify-center transition-colors",
                      option.id === "create"
                        ? "bg-gradient-to-br from-lumi-orange-1/20 via-lumi-pink-1/20 to-lumi-purple-1/20 text-lumi-pink-1"
                        : "bg-muted text-muted-foreground",
                      hoveredOption === option.id && option.enabled && "text-primary"
                    )}
                  >
                    {option.icon}
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-1">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  
                  {option.id === "create" && (
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-lumi-pink-1 bg-lumi-pink-1/10 px-2 py-1 rounded-full">
                        <Sparkles className="h-3 w-3" />
                        Recommended
                      </span>
                    </div>
                  )}
                  
                  {!option.enabled && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Create an ad first
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick access footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-muted-foreground mb-2">Or jump to:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              My Brand
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              Settings
            </Button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
