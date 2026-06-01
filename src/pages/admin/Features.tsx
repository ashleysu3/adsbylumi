import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Star, Sparkles, Search, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LumiFeature {
  id: string;
  name: string;
  slug: string | null;
  category: string;
  area: string | null;
  short_description: string | null;
  long_description: string | null;
  why_helpful: string | null;
  ideal_audience: string | null;
  status: string;
  highlight: boolean;
  tags: string[];
  related_pages: string[];
  marketing_angles: string[];
  sort_order: number;
  is_active: boolean;
  last_updated_note: string | null;
  updated_at: string;
}

const CATEGORIES = ["feature", "improvement", "fix", "highlight", "announcement"];
const STATUSES = ["live", "coming_soon", "beta", "deprecated"];
const AREAS = ["Planning", "Creative", "Data", "Brand", "Partners", "Billing", "Platform"];

function emptyFeature(): Partial<LumiFeature> {
  return {
    name: "", slug: "", category: "feature", area: "", short_description: "",
    long_description: "", why_helpful: "", ideal_audience: "", status: "live",
    highlight: false, tags: [], related_pages: [], marketing_angles: [],
    sort_order: 0, is_active: true, last_updated_note: "",
  };
}

export default function AdminFeatures() {
  const [features, setFeatures] = useState<LumiFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<LumiFeature> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("lumi_features")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      setFeatures((data as LumiFeature[]) || []);
    } catch (e: any) {
      toast.error("Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return features.filter((f) => {
      if (areaFilter !== "all" && (f.area || "") !== areaFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return [f.name, f.short_description, f.why_helpful, f.ideal_audience, (f.tags || []).join(" ")]
        .filter(Boolean).some((s: any) => String(s).toLowerCase().includes(q));
    });
  }, [features, query, areaFilter]);

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name.trim(),
        slug: editing.slug?.trim() || null,
        category: editing.category || "feature",
        area: editing.area || null,
        short_description: editing.short_description || null,
        long_description: editing.long_description || null,
        why_helpful: editing.why_helpful || null,
        ideal_audience: editing.ideal_audience || null,
        status: editing.status || "live",
        highlight: !!editing.highlight,
        tags: editing.tags || [],
        related_pages: editing.related_pages || [],
        marketing_angles: editing.marketing_angles || [],
        sort_order: editing.sort_order ?? 0,
        is_active: editing.is_active ?? true,
        last_updated_note: editing.last_updated_note || null,
      };
      if (editing.id) {
        const { error } = await supabase.from("lumi_features").update(payload).eq("id", editing.id).select().single();
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from("lumi_features").insert(payload);
        if (error) throw error;
        toast.success("Added");
      }
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this feature?")) return;
    const { error } = await supabase.from("lumi_features").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  async function toggleHighlight(f: LumiFeature) {
    const { error } = await supabase.from("lumi_features").update({ highlight: !f.highlight }).eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary" /> Lumi Features Catalog
          </h1>
          <p className="text-muted-foreground mt-1">
            The source-of-truth list of what Lumi actually does. Used to ground partner-portal AI suggestions,
            newsletter & social ideas, and marketing copy.
          </p>
        </div>
        <AdminTabs />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>All features ({features.length})</CardTitle>
              <CardDescription>Star a feature to mark it as a current marketing highlight.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input className="pl-8 w-56" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => setEditing(emptyFeature())}>
                <Plus className="w-4 h-4 mr-1" /> Add feature
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No features match.</p>}
            {filtered.map((f) => (
              <div key={f.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => toggleHighlight(f)}
                        title={f.highlight ? "Remove highlight" : "Mark as highlight"}
                        className="shrink-0"
                      >
                        <Star className={`w-4 h-4 ${f.highlight ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                      </button>
                      <span className="font-medium">{f.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{f.category}</Badge>
                      {f.area && <Badge variant="secondary" className="text-xs">{f.area}</Badge>}
                      <Badge variant={f.status === "live" ? "default" : "outline"} className="text-xs">{f.status}</Badge>
                      {!f.is_active && <Badge variant="destructive" className="text-xs">hidden</Badge>}
                    </div>
                    {f.short_description && (
                      <p className="text-sm text-muted-foreground mt-1">{f.short_description}</p>
                    )}
                    {f.why_helpful && (
                      <p className="text-xs text-foreground/80 mt-1">
                        <span className="font-semibold">Why it helps: </span>{f.why_helpful}
                      </p>
                    )}
                    {(f.tags || []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit feature" : "New feature"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Name *</Label>
                  <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Area</Label>
                  <Select value={editing.area || ""} onValueChange={(v) => setEditing({ ...editing, area: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort order</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <Label>Short description</Label>
                <Input value={editing.short_description || ""} onChange={(e) => setEditing({ ...editing, short_description: e.target.value })} maxLength={200} placeholder="One sentence — what is this?" />
              </div>
              <div>
                <Label>Long description</Label>
                <Textarea rows={3} value={editing.long_description || ""} onChange={(e) => setEditing({ ...editing, long_description: e.target.value })} maxLength={1000} placeholder="What does it actually do?" />
              </div>
              <div>
                <Label>Why it's helpful for our ideal audience</Label>
                <Textarea rows={3} value={editing.why_helpful || ""} onChange={(e) => setEditing({ ...editing, why_helpful: e.target.value })} maxLength={1000} placeholder="What pain does it remove? What lets a non-expert coach win?" />
              </div>
              <div>
                <Label>Ideal audience for this feature</Label>
                <Input value={editing.ideal_audience || ""} onChange={(e) => setEditing({ ...editing, ideal_audience: e.target.value })} maxLength={300} placeholder="e.g. Coaches launching their first ad campaign" />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={(editing.tags || []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="planning, ai, creative"
                />
              </div>
              <div>
                <Label>Marketing angles (one per line)</Label>
                <Textarea
                  rows={3}
                  value={(editing.marketing_angles || []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, marketing_angles: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  placeholder={"Hook for a newsletter, social post, or ad…"}
                />
              </div>
              <div>
                <Label>Related pages (one per line)</Label>
                <Textarea
                  rows={2}
                  value={(editing.related_pages || []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, related_pages: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  placeholder={"/planning\n/creative"}
                />
              </div>
              <div>
                <Label>Last updated note (optional)</Label>
                <Input value={editing.last_updated_note || ""} onChange={(e) => setEditing({ ...editing, last_updated_note: e.target.value })} maxLength={200} placeholder="e.g. Refreshed hook library Mar 2026" />
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!editing.highlight} onCheckedChange={(v) => setEditing({ ...editing, highlight: v })} />
                  Mark as marketing highlight
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  Active (visible to AI grounding)
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
