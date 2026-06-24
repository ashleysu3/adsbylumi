import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { saveCreative } from "@/lib/creatives";

export function LabGraphics({ seedId: _seedId }: { seedId?: string }) {
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const run = async () => {
    if (!activeBrand?.id) {
      toast.error("Pick a brand first");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Describe the graphic you want");
      return;
    }
    setLoading(true);
    setImageUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-creative", {
        body: {
          brand_id: activeBrand.id,
          prompt: prompt.trim(),
          format: "graphic",
        },
      });
      if (error) throw error;
      const url = data?.image_url || data?.url || data?.asset_url;
      if (!url) {
        toast.error(data?.error || "No graphic returned");
        return;
      }
      setImageUrl(url);
      await saveCreative({
        brandId: activeBrand.id,
        type: "graphic",
        title: prompt.slice(0, 80),
        content: { prompt },
        assetUrl: url,
        thumbUrl: url,
        source: "lab",
        sourceRef: { tool: "graphics", prompt },
      });
      toast.success("Graphic saved to My Creatives");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't generate graphic");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Graphics
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate static visuals on-brand. For carousels and templates,{" "}
          <button
            type="button"
            onClick={() => navigate("/creative-toolkit")}
            className="underline underline-offset-2"
          >
            open the toolkit
          </button>
          .
        </p>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the graphic you want"
        rows={4}
      />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generate graphic
      </Button>

      {imageUrl && (
        <div className="rounded-md border overflow-hidden">
          <img src={imageUrl} alt="Generated graphic" className="w-full" />
        </div>
      )}
    </div>
  );
}
