import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfferDialog } from "./OfferDialog";
import { Plus, ExternalLink, Package, Loader2, Sparkles, Rocket } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Offer {
  id: string;
  name: string;
  url?: string | null;
  description?: string | null;
  price_point?: string | null;
  product_psychology?: any;
  recommended_template_id?: string | null;
  recommendation_reason?: string | null;
  recommendation_confidence?: string | null;
}

interface OfferManagerProps {
  brandId: string;
  offers: Offer[];
  onUpdate: () => void;
}

export function OfferManager({ brandId, offers, onUpdate }: OfferManagerProps) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [creatingCampaign, setCreatingCampaign] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('active', true);
    if (data) setTemplates(data);
  };

  const toggleOffer = (offerId: string) => {
    setExpandedOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(offerId)) {
        newSet.delete(offerId);
      } else {
        newSet.add(offerId);
      }
      return newSet;
    });
  };

  const createCampaignForOffer = async (offer: Offer) => {
    if (!offer.recommended_template_id) {
      toast.error("No campaign recommendation available");
      return;
    }

    setCreatingCampaign(offer.id);
    try {
      const template = templates.find(t => t.id === offer.recommended_template_id);
      if (!template) throw new Error("Template not found");

      // Create strategy with pre-filled offer data
      const { data: strategy, error } = await supabase
        .from('strategies')
        .insert({
          brand_id: brandId,
          template_id: template.id,
          name: `${template.name} - ${offer.name}`,
          campaign_type: template.slug,
          offer_name: offer.name,
          offer_url: offer.url,
          offer_price: offer.price_point,
          offer_description: offer.description,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Campaign created for ${offer.name}!`);
      navigate(`/creative?strategy=${strategy.id}`);
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setCreatingCampaign(null);
    }
  };

  const getConfidenceBadgeVariant = (confidence?: string | null) => {
    if (confidence === 'high') return 'default';
    if (confidence === 'medium') return 'secondary';
    return 'outline';
  };

  const getRecommendedTemplate = (templateId?: string | null) => {
    if (!templateId) return null;
    return templates.find(t => t.id === templateId);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Your Offers & Products</CardTitle>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Offer
            </Button>
          </div>
          <CardDescription>
            Manage your offers and their product-specific psychological profiles
          </CardDescription>
        </CardHeader>

        <CardContent>
          {offers.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No offers added yet. Add your first offer to get started.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Offer
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <Collapsible
                  key={offer.id}
                  open={expandedOffers.has(offer.id)}
                  onOpenChange={() => toggleOffer(offer.id)}
                >
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CollapsibleTrigger asChild>
                          <button className="flex-1 text-left hover:opacity-80 transition-opacity">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{offer.name}</h4>
                              {offer.product_psychology ? (
                                <Badge variant="default" className="text-xs">Psychology Ready</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  Generating...
                                </Badge>
                              )}
                              {offer.recommended_template_id && getRecommendedTemplate(offer.recommended_template_id) && (
                                <Badge variant={getConfidenceBadgeVariant(offer.recommendation_confidence)} className="text-xs">
                                  <Sparkles className="mr-1 h-3 w-3" />
                                  Best fit: {getRecommendedTemplate(offer.recommended_template_id)?.name}
                                </Badge>
                              )}
                            </div>
                            {offer.price_point && (
                              <p className="text-sm text-muted-foreground mt-1">{offer.price_point}</p>
                            )}
                          </button>
                        </CollapsibleTrigger>
                        {offer.url && (
                          <a
                            href={offer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {offer.description && (
                          <div>
                            <p className="text-sm font-medium mb-1">Description</p>
                            <p className="text-sm text-muted-foreground">{offer.description}</p>
                          </div>
                        )}

                        {offer.product_psychology && (
                          <>
                            {offer.product_psychology.positioning && (
                              <div>
                                <p className="text-sm font-medium mb-1">Product Positioning</p>
                                <p className="text-sm text-muted-foreground">
                                  {offer.product_psychology.positioning}
                                </p>
                              </div>
                            )}

                            {offer.product_psychology.product_pain_points?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">Product-Specific Pain Points</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {offer.product_psychology.product_pain_points.map((point: string, i: number) => (
                                    <li key={i} className="text-sm text-muted-foreground">{point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {offer.product_psychology.product_desires?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">Product-Specific Desires</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {offer.product_psychology.product_desires.map((desire: string, i: number) => (
                                    <li key={i} className="text-sm text-muted-foreground">{desire}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {offer.product_psychology.buying_triggers && (
                              <div>
                                <p className="text-sm font-medium mb-1">Buying Triggers</p>
                                <p className="text-sm text-muted-foreground">
                                  {offer.product_psychology.buying_triggers}
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {offer.recommended_template_id && getRecommendedTemplate(offer.recommended_template_id) && (
                          <div className="pt-4 border-t">
                            <p className="text-sm font-medium mb-2">Recommended Campaign</p>
                            <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span className="font-semibold">{getRecommendedTemplate(offer.recommended_template_id)?.name}</span>
                              </div>
                              {offer.recommendation_reason && (
                                <p className="text-sm text-muted-foreground">{offer.recommendation_reason}</p>
                              )}
                              <Button 
                                onClick={() => createCampaignForOffer(offer)} 
                                disabled={creatingCampaign === offer.id}
                                className="w-full"
                              >
                                {creatingCampaign === offer.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Rocket className="mr-2 h-4 w-4" />
                                    Create Campaign for This Offer
                                  </>
                                )}
                              </Button>
                              <p className="text-xs text-center text-muted-foreground">
                                Or choose a different template in Ad Planner
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        brandId={brandId}
        onSuccess={onUpdate}
      />
    </>
  );
}
