import { Package, Sparkles, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface UnlinkedCampaignsBannerProps {
  campaigns: Array<{ id: string; name: string; offerId?: string | null; status?: string; [key: string]: any }>;
  onLinkOffer: (campaign: any) => void;
}

export function UnlinkedCampaignsBanner({ campaigns, onLinkOffer }: UnlinkedCampaignsBannerProps) {
  const activeCampaigns = campaigns.filter(
    (c) => (c.status === "active" || c.status === "live") && !c.offerId
  );

  if (activeCampaigns.length === 0) return null;

  return (
    <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <AlertDescription className="text-sm font-medium text-foreground">
            {activeCampaigns.length === 1
              ? `"${activeCampaigns[0].name}" is running without a linked offer`
              : `${activeCampaigns.length} active campaigns don't have an offer linked`}
          </AlertDescription>
          <p className="text-xs text-muted-foreground">
            Link an offer so Lumi can generate creative, track results by product, and give smarter recommendations.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {activeCampaigns.slice(0, 3).map((campaign) => (
              <Button
                key={campaign.id}
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5 h-8"
                onClick={() => onLinkOffer(campaign)}
              >
                <Sparkles className="h-3 w-3" />
                {activeCampaigns.length === 1 ? "Link or Auto-Create Offer" : campaign.name}
                <ArrowRight className="h-3 w-3" />
              </Button>
            ))}
            {activeCampaigns.length > 3 && (
              <span className="text-xs text-muted-foreground self-center">
                +{activeCampaigns.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}
