import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getHighTicketGuidance } from "@/lib/high-ticket";
import { useAutosaveOnChange } from "@/hooks/useAutosave";
import { AutoSaveIndicator } from "@/components/AutoSaveIndicator";


interface OfferEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: {
    id: string;
    name: string;
    url?: string | null;
    description?: string | null;
    price_point?: string | null;
    target_outcome?: string;
    use_brand_style_defaults?: boolean | null;
  } | null;
  onSuccess: () => void;
}

export function OfferEditDialog({ open, onOpenChange, offer, onSuccess }: OfferEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    price_point: "",
    target_outcome: "",
    use_brand_style_defaults: true,
  });

  useEffect(() => {
    if (offer && open) {
      setFormData({
        name: offer.name || "",
        url: offer.url || "",
        description: offer.description || "",
        price_point: offer.price_point || "",
        target_outcome: offer.target_outcome || "",
        use_brand_style_defaults: offer.use_brand_style_defaults !== false,
      });
    }
  }, [offer, open]);

  // Persist a set of offer fields. Shared by autosave and the Done button so
  // there's exactly one write path.
  const persist = async (values: typeof formData) => {
    if (!offer) return;
    const { error } = await supabase
      .from("offers")
      .update({
        name: values.name,
        url: values.url || null,
        description: values.description || null,
        price_point: values.price_point || null,
        target_outcome: values.target_outcome || null,
        use_brand_style_defaults: values.use_brand_style_defaults,
      } as any)
      .eq("id", offer.id);

    if (error) throw error;

    // Propagate URL/name/description/price changes to unpublished workspaces referencing this offer
    const { error: wsError } = await supabase
      .from("campaign_workspaces")
      .update({
        offer_url: values.url || null,
        offer_name: values.name,
        offer_description: values.description || null,
        offer_price: values.price_point || null,
      })
      .eq("offer_id", offer.id)
      .is("published_at", null);

    if (wsError) {
      console.warn("Failed to propagate offer changes to workspaces:", wsError);
    }
  };

  // Autosave every edit so closing the dialog (or navigating away) never loses work.
  const { status: saveStatus, flush } = useAutosaveOnChange(
    formData,
    persist,
    { key: offer?.id ?? null, enabled: !!offer && open && !!formData.name },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer) return;
    setLoading(true);

    try {
      await flush();
      await persist(formData);
      toast.success("Offer updated");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating offer:", error);
      toast.error(error.message || "Failed to update offer");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Offer</DialogTitle>
          <DialogDescription>Update your offer details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Offer Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url">Offer URL</Label>
            <Input
              id="edit-url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/offer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="What's included in this offer..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-price">Price</Label>
            <Input
              id="edit-price"
              value={formData.price_point}
              onChange={(e) => setFormData((prev) => ({ ...prev, price_point: e.target.value }))}
              placeholder="$997 or Free"
            />
            {(() => {
              const ht = getHighTicketGuidance(formData.price_point);
              if (!ht.isHighTicket) return null;
              return (
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-2.5">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    {ht.headline}
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-snug">
                    {ht.recommendation}
                  </p>
                </div>
              );
            })()}
          </div>


          {/* Before & After is auto-generated and used in ads, but hidden from the user */}


          {/* Apply brand Style defaults */}
          <div className="rounded-lg border bg-muted/30 p-3 flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor="edit-use-brand-style" className="text-sm font-medium cursor-pointer">
                Apply brand Style defaults to this offer
              </Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                When on, ad scripts and creative plans for this offer use your brand's copy voice,
                emoji preferences, bullet style, text overlay style, and b-roll. Turn off if this offer
                should sound different from the rest of your brand.
              </p>
            </div>
            <input
              id="edit-use-brand-style"
              type="checkbox"
              role="switch"
              aria-checked={formData.use_brand_style_defaults}
              checked={formData.use_brand_style_defaults}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, use_brand_style_defaults: e.target.checked }))
              }
              className="mt-1 h-4 w-4 accent-primary cursor-pointer shrink-0"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
