import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Search,
  MoreHorizontal,
  Edit3,
  Plus,
  Send,
  Trash2,
  Copy as CopyIcon,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type { CreativeDraft, CreativeType, CreativeStatus } from "@/lib/creatives";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  hook: "Hook",
  primary_copy: "Primary copy",
  headline: "Headline",
  description: "Description",
  caption: "Caption",
  cta: "CTA",
  angle: "Angle",
  concept: "Concept",
  broll_idea: "B-roll idea",
  broll_clip: "B-roll clip",
  graphic: "Graphic",
  trend: "Trend",
};

const TYPE_FILTERS: { value: CreativeType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hook", label: "Hooks" },
  { value: "primary_copy", label: "Primary copy" },
  { value: "headline", label: "Headlines" },
  { value: "caption", label: "Captions" },
  { value: "cta", label: "CTAs" },
  { value: "angle", label: "Angles" },
  { value: "concept", label: "Concepts" },
  { value: "broll_idea", label: "B-roll" },
  { value: "graphic", label: "Graphics" },
  { value: "trend", label: "Trends" },
];

export function CreativesDraftsLibrary() {
  const { activeBrand, loading: brandLoading } = useBrand();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CreativeDraft[]>([]);
  const [typeFilter, setTypeFilter] = useState<CreativeType | "all">("all");
  const [query, setQuery] = useState("");
  const [promoteTarget, setPromoteTarget] = useState<CreativeDraft | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = async () => {
    if (!activeBrand?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from("creatives")
        .select("*")
        .eq("brand_id", activeBrand.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as CreativeDraft[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't load your creatives");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brandLoading) return;
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLoading, activeBrand?.id]);

  // Poll while any item is "working" so the UI reflects completion live.
  useEffect(() => {
    const hasWorking = rows.some((r) => r.status === "working");
    if (!hasWorking) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(() => {
      load();
    }, 3500);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      const hay = [
        r.title || "",
        r.task_label || "",
        typeof r.content === "string" ? r.content : JSON.stringify(r.content || {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, typeFilter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [rows]);

  const groups = useMemo(() => {
    const g: Record<CreativeStatus, CreativeDraft[]> = {
      working: [],
      failed: [],
      ready: [],
      used: [],
    };
    for (const r of filtered) (g[r.status] ?? g.ready).push(r);
    return g;
  }, [filtered]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("creatives").delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't delete");
    }
  };

  const handleEdit = (r: CreativeDraft) => {
    const tool = toolForType(r.type);
    navigate(`/creative-studio?mode=lab&tool=${tool}&seed=${r.id}`);
  };

  const handleUseInNewAd = (r: CreativeDraft) => {
    navigate(`/creative-studio?mode=guided&seed=${r.id}`);
  };

  const handleRetry = async (r: CreativeDraft) => {
    // For now retry = reopen the matching tool with the previous prompt.
    const tool = toolForType(r.type);
    navigate(`/creative-studio?mode=lab&tool=${tool}&seed=${r.id}`);
  };

  const renderGroup = (
    title: string,
    items: CreativeDraft[],
    subtitle: string,
    icon: React.ReactNode,
  ) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold">
              {title} <span className="text-muted-foreground font-normal">({items.length})</span>
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((r) => (
            <DraftCard
              key={r.id}
              draft={r}
              onEdit={() => handleEdit(r)}
              onPromote={() => setPromoteTarget(r)}
              onUseInNewAd={() => handleUseInNewAd(r)}
              onDelete={() => handleDelete(r.id)}
              onRetry={() => handleRetry(r)}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-display">My Creatives</h2>
        <p className="text-sm text-muted-foreground">
          Every hook, concept, graphic, b-roll, and rewrite LUMI starts shows up here from the
          moment it kicks off. Nothing goes live until you add it to a campaign yourself.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((k) => {
            const active = typeFilter === k.value;
            const n = counts[k.value] || 0;
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => setTypeFilter(k.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card hover:bg-muted/60 border-border text-foreground",
                )}
              >
                {k.label}
                <span
                  className={cn(
                    "rounded-full px-1.5",
                    active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drafts…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground/70" />
            <p className="font-medium text-foreground">Nothing here yet</p>
            <p className="text-sm">
              Head to{" "}
              <button
                type="button"
                onClick={() => navigate("/creative-studio?mode=lab")}
                className="underline underline-offset-2"
              >
                The Lab
              </button>{" "}
              to make something — every job shows here the moment it starts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {renderGroup(
            "In progress",
            groups.working,
            "LUMI is working on these right now. They'll move to Ready to review when they're done.",
            <Loader2 className="h-4 w-4 animate-spin text-primary" />,
          )}
          {renderGroup(
            "Needs attention",
            groups.failed,
            "Something went wrong. Retry to start over.",
            <AlertTriangle className="h-4 w-4 text-destructive" />,
          )}
          {renderGroup(
            "Ready to review",
            groups.ready,
            "Done and waiting on you. Add to a campaign when you're ready.",
            <CheckCircle2 className="h-4 w-4 text-primary" />,
          )}
          {renderGroup(
            "Used",
            groups.used,
            "Already added to a campaign.",
            <Send className="h-4 w-4 text-muted-foreground" />,
          )}
        </div>
      )}

      {promoteTarget && (
        <PromoteDialog
          draft={promoteTarget}
          onClose={() => setPromoteTarget(null)}
          onDone={() => {
            setPromoteTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function toolForType(t: string): string {
  if (
    t === "hook" ||
    t === "primary_copy" ||
    t === "headline" ||
    t === "description" ||
    t === "caption" ||
    t === "cta"
  )
    return "copy";
  if (t === "angle") return "angles";
  if (t === "concept") return "concepts";
  if (t === "broll_idea" || t === "broll_clip") return "broll";
  if (t === "graphic") return "graphics";
  if (t === "trend") return "trends";
  return "copy";
}

function previewText(r: CreativeDraft): string {
  if (typeof r.content === "string") return r.content;
  if (r.content?.text) return r.content.text;
  if (r.content?.body) return r.content.body;
  if (r.content?.hook) return r.content.hook;
  try {
    return JSON.stringify(r.content).slice(0, 240);
  } catch {
    return "";
  }
}

function DraftCard({
  draft,
  onEdit,
  onPromote,
  onUseInNewAd,
  onDelete,
  onRetry,
}: {
  draft: CreativeDraft;
  onEdit: () => void;
  onPromote: () => void;
  onUseInNewAd: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const text = previewText(draft);
  const visual = !!draft.thumb_url || !!draft.asset_url;
  const isWorking = draft.status === "working";
  const isFailed = draft.status === "failed";
  const isUsed = draft.status === "used";

  return (
    <Card
      className={cn(
        "group",
        isWorking && "border-primary/40 bg-primary/[0.03]",
        isFailed && "border-destructive/40 bg-destructive/[0.03]",
      )}
    >
      {visual && !isWorking && (
        <div className="aspect-video bg-muted overflow-hidden">
          {draft.thumb_url || draft.asset_url ? (
            <img
              src={draft.thumb_url || draft.asset_url!}
              alt={draft.title || draft.type}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {TYPE_LABEL[draft.type] || draft.type}
          </Badge>
          {isWorking && (
            <Badge className="text-xs gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> In progress
            </Badge>
          )}
          {isFailed && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="h-3 w-3" /> Failed
            </Badge>
          )}
          {isUsed && (
            <Badge variant="outline" className="text-xs">
              Used
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {String(draft.source).replace(/_/g, " ")}
          </span>
        </div>

        {isWorking && draft.task_label && (
          <p className="text-sm text-foreground">{draft.task_label}</p>
        )}
        {isFailed && (
          <p className="text-sm text-destructive">
            {draft.error_message || "Generation failed. Try again."}
          </p>
        )}

        {!isWorking && !isFailed && draft.title && (
          <p className="text-sm font-medium line-clamp-2">{draft.title}</p>
        )}
        {!isWorking && !isFailed && text && (
          <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{text}</p>
        )}

        {isUsed && draft.used_in?.workspace_id && (
          <p className="text-xs text-muted-foreground">
            Added to a campaign — paused until you confirm in Live Ads.
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          {isWorking ? (
            <span className="text-xs text-muted-foreground">Tracking this job…</span>
          ) : isFailed ? (
            <Button variant="ghost" size="sm" className="h-7" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => {
                if (text) {
                  navigator.clipboard.writeText(text);
                  toast.success("Copied");
                }
              }}
            >
              <CopyIcon className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isWorking && !isFailed && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="h-3.5 w-3.5 mr-2" /> Edit / iterate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onPromote}>
                    <Send className="h-3.5 w-3.5 mr-2" /> Add to an existing campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onUseInNewAd}>
                    <Plus className="h-3.5 w-3.5 mr-2" /> Use in a new ad
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {isFailed && (
                <>
                  <DropdownMenuItem onClick={onRetry}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Retry
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function PromoteDialog({
  draft,
  onClose,
  onDone,
}: {
  draft: CreativeDraft;
  onClose: () => void;
  onDone: () => void;
}) {
  const { activeBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!activeBrand?.id) return;
      try {
        const { data } = await (supabase as any)
          .from("campaign_workspaces")
          .select("id, name, offer_name, meta_campaign_ids")
          .eq("brand_id", activeBrand.id)
          .order("created_at", { ascending: false });
        const live = (data || []).filter((c: any) => {
          const ids = c.meta_campaign_ids;
          return Array.isArray(ids) ? ids.length > 0 : !!ids;
        });
        setCampaigns(
          live.map((c: any) => ({ id: c.id, name: c.name || c.offer_name || "Campaign" })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [activeBrand?.id]);

  const submit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("add-creative-to-campaign", {
        body: {
          workspace_id: selectedId,
          creative_id: draft.id,
          creative_type: draft.type,
          content: draft.content,
          asset_url: draft.asset_url,
          paused: true,
        },
      });
      if (error) throw error;

      await (supabase as any)
        .from("creatives")
        .update({
          status: "used",
          used_in: { workspace_id: selectedId, added_at: new Date().toISOString() },
        })
        .eq("id", draft.id);

      toast.success("Added to campaign — created paused. Confirm in Live Ads before it goes live.");
      onDone();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't add to campaign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold">Add to an existing campaign</h3>
            <p className="text-xs text-muted-foreground mt-1">
              The ad will be created <strong>paused</strong> in the same ad set. Nothing goes
              live until you confirm in Live Ads.
            </p>
          </div>
          {loading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No live campaigns yet. Launch or import one first.
            </p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose a campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!selectedId || submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Add paused
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
