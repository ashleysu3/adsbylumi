import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { normalizeWebsiteUrl } from "@/lib/normalizeWebsiteUrl";
import { formatInvokeError } from "@/lib/formatInvokeError";


interface BrandEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: any;
  onUpdate: () => void;
}

export function BrandEditDialog({ open, onOpenChange, brand, onUpdate }: BrandEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [formData, setFormData] = useState({
    name: brand?.name || "",
    website_url: brand?.website_url || "",
    industry: brand?.industry || "",
    value_proposition: brand?.value_proposition || "",
    target_audience: brand?.target_audience || "",
  });

  const handleRegenerate = async () => {
    const normalizedWebsiteUrl = normalizeWebsiteUrl(formData.website_url);

    if (!normalizedWebsiteUrl) {
      toast.error("Please enter a website URL first");
      return;
    }

    if (normalizedWebsiteUrl !== formData.website_url) {
      setFormData(prev => ({ ...prev, website_url: normalizedWebsiteUrl }));
    }

    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-brand-info", {
        body: { websiteUrl: normalizedWebsiteUrl },
      });

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        value_proposition: data.value_proposition,
        target_audience: data.target_audience,
        industry: data.industry,
      }));

      toast.success("Brand info regenerated from website");
    } catch (error: any) {
      console.error("Error regenerating:", error);
      toast.error(`Failed to regenerate brand info: ${formatInvokeError(error)}`);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('brands')
        .update(formData)
        .eq('id', brand.id);

      if (error) throw error;

      toast.success("Brand updated successfully");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating brand:', error);
      toast.error("Failed to update brand");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Brand Details</DialogTitle>
          <DialogDescription>
            Update your brand information or regenerate from your website
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Brand Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://example.com"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Regenerate"
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value_proposition">What You Offer</Label>
            <Textarea
              id="value_proposition"
              value={formData.value_proposition}
              onChange={(e) => setFormData(prev => ({ ...prev, value_proposition: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_audience">Who You Serve</Label>
            <Textarea
              id="target_audience"
              value={formData.target_audience}
              onChange={(e) => setFormData(prev => ({ ...prev, target_audience: e.target.value }))}
              rows={3}
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
