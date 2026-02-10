import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Sparkles, MessageCircle, Lightbulb, ArrowRight, CheckCircle2, ChevronLeft, User, Smile, Link2, X } from "lucide-react";
import { SparkleIcon } from "@/components/SparkleIcon";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
import { motion } from "framer-motion";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { formatInvokeError } from "@/lib/formatInvokeError";
import { useBrand } from "@/contexts/BrandContext";

const STEP_LABELS = ["Brand Basics", "Positioning", "Copy Style", "Meet Lumi", "Connect Meta"];
const DEFAULT_EMOJIS = ['✨', '🎯', '💡', '🚀', '💪', '⭐'];
const BULLET_OPTIONS = ['✅', '→', '•', '✓', '▸', '★', '💫', '🔥'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAddBrandMode = searchParams.get('mode') === 'add-brand';
  const { refreshBrands, setActiveBrand } = useBrand();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [step, setStep] = useState(1);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [autoExtractPending, setAutoExtractPending] = useState(false);
  const [createdBrandId, setCreatedBrandId] = useState<string | null>(null);

  // Step 1
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 2
  const [valueProposition, setValueProposition] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  // Step 3 - Copy Style
  const [copyPerspective, setCopyPerspective] = useState<'I' | 'We'>('I');
  const [useEmojis, setUseEmojis] = useState(true);
  const [brandEmojis, setBrandEmojis] = useState<string[]>(DEFAULT_EMOJIS);
  const [bulletEmoji, setBulletEmoji] = useState('✅');
  const [newEmoji, setNewEmoji] = useState('');

  const extractDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auto-extract when URL is pasted/changed (debounced)
  const triggerAutoExtract = useCallback((url: string) => {
    const normalizedUrl = normalizeWebsiteUrl(url);
    if (!normalizedUrl || normalizedUrl.length < 10) return;
    
    if (extractDebounceRef.current) {
      clearTimeout(extractDebounceRef.current);
    }
    
    setAutoExtractPending(true);
    
    extractDebounceRef.current = setTimeout(async () => {
      if (extracting || hasExtracted) {
        setAutoExtractPending(false);
        return;
      }
      
      setExtracting(true);
      setAutoExtractPending(false);
      
      try {
        const { data, error } = await supabase.functions.invoke("extract-brand-info", {
          body: { websiteUrl: normalizedUrl },
        });

        if (error) throw error;

        setValueProposition(data.value_proposition || "");
        setTargetAudience(data.target_audience || "");
        setIndustry(data.industry || "");
        setHasExtracted(true);

        toast.success("✨ Website analyzed! Review the extracted info below.");
      } catch (error: any) {
        console.error("Auto-extract error:", error);
      } finally {
        setExtracting(false);
      }
    }, 1500);
  }, [extracting, hasExtracted]);

  useEffect(() => {
    return () => {
      if (extractDebounceRef.current) {
        clearTimeout(extractDebounceRef.current);
      }
    };
  }, []);

  const handleWebsiteUrlChange = (value: string) => {
    setWebsiteUrl(value);
    if (hasExtracted && value !== websiteUrl) {
      setHasExtracted(false);
    }
    triggerAutoExtract(value);
  };

  const handleStep1Next = async () => {
    const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);

    if (!brandName.trim() || !normalizedWebsiteUrl) {
      toast.error("Please fill in brand name and website URL");
      return;
    }

    if (normalizedWebsiteUrl !== websiteUrl) setWebsiteUrl(normalizedWebsiteUrl);

    if (!hasExtracted && !valueProposition && !targetAudience && !industry) {
      setExtracting(true);
      toast.info("Analyzing your website before continuing...");

      try {
        const { data, error } = await supabase.functions.invoke("extract-brand-info", {
          body: { websiteUrl: normalizedWebsiteUrl },
        });

        if (error) throw error;

        setValueProposition(data.value_proposition);
        setTargetAudience(data.target_audience);
        setIndustry(data.industry);
        setHasExtracted(true);

        toast.success("Brand info extracted successfully");
      } catch (error: any) {
        console.error("Error extracting brand info:", error);
        toast.error(`Could not auto-extract info: ${formatInvokeError(error)}. Please fill in manually on the next step.`);
        setHasExtracted(true);
      } finally {
        setExtracting(false);
      }
    }

    setStep(2);
  };

  // Step 2 -> Save brand and go to step 3
  const handleStep2Next = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
          website_url: normalizeWebsiteUrl(websiteUrl),
          industry,
          value_proposition: valueProposition,
          target_audience: targetAudience,
          psychology_status: "pending",
        })
        .select()
        .single();

      if (brandError) throw brandError;
      setCreatedBrandId(brandData.id);

      if (!existingSub) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .insert({
            user_id: user.id,
            tier: "starter",
            status: "active"
          });

        if (subError) throw subError;
      }

      toast.info("Building your audience profile...");
      supabase.functions.invoke('generate-audience-psychology', {
        body: { brandId: brandData.id }
      });

      setStep(3);
    } catch (error: any) {
      console.error('Error during onboarding:', error);
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 -> Save copy style settings and go to step 4
  const handleStep3Next = async () => {
    if (!createdBrandId) {
      setStep(4);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({
          copy_perspective: copyPerspective,
          use_emojis: useEmojis,
          brand_emojis: brandEmojis,
          bullet_emoji: bulletEmoji,
        })
        .eq('id', createdBrandId);

      if (error) throw error;
      setStep(4);
    } catch (error: any) {
      console.error('Error saving copy style:', error);
      toast.error('Failed to save copy style settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    // Refresh brand list so the new brand appears in the selector
    await refreshBrands();
    
    // If we have a created brand ID, set it as active
    if (createdBrandId) {
      const { data: newBrand } = await supabase
        .from('brands')
        .select('id, name, website_url, industry, meta_account_id, created_at')
        .eq('id', createdBrandId)
        .single();
      
      if (newBrand) {
        setActiveBrand(newBrand);
      }
    }
    
    toast.success("Welcome to Lumi! ✨");
    navigate(isAddBrandMode ? "/campaigns" : "/start");
  };

  const addEmoji = () => {
    if (!newEmoji.trim()) return;
    if (brandEmojis.length >= 6) {
      toast.error('Maximum 6 emojis allowed');
      return;
    }
    if (brandEmojis.includes(newEmoji.trim())) {
      toast.error('Emoji already added');
      return;
    }
    setBrandEmojis(prev => [...prev, newEmoji.trim()]);
    setNewEmoji('');
  };

  const removeEmoji = (emoji: string) => {
    setBrandEmojis(prev => prev.filter(e => e !== emoji));
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const progressPercentage = (step / 5) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background via-background to-lumi-purple-1/10">
      <Card variant="gradient" className="w-full max-w-2xl rounded-2xl shadow-elevated">
        <CardHeader className="pb-3">
          {/* Step progress */}
          <div className="space-y-3 mb-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {step} of 5</span>
              <span>{STEP_LABELS[step - 1]}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between">
              {STEP_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`text-[10px] font-medium ${
                    i + 1 <= step ? 'text-primary' : 'text-muted-foreground/50'
                  }`}
                >
                  {i + 1 <= step ? '●' : '○'}
                </div>
              ))}
            </div>
          </div>

          <CardTitle className="font-display text-2xl">
            {step === 1 ? "Welcome to Lumi! ✨" :
             step === 2 ? "Your Positioning" :
             step === 3 ? "Your Copy Style" :
             step === 4 ? "Meet Lumi ✨" :
             "Connect Meta"}
          </CardTitle>
          <CardDescription>
            {step === 1 ? "Let's get to know your brand" :
             step === 2 ? "Here's what Lumi found — feel free to tweak anything" :
             step === 3 ? "Set your ad copy voice and emoji preferences" :
             step === 4 ? "Your AI-powered Meta Ads assistant" :
             "Link your Meta ad account to launch campaigns"}
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
                <div className="relative">
                  <Input
                    id="websiteUrl"
                    type="url"
                    variant="glow"
                    value={websiteUrl}
                    onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                    placeholder="https://example.com"
                    className="pr-10"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {extracting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : autoExtractPending ? (
                      <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    ) : hasExtracted ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {extracting ? (
                    <>
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      Analyzing your website...
                    </>
                  ) : hasExtracted ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Website analyzed — info extracted below
                    </>
                  ) : autoExtractPending ? (
                    "Will analyze when you stop typing..."
                  ) : (
                    "Paste your URL and Lumi will automatically analyze it"
                  )}
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
            <div className="space-y-6">
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
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleStep2Next} disabled={loading} className="flex-1" variant="lumi">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting things up...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </div>
            </div>
          ) : step === 3 ? (
            // Copy Voice + Emoji Preferences
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Copy Perspective Toggle */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Ad Copy Voice</Label>
                <p className="text-sm text-muted-foreground">
                  Should your ads say "I" or "We"? Choose the voice that fits your brand.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCopyPerspective('I')}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      copyPerspective === 'I'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-semibold text-sm">Personal "I"</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      "I help entrepreneurs scale..."<br />
                      "My program teaches you..."
                    </p>
                  </button>
                  <button
                    onClick={() => setCopyPerspective('We')}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      copyPerspective === 'We'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-semibold text-sm">Team "We"</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      "We help entrepreneurs scale..."<br />
                      "Our program teaches you..."
                    </p>
                  </button>
                </div>
              </div>

              <Separator />

              {/* Emoji Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Use Emojis in Copy</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable emojis in generated ad copy
                  </p>
                </div>
                <Switch
                  checked={useEmojis}
                  onCheckedChange={setUseEmojis}
                />
              </div>

              {useEmojis && (
                <>
                  {/* Brand Emojis */}
                  <div className="space-y-3">
                    <Label className="text-sm">Your Brand Emojis (up to 6)</Label>
                    <div className="flex flex-wrap gap-2">
                      {brandEmojis.map((emoji) => (
                        <div
                          key={emoji}
                          className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg border"
                        >
                          <span className="text-xl">{emoji}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-destructive/20"
                            onClick={() => removeEmoji(emoji)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {brandEmojis.length < 6 && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <EmojiQuickPicker
                          onSelect={(emoji) => {
                            if (brandEmojis.length >= 6) {
                              toast.error('Maximum 6 emojis allowed');
                              return;
                            }
                            if (brandEmojis.includes(emoji)) {
                              toast.error('Emoji already added');
                              return;
                            }
                            setBrandEmojis(prev => [...prev, emoji]);
                          }}
                          selectedEmojis={brandEmojis}
                        />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="flex gap-2">
                          <Input
                            value={newEmoji}
                            onChange={(e) => setNewEmoji(e.target.value)}
                            placeholder="Paste emoji..."
                            className="w-24"
                            maxLength={4}
                          />
                          <Button variant="ghost" size="sm" onClick={addEmoji}>
                            Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bullet Style */}
                  <div className="space-y-3">
                    <Label className="text-sm">Bullet Point Style</Label>
                    <div className="flex flex-wrap gap-2">
                      {BULLET_OPTIONS.map((bullet) => (
                        <Button
                          key={bullet}
                          variant={bulletEmoji === bullet ? "default" : "outline"}
                          size="sm"
                          onClick={() => setBulletEmoji(bullet)}
                          className="text-lg w-10 h-10 p-0"
                        >
                          {bullet}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleStep3Next} disabled={loading} className="flex-1" variant="lumi">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Next"
                  )}
                </Button>
              </div>
            </motion.div>
          ) : step === 4 ? (
            // Meet Lumi
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 py-4"
            >
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <SparkleIcon size="xl" state="idle" glow className="animate-float" />
                </motion.div>
              </div>

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

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex gap-2"
              >
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(5)} 
                  variant="lumi" 
                  className="flex-1 group"
                  size="lg"
                >
                  Next — Connect Meta
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            // Step 5: Connect Meta
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 py-4"
            >
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <Link2 className="h-10 w-10 text-primary" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Connect your Meta (Facebook/Instagram) ad account to launch campaigns directly from Lumi.
                </p>
              </div>

              {createdBrandId && (
                <div data-section="meta-account">
                  <MetaAccountConnect
                    brandId={createdBrandId}
                    currentAccountId={null}
                    currentPageId={null}
                    currentPageName={null}
                    onUpdate={() => {
                      toast.success("Meta account connected! 🎉");
                      handleFinishOnboarding();
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(4)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleFinishOnboarding}
                  variant="ghost"
                  className="flex-1"
                >
                  Skip for now — I'll connect later
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                You can always connect later from My Brand → Brand Settings.
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
