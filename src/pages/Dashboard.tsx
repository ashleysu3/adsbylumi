import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BrandEditDialog } from "@/components/BrandEditDialog";
import { MetaAccountConnect } from "@/components/MetaAccountConnect";
import { AudiencePsychology } from "@/components/AudiencePsychology";
import { OfferManager } from "@/components/OfferManager";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { Building2, Globe, Target, Edit } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    return localStorage.getItem('onboarding-dismissed') === 'true';
  });

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
        .single();

      if (brandError) throw brandError;
      setBrand(brandData);

      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setSubscription(subData);

      // Fetch offers
      const { data: offersData } = await supabase
        .from("offers")
        .select("*")
        .eq("brand_id", brandData.id)
        .order("created_at", { ascending: false });

      setOffers(offersData || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load brand data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
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
            <h2 className="text-3xl font-bold tracking-tight">
              {brand.name}
            </h2>
            <p className="text-muted-foreground">
              Your brand at a glance
            </p>
          </div>
          {subscription && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {subscription.tier.replace("_", " ").charAt(0).toUpperCase() + subscription.tier.replace("_", " ").slice(1)}
            </Badge>
          )}
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
        <Card>
          <CardHeader>
            <CardTitle>Ready to plan your next campaign?</CardTitle>
            <CardDescription>
              Get a clear strategy and step-by-step plan for your Meta ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="h-12 px-8" onClick={() => window.location.href = "/planning"}>
              Start Planning
            </Button>
          </CardContent>
        </Card>

        {/* Main Content - Single Column */}
        <div className="space-y-6">
          {/* Brand Details Card */}
            <Card data-section="brand-details">
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
                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{brand.meta_account_id}</code>
                      <MetaAccountConnect 
                        brandId={brand.id} 
                        currentAccountId={brand.meta_account_id}
                        onUpdate={fetchBrandData}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Connect your Meta Ad Account to enable campaign creation
                      </p>
                      <MetaAccountConnect 
                        brandId={brand.id} 
                        currentAccountId={brand.meta_account_id}
                        onUpdate={fetchBrandData}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audience Psychology */}
            <AudiencePsychology
              brandId={brand.id}
              psychology={brand.audience_psychology}
              status={brand.psychology_status}
              onUpdate={fetchBrandData}
            />

          {/* Offers Manager */}
          <OfferManager
            brandId={brand.id}
            offers={offers}
            onUpdate={fetchBrandData}
          />
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
