import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShimmer } from "@/components/GradientShimmer";
import { InlineProgressChecklist } from "@/components/InlineProgressChecklist";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { BrandEditDialog } from "@/components/BrandEditDialog";
import { PenLine, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function InitialSetup() {
  const navigate = useNavigate();
  const { getEffectiveUserId } = useImpersonation();
  const { activeBrand: contextBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [contextBrand?.id]);

  const fetchData = async () => {
    setLoading(true);
    setBrand(null);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;
      let brandData: any = null;
      if (contextBrand) {
        const { data } = await supabase.from("brands").select("*").eq("id", contextBrand.id).maybeSingle();
        brandData = data;
      } else {
        const { data } = await supabase
          .from("brands")
          .select("*")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brandData = data;
      }
      setBrand(brandData);
      if (brandData) {
        const { data: offersData } = await supabase
          .from("offers")
          .select("*")
          .eq("brand_id", brandData.id)
          .eq("archived", false);
        setOffers(offersData || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load setup");
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    if (sectionId === "offers") return navigate("/offers");
    if (sectionId === "meta-account") return navigate("/meta-settings");
    if (sectionId === "audience-psychology") return navigate("/audience");
    if (sectionId === "brand-details") return setEditDialogOpen(true);
    const el = document.querySelector(`[data-section="${sectionId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
            <CardTitle>Let's get you set up</CardTitle>
            <CardDescription>Walk through the brand wizard to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/onboarding")}>
              Start Setup
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <PenLine className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-display tracking-tight text-foreground">Initial Setup</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Finish setting up your brand so LUMI can do its best work.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/onboarding")}>
            Re-run setup wizard
          </Button>
        </div>

        <InlineProgressChecklist brand={brand} offers={offers} onScrollToSection={scrollToSection} />

        <OnboardingChecklist brand={brand} offers={offers} onEditBrand={() => setEditDialogOpen(true)} />
      </div>

      <BrandEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        brand={brand}
        onUpdate={fetchData}
      />
    </DashboardLayout>
  );
}
