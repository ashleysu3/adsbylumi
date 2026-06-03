import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PendingItem {
  id: string;
  board_id: string;
  user_id: string;
  uploaded_image_url: string;
  note: string | null;
  tags: any;
  created_at: string;
  uploaderEmail?: string;
  uploaderName?: string;
}

export default function AdminApprovals() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) { navigate("/"); return; }
      setAuthChecked(true);
      fetchQueue();
    })();
  }, [navigate]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("board_items")
        .select("id, board_id, user_id, uploaded_image_url, note, tags, created_at")
        .eq("status", "pending")
        .not("uploaded_image_url", "is", null)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data || []) as PendingItem[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      let profilesById: Record<string, { email?: string; full_name?: string }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);
        (profs || []).forEach((p: any) => {
          profilesById[p.id] = { email: p.email, full_name: p.full_name };
        });
      }
      setItems(
        rows.map((r) => ({
          ...r,
          uploaderEmail: profilesById[r.user_id]?.email,
          uploaderName: profilesById[r.user_id]?.full_name,
        }))
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (item: PendingItem) => {
    setActingId(item.id);
    try {
      // Pre-tag via edge function; existing user tags take precedence
      let aiTags: Record<string, any> = {};
      try {
        const { data: tagData } = await supabase.functions.invoke("tag-inspiration", {
          body: { imageUrl: item.uploaded_image_url },
        });
        const parsed = typeof tagData === "string" ? JSON.parse(tagData) : tagData;
        if (parsed && typeof parsed === "object" && !parsed.error) aiTags = parsed;
      } catch (tagErr) {
        console.warn("Auto-tag failed", tagErr);
      }

      const existing = item.tags && typeof item.tags === "object" ? item.tags : {};
      const tagsObj = { ...aiTags, ...existing };

      const { error: insErr } = await supabase
        .from("inspiration_items")
        .insert({
          image_url: item.uploaded_image_url,
          title: item.note || null,
          source: "community",
          tags: tagsObj,
        });
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from("board_items")
        .update({ status: "approved" })
        .eq("id", item.id)
        .select()
        .single();
      if (updErr) throw updErr;

      toast.success("Approved and added to library");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Approve failed");
    } finally {
      setActingId(null);
    }
  };

  const reject = async (item: PendingItem) => {
    setActingId(item.id);
    try {
      const { error } = await supabase
        .from("board_items")
        .update({ status: "rejected" })
        .eq("id", item.id)
        .select()
        .single();
      if (error) throw error;
      toast.success("Rejected");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Reject failed");
    } finally {
      setActingId(null);
    }
  };

  if (!authChecked) {
    return (
      <DashboardLayout>
        <div className="p-8 text-sm text-muted-foreground">Checking permissions…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AdminTabs />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            User-uploaded ads awaiting your review. Approve to promote into the global library; reject to leave on the user's board only.
          </p>
        </div>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center flex flex-col items-center gap-2 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              <p className="text-sm">Nothing pending — you're all caught up.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const isLoading = actingId === item.id;
              return (
                <Card key={item.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted">
                    <img
                      src={item.uploaded_image_url}
                      alt={item.note || "Pending upload"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm truncate">
                      {item.uploaderName || item.uploaderEmail || "Unknown user"}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      {item.uploaderEmail && item.uploaderName ? item.uploaderEmail + " · " : ""}
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {item.note && (
                      <p className="text-sm text-foreground/80 bg-muted/30 rounded p-2 whitespace-pre-wrap">
                        {item.note}
                      </p>
                    )}
                    {item.tags && Object.keys(item.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.tags).map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-[10px]">{String(v)}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approve(item)}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(item)} disabled={isLoading}>
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
