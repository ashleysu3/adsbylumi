import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfferDialog } from "./OfferDialog";
import { Plus, ExternalLink, Package, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Offer {
  id: string;
  name: string;
  url?: string | null;
  description?: string | null;
  price_point?: string | null;
  product_psychology?: any;
}

interface OfferManagerProps {
  brandId: string;
  offers: Offer[];
  onUpdate: () => void;
}

export function OfferManager({ brandId, offers, onUpdate }: OfferManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());

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
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{offer.name}</h4>
                              {offer.product_psychology ? (
                                <Badge variant="default" className="text-xs">Psychology Ready</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  Generating...
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
