import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowRight, Zap } from "lucide-react";

interface UnlinkedCampaign {
  id: string;
  name: string;
  meta_campaign_status: string | null;
}

interface LinkNewOfferToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  offerId: string;
  offerName: string;
  offerDescription?: string | null;
  offerPrice?: string | null;
  offerUrl?: string | null;
}

export function LinkNewOfferToCampaignDialog({
  open,
  onOpenChange,
  brandId,
  offerId,
  offerName,
  offerDescription,
  offerPrice,
  offerUrl,
}: LinkNewOfferToCampaignDialogProps) {
  const [campaigns, setCampaigns] = useState<UnlinkedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (open) fetchUnlinkedCampaigns();
  }, [open, brandId]);

  const fetchUnlinkedCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("id, name, meta_campaign_status")
        .eq("brand_id", brandId)
        .is("offer_id", null)
        .not("meta_campaign_ids", "is", null)
        .in("meta_campaign_status", ["active", "live"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter out draft/simulated IDs
      const real = (data || []).filter((w) => {
        const ids = (w as any).meta_campaign_ids;
        const campaignId = ids?.campaignId;
        if (!campaignId) return false;
        if (typeof campaignId === "string" && campaignId.includes("_")) {
          const parts = campaignId.split("_");
          const ts = parseInt(parts[parts.length - 1]);
          const now = Date.now();
          if (ts > now - 365 * 24 * 60 * 60 * 1000 && ts <= now) return false;
        }
        return true;
      });

      setCampaigns(real);
    } catch (err) {
      console.error("Error fetching unlinked campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedId) return;
    setLinking(true);
    try {
      const { data: brandData } = await supabase
        .from("brands")
        .select("brand_voice, target_audience, audience_psychology")
        .eq("id", brandId)
        .single();

      const minimalStrategy = {
        offer: {
          name: offerName,
          description: offerDescription,
          price: offerPrice,
          url: offerUrl,
        },
        brand_voice: brandData?.brand_voice,
        target_audience: brandData?.target_audience,
        audience_psychology: brandData?.audience_psychology,
        source: "offer_creation_link",
        linked_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("campaign_workspaces")
        .update({
          offer_id: offerId,
          offer_name: offerName,
          offer_description: offerDescription,
          offer_price: offerPrice,
          offer_url: offerUrl,
          strategy_json: minimalStrategy,
        })
        .eq("id", selectedId);

      if (error) throw error;

      const camp = campaigns.find((c) => c.id === selectedId);
      toast.success(`Linked "${offerName}" to ${camp?.name || "campaign"}`);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error linking offer to campaign:", err);
      toast.error("Failed to link offer");
    } finally {
      setLinking(false);
    }
  };

  // Auto-close if no unlinked campaigns
  useEffect(() => {
    if (!loading && campaigns.length === 0 && open) {
      onOpenChange(false);
    }
  }, [loading, campaigns.length, open]);

  if (!open || (!loading && campaigns.length === 0)) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Link to a Live Campaign?
          </DialogTitle>
          <DialogDescription>
            You have {campaigns.length === 1 ? "a live campaign" : `${campaigns.length} live campaigns`} without an offer linked. Want to connect <span className="font-medium text-foreground">{offerName}</span> to one?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RadioGroup
              value={selectedId}
              onValueChange={setSelectedId}
              className="space-y-2"
            >
              {campaigns.map((c) => (
                <Label
                  key={c.id}
                  htmlFor={`camp-${c.id}`}
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all hover:border-primary/50 ${
                    selectedId === c.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem value={c.id} id={`camp-${c.id}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{c.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                    Live
                  </Badge>
                </Label>
              ))}
            </RadioGroup>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleLink} disabled={linking || !selectedId}>
            {linking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                Link Offer
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
