import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { saveCreative, startCreative, completeCreative, failCreative } from "@/lib/creatives";

export function LabConcepts({ seedId: _seedId }: { seedId?: string }) {
  const { activeBrand } = useBrand();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const run = async () => {
    if (!activeBrand?.id) {
      toast.error("Pick a brand first");
      return;
    }
    setLoading(true);
    setResults([]);
    const label = `Sketching ad concepts${prompt.trim() ? ` around: ${prompt.trim().slice(0, 80)}` : ""}`;
    const jobId = await startCreative({
      brandId: activeBrand.id,
      type: "concept",
      taskLabel: label,
      source: "lab",
      sourceRef: { tool: "concepts", prompt },
    });
    try {
      const { data, error } = await supabase.functions.invoke("rank-creative-concepts", {
        body: { brand_id: activeBrand.id, prompt: prompt.trim() || undefined },
      });
      if (error) throw error;
      const arr: any[] = data?.concepts || data?.results || [];
      if (arr.length === 0) {
        const msg = data?.error || "No concepts generated";
        if (jobId) await failCreative(jobId, msg);
        toast.error(msg);
        return;
      }
      setResults(arr);
      const first = arr[0];
      if (jobId) {
        await completeCreative(jobId, {
          type: "concept",
          title: first.title || first.name || "Concept",
          content: first,
        });
      }
      for (const c of arr.slice(1)) {
        await saveCreative({
          brandId: activeBrand.id,
          type: "concept",
          title: c.title || c.name || "Concept",
          content: c,
          source: "lab",
          sourceRef: { tool: "concepts", prompt },
        });
      }
      toast.success(`${arr.length} concepts ready in My Creatives`);
    } catch (e: any) {
      console.error(e);
      if (jobId) await failCreative(jobId, e?.message || "Generation failed");
      toast.error(e?.message || "Couldn't generate concepts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Concepts
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate ad concepts (graphic, carousel, b-roll, talking head). Saves to My Creatives.
        </p>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Theme or angle (optional)"
        rows={3}
      />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generate concepts
      </Button>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {results.map((r, i) => (
            <div key={i} className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">{r.title || r.name || `Concept ${i + 1}`}</p>
              {r.hook && <p className="text-xs">{r.hook}</p>}
              {r.description && (
                <p className="text-muted-foreground text-xs">{r.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
