import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface OfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  onSuccess: () => void;
}

export function OfferDialog({ open, onOpenChange, brandId, onSuccess }: OfferDialogProps) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    price_point: "",
    target_outcome: "",
  });

  const handleExtractInfo = async () => {
    if (!formData.url) {
      toast.error("Please enter an offer URL first");
      return;
    }

    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-offer-info', {
        body: { 
          offerUrl: formData.url,
          offerName: formData.name 
        }
      });

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        description: data.description,
        price_point: data.price_point,
        target_outcome: data.target_outcome,
      }));

      toast.success("Offer info extracted from page");
    } catch (error: any) {
      console.error('Error extracting offer info:', error);
      toast.error("Failed to extract offer info");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Insert offer
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .insert({
          brand_id: brandId,
          name: formData.name,
          url: formData.url,
          description: formData.description,
          price_point: formData.price_point,
          target_outcome: formData.target_outcome,
          ai_generated_description: true,
          ai_generated_price: true,
        })
        .select()
        .single();

      if (offerError) throw offerError;

      // Generate product psychology
      toast.info("Generating product psychology...");
      const { error: psychError } = await supabase.functions.invoke('generate-product-psychology', {
        body: { 
          offerId: offer.id,
          brandId: brandId 
        }
      });

      if (psychError) {
        console.error('Psychology generation error:', psychError);
        toast.warning("Offer created, but psychology generation failed");
      } else {
        toast.success("Offer created with product psychology");
      }

      onSuccess();
      onOpenChange(false);
      setFormData({ name: "", url: "", description: "", price_point: "", target_outcome: "" });
    } catch (error: any) {
      console.error('Error creating offer:', error);
      toast.error("Failed to create offer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Offer</DialogTitle>
          <DialogDescription>
            Enter your offer details and we'll generate a product-specific psychological profile
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Offer Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Signature Course"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Offer URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/offer"
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleExtractInfo}
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="What's included in this offer..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_point">Price</Label>
            <Input
              id="price_point"
              value={formData.price_point}
              onChange={(e) => setFormData(prev => ({ ...prev, price_point: e.target.value }))}
              placeholder="$997"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_outcome">Target Outcome</Label>
            <Input
              id="target_outcome"
              value={formData.target_outcome}
              onChange={(e) => setFormData(prev => ({ ...prev, target_outcome: e.target.value }))}
              placeholder="What transformation does this deliver?"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Offer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
