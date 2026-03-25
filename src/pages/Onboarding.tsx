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
import { Loader2, Sparkles, MessageCircle, Lightbulb, ArrowRight, CheckCircle2, ChevronLeft, User, Smile, Link2, X, Mail, Brain, Heart, AlertCircle, Zap, Users, Pencil, PlusCircle, Download } from "lucide-react";
import { SparkleIcon } from "@/components/SparkleIcon";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { PostConnectionAnalysisModal } from "@/components/PostConnectionAnalysisModal";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
import { motion } from "framer-motion";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { formatInvokeError } from "@/lib/formatInvokeError";
import { useBrand } from "@/contexts/BrandContext";
import { LumiThinkingInline } from "@/components/LumiThinking";

const STEP_LABELS = ["Brand Basics", "Positioning", "Psychology", "Meet Lumi", "Connect Meta", "What's Next"];
const DEFAULT_EMOJIS = ['✨', '🎯', '💡', '🚀', '💪', '⭐'];
const BULLET_OPTIONS = ['✅', '→', '•', '✓', '▸', '★', '💫', '🔥'];

const PSYCHOLOGY_LOADING_COPY = [
  "Analyzing your brand's positioning...",
  "Understanding your ideal client...",
  "Mapping psychological pain points...",
  "Identifying what motivates your audience...",
  "Building your psychology profile...",
  "This takes a moment — worth it.",
];

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
  const [showPostConnectionAnalysis, setShowPostConnectionAnalysis] = useState(false);

  // Step 1
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 2
  const [valueProposition, setValueProposition] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  // Step 3 - Psychology
  const [psychologyData, setPsychologyData] = useState<any>(null);
  const [psychologyStatus, setPsychologyStatus] = useState<string>("pending");
  const [pollingPsychology, setPollingPsychology] = useState(false);
  const [editingPsychology, setEditingPsychology] = useState(false);
  const [editedPsychology, setEditedPsychology] = useState<any>(null);

  // Step 4 - Copy Style
  const [copyPerspective, setCopyPerspective] = useState<'I' | 'We'>('I');
  const [useEmojis, setUseEmojis] = useState(true);
  const [brandEmojis, setBrandEmojis] = useState<string[]>(DEFAULT_EMOJIS);
  const [bulletEmoji, setBulletEmoji] = useState('✅');
  const [newEmoji, setNewEmoji] = useState('');

  const extractDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkAuth();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
    }
    setCheckingAuth(false);
  };

  // Auto-extract when URL is pasted/changed (debounced)
  const extractingRef = useRef(false);
  const hasExtractedUrlRef = useRef<string | null>(null);

  const triggerAutoExtract = useCallback((url: string) => {
    const normalizedUrl = normalizeWebsiteUrl(url);
    if (!normalizedUrl || normalizedUrl.length < 10) return;
    if (hasExtractedUrlRef.current === normalizedUrl) return;
    
    if (extractDebounceRef.current) clearTimeout(extractDebounceRef.current);
    
    setAutoExtractPending(true);
    
    extractDebounceRef.current = setTimeout(async () => {
      if (extractingRef.current) {
        setAutoExtractPending(false);
        return;
      }
      
      extractingRef.current = true;
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
        hasExtractedUrlRef.current = normalizedUrl;
        toast.success("✨ Website analyzed! Review the extracted info below.");
      } catch (error: any) {
        console.error("Auto-extract error:", error);
      } finally {
        extractingRef.current = false;
        setExtracting(false);
      }
    }, 1500);
  }, []);

  const handleWebsiteUrlChange = (value: string) => {
    setWebsiteUrl(value);
    const normalizedNew = normalizeWebsiteUrl(value);
    if (hasExtractedUrlRef.current && hasExtractedUrlRef.current !== normalizedNew) {
      setHasExtracted(false);
      hasExtractedUrlRef.current = null;
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

  // Step 2 -> Save brand, trigger psychology, go to step 3 (Psychology Review)
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
          psychology_status: "generating",
        })
        .select()
        .single();

      if (brandError) throw brandError;
      setCreatedBrandId(brandData.id);

      if (!existingSub) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .insert({ user_id: user.id, tier: "starter", status: "active" });
        if (subError) throw subError;
      }

      // Auto-create digest settings
      await supabase.from("digest_settings").insert({
        brand_id: brandData.id,
        created_by: user.id,
        enabled: true,
        send_day: "monday",
        send_time: "08:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
        date_range_days: 7,
      });

      // Trigger psychology generation
      setPsychologyStatus("generating");
      supabase.functions.invoke('generate-audience-psychology', {
        body: { brandId: brandData.id }
      });

      // Start polling for psychology completion
      startPsychologyPolling(brandData.id);
      setStep(3);
    } catch (error: any) {
      console.error('Error during onboarding:', error);
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const startPsychologyPolling = (brandId: string) => {
    setPollingPsychology(true);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('brands')
        .select('audience_psychology, psychology_status')
        .eq('id', brandId)
        .single();
      
      if (data?.psychology_status === 'completed' || data?.psychology_status === 'approved') {
        setPsychologyData(data.audience_psychology);
        setPsychologyStatus(data.psychology_status);
        setPollingPsychology(false);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      } else if (data?.psychology_status === 'error') {
        setPsychologyStatus('error');
        setPollingPsychology(false);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    }, 3000);
  };

  const handleApprovePsychology = async () => {
    if (!createdBrandId) return;
    try {
      const { error } = await supabase
        .from('brands')
        .update({ psychology_status: 'approved' })
        .eq('id', createdBrandId);
      if (error) throw error;
      setPsychologyStatus('approved');
      toast.success("Psychology profile approved! ✨");
      setStep(4);
    } catch (error: any) {
      toast.error("Failed to approve");
    }
  };

  const handleEditPsychology = () => {
    setEditedPsychology(psychologyData ? { ...psychologyData } : {});
    setEditingPsychology(true);
  };

  const handleSavePsychologyEdits = async () => {
    if (!createdBrandId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({
          audience_psychology: editedPsychology,
          psychology_status: 'approved',
        })
        .eq('id', createdBrandId);
      if (error) throw error;
      setPsychologyData(editedPsychology);
      setPsychologyStatus('approved');
      setEditingPsychology(false);
      toast.success("Psychology profile updated and approved!");
      setStep(4);
    } catch (error: any) {
      toast.error("Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPsychology = async () => {
    if (!createdBrandId) return;
    setPsychologyStatus("generating");
    setPollingPsychology(true);
    supabase.functions.invoke('generate-audience-psychology', {
      body: { brandId: createdBrandId }
    });
    startPsychologyPolling(createdBrandId);
  };

  const updatePsychologyArrayField = (field: string, value: string) => {
    const items = value.split('\n').filter(item => item.trim());
    setEditedPsychology((prev: any) => ({ ...prev, [field]: items }));
  };

  // Step 4 -> Save copy style settings and go to step 5
  const handleStep4Next = async () => {
    if (!createdBrandId) {
      setStep(5);
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
      setStep(5);
    } catch (error: any) {
      console.error('Error saving copy style:', error);
      toast.error('Failed to save copy style settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishOnboarding = async (destination?: 'create' | 'import') => {
    await refreshBrands();
    if (createdBrandId) {
      const { data: newBrand } = await supabase
        .from('brands')
        .select('id, name, website_url, industry, meta_account_id, created_at')
        .eq('id', createdBrandId)
        .single();
      if (newBrand) setActiveBrand(newBrand);
    }
    toast.success("Welcome to Lumi! ✨");
    
    if (destination === 'create') {
      navigate('/create');
    } else if (destination === 'import') {
      navigate('/data?import=true');
    } else {
      navigate(isAddBrandMode ? "/campaigns" : "/start");
    }
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

  const totalSteps = 6;
  const progressPercentage = (step / totalSteps) * 100;

  const renderPsychologySection = (label: string, icon: React.ReactNode, items: string[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </div>
        <ul className="space-y-1.5 pl-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background via-background to-lumi-purple-1/10">
      <Card variant="gradient" className="w-full max-w-2xl rounded-2xl shadow-elevated">
        <CardHeader className="pb-3">
          <div className="space-y-3 mb-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {step} of {totalSteps}</span>
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
             step === 3 ? "Your Audience Psychology" :
             step === 4 ? "Meet Lumi ✨" :
             step === 5 ? "Connect Meta" :
             "What would you like to do first?"}
          </CardTitle>
          <CardDescription>
            {step === 1 ? "Let's get to know your brand" :
             step === 2 ? "Here's what Lumi found — feel free to tweak anything" :
             step === 3 ? "Review and approve your audience's psychological profile — this powers all your ad copy" :
             step === 4 ? "Your AI-powered Meta Ads assistant" :
             step === 5 ? "Link your Meta ad account to launch campaigns" :
             "Choose your starting point"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 1 ? (
            /* ── Step 1: Brand Basics ── */
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
                  list="industry-suggestions"
                />
                <datalist id="industry-suggestions">
                  <option value="Online Coaching" />
                  <option value="Business Coaching" />
                  <option value="Life Coaching" />
                  <option value="Health & Wellness Coaching" />
                  <option value="Fitness Coaching" />
                  <option value="E-commerce" />
                  <option value="Digital Products" />
                  <option value="Online Courses" />
                  <option value="SaaS" />
                  <option value="Photography" />
                  <option value="Consulting" />
                  <option value="Real Estate" />
                  <option value="Beauty & Skincare" />
                  <option value="Food & Beverage" />
                  <option value="Fashion" />
                  <option value="Home & Decor" />
                  <option value="Finance" />
                  <option value="Legal Services" />
                  <option value="Event Planning" />
                  <option value="Wedding Services" />
                </datalist>
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
            /* ── Step 2: Positioning ── */
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
            /* ── Step 3: Psychology Review ── */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 py-2"
            >
              {(psychologyStatus === 'generating' || pollingPsychology) ? (
                <div className="space-y-6 py-8">
                  <div className="flex justify-center">
                    <SparkleIcon size="xl" state="thinking" glow className="animate-float" />
                  </div>
                  <LumiThinkingInline
                    isOpen={true}
                    customCopy={PSYCHOLOGY_LOADING_COPY}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    Lumi is building a deep psychological profile of your audience. This usually takes 15–30 seconds.
                  </p>
                </div>
              ) : psychologyStatus === 'error' ? (
                <div className="space-y-4 py-4 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    Something went wrong generating your psychology profile.
                  </p>
                  <Button onClick={handleRetryPsychology} variant="lumi">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              ) : editingPsychology && editedPsychology ? (
                /* Editing mode */
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <Label>Pain Points (one per line)</Label>
                    <Textarea
                      value={(editedPsychology.pain_points || []).join('\n')}
                      onChange={(e) => updatePsychologyArrayField('pain_points', e.target.value)}
                      rows={4}
                      placeholder="What keeps them up at night?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Desires (one per line)</Label>
                    <Textarea
                      value={(editedPsychology.desires || []).join('\n')}
                      onChange={(e) => updatePsychologyArrayField('desires', e.target.value)}
                      rows={4}
                      placeholder="What do they dream about?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Objections (one per line)</Label>
                    <Textarea
                      value={(editedPsychology.objections || []).join('\n')}
                      onChange={(e) => updatePsychologyArrayField('objections', e.target.value)}
                      rows={4}
                      placeholder="What stops them from buying?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Motivations</Label>
                    <Textarea
                      value={editedPsychology.motivations || ''}
                      onChange={(e) => setEditedPsychology((prev: any) => ({ ...prev, motivations: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditingPsychology(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSavePsychologyEdits} disabled={loading} variant="lumi" className="flex-1">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Save & Approve
                    </Button>
                  </div>
                </div>
              ) : psychologyData ? (
                /* Review mode */
                <div className="space-y-5">
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-4 max-h-[45vh] overflow-y-auto">
                    {renderPsychologySection("Pain Points", <Heart className="h-4 w-4 text-destructive" />, psychologyData.pain_points)}
                    {renderPsychologySection("Desires", <Sparkles className="h-4 w-4 text-amber-500" />, psychologyData.desires)}
                    {renderPsychologySection("Objections", <AlertCircle className="h-4 w-4 text-orange-500" />, psychologyData.objections)}
                    
                    {psychologyData.motivations && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Zap className="h-4 w-4 text-primary" />
                          Motivations
                        </div>
                        <p className="text-sm text-muted-foreground">{psychologyData.motivations}</p>
                      </div>
                    )}
                    
                    {psychologyData.demographics && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Users className="h-4 w-4 text-primary" />
                          Demographics
                        </div>
                        <p className="text-sm text-muted-foreground">{psychologyData.demographics}</p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    This profile powers all your ad copy. Make sure it sounds like your audience.
                  </p>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <Button variant="outline" onClick={handleEditPsychology} className="gap-1">
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button onClick={handleApprovePsychology} variant="lumi" className="flex-1 gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Looks Good — Approve
                    </Button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          ) : step === 4 ? (
            /* ── Step 4: Meet Lumi ── */
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
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Your Weekly Lumi Digest</h4>
                    <p className="text-sm text-muted-foreground">
                      Every Monday, Lumi sends you a performance recap and tells you exactly what to focus on that week.
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-muted-foreground text-xs mt-1"
                onClick={() => setStep(5)}
              >
                Skip intro →
              </Button>
            </motion.div>
          ) : step === 5 ? (
            /* ── Step 5: Connect Meta ── */
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
                      setShowPostConnectionAnalysis(true);
                    }}
                  />
                </div>
              )}

              {createdBrandId && (
                <PostConnectionAnalysisModal
                  brandId={createdBrandId}
                  open={showPostConnectionAnalysis}
                  onClose={() => {
                    setShowPostConnectionAnalysis(false);
                    setStep(6);
                  }}
                />
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(4)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(6)}
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
          ) : (
            /* ── Step 6: What's Next ── */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 py-4"
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

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">You're all set! 🎉</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how you'd like to get started with Lumi
                </p>
              </div>

              <div className="grid gap-3">
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => handleFinishOnboarding('create')}
                  className="flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="p-3 rounded-xl bg-gradient-lumi shrink-0">
                    <PlusCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">Create a New Ad</h4>
                    <p className="text-sm text-muted-foreground">
                      Start from scratch — Lumi will guide you through strategy, creative, and copy.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary mt-1 shrink-0 transition-transform group-hover:translate-x-1" />
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={() => handleFinishOnboarding('import')}
                  className="flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="p-3 rounded-xl bg-gradient-lumi shrink-0">
                    <Download className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">Import Existing Ads from Meta</h4>
                    <p className="text-sm text-muted-foreground">
                      Already running campaigns? Import them so Lumi can analyze performance and suggest improvements.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary mt-1 shrink-0 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-muted-foreground text-xs"
                onClick={() => setStep(5)}
              >
                <ChevronLeft className="mr-1 h-3 w-3" />
                Back
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
