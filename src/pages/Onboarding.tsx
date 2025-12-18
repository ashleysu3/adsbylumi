import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, MessageCircle, Lightbulb, ArrowRight } from "lucide-react";
import { LumiCharacter } from "@/components/LumiCharacter";
import { motion } from "framer-motion";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [step, setStep] = useState(1);
  const [hasExtracted, setHasExtracted] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
    }
    setCheckingAuth(false);
  };

  const handleExtractBrandInfo = async () => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL first");
      return;
    }

    setExtracting(true);
    toast.info("Analyzing your website...");

    try {
      const { data, error } = await supabase.functions.invoke('extract-brand-info', {
        body: { websiteUrl }
      });

      if (error) throw error;

      setValueProposition(data.value_proposition);
      setTargetAudience(data.target_audience);
      setIndustry(data.industry);
      setHasExtracted(true);

      toast.success("Brand info extracted from website");
    } catch (error: any) {
      console.error('Error extracting brand info:', error);
      toast.error("Failed to extract brand info. You can enter it manually.");
    } finally {
      setExtracting(false);
    }
  };

  const handleStep1Next = async () => {
    if (!brandName || !websiteUrl) {
      toast.error("Please fill in brand name and website URL");
      return;
    }

    // Only auto-extract if we haven't extracted before AND fields are empty
    if (!hasExtracted && !valueProposition && !targetAudience && !industry) {
      setExtracting(true);
      toast.info("Analyzing your website before continuing...");
      
      try {
        const { data, error } = await supabase.functions.invoke('extract-brand-info', {
          body: { websiteUrl }
        });

        if (error) throw error;

        setValueProposition(data.value_proposition);
        setTargetAudience(data.target_audience);
        setIndustry(data.industry);
        setHasExtracted(true);

        toast.success("Brand info extracted successfully");
      } catch (error: any) {
        console.error('Error extracting brand info:', error);
        toast.error("Could not auto-extract info. Please fill in manually on the next step.");
        setHasExtracted(true); // Mark as attempted to prevent repeated tries
      } finally {
        setExtracting(false);
      }
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user already has a subscription (created via Stripe checkout)
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: brandData, error: brandError } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: brandName,
          website_url: websiteUrl,
          industry,
          value_proposition: valueProposition,
          target_audience: targetAudience,
          psychology_status: 'pending'
        })
        .select()
        .single();

      if (brandError) throw brandError;

      // Only create a starter subscription if none exists from Stripe
      // The actual tier is determined by Stripe webhook based on payment
      if (!existingSub) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .insert({
            user_id: user.id,
            tier: "starter", // Default free tier - upgrades happen via Stripe
            status: "active"
          });

        if (subError) throw subError;
      }

      toast.info("Building your audience profile...");
      supabase.functions.invoke('generate-audience-psychology', {
        body: { brandId: brandData.id }
      });

      // Move to Meet Lumi step instead of navigating away
      setStep(3);
    } catch (error: any) {
      console.error('Error during onboarding:', error);
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishOnboarding = () => {
    toast.success("Welcome to Lumi! ✨");
    navigate("/dashboard");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background via-background to-lumi-purple-1/10">
      <Card variant="gradient" className="w-full max-w-2xl rounded-2xl shadow-elevated">
        <CardHeader>
          <CardTitle className="font-display text-2xl">
            {step === 3 ? "Meet Lumi ✨" : "Welcome to Lumi! ✨"}
          </CardTitle>
          <CardDescription>
            {step === 1 
              ? "Let's get to know your brand" 
              : step === 2 
                ? "Here's what Lumi found — feel free to tweak anything"
                : "Your AI-powered Meta Ads assistant"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  variant="glow"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="My Amazing Brand"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="websiteUrl"
                    type="url"
                    variant="glow"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExtractBrandInfo}
                    disabled={extracting || !websiteUrl}
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Extract
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lumi will analyze your website to understand your brand better
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  variant="glow"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Coaching, E-commerce, SaaS"
                />
              </div>

              <Button 
                onClick={handleStep1Next} 
                disabled={extracting}
                className="w-full"
                variant="lumi"
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing website...
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          ) : step === 2 ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="valueProposition">What do you offer?</Label>
                <Textarea
                  id="valueProposition"
                  variant="glow"
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  rows={3}
                  placeholder="Lumi recommends describing your main product or service..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">Who do you serve?</Label>
                <Textarea
                  id="targetAudience"
                  variant="glow"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  rows={3}
                  placeholder="Tell Lumi about your ideal customer..."
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="flex-1" variant="lumi">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting things up...
                    </>
                  ) : (
                    "Let's Go! ✨"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            // Step 3: Meet Lumi
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 py-4"
            >
              {/* Lumi Character */}
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <LumiCharacter size="xl" state="idle" glow className="animate-float" />
                </motion.div>
              </div>

              {/* Feature highlights */}
              <div className="space-y-4">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50"
                >
                  <div className="p-2 rounded-lg bg-gradient-lumi">
                    <Lightbulb className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Smart Recommendations</h4>
                    <p className="text-sm text-muted-foreground">
                      Lumi will pop up with personalized tips and next steps as you work — look for the sparkle button in the bottom right.
                    </p>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50"
                >
                  <div className="p-2 rounded-lg bg-gradient-lumi">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Ask Anything</h4>
                    <p className="text-sm text-muted-foreground">
                      Click the sparkle button anytime to ask questions, get help with strategy, or learn what to do next.
                    </p>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50"
                >
                  <div className="p-2 rounded-lg bg-gradient-lumi">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Always Here to Help</h4>
                    <p className="text-sm text-muted-foreground">
                      Whether you're new to ads or a pro, Lumi adapts to guide you through creating campaigns that convert.
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button 
                  onClick={handleFinishOnboarding} 
                  variant="lumi" 
                  className="w-full group"
                  size="lg"
                >
                  Let's Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
