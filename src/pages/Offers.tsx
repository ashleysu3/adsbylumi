import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/DashboardLayout";
import { OfferManager } from "@/components/OfferManager";
import { PageShimmer } from "@/components/GradientShimmer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Offers() {
  const { activeBrand } = useBrand();
  const { getEffectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      if (!activeBrand) {
        setLoading(false);
        return;
      }

      const { data: brandData, error: brandError } = await supabase
        .from("brands")
        .select("id, name")
        .eq("id", activeBrand.id)
        .single();

      if (brandError) throw brandError;
      setBrand(brandData);

      const { data: offersData } = await supabase
        .from("offers")
        .select("*")
        .eq("brand_id", activeBrand.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      setOffers(offersData || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBrand?.id]);

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
            <CardDescription>Set up your brand first to manage offers.</CardDescription>
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
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-display tracking-tight">Offers</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage the products, services, and programs you're promoting.
          </p>
        </div>

        <OfferManager
          brandId={brand.id}
          offers={offers}
          onUpdate={fetchData}
        />
      </div>
    </DashboardLayout>
  );
}
