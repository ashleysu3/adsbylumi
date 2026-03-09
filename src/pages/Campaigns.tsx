import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignsList } from "@/components/CampaignsList";
import { ResumeWorkspaceBanner } from "@/components/ResumeWorkspaceBanner";
import { GridShimmer } from "@/components/GradientShimmer";
import { LumiEducationCard } from "@/components/LumiEducationCard";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";


export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBrand, loading: brandLoading } = useBrand();
  

  const isAddCreativeMode = searchParams.get("addCreative") === "true";

  const { data: hasRecentlyLaunchedCampaign } = useQuery({
    queryKey: ["recently-launched-campaign", activeBrand?.id],
    queryFn: async () => {
      if (!activeBrand?.id) return false;
      // Only show if a campaign was published in the last 5 days
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("campaign_workspaces")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", activeBrand.id)
        .not("published_at", "is", null)
        .gte("published_at", fiveDaysAgo);
      return (count ?? 0) > 0;
    },
    enabled: !!activeBrand?.id,
  });

  useEffect(() => {
    if (!brandLoading && !activeBrand) {
      navigate("/onboarding");
    }
  }, [brandLoading, activeBrand]);


  const handleClearAddCreativeMode = () => {
    searchParams.delete("addCreative");
    setSearchParams(searchParams);
  };

  if (brandLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              My <span className="text-gradient-lumi">Campaigns</span>
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

  if (!activeBrand) {
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
              My <span className="text-gradient-lumi">Campaigns</span>
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

        {/* Resume incomplete workspace banner */}
        {!isAddCreativeMode && (
          <ResumeWorkspaceBanner brandId={activeBrand.id} />
        )}

        {/* First live campaign education card — only show when a campaign is actually live */}
        {hasLiveCampaign && (
          <LumiEducationCard
            cardId="first-live-tip"
            headline="Your ad is live! 🎉"
            body="Give it 3–5 days before drawing conclusions. Meta's algorithm needs time to find the right people."
          />
        )}

        <CampaignsList 
          brandId={activeBrand.id} 
          addCreativeMode={isAddCreativeMode}
          onCampaignSelectForCreative={(campaignId) => {
            // Navigate to creative page for this campaign
            navigate(`/creative-studio?workspace=${campaignId}&addCreative=true`);
          }}
        />

      </div>
    </DashboardLayout>
  );
}
