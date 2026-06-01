import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Sparkles, Inbox } from "lucide-react";
import { toast } from "sonner";

type Strategy = {
  id: string;
  slug: string;
  name: string;
  industry: string[];
  business_model: string[];
  primary_goals: string[];
  keywords: string[];
  description: string;
  why_it_works: string;
  campaigns: any[];
  is_active: boolean;
  sort_order: number;
};

type RequestRow = {
  id: string;
  user_id: string;
  brand_id: string;
  brand_snapshot: any;
  user_goal: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const EMPTY: Partial<Strategy> = {
  slug: "",
  name: "",
  industry: [],
  business_model: [],
  primary_goals: [],
  keywords: [],
  description: "",
  why_it_works: "",
  campaigns: [],
  is_active: true,
  sort_order: 0,
};

function arrToStr(a: string[] | undefined) {
  return (a ?? []).join(", ");
}
function strToArr(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function AdminStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Strategy> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: strats }, { data: reqs }] = await Promise.all([
        supabase
          .from("recommended_strategies" as any)
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("strategy_requests" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setStrategies((strats as any) ?? []);
      setRequests((reqs as any) ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.slug || !editing.name) {
      toast.error("Slug and name are required");
      return;
    }
    let campaigns = editing.campaigns ?? [];
    if (typeof campaigns === "string") {
      try {
        campaigns = JSON.parse(campaigns);
      } catch {
        toast.error("Campaigns JSON is invalid");
        return;
      }
    }
    const payload = { ...editing, campaigns };
    try {
      if (editing.id) {
        const { error } = await supabase
          .from("recommended_strategies" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recommended_strategies" as any)
          .insert(payload);
        if (error) throw error;
      }
      toast.success("Saved");
      setDialogOpen(false);
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this strategy?")) return;
    const { error } = await supabase
      .from("recommended_strategies" as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const dismissRequest = async (id: string) => {
    const { error } = await supabase
      .from("strategy_requests" as any)
      .update({ status: "dismissed", responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const promoteRequest = (r: RequestRow) => {
    const snap = r.brand_snapshot ?? {};
    const brand = snap.brand ?? {};
    setEditing({
      ...EMPTY,
      slug: `${(brand.name ?? "brand")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: `Custom for ${brand.name ?? "brand"}`,
      industry: brand.industry ? [brand.industry] : [],
      primary_goals: r.user_goal ? [r.user_goal] : [],
      description: `Custom strategy from request ${r.id.slice(0, 8)}`,
    });
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <AdminTabs />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-lumi-pink-1" />
              Recommended Strategies
            </h1>
            <p className="text-sm text-muted-foreground">
              The library LUMI uses to recommend campaign plans to users.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ ...EMPTY })}>
                <Plus className="h-4 w-4 mr-1" /> New strategy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing?.id ? "Edit strategy" : "New strategy"}
                </DialogTitle>
              </DialogHeader>
              {editing && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Slug</Label>
                      <Input
                        value={editing.slug ?? ""}
                        onChange={(e) =>
                          setEditing({ ...editing, slug: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editing.name ?? ""}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Industries (comma-separated)</Label>
                      <Input
                        value={arrToStr(editing.industry)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            industry: strToArr(e.target.value),
                          })
                        }
                        placeholder="wedding, photographer"
                      />
                    </div>
                    <div>
                      <Label>Business models</Label>
                      <Input
                        value={arrToStr(editing.business_model)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            business_model: strToArr(e.target.value),
                          })
                        }
                        placeholder="service, local-service"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Primary goals</Label>
                      <Input
                        value={arrToStr(editing.primary_goals)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            primary_goals: strToArr(e.target.value),
                          })
                        }
                        placeholder="book_calls, grow_social"
                      />
                    </div>
                    <div>
                      <Label>Keywords</Label>
                      <Input
                        value={arrToStr(editing.keywords)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            keywords: strToArr(e.target.value),
                          })
                        }
                        placeholder="discovery call, contact form, inquiry"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Description (what the user sees)</Label>
                    <Textarea
                      value={editing.description ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Why it works</Label>
                    <Textarea
                      value={editing.why_it_works ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, why_it_works: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Campaigns (JSON array)</Label>
                    <Textarea
                      className="font-mono text-xs"
                      rows={10}
                      value={
                        typeof editing.campaigns === "string"
                          ? editing.campaigns
                          : JSON.stringify(editing.campaigns ?? [], null, 2)
                      }
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          campaigns: e.target.value as any,
                        })
                      }
                      placeholder='[{"name":"Grow on Instagram","objective":"OUTCOME_AWARENESS","goal":"grow_social","audience":"Broad+","budget_pct":40,"creative_brief":"Short talking-head intros..."}]'
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editing.is_active ?? true}
                        onCheckedChange={(v) =>
                          setEditing({ ...editing, is_active: v })
                        }
                      />
                      <Label>Active</Label>
                    </div>
                    <div>
                      <Label className="text-xs mr-2">Sort</Label>
                      <Input
                        type="number"
                        className="w-20 inline-block"
                        value={editing.sort_order ?? 0}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            sort_order: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={save} className="w-full">
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">
              Library ({strategies.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              <Inbox className="h-4 w-4 mr-1" />
              Pending requests (
              {requests.filter((r) => r.status === "pending").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-3 mt-4">
            {loading && <p className="text-muted-foreground">Loading…</p>}
            {strategies.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {s.name}
                        {!s.is_active && (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{s.slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(s);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-2">
                    {s.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {s.industry?.map((i) => (
                      <Badge key={i} variant="secondary">
                        {i}
                      </Badge>
                    ))}
                    {s.primary_goals?.map((g) => (
                      <Badge key={g} variant="outline">
                        {g}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {Array.isArray(s.campaigns) ? s.campaigns.length : 0} campaigns
                  </p>
                </CardContent>
              </Card>
            ))}
            {!loading && strategies.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No strategies yet. Click <strong>New strategy</strong> to add one.
              </p>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-3 mt-4">
            {requests.length === 0 && (
              <p className="text-muted-foreground text-sm">No requests yet.</p>
            )}
            {requests.map((r) => {
              const brand = r.brand_snapshot?.brand ?? {};
              return (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {brand.name ?? "Unknown brand"}
                          {brand.industry && (
                            <span className="text-muted-foreground font-normal text-sm">
                              {" · "}
                              {brand.industry}
                            </span>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Goal: {r.user_goal ?? "—"} · Status: {r.status} ·{" "}
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promoteRequest(r)}
                        >
                          Promote to template
                        </Button>
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissRequest(r.id)}
                          >
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm">
                    {brand.website_url && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {brand.website_url}
                      </p>
                    )}
                    {brand.value_proposition && (
                      <p className="text-sm">{brand.value_proposition}</p>
                    )}
                    {r.admin_notes && (
                      <p className="text-xs italic text-muted-foreground mt-1">
                        Note: {r.admin_notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
