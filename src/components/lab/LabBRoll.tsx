import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Save, Film } from "lucide-react";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { saveCreative } from "@/lib/creatives";

const ALL_BRAND = "__all__";

type Offer = { id: string; name: string };

export function LabBRoll({ seedId: _seedId }: { seedId?: string }) {
  const { activeBrand } = useBrand();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState<string>(ALL_BRAND);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!activeBrand?.id) return;
    (async () => {
      const { data } = await supabase
        .from("offers")
        .select("id, name")
        .eq("brand_id", activeBrand.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      setOffers((data as Offer[]) || []);
    })();
  }, [activeBrand?.id]);

  const labelOf = (idea: any, i: number) =>
    typeof idea === "string"
      ? idea
      : idea.label || idea.description || idea.shot || `Shot ${i + 1}`;

  const run = async () => {
    if (!activeBrand?.id) {
      toast.error("Pick a brand first");
      return;
    }
    setLoading(true);
    setResults([]);
    setSelected(new Set());
    try {
      const offer = offers.find((o) => o.id === offerId);
      const focusBits: string[] = [];
      if (offer) {
        focusBits.push(`Focus on the offer "${offer.name}"${offer.auto_summary ? ` — ${offer.auto_summary}` : ""}.`);
      } else {
        focusBits.push("Mix shots that fit the brand as a whole, not a single offer.");
      }
      if (prompt.trim()) focusBits.push(prompt.trim());
      const composed = focusBits.join("\n\n");

      const { data, error } = await supabase.functions.invoke("generate-broll-ideas", {
        body: { brand_id: activeBrand.id, prompt: composed, count: 8 },
      });
      if (error) throw error;
      const arr: any[] = data?.ideas || data?.results || data?.shots || [];
      if (arr.length === 0) {
        toast.error(data?.error || "No b-roll ideas generated");
        return;
      }
      setResults(arr);
      // Pre-select all so users can quickly save everything if they want
      setSelected(new Set(arr.map((_, i) => i)));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't generate b-roll ideas");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const saveSelected = async () => {
    if (!activeBrand?.id) return;
    if (selected.size === 0) {
      toast.error("Pick at least one shot to save");
      return;
    }
    setSaving(true);
    try {
      const offer = offers.find((o) => o.id === offerId);
      let savedCount = 0;
      for (let i = 0; i < results.length; i++) {
        if (!selected.has(i)) continue;
        const idea = results[i];
        await saveCreative({
          brandId: activeBrand.id,
          type: "broll_idea",
          title: labelOf(idea, i).slice(0, 80),
          content: typeof idea === "string" ? { text: idea } : idea,
          source: "lab",
          sourceRef: {
            tool: "broll",
            prompt,
            offer_id: offer?.id || null,
            offer_name: offer?.name || null,
          },
        });
        savedCount++;
      }
      toast.success(`Saved ${savedCount} shot${savedCount === 1 ? "" : "s"} to My Creatives`);
      // Clear selection so it's clear what's been saved
      setSelected(new Set());
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't save shots");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> B-Roll
        </h3>
        <p className="text-xs text-muted-foreground">
          Shot ideas you can film yourself or pair with copy. Pick the ones you like and save them
          to My Creatives.
        </p>
      </div>

      {/* Offer scope */}
      <div className="space-y-1.5">
        <Label className="text-sm">What should these shots support?</Label>
        <Select value={offerId} onValueChange={setOfferId}>
          <SelectTrigger className="w-full sm:w-[420px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BRAND}>The whole brand (mix of ideas)</SelectItem>
            {offers.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Optional scene/mood */}
      <details className="rounded-md border bg-muted/30 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium select-none">
          Add a scene, mood, or product detail{" "}
          <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </summary>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. cozy morning at the kitchen counter, golden-hour walk, hands typing on a laptop…"
          rows={3}
          className="mt-3"
        />
      </details>

      <Button onClick={run} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Generate shot ideas
      </Button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {selected.size} of {results.length} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelected(
                    selected.size === results.length
                      ? new Set()
                      : new Set(results.map((_, i) => i)),
                  )
                }
              >
                {selected.size === results.length ? "Clear all" : "Select all"}
              </Button>
              <Button size="sm" onClick={saveSelected} disabled={saving || selected.size === 0}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save to My Creatives
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {results.map((r, i) => {
              const isChecked = selected.has(i);
              const label = labelOf(r, i);
              const note =
                typeof r === "object" && r !== null
                  ? r.note || r.why || r.reason || null
                  : null;
              return (
                <label
                  key={i}
                  htmlFor={`broll-${i}`}
                  className={`rounded-md border p-3 text-sm flex items-start gap-3 cursor-pointer transition-colors ${
                    isChecked ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40"
                  }`}
                >
                  <Checkbox
                    id={`broll-${i}`}
                    checked={isChecked}
                    onCheckedChange={() => toggle(i)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <Film className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="font-medium leading-snug">{label}</span>
                    </div>
                    {note && (
                      <p className="text-xs text-muted-foreground mt-1 ml-5">{note}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
