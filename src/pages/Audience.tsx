import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageShimmer } from "@/components/GradientShimmer";
import { AudiencePsychology } from "@/components/AudiencePsychology";
import { Users, Package, Brain } from "lucide-react";
import { toast } from "sonner";

export default function Audience() {
  const { getEffectiveUserId } = useImpersonation();
  const { activeBrand: contextBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");

  useEffect(() => {
    fetchBrand();
  }, [contextBrand?.id]);

  const fetchBrand = async () => {
    setLoading(true);
    setBrand(null);
    setOffers([]);
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;
      let brandData: any = null;
      if (contextBrand) {
        const { data } = await supabase.from("brands").select("*").eq("id", contextBrand.id).maybeSingle();
        brandData = data;
      } else {
        const { data } = await supabase
          .from("brands")
          .select("*")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        brandData = data;
      }
      setBrand(brandData);

      if (brandData) {
        const { data: offerData } = await supabase
          .from("offers")
          .select("*")
          .eq("brand_id", brandData.id)
          .or("archived.is.null,archived.eq.false")
          .order("created_at", { ascending: false });
        const list = offerData || [];
        setOffers(list);
        const firstWithPsych = list.find((o: any) => o.product_psychology || o.offer_audience_psychology);
        if (firstWithPsych) setSelectedOfferId(firstWithPsych.id);
        else if (list[0]) setSelectedOfferId(list[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load audience");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>No Brand Found</CardTitle>
            <CardDescription>Set up your brand first to work on audience psychology.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  const selectedOffer = offers.find((o) => o.id === selectedOfferId);
  const hasOfferPsych = !!(selectedOffer?.product_psychology || selectedOffer?.offer_audience_psychology);

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display tracking-tight text-foreground">Audience</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              The people your ads should reach — and the psychology that moves them.
            </p>
          </div>
        </div>

        <AudiencePsychology
          brandId={brand.id}
          psychology={brand.audience_psychology}
          status={brand.psychology_status}
          psychologyContentHash={brand.psychology_content_hash}
          psychologyGeneratedAt={brand.psychology_generated_at}
          onUpdate={fetchBrand}
        />

        {/* Offer-specific psychology profiles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle>Offer-Specific Psychology</CardTitle>
              </div>
              {offers.length > 0 && (
                <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select an offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {offers.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <CardDescription>
              How your audience thinks and feels about each specific offer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add an offer to see its psychological profile here.
              </p>
            ) : !selectedOffer ? null : !hasOfferPsych ? (
              <p className="text-sm text-muted-foreground">
                No psychology generated for this offer yet. Open the offer to generate it.
              </p>
            ) : (
              <div className="space-y-6">
                {selectedOffer.product_psychology && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedOffer.product_psychology.positioning && (
                      <div className="p-3 rounded-lg bg-muted/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Positioning</p>
                        <p className="text-sm">{selectedOffer.product_psychology.positioning}</p>
                      </div>
                    )}
                    {selectedOffer.product_psychology.buying_triggers && (
                      <div className="p-3 rounded-lg bg-muted/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Buying Triggers</p>
                        <p className="text-sm">{selectedOffer.product_psychology.buying_triggers}</p>
                      </div>
                    )}
                    {selectedOffer.product_psychology.product_pain_points?.length > 0 && (
                      <div className="p-3 rounded-lg bg-muted/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pain Points</p>
                        <ul className="space-y-0.5">
                          {selectedOffer.product_psychology.product_pain_points.map((p: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedOffer.product_psychology.product_desires?.length > 0 && (
                      <div className="p-3 rounded-lg bg-muted/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Desires</p>
                        <ul className="space-y-0.5">
                          {selectedOffer.product_psychology.product_desires.map((d: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">• {d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {selectedOffer.offer_audience_psychology && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      Audience Journey
                    </h5>

                    {selectedOffer.offer_audience_psychology.emotional_before_after && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                          <p className="text-[11px] font-semibold text-destructive mb-1">Before</p>
                          <p className="text-xs text-muted-foreground">{selectedOffer.offer_audience_psychology.emotional_before_after.before}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                          <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-1">After</p>
                          <p className="text-xs text-muted-foreground">{selectedOffer.offer_audience_psychology.emotional_before_after.after}</p>
                        </div>
                      </div>
                    )}

                    {selectedOffer.offer_audience_psychology.what_finally_convinces && (
                      <div className="p-3 rounded-lg bg-muted/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">What convinces them</p>
                        <p className="text-sm">{selectedOffer.offer_audience_psychology.what_finally_convinces}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
