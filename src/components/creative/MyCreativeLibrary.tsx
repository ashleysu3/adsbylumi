import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Film,
  Image as ImageIcon,
  Layers,
  Video,
  Sparkles,
  Search,
  Loader2,
  Copy,
  Check,
  Heart,
  Type,
  AlignLeft,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SavedConceptsLibrary } from "./SavedConceptsLibrary";

type ConceptFormat = "graphic" | "carousel" | "broll" | "talking_head";

type ConceptItem = {
  id: string;
  format: ConceptFormat;
  title: string;
  hook?: string;
  stage: string;
  workspaceId: string;
  workspaceName: string;
  slideCount?: number;
  thumbUrl?: string | null;
  href?: string | null;
  createdAt?: string | null;
};

type CopyItem = {
  id: string;
  kind: "headline" | "primary" | "description";
  text: string;
  stage?: string;
  angle?: string;
  length?: string;
  workspaceId: string;
  workspaceName: string;
};

const FORMAT_FILTERS: { value: ConceptFormat | "all"; label: string; icon: any }[] = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "graphic", label: "Graphics", icon: ImageIcon },
  { value: "carousel", label: "Carousels", icon: Layers },
  { value: "broll", label: "B-Roll", icon: Film },
  { value: "talking_head", label: "Talking Head", icon: Video },
];

const stageColors: Record<string, string> = {
  grow: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  nurture: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  convert: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  tofu: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mofu: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  bofu: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};
const stageDisplay: Record<string, string> = {
  grow: "Grow", nurture: "Nurture", convert: "Convert",
  tofu: "Grow", mofu: "Nurture", bofu: "Convert",
};

function formatIconFor(f: ConceptFormat) {
  switch (f) {
    case "graphic": return ImageIcon;
    case "carousel": return Layers;
    case "broll": return Film;
    case "talking_head": return Video;
  }
}

export function MyCreativeLibrary() {
  const { activeBrand, loading: brandLoading } = useBrand();
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);
  const [copies, setCopies] = useState<CopyItem[]>([]);
  const [formatFilter, setFormatFilter] = useState<ConceptFormat | "all">("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (!activeBrand?.id) {
      setConcepts([]);
      setCopies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const brandId = activeBrand.id;
      const [wsRes, brollRes] = await Promise.all([
        supabase
          .from("campaign_workspaces")
          .select("id, name, offer_name, creative_json, created_at")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false }),
        supabase
          .from("broll_libraries")
          .select("id, name, clips, created_at")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false }),
      ]);

      const conceptList: ConceptItem[] = [];
      const copyList: CopyItem[] = [];

      for (const ws of (wsRes.data ?? []) as any[]) {
        const wsName = ws.name || ws.offer_name || "Untitled campaign";
        const creative = ws.creative_json || {};
        const mix = creative.creative_mix || creative.customer_journey || {};
        const buckets: Array<[string, any[]]> = [
          ["grow", mix.grow || mix.tofu || []],
          ["nurture", mix.nurture || mix.mofu || []],
          ["convert", mix.convert || mix.bofu || []],
        ];
        for (const [stage, arr] of buckets) {
          arr.forEach((c: any, idx: number) => {
            const fmt = (c.format || c.type || "graphic") as ConceptFormat;
            if (!["graphic", "carousel", "broll", "talking_head"].includes(fmt)) return;
            conceptList.push({
              id: `${ws.id}-${stage}-${idx}`,
              format: fmt,
              title: c.title || c.name || c.hook || `${stageDisplay[stage] || stage} concept ${idx + 1}`,
              hook: c.hook,
              stage,
              workspaceId: ws.id,
              workspaceName: wsName,
              slideCount: c.graphic?.slideCount || c.slideCount,
              thumbUrl: c.thumb_url || c.preview_url || null,
              href: c.url || null,
              createdAt: ws.created_at,
            });
          });
        }

        // Copy
        const lib = creative.ad_copy_library || {};
        const headlines = lib.headlines || creative.headlines || [];
        const descriptions = lib.descriptions || creative.descriptions || [];
        const primary = lib.primary_copy || creative.primary_copy || {};
        headlines.forEach((h: any, i: number) => {
          if (!h?.text) return;
          copyList.push({
            id: `${ws.id}-h-${i}`, kind: "headline", text: h.text,
            stage: h.stage, angle: h.angle, workspaceId: ws.id, workspaceName: wsName,
          });
        });
        descriptions.forEach((d: any, i: number) => {
          if (!d?.text) return;
          copyList.push({
            id: `${ws.id}-d-${i}`, kind: "description", text: d.text,
            stage: d.stage, angle: d.angle, workspaceId: ws.id, workspaceName: wsName,
          });
        });
        const primaryGroups: Array<[string, any[]]> = Array.isArray(primary)
          ? [["", primary]]
          : [["short", primary.short || []], ["medium", primary.medium || []], ["long", primary.long || []]];
        primaryGroups.forEach(([len, items]) => {
          items.forEach((p: any, i: number) => {
            if (!p?.text) return;
            copyList.push({
              id: `${ws.id}-p-${len}-${i}`, kind: "primary", text: p.text,
              stage: p.stage, angle: p.angle, length: len || p.length,
              workspaceId: ws.id, workspaceName: wsName,
            });
          });
        });
      }

      // B-Roll clips as concepts
      for (const lib of (brollRes.data ?? []) as any[]) {
        const clips = Array.isArray(lib.clips) ? lib.clips : [];
        for (const clip of clips) {
          conceptList.push({
            id: `broll-${lib.id}-${clip.id ?? Math.random()}`,
            format: "broll",
            title: clip.label || clip.description || "B-Roll clip",
            stage: "",
            workspaceId: `broll-${lib.id}`,
            workspaceName: lib.name ? `B-Roll: ${lib.name}` : "B-Roll Library",
            thumbUrl: clip.thumbnail_url || clip.thumb_url || clip.preview_url || null,
            href: clip.url || clip.source_url || null,
            createdAt: lib.created_at,
          });
        }
      }

      conceptList.sort((a, b) => {
        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bd - ad;
      });

      setConcepts(conceptList);
      setCopies(copyList);
    } catch (e: any) {
      console.error("[MyCreativeLibrary] load failed", e);
      toast.error(e?.message || "Failed to load your creative");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brandLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLoading, activeBrand?.id]);

  const workspaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of concepts) map.set(c.workspaceId, c.workspaceName);
    return Array.from(map.entries());
  }, [concepts]);

  const formatCounts = useMemo(() => {
    const c: Record<string, number> = { all: concepts.length };
    for (const it of concepts) c[it.format] = (c[it.format] || 0) + 1;
    return c;
  }, [concepts]);

  const filteredConcepts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concepts.filter((it) => {
      if (formatFilter !== "all" && it.format !== formatFilter) return false;
      if (workspaceFilter !== "all" && it.workspaceId !== workspaceFilter) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        (it.hook?.toLowerCase().includes(q) ?? false) ||
        it.workspaceName.toLowerCase().includes(q)
      );
    });
  }, [concepts, formatFilter, workspaceFilter, query]);

  // Group by campaign (workspace)
  const grouped = useMemo(() => {
    const g = new Map<string, ConceptItem[]>();
    for (const it of filteredConcepts) {
      if (!g.has(it.workspaceId)) g.set(it.workspaceId, []);
      g.get(it.workspaceId)!.push(it);
    }
    return Array.from(g.entries()).map(([wsId, items]) => ({
      workspaceId: wsId,
      workspaceName: items[0]?.workspaceName ?? "Campaign",
      items,
    }));
  }, [filteredConcepts]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold font-display">My Creative</h2>
        <p className="text-sm text-muted-foreground">
          Everything LUMI has generated for this brand — graphics, carousels, b-roll, and copy — organized by campaign.
        </p>
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList>
          <TabsTrigger value="library" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Library
          </TabsTrigger>
          <TabsTrigger value="copy" className="gap-2">
            <Type className="h-3.5 w-3.5" />
            Copy
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-2">
            <Heart className="h-3.5 w-3.5" />
            Saved Concepts
          </TabsTrigger>
        </TabsList>

        {/* LIBRARY */}
        <TabsContent value="library" className="space-y-4 mt-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {FORMAT_FILTERS.map((k) => {
                const Icon = k.icon;
                const active = formatFilter === k.value;
                const n = formatCounts[k.value] || 0;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setFormatFilter(k.value)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-muted/60 border-border text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {k.label}
                    <span className={cn("ml-1 rounded-full px-1.5 text-xs",
                      active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <select
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All campaigns ({workspaces.length})</option>
                {workspaces.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your creative…"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading your creative…
            </div>
          ) : grouped.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/70" />
                <p className="font-medium text-foreground">Nothing here yet</p>
                <p className="text-sm">
                  As LUMI generates concepts, graphics, carousels and b-roll for this brand, they'll collect here by campaign.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.workspaceId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{group.workspaceName}</h3>
                    <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.items.map((it) => (
                      <ConceptCard key={it.id} item={it} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COPY */}
        <TabsContent value="copy" className="mt-4">
          <CopyTab
            copies={copies}
            loading={loading}
            copiedId={copiedId}
            onCopy={copyToClipboard}
          />
        </TabsContent>

        {/* SAVED */}
        <TabsContent value="saved" className="mt-4">
          <SavedConceptsLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConceptCard({ item }: { item: ConceptItem }) {
  const Icon = formatIconFor(item.format);
  const hasVideo = item.format === "broll" && item.href && /\.(mp4|webm|mov)(\?|$)/i.test(item.href);
  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className="aspect-video bg-muted relative flex items-center justify-center">
        {item.thumbUrl ? (
          <img src={item.thumbUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : hasVideo ? (
          <video src={item.href!} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/60" />
        )}
        <Badge variant="secondary" className="absolute top-2 left-2 capitalize text-xs">
          {item.format.replace("_", " ")}
          {item.format === "carousel" && item.slideCount ? ` · ${item.slideCount}` : ""}
        </Badge>
        {item.stage && stageDisplay[item.stage] && (
          <Badge className={cn("absolute top-2 right-2 text-xs", stageColors[item.stage])}>
            {stageDisplay[item.stage]}
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="text-sm font-medium line-clamp-2">{item.title}</p>
        {item.hook && item.hook !== item.title && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.hook}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CopyTab({
  copies, loading, copiedId, onCopy,
}: {
  copies: CopyItem[];
  loading: boolean;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const [kind, setKind] = useState<"headline" | "primary" | "description">("headline");
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");

  const workspaces = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of copies) m.set(c.workspaceId, c.workspaceName);
    return Array.from(m.entries());
  }, [copies]);

  const filtered = useMemo(() => {
    return copies.filter((c) =>
      c.kind === kind && (workspaceFilter === "all" || c.workspaceId === workspaceFilter)
    );
  }, [copies, kind, workspaceFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading copy…
      </div>
    );
  }

  if (copies.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground space-y-2">
          <Type className="h-6 w-6 mx-auto text-muted-foreground/70" />
          <p className="font-medium text-foreground">No copy yet</p>
          <p className="text-sm">
            Headlines, primary copy and descriptions LUMI generates for your campaigns will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const kindTabs: { value: typeof kind; label: string; icon: any }[] = [
    { value: "headline", label: "Headlines", icon: Type },
    { value: "primary", label: "Primary Copy", icon: AlignLeft },
    { value: "description", label: "Descriptions", icon: MessageSquare },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {kindTabs.map((k) => {
            const Icon = k.icon;
            const active = kind === k.value;
            const n = copies.filter((c) => c.kind === k.value).length;
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card hover:bg-muted/60 border-border text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {k.label}
                <span className={cn("ml-1 rounded-full px-1.5 text-xs",
                  active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <select
          value={workspaceFilter}
          onChange={(e) => setWorkspaceFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All campaigns</option>
          {workspaces.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {kind === "primary" ? "primary copy" : `${kind}s`} for this filter yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="group">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {c.stage && stageDisplay[c.stage] && (
                    <Badge className={cn("text-xs", stageColors[c.stage])}>
                      {stageDisplay[c.stage]}
                    </Badge>
                  )}
                  {c.angle && <Badge variant="outline" className="text-xs">{c.angle}</Badge>}
                  {c.length && <Badge variant="secondary" className="text-xs">{c.length}</Badge>}
                  <Badge variant="outline" className="text-xs ml-auto">{c.workspaceName}</Badge>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.text}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{c.text.length} chars</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => onCopy(c.text, c.id)}
                  >
                    {copiedId === c.id ? (
                      <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
