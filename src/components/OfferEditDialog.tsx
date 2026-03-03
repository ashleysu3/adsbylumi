import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  });

  useEffect(() => {
    if (offer && open) {
      setFormData({
        name: offer.name || "",
        url: offer.url || "",
        description: offer.description || "",
        price_point: offer.price_point || "",
        target_outcome: offer.target_outcome || "",
      });
    }
  }, [offer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("offers")
        .update({
          name: formData.name,
          url: formData.url || null,
          description: formData.description || null,
          price_point: formData.price_point || null,
          target_outcome: formData.target_outcome || null,
        })
        .eq("id", offer.id);

      if (error) throw error;

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
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-outcome">Target Outcome</Label>
            <Input
              id="edit-outcome"
              value={formData.target_outcome}
              onChange={(e) => setFormData((prev) => ({ ...prev, target_outcome: e.target.value }))}
              placeholder="What transformation does this deliver?"
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
