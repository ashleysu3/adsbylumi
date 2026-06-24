import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { saveCreative, startCreative, completeCreative, failCreative } from "@/lib/creatives";

export function LabBRoll({ seedId: _seedId }: { seedId?: string }) {
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
    const label = `Brainstorming b-roll shots${prompt.trim() ? ` for: ${prompt.trim().slice(0, 80)}` : ""}`;
    const jobId = await startCreative({
      brandId: activeBrand.id,
      type: "broll_idea",
      taskLabel: label,
      source: "lab",
      sourceRef: { tool: "broll", prompt },
    });
    try {
      const { data, error } = await supabase.functions.invoke("generate-broll-ideas", {
        body: { brand_id: activeBrand.id, prompt: prompt.trim() || undefined, count: 8 },
      });
      if (error) throw error;
      const arr: any[] = data?.ideas || data?.results || data?.shots || [];
      if (arr.length === 0) {
        const msg = data?.error || "No b-roll ideas generated";
        if (jobId) await failCreative(jobId, msg);
        toast.error(msg);
        return;
      }
      setResults(arr);
      const labelOf = (idea: any) =>
        typeof idea === "string" ? idea : idea.label || idea.description || idea.shot || "B-roll shot";
      if (jobId) {
        const first = arr[0];
        await completeCreative(jobId, {
          type: "broll_idea",
          title: labelOf(first).slice(0, 80),
          content: typeof first === "string" ? { text: first } : first,
        });
      }
      for (const idea of arr.slice(1)) {
        await saveCreative({
          brandId: activeBrand.id,
          type: "broll_idea",
          title: labelOf(idea).slice(0, 80),
          content: typeof idea === "string" ? { text: idea } : idea,
          source: "lab",
          sourceRef: { tool: "broll", prompt },
        });
      }
      toast.success(`${arr.length} b-roll ideas ready in My Creatives`);
    } catch (e: any) {
      console.error(e);
      if (jobId) await failCreative(jobId, e?.message || "Generation failed");
      toast.error(e?.message || "Couldn't generate b-roll ideas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> B-Roll
        </h3>
        <p className="text-xs text-muted-foreground">
          Shot ideas you can film yourself or pair with copy. Saves to My Creatives.
        </p>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What kind of scene, mood, or product? (optional)"
        rows={3}
      />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generate shot ideas
      </Button>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {results.map((r, i) => {
            const label =
              typeof r === "string" ? r : r.label || r.description || r.shot || `Shot ${i + 1}`;
            return (
              <div key={i} className="rounded-md border p-3 text-sm">
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
