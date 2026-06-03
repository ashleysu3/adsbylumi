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
import { Loader2, Upload, Wand2, Check, X, RefreshCw, Trash2 } from "lucide-react";
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

export default function AdminMagicTemplates() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentRefUrl, setCurrentRefUrl] = useState<string | null>(null);
  const [currentHtml, setCurrentHtml] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [currentType, setCurrentType] = useState<"single" | "carousel">("single");
  const [currentNeedsPhoto, setCurrentNeedsPhoto] = useState(true);
  const [currentCopySlots, setCurrentCopySlots] = useState<any>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ ok: boolean; errors: string[]; missingSlots: string[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) { navigate("/"); return; }
      setAuthChecked(true);
      fetchList();
    })();
  }, [navigate]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data || []) as TemplateRow[]);
    } catch (e: any) {
      toast.error(e.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const signUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("template-refs").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error) throw error;
    return data.signedUrl;
  };

  const resetCompose = () => {
    setFile(null); setNotes(""); setCurrentId(null); setCurrentRefUrl(null);
    setCurrentHtml(""); setCurrentName(""); setCurrentType("single");
    setCurrentNeedsPhoto(true); setCurrentCopySlots([]);
    setPreview(null); setValidation(null);
  };

  const handleGenerate = async () => {
    if (!file) { toast.error("Upload a reference image first"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop() || "png";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("template-refs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const signedUrl = await signUrl(path);
      setCurrentRefUrl(signedUrl);

      await runGenerate(signedUrl, path, notes);
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async (imageUrl: string, sourcePath: string, notesText: string) => {
    const { data: genData, error: genErr } = await supabase.functions.invoke("generate-template", {
      body: { imageUrl, notes: notesText },
    });
    if (genErr) throw genErr;
    const tpl = genData || {};
    if (tpl.error) throw new Error(`generate-template: ${tpl.error}`);
    const name = tpl.name || "Untitled template";
    const type = (tpl.type === "carousel" ? "carousel" : "single") as "single" | "carousel";
    const needsPhoto = tpl.needsPhoto ?? true;
    const copySlots = tpl.copySlots || [];
    const html = typeof tpl.html === "string" ? tpl.html : "";
    if (!html) {
      console.error("generate-template returned no html:", tpl);
      throw new Error("Model did not return html. Try again or simplify the reference image.");
    }

    // Insert draft
    const { data: ins, error: insErr } = await supabase.from("templates").insert({
      name, type, html,
      copy_slots: copySlots,
      slide_slots: tpl.slideSlots || [],
      needs_photo: needsPhoto,
      style_hint: tpl.styleHint || null,
      source_image_url: sourcePath,
      status: "draft",
    }).select("*").single();
    if (insErr) throw insErr;

    setCurrentId(ins.id);
    setCurrentName(name);
    setCurrentType(type);
    setCurrentNeedsPhoto(needsPhoto);
    setCurrentCopySlots(copySlots);
    setCurrentHtml(html);
    await fetchList();

    await runValidate(html, type, copySlots, needsPhoto);
  };

  const runValidate = async (html: string, type: string, copySlots: any, needsPhoto: boolean) => {
    setValidation(null); setPreview(null);
    const { data, error } = await supabase.functions.invoke("validate-template", {
      body: { html, type, copySlots, needsPhoto },
    });
    if (error) { toast.error("Validation call failed"); return; }
    const ok = !!data?.ok;
    const errors = data?.errors || [];
    const missingSlots = data?.missingSlots || [];
    const previewBase64 = data?.previewBase64 || null;
    setValidation({ ok, errors, missingSlots });
    if (previewBase64) setPreview(`data:image/png;base64,${previewBase64}`);
  };

  const handleRegenerate = async () => {
    if (!currentRefUrl) return;
    setBusy(true);
    try {
      // Re-resolve source path from currentId
      const row = rows.find(r => r.id === currentId);
      const path = row?.source_image_url || "";
      await runGenerate(currentRefUrl, path, notes);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleRevalidate = async () => {
    setBusy(true);
    try {
      // Save html edits first
      if (currentId) {
        await supabase.from("templates").update({ html: currentHtml }).eq("id", currentId);
      }
      await runValidate(currentHtml, currentType, currentCopySlots, currentNeedsPhoto);
      await fetchList();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("templates").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Template approved");
    if (id === currentId) resetCompose();
    fetchList();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("templates").update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected");
    fetchList();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    if (id === currentId) resetCompose();
    fetchList();
  };

  if (!authChecked) {
    return <DashboardLayout><div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <AdminTabs />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Magic Templates</h1>
          <p className="text-sm text-muted-foreground">Drop in a reference ad. AI builds a template that matches LUMI's render contract.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">New template from reference</CardTitle></CardHeader>
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
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={busy || !file}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                Generate template
              </Button>
              {currentId && <Button variant="outline" onClick={resetCompose}>Start over</Button>}
            </div>

            {currentId && (
              <div className="border-t pt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Reference</Label>
                    {currentRefUrl && <img src={currentRefUrl} alt="reference" className="mt-1 w-full rounded-md border" />}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Preview</Label>
                    {preview
                      ? <img src={preview} alt="preview" className="mt-1 w-full rounded-md border" />
                      : <div className="mt-1 aspect-square w-full rounded-md border flex items-center justify-center text-xs text-muted-foreground">{busy ? "Rendering…" : "No preview yet"}</div>}
                  </div>
                </div>

                {validation && (
                  validation.ok
                    ? <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">✓ Valid template</div>
                    : <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300 space-y-1">
                        <div className="font-medium">Invalid template</div>
                        {validation.errors.length > 0 && <ul className="list-disc pl-5">{validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
                        {validation.missingSlots.length > 0 && <div>Missing slots: {validation.missingSlots.join(", ")}</div>}
                      </div>
                )}

                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={currentName} onChange={(e) => setCurrentName(e.target.value)} onBlur={async () => {
                    if (currentId) await supabase.from("templates").update({ name: currentName }).eq("id", currentId);
                  }} />
                </div>

                <div className="grid gap-2">
                  <Label>HTML (edit and re-validate)</Label>
                  <Textarea value={currentHtml} onChange={(e) => setCurrentHtml(e.target.value)} rows={10} className="font-mono text-xs" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleRevalidate} variant="outline" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Re-validate
                  </Button>
                  <Button onClick={handleRegenerate} variant="outline" disabled={busy}>
                    <Wand2 className="h-4 w-4 mr-2" />Regenerate
                  </Button>
                  {validation?.ok && (
                    <Button onClick={() => handleApprove(currentId)} className="bg-green-600 hover:bg-green-700">
                      <Check className="h-4 w-4 mr-2" />Approve
                    </Button>
                  )}
                </div>
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
