import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form state
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tier, setTier] = useState<"starter" | "growth" | "agency_pro">("starter");

  const handleSubmit = async () => {
    if (!brandName || !industry) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create brand
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: brandName,
          website_url: websiteUrl,
          industry,
          value_proposition: valueProposition,
          target_audience: targetAudience,
        })
        .select()
        .single();

      if (brandError) throw brandError;

      // Create subscription record
      const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          tier,
          status: "trial",
        });

      if (subError) throw subError;

      toast.success("Brand profile created! Welcome to Your Ad Assistant.");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to create brand profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-editorial flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-3xl shadow-elevated">
        <CardHeader className="text-center border-b pb-6">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <CardTitle className="text-4xl font-editorial tracking-tight">
            Let's Build Your Brand Profile
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            This helps us craft strategies that truly resonate with your audience
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="brandName" className="text-base">Brand Name *</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Acme Coaching"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-base">Website URL</Label>
                <Input
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry" className="text-base">Industry *</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coaching">Coaching & Consulting</SelectItem>
                    <SelectItem value="courses">Online Courses</SelectItem>
                    <SelectItem value="services">Professional Services</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!brandName || !industry}
                  className="h-12 px-8"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="valueProposition" className="text-base">
                  What makes your brand unique?
                </Label>
                <Textarea
                  id="valueProposition"
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  placeholder="We help burnt-out professionals reclaim their time and energy through science-backed productivity systems..."
                  className="min-h-[120px] text-base resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience" className="text-base">
                  Who do you serve?
                </Label>
                <Textarea
                  id="targetAudience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Mid-career professionals (35-50) who feel overwhelmed by work demands..."
                  className="min-h-[120px] text-base resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base">Choose Your Plan</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  {[
                    { value: "starter", name: "Starter", price: "$147/mo", desc: "1 Brand • 3 Campaigns" },
                    { value: "growth", name: "Growth", price: "$247/mo", desc: "2 Brands • 10 Campaigns" },
                    { value: "agency_pro", name: "Agency Pro", price: "$497/mo", desc: "Unlimited Everything" },
                  ].map((plan) => (
                    <button
                      key={plan.value}
                      onClick={() => setTier(plan.value as any)}
                      className={`p-6 rounded-lg border-2 text-left transition-all ${
                        tier === plan.value
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      <div className="font-semibold text-lg">{plan.name}</div>
                      <div className="text-2xl font-editorial mt-1">{plan.price}</div>
                      <div className="text-sm text-muted-foreground mt-2">{plan.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="h-12 px-6">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="h-12 px-8"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
