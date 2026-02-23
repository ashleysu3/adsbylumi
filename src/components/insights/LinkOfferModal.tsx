import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Package, Plus, ArrowRight, Wand2, ExternalLink, CheckCircle2 } from "lucide-react";
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

type ModalView = "choose" | "link" | "auto-create";

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
  const [view, setView] = useState<ModalView>("choose");
  const [adUrls, setAdUrls] = useState<string[]>([]);
  const [fetchingUrls, setFetchingUrls] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string>("");

  useEffect(() => {
    if (open) {
      setView("choose");
      setSelectedOfferId("");
      setSelectedUrl("");
      setAdUrls([]);
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
    setView("link");
  };

  const handleAutoCreate = async () => {
    setFetchingUrls(true);
    setView("auto-create");
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ad-destination-urls", {
        body: { workspaceId },
      });
      if (error) throw error;
      setAdUrls(data?.urls || []);
      if (data?.urls?.length === 1) setSelectedUrl(data.urls[0]);
    } catch (err: any) {
      console.error("Error fetching ad URLs:", err);
      toast.error("Couldn't fetch destination URLs from your ads");
      setView("choose");
    } finally {
      setFetchingUrls(false);
    }
  };

  const handleCreateFromUrl = async () => {
    if (!selectedUrl) return;
    setAutoCreating(true);
    try {
      // Extract offer info from URL
      const { data: offerInfo, error: extractError } = await supabase.functions.invoke("extract-offer-info", {
        body: { offerUrl: selectedUrl },
      });
      if (extractError) throw extractError;

      // Create the offer
      const offerName = offerInfo?.raw_copy_highlights?.[0]?.substring(0, 80) ||
        new URL(selectedUrl).pathname.split("/").filter(Boolean).pop() ||
        "Auto-Created Offer";

      const { data: newOffer, error: insertError } = await supabase
        .from("offers")
        .insert({
          brand_id: brandId,
          name: offerName,
          url: selectedUrl,
          description: offerInfo?.description || null,
          price_point: offerInfo?.price_point || null,
          target_outcome: offerInfo?.target_outcome || null,
          product_psychology: offerInfo || null,
          ai_generated_description: true,
          ai_generated_price: !!offerInfo?.price_point,
        })
        .select("id, name, description, price_point, url, product_psychology")
        .single();

      if (insertError) throw insertError;

      // Link it to the campaign
      const { data: brandData } = await supabase
        .from("brands")
        .select("brand_voice, target_audience, audience_psychology")
        .eq("id", brandId)
        .single();

      const minimalStrategy = {
        offer: {
          name: newOffer.name,
          description: newOffer.description,
          price: newOffer.price_point,
          url: newOffer.url,
          product_psychology: newOffer.product_psychology,
        },
        brand_voice: brandData?.brand_voice,
        target_audience: brandData?.target_audience,
        audience_psychology: brandData?.audience_psychology,
        source: "auto_created_from_ad",
        linked_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("campaign_workspaces")
        .update({
          offer_id: newOffer.id,
          offer_name: newOffer.name,
          offer_description: newOffer.description,
          offer_price: newOffer.price_point,
          offer_url: newOffer.url,
          strategy_json: minimalStrategy,
        })
        .eq("id", workspaceId);

      if (updateError) throw updateError;

      toast.success(`Created & linked "${newOffer.name}" ✨`);
      onSuccess(newOffer);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error auto-creating offer:", err);
      toast.error("Failed to create offer from URL");
    } finally {
      setAutoCreating(false);
    }
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
            Connect "{workspaceName}" to an offer to enable creative generation
          </DialogDescription>
        </DialogHeader>

        {/* Choose View */}
        {view === "choose" && (
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto p-4 rounded-xl text-left"
              onClick={() => setView("link")}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Link an Existing Offer</p>
                <p className="text-xs text-muted-foreground">Choose from your current offers</p>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto p-4 rounded-xl text-left"
              onClick={handleAutoCreate}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                <Wand2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Let Lumi Auto-Create It</p>
                <p className="text-xs text-muted-foreground">Lumi will scan your ad's landing page and create the offer for you</p>
              </div>
              <Sparkles className="h-4 w-4 ml-auto text-primary animate-sparkle-pulse" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto p-4 rounded-xl text-left"
              onClick={() => setShowCreateOffer(true)}
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Create a New Offer Manually</p>
                <p className="text-xs text-muted-foreground">Enter your offer details step by step</p>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
          </div>
        )}

        {/* Auto-Create View */}
        {view === "auto-create" && (
          <div className="space-y-4 py-4">
            {fetchingUrls ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Scanning your ads for landing pages...</p>
              </div>
            ) : adUrls.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No destination URLs found in this campaign's ads.
                </p>
                <Button variant="outline" onClick={() => setView("choose")}>
                  Go Back
                </Button>
              </div>
            ) : (
              <>
                <Label className="text-sm font-medium">
                  {adUrls.length === 1
                    ? "Lumi found this landing page in your ads:"
                    : `Lumi found ${adUrls.length} landing pages — select one to create an offer from:`}
                </Label>
                <RadioGroup
                  value={selectedUrl}
                  onValueChange={setSelectedUrl}
                  className="space-y-2"
                >
                  {adUrls.map((url) => (
                    <Label
                      key={url}
                      htmlFor={`url-${url}`}
                      className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all hover:border-primary/50 ${
                        selectedUrl === url
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border"
                      }`}
                    >
                      <RadioGroupItem value={url} id={`url-${url}`} />
                      <span className="text-sm truncate flex-1">{url}</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </Label>
                  ))}
                </RadioGroup>

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="ghost" onClick={() => setView("choose")} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateFromUrl}
                    disabled={!selectedUrl || autoCreating}
                    className="flex-1"
                  >
                    {autoCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Offer...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Create & Link
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Link Existing View */}
        {view === "link" && (
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
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setView("choose")}>
                    Back
                  </Button>
                  <Button onClick={() => setShowCreateOffer(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Offer
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Select an offer to link</Label>
                  <Button variant="ghost" size="sm" onClick={() => setView("choose")} className="text-xs">
                    Back
                  </Button>
                </div>
                
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
