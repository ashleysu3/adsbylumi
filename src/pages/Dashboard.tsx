import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/DashboardLayout";
import confetti from "canvas-confetti";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BrandEditDialog } from "@/components/BrandEditDialog";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { AudiencePsychology } from "@/components/AudiencePsychology";
import { OfferManager } from "@/components/OfferManager";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { InlineProgressChecklist } from "@/components/InlineProgressChecklist";
import { PageShimmer } from "@/components/GradientShimmer";
import { AlertsBanner } from "@/components/AlertsBanner";
import { useLumiRecommend } from "@/components/LumiAssistant";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
 import { ContentAssetsEditor } from "@/components/ContentAssetsEditor";
 import { BrandOnboardingWizard } from "@/components/BrandOnboardingWizard";
import { Building2, Globe, Target, Edit, CheckCircle2, ChevronDown, Brain, Package, Link, AlertTriangle, Smile, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EmojiSettings {
  use_emojis: boolean;
  brand_emojis: string[];
  bullet_emoji: string;
}

const DEFAULT_EMOJIS = ['✨', '🎯', '💡', '🚀', '💪', '⭐'];
const BULLET_OPTIONS = ['✅', '→', '•', '✓', '▸', '★', '💫', '🔥'];

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setRecommendation } = useLumiRecommend();
  const { getEffectiveUserId, isImpersonating } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    return localStorage.getItem('onboarding-dismissed') === 'true';
  });
  const [progressPopoverOpen, setProgressPopoverOpen] = useState(false);
  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    use_emojis: true,
    brand_emojis: DEFAULT_EMOJIS,
    bullet_emoji: '✅',
  });
  const [newEmoji, setNewEmoji] = useState('');
   const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
   const [activeTab, setActiveTab] = useState('overview');
  const hasShownConfetti = useRef(false);
  const hasHandledCheckout = useRef(false);
  const hasCheckedBrand = useRef(false);
  const hasShownRecommendation = useRef(false);

  // Handle checkout success
  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success" && !hasHandledCheckout.current) {
      hasHandledCheckout.current = true;
      toast.success("Welcome to Lumi! Your subscription is now active.", {
        duration: 5000,
      });
      // Clear the query param
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleDismissChecklist = () => {
    setChecklistDismissed(true);
    localStorage.setItem('onboarding-dismissed', 'true');
    toast.success("You can always re-enable the checklist from settings");
  };

  useEffect(() => {
    fetchBrandData();
    
    // Setup realtime subscription for brand updates
    const channel = supabase
      .channel('brand-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'brands'
        },
        (payload) => {
          console.log('Brand updated:', payload);
          if (payload.new.id === brand?.id) {
            setBrand(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [brand?.id]);

  // Trigger confetti when profile reaches 100% completion
  useEffect(() => {
    if (!brand || !offers) return;
    
    const progress = calculateBrandProgress();
    const confettiShownKey = `confetti-shown-${brand.id}`;
    const hasShownBefore = localStorage.getItem(confettiShownKey) === 'true';
    
    if (progress.percentage === 100 && !hasShownBefore && !hasShownConfetti.current) {
      hasShownConfetti.current = true;
      
      // Delay slightly to ensure UI has updated
      setTimeout(() => {
        // Fire confetti from multiple angles
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          const particleCount = 50 * (timeLeft / duration);
          
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          });
        }, 250);

        // Store that confetti was shown
        localStorage.setItem(confettiShownKey, 'true');
        toast.success("🎉 Profile Complete! You're ready to create amazing campaigns!");
      }, 300);
    }
  }, [brand, offers]);

  const calculateBrandProgress = () => {
    const checks = [
      !!(brand?.name && brand?.website_url && brand?.industry), // Brand basics
      !!(brand?.value_proposition && brand?.target_audience),   // Positioning
      brand?.psychology_status === "approved",                   // Psychology approved
      offers.length > 0,                                         // Has offers
      !!brand?.meta_account_id                                   // Meta connected
    ];
    
    const completed = checks.filter(Boolean).length;
    const total = checks.length;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  };

  const getIncompleteItems = () => {
    const items = [];
    
    if (!(brand?.name && brand?.website_url && brand?.industry)) {
      items.push({ label: "Complete brand basics", section: "brand-details", icon: Building2 });
    }
    if (!(brand?.value_proposition && brand?.target_audience)) {
      items.push({ label: "Add positioning details", section: "brand-details", icon: Target });
    }
    if (brand?.psychology_status !== "approved") {
      items.push({ label: "Approve audience psychology", section: "audience-psychology", icon: Brain });
    }
    if (offers.length === 0) {
      items.push({ label: "Add your first offer", section: "offers", icon: Package });
    }
    if (!brand?.meta_account_id) {
      items.push({ label: "Connect Meta ad account", section: "meta-account", icon: Link });
    }
    
    return items;
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.querySelector(`[data-section="${sectionId}"]`);
    if (element) {
      setProgressPopoverOpen(false);
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      
      // Add pulse animation to highlight the section
      setTimeout(() => {
        element.classList.add('animate-pulse');
        setTimeout(() => element.classList.remove('animate-pulse'), 1000);
      }, 500);
    }
  };

  const fetchBrandData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use effective user ID for impersonation support
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      // Fetch user's first brand (use effective ID for admins impersonating)
      const { data: brandData, error: brandError } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no brand exists and we haven't redirected yet, send to onboarding
      // Don't redirect when impersonating - the impersonated user may not have a brand
      if (!brandData && !hasCheckedBrand.current && !isImpersonating) {
        hasCheckedBrand.current = true;
        navigate("/onboarding");
        return;
      }

      if (brandError) throw brandError;
      setBrand(brandData);
      
      // Load emoji settings from brand
      if (brandData) {
        setEmojiSettings({
          use_emojis: brandData.use_emojis ?? true,
          brand_emojis: brandData.brand_emojis ?? DEFAULT_EMOJIS,
          bullet_emoji: brandData.bullet_emoji ?? '✅',
        });
      }

      // Fetch subscription (use effective user ID)
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", effectiveUserId)
        .single();

      setSubscription(subData);

      // Fetch offers (exclude archived)
      if (brandData) {
        const { data: offersData } = await supabase
          .from("offers")
          .select("*")
          .eq("brand_id", brandData.id)
          .eq("archived", false)
          .order("created_at", { ascending: false });

        setOffers(offersData || []);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load brand data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmojiSettings = async () => {
    if (!brand) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ 
          use_emojis: emojiSettings.use_emojis,
          brand_emojis: emojiSettings.brand_emojis,
          bullet_emoji: emojiSettings.bullet_emoji,
        })
        .eq('id', brand.id);

      if (error) throw error;
      toast.success('Emoji settings saved');
    } catch (error) {
      console.error('Error saving emoji settings:', error);
      toast.error('Failed to save emoji settings');
    } finally {
      setSaving(false);
    }
  };

  const addEmoji = () => {
    if (!newEmoji.trim()) return;
    if (emojiSettings.brand_emojis.length >= 6) {
      toast.error('Maximum 6 emojis allowed');
      return;
    }
    if (emojiSettings.brand_emojis.includes(newEmoji.trim())) {
      toast.error('Emoji already added');
      return;
    }
    setEmojiSettings(prev => ({
      ...prev,
      brand_emojis: [...prev.brand_emojis, newEmoji.trim()]
    }));
    setNewEmoji('');
  };

  const removeEmoji = (emoji: string) => {
    setEmojiSettings(prev => ({
      ...prev,
      brand_emojis: prev.brand_emojis.filter(e => e !== emoji)
    }));
  };

   // Show onboarding wizard for incomplete profiles (only once per session)
   useEffect(() => {
     if (!loading && brand) {
       const wizardDismissedKey = `brand-wizard-dismissed-${brand.id}`;
       const wasRecentlyDismissed = localStorage.getItem(wizardDismissedKey);
       
       // Show wizard if profile is incomplete and not recently dismissed
       const progress = calculateBrandProgress();
       if (progress.percentage < 100 && !wasRecentlyDismissed) {
         // Delay slightly to let the page render
         const timer = setTimeout(() => setShowOnboardingWizard(true), 500);
         return () => clearTimeout(timer);
       }
     }
   }, [loading, brand?.id]);
 
   const handleWizardDismiss = () => {
     setShowOnboardingWizard(false);
     if (brand) {
       localStorage.setItem(`brand-wizard-dismissed-${brand.id}`, 'true');
     }
   };
 
   const handleWizardNavigateToTab = (tab: string) => {
     setActiveTab(tab);
   };
 
   const handleWizardComplete = () => {
     setShowOnboardingWizard(false);
     if (brand) {
       localStorage.setItem(`brand-wizard-dismissed-${brand.id}`, 'true');
     }
   };
 
  // Show contextual recommendation based on incomplete items
  useEffect(() => {
    if (!loading && brand && !hasShownRecommendation.current) {
      hasShownRecommendation.current = true;
      const incompleteItems = getIncompleteItems();
      
      if (incompleteItems.length > 0) {
        const firstIncomplete = incompleteItems[0];
        setRecommendation({
          id: `dashboard-${firstIncomplete.section}`,
          title: "Lumi recommends",
          message: `${firstIncomplete.label} to unlock better campaign recommendations and creative.`,
          actionLabel: "Let's do it",
          onAction: () => scrollToSection(firstIncomplete.section),
        });
      } else if (!brand.meta_account_id) {
        setRecommendation({
          id: "dashboard-meta",
          title: "Lumi recommends",
          message: "Connect your Meta ad account to start building and launching campaigns directly from Lumi!",
          actionLabel: "Connect Meta",
          onAction: () => scrollToSection("meta-account"),
        });
      }
    }
  }, [loading, brand, offers]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>No Brand Found</CardTitle>
            <CardDescription>
              It looks like you haven't set up a brand yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = "/onboarding"}>
              Set Up Brand
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-display tracking-tight">
              {brand.name}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Your Lumi Home — everything about your brand at a glance.
            </p>
          </div>
          {calculateBrandProgress().percentage === 100 && (
            <Badge 
              variant="outline"
              className="text-xs md:text-sm px-2 md:px-3 py-1 border-green-500 text-green-700 dark:text-green-400 self-start"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Profile Complete
            </Badge>
          )}
        </div>

        {/* Inline Progress Checklist - more prominent than popover */}
        {calculateBrandProgress().percentage < 100 && (
          <InlineProgressChecklist 
            brand={brand}
            offers={offers}
            onScrollToSection={scrollToSection}
          />
        )}

        {/* System Alerts */}
        <AlertsBanner />

        {/* Detailed Onboarding Checklist (collapsible) */}
        {!checklistDismissed && (
          <OnboardingChecklist
            brand={brand}
            offers={offers}
            onEditBrand={() => setEditDialogOpen(true)}
            onDismiss={handleDismissChecklist}
          />
        )}

        {/* Tabs Navigation */}
         <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <Building2 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="brand-copy" className="gap-2">
              <Smile className="h-4 w-4" />
              Brand Copy
            </TabsTrigger>
            <TabsTrigger value="psychology" className="gap-2">
              <Brain className="h-4 w-4" />
              Audience Psychology
            </TabsTrigger>
            <TabsTrigger value="offers" className="gap-2">
              <Package className="h-4 w-4" />
              Offers
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Brand Details Card */}
            <Card variant="glow" data-section="brand-details">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle>Brand Details</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {brand.website_url && (
                  <div className="flex items-start space-x-3">
                    <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a
                        href={brand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {brand.website_url}
                      </a>
                    </div>
                  </div>
                )}
                
                {brand.industry && (
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Industry</p>
                      <p className="text-sm text-muted-foreground">{brand.industry}</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t" data-section="meta-account">
                  <p className="text-sm font-medium mb-2">Meta Ad Account</p>
                  {brand.meta_account_id ? (
                    <div className="space-y-3">
                      {brand.meta_token_expires_at && new Date(brand.meta_token_expires_at) < new Date() && (
                        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-destructive">Connection Expired</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Your Meta access has expired. Reconnect to continue syncing campaigns.
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{brand.meta_account_id}</code>
                          {brand.page_name && (
                            <p className="text-xs text-muted-foreground">Page: {brand.page_name}</p>
                          )}
                        </div>
                        <MetaAccountConnect 
                          brandId={brand.id} 
                          currentAccountId={brand.meta_account_id}
                          currentPageId={brand.page_id}
                          currentPageName={brand.page_name}
                          tokenExpired={brand.meta_token_expires_at ? new Date(brand.meta_token_expires_at) < new Date() : false}
                          onUpdate={fetchBrandData}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Connect your Meta Ad Account to enable campaign creation
                      </p>
                      <MetaAccountConnect 
                        brandId={brand.id} 
                        currentAccountId={brand.meta_account_id}
                        currentPageId={brand.page_id}
                        currentPageName={brand.page_name}
                        onUpdate={fetchBrandData}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand Copy Tab */}
          <TabsContent value="brand-copy" className="space-y-6">
             {/* Content Assets Editor - at the top */}
             <ContentAssetsEditor 
               brandId={brand.id} 
               offers={offers.map(o => ({ id: o.id, name: o.name }))} 
             />
             
             {/* Emoji Settings */}
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5" />
                  Emoji Preferences
                </CardTitle>
                <CardDescription>
                  Control how emojis are used in your AI-generated ad copy. Meta recommends strategic emoji use for higher engagement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Use Emojis in Copy</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable emoji usage in generated headlines, descriptions, and primary copy
                    </p>
                  </div>
                  <Switch
                    checked={emojiSettings.use_emojis}
                    onCheckedChange={(checked) => setEmojiSettings(prev => ({ ...prev, use_emojis: checked }))}
                  />
                </div>
                
                {emojiSettings.use_emojis && (
                  <>
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-base">Your Brand Emojis</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose up to 6 emojis that represent your brand. These will be used in your ad copy.
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {emojiSettings.brand_emojis.map((emoji) => (
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
                      
                      {emojiSettings.brand_emojis.length < 6 && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <EmojiQuickPicker 
                            onSelect={(emoji) => {
                              if (emojiSettings.brand_emojis.length >= 6) {
                                toast.error('Maximum 6 emojis allowed');
                                return;
                              }
                              if (emojiSettings.brand_emojis.includes(emoji)) {
                                toast.error('Emoji already added');
                                return;
                              }
                              setEmojiSettings(prev => ({
                                ...prev,
                                brand_emojis: [...prev.brand_emojis, emoji]
                              }));
                            }}
                            selectedEmojis={emojiSettings.brand_emojis}
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
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-base">Bullet Point Style</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose the emoji or symbol used for bullet points in your primary copy
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {BULLET_OPTIONS.map((bullet) => (
                          <Button
                            key={bullet}
                            variant={emojiSettings.bullet_emoji === bullet ? "default" : "outline"}
                            size="sm"
                            onClick={() => setEmojiSettings(prev => ({ ...prev, bullet_emoji: bullet }))}
                            className="text-lg w-10 h-10 p-0"
                          >
                            {bullet}
                          </Button>
                        ))}
                      </div>
                      
                      <div className="bg-muted/50 rounded-lg p-4 border">
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Preview</p>
                        <div className="space-y-1 text-sm">
                          <p>{emojiSettings.bullet_emoji} Stop wasting time on ads that don't convert</p>
                          <p>{emojiSettings.bullet_emoji} Get AI-powered creative that actually works</p>
                          <p>{emojiSettings.bullet_emoji} Launch campaigns in minutes, not days</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="pt-4">
                  <Button onClick={handleSaveEmojiSettings} disabled={saving} variant="lumi">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Emoji Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Meta Best Practices for Copy</CardTitle>
                <CardDescription>How Lumi formats your primary copy based on Meta's recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">✓ What Lumi Does</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Uses line breaks for readability</li>
                      <li>• Adds strategic emoji placement</li>
                      <li>• Creates scannable bullet lists</li>
                      <li>• Varies copy lengths (short/medium/long)</li>
                      <li>• Puts the hook first, CTA last</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">✗ What Lumi Avoids</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Emoji overload (max 2-3 per section)</li>
                      <li>• Wall-of-text paragraphs</li>
                      <li>• ALL CAPS abuse</li>
                      <li>• Clickbait or misleading claims</li>
                      <li>• Generic, non-specific language</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audience Psychology Tab */}
          <TabsContent value="psychology" className="space-y-6">
            <div data-section="audience-psychology">
              <AudiencePsychology
                brandId={brand.id}
                psychology={brand.audience_psychology}
                status={brand.psychology_status}
                onUpdate={fetchBrandData}
              />
            </div>
          </TabsContent>

          {/* Offers Tab */}
          <TabsContent value="offers" className="space-y-6">
            <div data-section="offers">
              <OfferManager
                brandId={brand.id}
                offers={offers}
                onUpdate={fetchBrandData}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BrandEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        brand={brand}
        onUpdate={fetchBrandData}
      />
 
       {/* Onboarding Wizard Overlay */}
       {showOnboardingWizard && (
         <BrandOnboardingWizard
           brand={brand}
           offers={offers}
           onDismiss={handleWizardDismiss}
           onNavigateToTab={handleWizardNavigateToTab}
           onEditBrand={() => setEditDialogOpen(true)}
           onComplete={handleWizardComplete}
         />
       )}
    </DashboardLayout>
  );
}
