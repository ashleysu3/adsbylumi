import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, Check, X, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TemplateRow {
  id: string;
  name: string | null;
  type: string | null;
  html: string | null;
  copy_slots: any;
  slide_slots: any;
  needs_photo: boolean | null;
  style_hint: string | null;
  source_image_url: string | null;
  preview_url: string | null;
  status: string | null;
  created_at: string;
}

interface RequestRow {
  id: string;
  reference_url: string;
  notes: string | null;
  status: string;
  result: any;
  error: string | null;
  attempts: number;
  created_at: string;
}

export default function AdminMagicTemplates() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) { navigate("/"); return; }
      setAuthChecked(true);
      fetchAll();
    })();
  }, [navigate]);

  // Auto-refresh requests so admins see status update as worker runs
  useEffect(() => {
    if (!authChecked) return;
    const t = setInterval(() => fetchRequests(), 8000);
    return () => clearInterval(t);
  }, [authChecked]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchList(), fetchRequests()]);
    setLoading(false);
  };

  const fetchList = async () => {
    const { data, error } = await supabase
      .from("templates").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data || []) as TemplateRow[]);
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("template_requests").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) return;
    setRequests((data || []) as RequestRow[]);
  };

  const signUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("template-refs").createSignedUrl(path, 60 * 60 * 24 * 30);
    if (error) throw error;
    return data.signedUrl;
  };

  const handleEnqueue = async () => {
    if (!file) { toast.error("Upload a reference image first"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop() || "png";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("template-refs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const signedUrl = await signUrl(path);

      const { error: insErr } = await supabase.from("template_requests").insert({
        reference_url: signedUrl,
        source_path: path,
        notes,
        requested_by: user!.id,
        status: "pending",
      });
      if (insErr) throw insErr;

      toast.success("Request queued — worker will build it shortly");
      setFile(null); setNotes("");
      await fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to queue request");
    } finally {
      setBusy(false);
    }
  };

  const handleRetryRequest = async (id: string) => {
    const { error } = await supabase
      .from("template_requests")
      .update({ status: "pending", error: null, locked_at: null, attempts: 0 })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Re-queued");
    fetchRequests();
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Delete this request?")) return;
    const { error } = await supabase.from("template_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchRequests();
  };

  const handleApprove = async (templateId: string, requestId?: string) => {
    const { error } = await supabase.from("templates").update({ status: "approved" }).eq("id", templateId);
    if (error) return toast.error(error.message);
    if (requestId) {
      await supabase.from("template_requests").update({ status: "ready" }).eq("id", requestId);
    }
    toast.success("Template approved");
    fetchAll();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("templates").update({ status: "rejected" }).eq("id", id);
    if (error) return toast.error(error.message);
    fetchList();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchList();
  };

  if (!authChecked) {
    return <DashboardLayout><div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div></DashboardLayout>;
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "secondary", building: "secondary", ready: "default", failed: "destructive",
    };
    return <Badge variant={(map[s] as any) || "secondary"}>{s}</Badge>;
  };

  return (
    <DashboardLayout>
      <AdminTabs />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Magic Templates</h1>
          <p className="text-sm text-muted-foreground">Drop in a reference ad. The worker builds it in the background and admins approve.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Queue a new template request</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Reference ad image</Label>
                <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. cutout style, bold headline, bottom CTA" rows={3} />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button onClick={handleEnqueue} disabled={busy || !file}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Queue build
              </Button>
              <span className="text-xs text-muted-foreground">Builds run in the background (~30–60s each).</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Build queue</CardTitle>
            <Button size="sm" variant="ghost" onClick={fetchRequests}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No requests yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {requests.map((r) => {
                  const previewB64 = r.result?.previewBase64;
                  const templateId = r.result?.template_id;
                  const tpl = templateId ? rows.find(t => t.id === templateId) : null;
                  const attempt = r.result?.attempt ?? r.attempts;
                  return (
                    <Card key={r.id} className="overflow-hidden">
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        {previewB64
                          ? <img src={`data:image/png;base64,${previewB64}`} alt="preview" className="w-full h-full object-cover" />
                          : <img src={r.reference_url} alt="ref" className="w-full h-full object-cover opacity-60" />}
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.result?.name || "Pending build"}</div>
                            <div className="text-xs text-muted-foreground">
                              attempt {attempt} · {new Date(r.created_at).toLocaleString()}
                            </div>
                          </div>
                          {statusBadge(r.status)}
                        </div>
                        {r.notes && <p className="text-xs text-muted-foreground line-clamp-2">{r.notes}</p>}
                        {r.error && <p className="text-xs text-destructive line-clamp-3">{r.error}</p>}
                        <div className="flex gap-1 flex-wrap">
                          {r.status === "ready" && tpl && tpl.status !== "approved" && (
                            <Button size="sm" onClick={() => handleApprove(tpl.id, r.id)} className="bg-green-600 hover:bg-green-700">
                              <Check className="h-3 w-3 mr-1" />Approve
                            </Button>
                          )}
                          {r.status === "ready" && tpl?.status === "approved" && (
                            <Badge variant="default">Approved</Badge>
                          )}
                          {r.status === "failed" && (
                            <Button size="sm" variant="outline" onClick={() => handleRetryRequest(r.id)}>
                              <RefreshCw className="h-3 w-3 mr-1" />Retry
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteRequest(r.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">All templates</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No templates yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((t) => (
                  <Card key={t.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      {t.preview_url
                        ? <img src={t.preview_url} alt={t.name || ""} className="w-full h-full object-cover" />
                        : <span className="text-xs text-muted-foreground">No preview</span>}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate text-sm">{t.name || "Untitled"}</div>
                          <div className="text-xs text-muted-foreground">{t.type || "single"}</div>
                        </div>
                        <Badge variant={t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"}>
                          {t.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {t.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => handleApprove(t.id)}>
                            <Check className="h-3 w-3 mr-1" />Approve
                          </Button>
                        )}
                        {t.status !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => handleReject(t.id)}>
                            <X className="h-3 w-3 mr-1" />Reject
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
