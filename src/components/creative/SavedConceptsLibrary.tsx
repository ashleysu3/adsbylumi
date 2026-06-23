import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart,
  HeartOff,
  Copy,
  Check,
  Video,
  FileText,
  Layers,
  Image as ImageIcon,
  Target,
  Zap,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const stageBadgeColors: Record<string, string> = {
  grow: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  nurture: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  convert: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  tofu: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mofu: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  bofu: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const stageDisplayNames: Record<string, string> = {
  grow: "Grow",
  nurture: "Nurture",
  convert: "Convert",
  tofu: "Grow",
  mofu: "Nurture",
  bofu: "Convert",
};

const stageIcons: Record<string, React.ElementType> = {
  grow: Target,
  nurture: Zap,
  convert: TrendingUp,
  tofu: Target,
  mofu: Zap,
  bofu: TrendingUp,
};

const formatIcons: Record<string, React.ElementType> = {
  talking_head: Video,
  b_roll: Video,
  carousel: Layers,
  static: ImageIcon,
};

type SavedConcept = {
  workspaceId: string;
  workspaceName: string;
  conceptId: string;
  matchedLovedId: string;
  stage: string;
  format?: string;
  hook?: string;
  script?: string;
  title?: string;
  name?: string;
  hook_type?: string;
  angle_name?: string;
  id?: string;
};

export function SavedConceptsLibrary() {
  const { activeBrand, loading: brandLoading } = useBrand();
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<SavedConcept[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (!activeBrand?.id) {
      setConcepts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("id, name, creative_json, loved_concepts, brand_id")
        .eq("brand_id", activeBrand.id);
      if (error) throw error;

      const out: SavedConcept[] = [];
      for (const ws of (data ?? []) as any[]) {
        const loved: string[] = Array.isArray(ws.loved_concepts) ? ws.loved_concepts : [];
        if (!loved.length) continue;
        const creative = ws.creative_json || {};
        const mix = creative.creative_mix || creative.customer_journey || {};
        const buckets: Array<[string, string, any[]]> = [
          ["grow", "tofu", mix.grow || mix.tofu || []],
          ["nurture", "mofu", mix.nurture || mix.mofu || []],
          ["convert", "bofu", mix.convert || mix.bofu || []],
        ];
        for (const [stage, legacy, arr] of buckets) {
          arr.forEach((c: any, idx: number) => {
            const conceptId = `${stage}-${idx}`;
            const legacyId = `${legacy}-${idx}`;
            const matched =
              (loved.includes(conceptId) && conceptId) ||
              (loved.includes(legacyId) && legacyId) ||
              (c.id && loved.includes(c.id) && c.id);
            if (!matched) return;
            out.push({
              workspaceId: ws.id,
              workspaceName: ws.name || "Untitled workspace",
              conceptId,
              matchedLovedId: matched as string,
              stage,
              ...c,
            });
          });
        }
      }
      setConcepts(out);
    } catch (e: any) {
      console.error("[SavedConceptsLibrary] load failed", e);
      toast.error(e?.message || "Failed to load saved concepts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brandLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLoading, activeBrand?.id]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const unlove = async (c: SavedConcept) => {
    try {
      const { data: ws, error } = await supabase
        .from("campaign_workspaces")
        .select("loved_concepts")
        .eq("id", c.workspaceId)
        .maybeSingle();
      if (error) throw error;
      const current: string[] = Array.isArray(ws?.loved_concepts)
        ? (ws!.loved_concepts as unknown as string[])
        : [];
      const next = current.filter((id) => id !== c.matchedLovedId);
      const { error: upErr } = await supabase
        .from("campaign_workspaces")
        .update({ loved_concepts: next, updated_at: new Date().toISOString() })
        .eq("id", c.workspaceId);
      if (upErr) throw upErr;
      setConcepts((prev) =>
        prev.filter(
          (p) => !(p.workspaceId === c.workspaceId && p.matchedLovedId === c.matchedLovedId)
        )
      );
      toast.success("Removed from favorites");
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading saved concepts…
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
          <Heart className="h-6 w-6 mx-auto text-muted-foreground/70" />
          <p className="font-medium text-foreground">No saved concepts yet</p>
          <p className="text-sm">
            Heart concepts inside any campaign workspace and they'll collect here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {concepts.map((concept) => {
        const StageIcon = stageIcons[concept.stage] || Target;
        const FormatIcon = formatIcons[concept.format || ""] || FileText;
        const uid = `${concept.workspaceId}-${concept.conceptId}`;
        return (
          <Card key={uid} className="relative group">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 opacity-70 hover:opacity-100 hover:bg-pink-50 dark:hover:bg-pink-950"
              onClick={() => unlove(concept)}
            >
              <HeartOff className="h-4 w-4 text-pink-500" />
            </Button>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge className={stageBadgeColors[concept.stage]}>
                  <StageIcon className="h-3 w-3 mr-1" />
                  {stageDisplayNames[concept.stage] || concept.stage?.toUpperCase()}
                </Badge>
                {concept.format && (
                  <Badge variant="outline" className="gap-1">
                    <FormatIcon className="h-3 w-3" />
                    {concept.format?.replace("_", " ")}
                  </Badge>
                )}
                {concept.hook_type && <Badge variant="secondary">{concept.hook_type}</Badge>}
                <Badge variant="outline" className="text-xs">
                  {concept.workspaceName}
                </Badge>
              </div>
              <CardTitle className="text-base">
                {concept.title || concept.name || concept.hook}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {concept.hook && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Hook</p>
                  <p className="text-sm bg-muted p-2 rounded">{concept.hook}</p>
                </div>
              )}
              {concept.script && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Script</p>
                  <p className="text-sm bg-muted p-2 rounded line-clamp-4">{concept.script}</p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    concept.script || concept.hook || concept.name || concept.title || "",
                    uid
                  )
                }
              >
                {copiedId === uid ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
