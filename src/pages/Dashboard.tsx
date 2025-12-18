import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import confetti from "canvas-confetti";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandEditDialog } from "@/components/BrandEditDialog";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { AudiencePsychology } from "@/components/AudiencePsychology";
import { OfferManager } from "@/components/OfferManager";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { PageShimmer } from "@/components/GradientShimmer";
import { useLumiRecommend } from "@/components/LumiAssistant";
import { Building2, Globe, Target, Edit, CheckCircle2, ChevronDown, Brain, Package, Link, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setRecommendation } = useLumiRecommend();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    return localStorage.getItem('onboarding-dismissed') === 'true';
  });
  const [progressPopoverOpen, setProgressPopoverOpen] = useState(false);
  const hasShownConfetti = useRef(false);
  const hasHandledCheckout = useRef(false);
  const hasCheckedBrand = useRef(false);
  const hasShownRecommendation = useRef(false);

  // Handle checkout success
  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success" && !hasHandledCheckout.current) {
      hasHandledCheckout.current = true;
      toast.success("Welcome to Lumi! Your 14-day free trial has started.", {
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

      // Fetch user's first brand
      const { data: brandData, error: brandError } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no brand exists and we haven't redirected yet, send to onboarding
      if (!brandData && !hasCheckedBrand.current) {
        hasCheckedBrand.current = true;
        navigate("/onboarding");
        return;
      }

      if (brandError) throw brandError;
      setBrand(brandData);

      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
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
      <div className="space-y-8">
        {/* Brand Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-display tracking-tight">
              {brand.name}
            </h2>
            <p className="text-muted-foreground">
              Your Lumi Home — everything about your brand at a glance.
            </p>
          </div>
          <Popover open={progressPopoverOpen} onOpenChange={setProgressPopoverOpen}>
            <PopoverTrigger asChild>
              <Badge 
                variant={
                  calculateBrandProgress().percentage === 100 ? "outline" : 
                  calculateBrandProgress().percentage >= 80 ? "default" : 
                  calculateBrandProgress().percentage >= 40 ? "secondary" : 
                  "destructive"
                }
                className={cn(
                  "text-sm px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity",
                  calculateBrandProgress().percentage === 100 && "border-green-500 text-green-700 dark:text-green-400"
                )}
              >
                {calculateBrandProgress().percentage === 100 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Profile Complete
                  </>
                ) : (
                  <>
                    {`${calculateBrandProgress().percentage}% Complete`}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Badge>
            </PopoverTrigger>
            {calculateBrandProgress().percentage < 100 && (
              <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground mb-3">Complete your profile:</p>
                  {getIncompleteItems().map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => scrollToSection(item.section)}
                        className="w-full flex items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-2 rounded transition-colors group"
                      >
                        <Icon className="h-4 w-4 flex-shrink-0 group-hover:text-primary transition-colors" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            )}
          </Popover>
        </div>

        {/* Onboarding Checklist */}
        {!checklistDismissed && (
          <OnboardingChecklist
            brand={brand}
            offers={offers}
            onEditBrand={() => setEditDialogOpen(true)}
            onDismiss={handleDismissChecklist}
          />
        )}

        {/* Campaign Planning Card */}
        <Card variant="gradient" className="rounded-2xl bg-gradient-to-br from-background to-lumi-purple-1/5">
          <CardHeader>
            <CardTitle className="font-display text-gradient-lumi">Ready to shine? ✨</CardTitle>
            <CardDescription>
              Lumi will guide you through creating a clear strategy for your next Meta campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="h-12 px-8" variant="lumi" onClick={() => window.location.href = "/planning"}>
              Start with Lumi Strategy
            </Button>
          </CardContent>
        </Card>

        {/* Main Content - Single Column */}
        <div className="space-y-6">
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
                      {/* Check if token might be expired */}
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

            {/* Audience Psychology */}
            <div data-section="audience-psychology">
              <AudiencePsychology
                brandId={brand.id}
                psychology={brand.audience_psychology}
                status={brand.psychology_status}
                onUpdate={fetchBrandData}
              />
            </div>

          {/* Offers Manager */}
          <div data-section="offers">
            <OfferManager
              brandId={brand.id}
              offers={offers}
              onUpdate={fetchBrandData}
            />
          </div>
        </div>
      </div>

      <BrandEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        brand={brand}
        onUpdate={fetchBrandData}
      />
    </DashboardLayout>
  );
}
