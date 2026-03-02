import { useState, useEffect } from "react";
import { Package, Sparkles, ArrowRight, EyeOff, Zap, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UnlinkedCampaignsBannerProps {
  campaigns: Array<{ id: string; name: string; offerId?: string | null; status?: string; brandId?: string; [key: string]: any }>;
  onLinkOffer: (campaign: any) => void;
  brandId?: string;
}

function getIgnoredKey(brandId?: string) {
  return `lumi_ignored_campaigns_${brandId || "default"}`;
}

function getIgnoredCampaigns(brandId?: string): string[] {
  try {
    const stored = localStorage.getItem(getIgnoredKey(brandId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setIgnoredCampaigns(ids: string[], brandId?: string) {
  localStorage.setItem(getIgnoredKey(brandId), JSON.stringify(ids));
}

export function UnlinkedCampaignsBanner({ campaigns, onLinkOffer, brandId }: UnlinkedCampaignsBannerProps) {
  const [ignoredIds, setIgnoredIds] = useState<string[]>(() => getIgnoredCampaigns(brandId));

  useEffect(() => {
    setIgnoredIds(getIgnoredCampaigns(brandId));
  }, [brandId]);

  const activeCampaigns = campaigns.filter(
    (c) => (c.status === "active" || c.status === "live") && !c.offerId && !ignoredIds.includes(c.id)
  );

  const handleIgnore = (campaignId: string) => {
    const updated = [...ignoredIds, campaignId];
    setIgnoredIds(updated);
    setIgnoredCampaigns(updated, brandId);
  };

  const handleMarkNonOffer = (campaignId: string) => {
    // Non-offer strategies are also ignored from the banner
    const updated = [...ignoredIds, campaignId];
    setIgnoredIds(updated);
    setIgnoredCampaigns(updated, brandId);
  };

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
            Link an offer, mark as a non-offer strategy, or tell Lumi to ignore it.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {activeCampaigns.slice(0, 3).map((campaign) => (
              <DropdownMenu key={campaign.id}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span className="max-w-[180px] truncate">{campaign.name}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => onLinkOffer(campaign)} className="gap-2 cursor-pointer">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Link an Offer</p>
                      <p className="text-xs text-muted-foreground">Connect to a product or service</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMarkNonOffer(campaign.id)} className="gap-2 cursor-pointer">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">Non-Offer Strategy</p>
                      <p className="text-xs text-muted-foreground">Brand awareness, traffic, etc.</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleIgnore(campaign.id)} className="gap-2 cursor-pointer">
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Ignore This Campaign</p>
                      <p className="text-xs text-muted-foreground">Running outside Lumi's strategies</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
