import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Package, Plus, ArrowRight } from "lucide-react";
import { OfferDialog } from "@/components/OfferDialog";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  price_point: string | null;
  url: string | null;
  product_psychology: any;
}

interface LinkOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  brandId: string;
  onSuccess: (offer: Offer) => void;
}

export function LinkOfferModal({ 
  open, 
  onOpenChange, 
  workspaceId, 
  workspaceName,
  brandId,
  onSuccess 
}: LinkOfferModalProps) {
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [fetchingOffers, setFetchingOffers] = useState(true);

  useEffect(() => {
    if (open) {
      fetchOffers();
    }
  }, [open, brandId]);

  const fetchOffers = async () => {
    setFetchingOffers(true);
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('id, name, description, price_point, url, product_psychology')
        .eq('brand_id', brandId)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (error: any) {
      console.error('Error fetching offers:', error);
      toast.error("Failed to load offers");
    } finally {
      setFetchingOffers(false);
    }
  };

  const handleLink = async () => {
    if (!selectedOfferId) {
      toast.error("Please select an offer");
      return;
    }

    setLoading(true);
    try {
      const selectedOffer = offers.find(o => o.id === selectedOfferId);
      if (!selectedOffer) throw new Error("Offer not found");

      // Fetch brand data for minimal strategy
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('brand_voice, target_audience, audience_psychology')
        .eq('id', brandId)
        .single();

      if (brandError) throw brandError;

      // Create minimal strategy JSON for imported campaigns
      const minimalStrategy = {
        offer: {
          name: selectedOffer.name,
          description: selectedOffer.description,
          price: selectedOffer.price_point,
          url: selectedOffer.url,
          product_psychology: selectedOffer.product_psychology,
        },
        brand_voice: brandData?.brand_voice,
        target_audience: brandData?.target_audience,
        audience_psychology: brandData?.audience_psychology,
        source: 'imported_campaign',
        linked_at: new Date().toISOString(),
      };

      // Update the workspace with the linked offer
      const { error: updateError } = await supabase
        .from('campaign_workspaces')
        .update({
          offer_id: selectedOffer.id,
          offer_name: selectedOffer.name,
          offer_description: selectedOffer.description,
          offer_price: selectedOffer.price_point,
          offer_url: selectedOffer.url,
          strategy_json: minimalStrategy,
        })
        .eq('id', workspaceId);

      if (updateError) throw updateError;

      toast.success(`Linked "${selectedOffer.name}" to this campaign`);
      onSuccess(selectedOffer);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error linking offer:', error);
      toast.error("Failed to link offer");
    } finally {
      setLoading(false);
    }
  };

  const handleOfferCreated = () => {
    setShowCreateOffer(false);
    fetchOffers();
    toast.success("Offer created! Now select it to link.");
  };

  if (showCreateOffer) {
    return (
      <OfferDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) setShowCreateOffer(false);
        }}
        brandId={brandId}
        onSuccess={handleOfferCreated}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Link an Offer
          </DialogTitle>
          <DialogDescription>
            Connect "{workspaceName}" to one of your offers to enable creative generation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fetchingOffers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">No offers yet</p>
                <p className="text-sm text-muted-foreground">
                  Create an offer first to link it to this campaign
                </p>
              </div>
              <Button onClick={() => setShowCreateOffer(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Offer
              </Button>
            </div>
          ) : (
            <>
              <Label className="text-sm font-medium">Select an offer to link</Label>
              
              <RadioGroup
                value={selectedOfferId}
                onValueChange={setSelectedOfferId}
                className="space-y-3"
              >
                {offers.map((offer) => (
                  <Label
                    key={offer.id}
                    htmlFor={`offer-${offer.id}`}
                    className={`flex flex-col gap-2 rounded-xl border p-4 cursor-pointer transition-all hover:border-primary/50 ${
                      selectedOfferId === offer.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={offer.id} id={`offer-${offer.id}`} className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{offer.name}</span>
                          {offer.price_point && (
                            <Badge variant="secondary" className="text-xs">
                              {offer.price_point}
                            </Badge>
                          )}
                        </div>
                        {offer.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {offer.description}
                          </p>
                        )}
                        {offer.product_psychology && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <Sparkles className="h-3 w-3" />
                            <span>Psychology ready</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateOffer(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Offer
              </Button>
            </>
          )}
        </div>

        {offers.length > 0 && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLink} 
              disabled={loading || !selectedOfferId}
            >
              {loading ? (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
