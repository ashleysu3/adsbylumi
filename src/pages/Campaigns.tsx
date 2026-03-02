import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { CampaignsList } from "@/components/CampaignsList";
import { ResumeWorkspaceBanner } from "@/components/ResumeWorkspaceBanner";
import { GridShimmer } from "@/components/GradientShimmer";
import { toast } from "sonner";


export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBrand, loading: brandLoading } = useBrand();
  

  const isAddCreativeMode = searchParams.get("addCreative") === "true";

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
