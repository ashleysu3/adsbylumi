import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [step, setStep] = useState(1);

  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tier, setTier] = useState<"starter" | "growth" | "agency_pro">("starter");

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

    // If we don't have extracted info yet, extract it before proceeding
    if (!valueProposition || !targetAudience || !industry) {
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

        toast.success("Brand info extracted successfully");
      } catch (error: any) {
        console.error('Error extracting brand info:', error);
        toast.error("Could not auto-extract info. Please fill in manually on the next step.");
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

      const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          tier,
          status: "active"
        });

      if (subError) throw subError;

      toast.info("Building your audience profile...");
      supabase.functions.invoke('generate-audience-psychology', {
        body: { brandId: brandData.id }
      });

      toast.success("Brand created successfully");
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Error during onboarding:', error);
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to Your Ad Assistant</CardTitle>
          <CardDescription>
            {step === 1 ? "Let's start with the basics" : "Review your brand details"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
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
                  We'll analyze your website to extract brand details
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Coaching, E-commerce, SaaS"
                />
              </div>

              <Button 
                onClick={handleStep1Next} 
                disabled={extracting}
                className="w-full"
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="valueProposition">What You Offer</Label>
                <Textarea
                  id="valueProposition"
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  rows={3}
                  placeholder="Describe what your business provides..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">Who You Serve</Label>
                <Textarea
                  id="targetAudience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  rows={3}
                  placeholder="Describe your ideal customer..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier">Subscription Plan</Label>
                <Select value={tier} onValueChange={(value: any) => setTier(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter - $147/mo</SelectItem>
                    <SelectItem value="growth">Growth - $247/mo</SelectItem>
                    <SelectItem value="agency_pro">Agency Pro - $497/mo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
