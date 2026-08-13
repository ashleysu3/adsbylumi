import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Pin } from "lucide-react";
import { toast } from "sonner";

interface PinnedAd {
  id: string;
  domain: string;
  label: string | null;
  template: string | null;
  copy: any;
  images: { base64: string; aspect?: string }[] | null;
  active: boolean;
  created_at: string;
}

// Admin view for the demo safety net: every row here is a hand-approved ad
// that the onboarding payoff screen reveals instead of a fresh render when a
// visitor arrives from that domain. Pinning happens on the payoff screen
// itself ("Pin this ad for demos"); this page is for review and cleanup.
export default function AdminDemoAds() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<PinnedAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) { navigate("/"); return; }
      setAuthChecked(true);
      fetchRows();
    })();
  }, [navigate]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("demo_pinned_ads" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Couldn't load pinned demo ads");
    } finally {
      setLoading(false);
    }
  };

  const setActive = async (row: PinnedAd, active: boolean) => {
    const { error } = await supabase
      .from("demo_pinned_ads" as any)
      .update({ active })
      .eq("id", row.id)
      .select()
      .single();
    if (error) {
      toast.error("Couldn't update that pin");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active } : r)));
  };

  const remove = async (row: PinnedAd) => {
    if (!confirm(`Remove the pinned demo ad for ${row.domain}?`)) return;
    const { error } = await supabase.from("demo_pinned_ads" as any).delete().eq("id", row.id);
    if (error) {
      toast.error("Couldn't remove that pin");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Pin removed");
  };

  if (!authChecked) return null;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AdminTabs />
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Pin className="h-5 w-5 text-primary" /> Demo ads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hand-approved ads shown on the onboarding payoff screen for a specific
            domain. Pin one from that screen, then keep it active for demo day.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing pinned yet. Generate an ad in onboarding and hit "Pin this ad for demos".
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{row.domain}</span>
                    <Badge variant={row.active ? "default" : "secondary"}>
                      {row.active ? "Active" : "Off"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {row.images?.[0]?.base64 ? (
                    <img
                      src={`data:image/png;base64,${row.images[0].base64}`}
                      alt={`Pinned demo ad for ${row.domain}`}
                      className="w-full rounded-md border object-contain"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground">No image stored</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {row.label || "—"}{row.template ? ` · ${row.template}` : ""}
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={row.active}
                        onCheckedChange={(v) => setActive(row, v)}
                      />
                      Show in demos
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => remove(row)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
