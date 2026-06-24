import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { saveCreative, startCreative, completeCreative, failCreative } from "@/lib/creatives";

export function LabAngles({ seedId: _seedId }: { seedId?: string }) {
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
    const label = `Brainstorming fresh angles${prompt.trim() ? ` for: ${prompt.trim().slice(0, 80)}` : ""}`;
    const jobId = await startCreative({
      brandId: activeBrand.id,
      type: "angle",
      taskLabel: label,
      source: "lab",
      sourceRef: { tool: "angles", prompt },
    });
    try {
      const { data, error } = await supabase.functions.invoke("generate-creative-angles", {
        body: {
          brand_id: activeBrand.id,
          prompt: prompt.trim() || undefined,
          count: 5,
        },
      });
      if (error) throw error;
      const arr: any[] = data?.angles || data?.results || data?.items || [];
      if (arr.length === 0) {
        const msg = data?.error || "No angles generated";
        if (jobId) await failCreative(jobId, msg);
        toast.error(msg);
        return;
      }
      setResults(arr);
      const first = arr[0];
      if (jobId) {
        await completeCreative(jobId, {
          type: "angle",
          title: first.title || first.name || first.angle || "Angle",
          content: { text: first.description || first.why || first.summary || "", ...first },
        });
      }
      for (const a of arr.slice(1)) {
        const title = a.title || a.name || a.angle || "Angle";
        const desc = a.description || a.why || a.summary || "";
        await saveCreative({
          brandId: activeBrand.id,
          type: "angle",
          title,
          content: { text: desc, ...a },
          source: "lab",
          sourceRef: { tool: "angles", prompt },
        });
      }
      toast.success(`${arr.length} angles ready in My Creatives`);
    } catch (e: any) {
      console.error(e);
      if (jobId) await failCreative(jobId, e?.message || "Generation failed");
      toast.error(e?.message || "Couldn't generate angles");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Angles
        </h3>
        <p className="text-xs text-muted-foreground">
          Fresh strategic angles for your brand — independent of any campaign. Saves to My Creatives.
        </p>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What's on your mind? (optional)"
        rows={3}
      />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generate angles
      </Button>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">{r.title || r.name || r.angle || `Angle ${i + 1}`}</p>
              {(r.description || r.why || r.summary) && (
                <p className="text-muted-foreground text-xs">
                  {r.description || r.why || r.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
