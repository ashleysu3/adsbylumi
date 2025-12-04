import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignsList } from "@/components/CampaignsList";
import { LumiLoader } from "@/components/LumiLoader";
import { toast } from "sonner";

export default function Campaigns() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brandId, setBrandId] = useState<string | null>(null);

  useEffect(() => {
    fetchBrand();
  }, []);

  const fetchBrand = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: brandData, error } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setBrandId(brandData.id);
    } catch (error: any) {
      toast.error("Failed to load brand data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LumiLoader size="lg" message="Loading your campaigns..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!brandId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No brand found. Please set up your brand first.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">My Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Active and draft campaign workspaces
          </p>
        </div>

        <CampaignsList brandId={brandId} />
      </div>
    </DashboardLayout>
  );
}
