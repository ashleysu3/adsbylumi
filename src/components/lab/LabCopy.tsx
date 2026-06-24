import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Save, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { saveCreative, startCreative, completeCreative, failCreative, type CreativeType } from "@/lib/creatives";

type CopyKind = "hook" | "primary_copy" | "headline" | "description" | "caption" | "cta";

const KINDS: Array<{ value: CopyKind; label: string; hint: string }> = [
  { value: "hook", label: "Hooks", hint: "3-second openers" },
  { value: "primary_copy", label: "Primary text", hint: "Body copy" },
  { value: "headline", label: "Headlines", hint: "Under 27 characters" },
  { value: "description", label: "Descriptions", hint: "Below the headline" },
  { value: "caption", label: "Captions", hint: "Organic-style captions" },
  { value: "cta", label: "CTAs", hint: "Call-to-action lines" },
];

export function LabCopy({ seedId }: { seedId?: string }) {
  const { activeBrand } = useBrand();
  const [kind, setKind] = useState<CopyKind>("hook");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    if (!seedId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("creatives")
        .select("type, content, title")
        .eq("id", seedId)
        .maybeSingle();
      if (data) {
        if (KINDS.some((k) => k.value === data.type)) setKind(data.type);
        const text =
          typeof data.content === "string"
            ? data.content
            : data.content?.text || data.content?.hook || "";
        if (text) setPrompt(text);
      }
    })();
  }, [seedId]);

  const run = async () => {
    if (!activeBrand?.id) {
      toast.error("Pick a brand first");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-copy-variations", {
        body: {
          brand_id: activeBrand.id,
          kind,
          prompt: prompt.trim() || `Write ${kind} for ${activeBrand.name || "this brand"}`,
          count: 6,
        },
      });
      if (error) throw error;
      const arr: string[] = (data?.variations || data?.results || data?.copy || data?.items || [])
        .map((v: any) => (typeof v === "string" ? v : v?.text || v?.copy || ""))
        .filter(Boolean);
      if (arr.length === 0) {
        toast.error(data?.error || "No copy generated");
      } else {
        setResults(arr);
        // Auto-save each as draft
        for (const text of arr) {
          await saveCreative({
            brandId: activeBrand.id,
            type: kind as CreativeType,
            title: text.slice(0, 80),
            content: { text },
            source: "lab",
            sourceRef: { tool: "copy", kind, prompt },
          });
        }
        toast.success(`${arr.length} drafts saved to My Creatives`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't generate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Copywriting
        </h3>
        <p className="text-xs text-muted-foreground">
          Pick a copy type, give a quick prompt (or leave blank), generate. Every variation saves
          to My Creatives.
        </p>
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as CopyKind)}>
        <TabsList className="flex-wrap h-auto">
          {KINDS.map((k) => (
            <TabsTrigger key={k.value} value={k.value} className="text-xs">
              {k.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {KINDS.map((k) => (
          <TabsContent key={k.value} value={k.value} className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">{k.hint}</p>
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What angle, offer, or topic? (optional)"
          rows={3}
        />
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Saved as drafts in My Creatives — review and add to a campaign when you're ready.
          </p>
          {results.map((r, i) => (
            <div
              key={i}
              className="rounded-md border p-3 text-sm whitespace-pre-wrap flex justify-between gap-3"
            >
              <span>{r}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(r);
                  toast.success("Copied");
                }}
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
