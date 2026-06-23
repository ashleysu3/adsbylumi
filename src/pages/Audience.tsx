import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShimmer } from "@/components/GradientShimmer";
import { AudiencePsychology } from "@/components/AudiencePsychology";
import { Users } from "lucide-react";
import { toast } from "sonner";

export default function Audience() {
  const { getEffectiveUserId } = useImpersonation();
  const { activeBrand: contextBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);

  useEffect(() => {
    fetchBrand();
  }, [contextBrand?.id]);

  const fetchBrand = async () => {
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
    } catch (err: any) {
      toast.error(err.message || "Failed to load audience");
    } finally {
      setLoading(false);
    }
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
            <CardTitle>No Brand Found</CardTitle>
            <CardDescription>Set up your brand first to work on audience psychology.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display tracking-tight text-foreground">Audience</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              The people your ads should reach — and the psychology that moves them.
            </p>
          </div>
        </div>

        <AudiencePsychology
          brandId={brand.id}
          psychology={brand.audience_psychology}
          status={brand.psychology_status}
          psychologyContentHash={brand.psychology_content_hash}
          psychologyGeneratedAt={brand.psychology_generated_at}
          onUpdate={fetchBrand}
        />
      </div>
    </DashboardLayout>
  );
}
