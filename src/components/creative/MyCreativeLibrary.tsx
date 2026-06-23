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
  Sparkles,
  Search,
  Loader2,
  ExternalLink,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SavedConceptsLibrary } from "./SavedConceptsLibrary";

type CreativeKind = "broll" | "graphic";

type CreativeItem = {
  id: string;
  kind: CreativeKind;
  title: string;
  subtitle?: string | null;
  thumbUrl?: string | null;
  href?: string | null;
  badge?: string;
  createdAt?: string | null;
};

const KIND_FILTERS: { value: CreativeKind | "all"; label: string; icon: any }[] = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "broll", label: "B-Roll", icon: Film },
  { value: "graphic", label: "Graphics", icon: ImageIcon },
];

function pathFromBrandAssetUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function MyCreativeLibrary() {
  const { activeBrand, loading: brandLoading } = useBrand();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CreativeItem[]>([]);
  const [filter, setFilter] = useState<CreativeKind | "all">("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!activeBrand?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const brandId = activeBrand.id;
      const [brollRes, brandAssetsRes] = await Promise.all([
        supabase
          .from("broll_libraries")
          .select("id, name, description, clips, created_at")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false }),
        supabase
          .from("brand_assets" as any)
          .select("id, url, role, created_at")
          .eq("brand_id", brandId)
          .in("role", ["graphic", "background", "texture"])
          .order("created_at", { ascending: false }),
      ]);

      const collected: CreativeItem[] = [];

      // B-Roll: flatten clips inside each library (only real clips LUMI produced)
      for (const lib of (brollRes.data ?? []) as any[]) {
        const clips = Array.isArray(lib.clips) ? lib.clips : [];
        for (const clip of clips) {
          collected.push({
            id: `broll-${lib.id}-${clip.id ?? Math.random()}`,
            kind: "broll",
            title: clip.label || clip.description || "B-Roll clip",
            subtitle: lib.name ? `From: ${lib.name}` : null,
            thumbUrl: clip.thumbnail_url || clip.thumb_url || clip.preview_url || null,
            href: clip.url || clip.source_url || null,
            badge: clip.tag || "Clip",
            createdAt: lib.created_at,
          });
        }
      }

      // Brand graphics — sign URLs in batch when stored as storage paths
      const brandAssets = (brandAssetsRes.data ?? []) as any[];
      const assetPaths = brandAssets
        .map((a) => pathFromBrandAssetUrl(a.url))
        .filter(Boolean) as string[];
      let signedBrand: Record<string, string> = {};
      if (assetPaths.length) {
        const { data: signed } = await supabase.storage
          .from("brand-assets")
          .createSignedUrls(assetPaths, 60 * 60);
        (signed || []).forEach((s, i) => {
          if (assetPaths[i] && s.signedUrl) signedBrand[assetPaths[i]] = s.signedUrl;
        });
      }
      for (const a of brandAssets) {
        const path = pathFromBrandAssetUrl(a.url);
        const display = path && signedBrand[path] ? signedBrand[path] : a.url;
        collected.push({
          id: `brand-asset-${a.id}`,
          kind: "graphic",
          title: a.role ? `${String(a.role).charAt(0).toUpperCase()}${String(a.role).slice(1)}` : "Graphic",
          subtitle: null,
          thumbUrl: display,
          href: display,
          badge: a.role || "graphic",
          createdAt: a.created_at,
        });
      }


      // Sort newest first
      collected.sort((a, b) => {
        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bd - ad;
      });

      setItems(collected);
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

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const it of items) c[it.kind] = (c[it.kind] || 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        (it.subtitle?.toLowerCase().includes(q) ?? false) ||
        (it.badge?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display">My Creative</h2>
          <p className="text-sm text-muted-foreground">
            Everything you've created or saved for this brand — ideas, b-roll, graphics, and photos.
          </p>
        </div>
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

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => {
          const Icon = k.icon;
          const active = filter === k.value;
          const n = counts[k.value] || 0;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setFilter(k.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card hover:bg-muted/60 border-border text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {k.label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 text-xs",
                  active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading your creative…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/70" />
            <p className="font-medium text-foreground">Nothing here yet</p>
            <p className="text-sm">
              {filter === "all"
                ? "As you save ideas, upload b-roll, harvest brand graphics, or add photos, they'll show up here."
                : `No ${KIND_FILTERS.find((k) => k.value === filter)?.label.toLowerCase()} yet for this brand.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((it) => (
            <CreativeCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreativeCard({ item }: { item: CreativeItem }) {
  const Icon = item.kind === "broll" ? Film : ImageIcon;

  const isMedia = item.kind === "graphic";
  const hasVideo = item.kind === "broll" && item.href && /\.(mp4|webm|mov)(\?|$)/i.test(item.href);


  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className="aspect-video bg-muted relative flex items-center justify-center">
        {item.thumbUrl && isMedia ? (
          <img
            src={item.thumbUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : hasVideo ? (
          <video src={item.href!} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/60" />
        )}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 capitalize text-xs"
        >
          {item.badge || item.kind}
        </Badge>
      </div>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-1">{item.title}</p>
          {item.href && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 -mr-2 -mt-1 opacity-70 group-hover:opacity-100"
              asChild
            >
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
