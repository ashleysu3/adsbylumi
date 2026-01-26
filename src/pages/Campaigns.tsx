import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignsList } from "@/components/CampaignsList";
import { GridShimmer } from "@/components/GradientShimmer";
import { toast } from "sonner";
import { LumiChat } from "@/components/LumiChat";

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getEffectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [showLumiGuidance, setShowLumiGuidance] = useState(false);

  const isAddCreativeMode = searchParams.get("addCreative") === "true";

  useEffect(() => {
    fetchBrand();
  }, []);

  useEffect(() => {
    // Show Lumi guidance when in add creative mode
    if (isAddCreativeMode && brandId) {
      setShowLumiGuidance(true);
    }
  }, [isAddCreativeMode, brandId]);

  const fetchBrand = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Use effective user ID for impersonation support
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const { data: brandData, error } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (brandData) {
        setBrandId(brandData.id);
        setBrand(brandData);
      }
    } catch (error: any) {
      toast.error("Failed to load brand data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAddCreativeMode = () => {
    searchParams.delete("addCreative");
    setSearchParams(searchParams);
    setShowLumiGuidance(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              My <span className="text-gradient-lumi">Ads</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Loading your ads...
            </p>
          </div>
          <GridShimmer count={4} className="grid-cols-1 md:grid-cols-2" />
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              My <span className="text-gradient-lumi">Ads</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              {isAddCreativeMode 
                ? "Select an ad to add new creative to" 
                : "Your ads in progress and live"}
            </p>
          </div>
          {isAddCreativeMode && (
            <button 
              onClick={handleClearAddCreativeMode}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        <CampaignsList 
          brandId={brandId} 
          addCreativeMode={isAddCreativeMode}
          onCampaignSelectForCreative={(campaignId) => {
            // Navigate to creative page for this campaign
            navigate(`/creative?workspace=${campaignId}&addCreative=true`);
          }}
        />

        {/* Lumi Chat guidance for add creative mode */}
        {showLumiGuidance && brand && (
          <LumiChat 
            context="add-creative" 
            brand={brand}
            trigger={null}
            autoOpen={true}
            onOpenChange={(open) => {
              if (!open) setShowLumiGuidance(false);
            }}
            customStarters={[
              { label: "Help me choose", message: "Help me pick the best campaign to add new creative to based on performance." },
              { label: "New creative idea", message: "I want to brainstorm a fresh creative angle before uploading." },
              { label: "Go straight to upload", message: "I already have my creative ready. Walk me through the upload process." },
              { label: "What performs best?", message: "What types of creative are performing best right now?" },
            ]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
