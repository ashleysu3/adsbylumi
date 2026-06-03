import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Edit, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const FORMATS = ["single", "carousel", "video-still"];
const STYLES = ["photo-forward", "type-led", "highlighter", "testimonial", "device-mockup"];
const HOOKS = ["curiosity", "mistake", "outcome", "contrarian", "question"];
const ENERGIES = ["bold", "minimal", "warm", "playful"];

interface InspirationItem {
  id: string;
  image_url: string;
  title: string | null;
  source: string | null;
  tags: any;
  created_at: string;
  signedUrl?: string;
}

interface TagState {
  format: string;
  style: string;
  hook: string;
  energy: string;
}

const emptyTags: TagState = { format: "", style: "", hook: "", energy: "" };

// Resolve a signed URL for an inspiration_items.image_url. Supports either a storage path
// inside the `inspiration` bucket OR a full URL (e.g. a community item pointing at ad-photos).
async function resolveDisplayUrl(image_url: string): Promise<string> {
  if (!image_url) return "";
  if (image_url.startsWith("http")) return image_url;
  const { data } = await supabase.storage.from("inspiration").createSignedUrl(image_url, 60 * 60);
  return data?.signedUrl || "";
}

export default function AdminInspiration() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bulkTags, setBulkTags] = useState<TagState>(emptyTags);
  const [bulkTitle, setBulkTitle] = useState("");

  const [editing, setEditing] = useState<InspirationItem | null>(null);
  const [editTags, setEditTags] = useState<TagState>(emptyTags);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) { navigate("/"); return; }
      setAuthChecked(true);
      fetchItems();
    })();
  }, [navigate]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inspiration_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const withUrls = await Promise.all(
        (data || []).map(async (it: any) => ({ ...it, signedUrl: await resolveDisplayUrl(it.image_url) }))
      );
      setItems(withUrls);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load library");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("inspiration")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;

          const tagsObj: Record<string, string> = {};
          if (bulkTags.format) tagsObj.format = bulkTags.format;
          if (bulkTags.style) tagsObj.style = bulkTags.style;
          if (bulkTags.hook) tagsObj.hook = bulkTags.hook;
          if (bulkTags.energy) tagsObj.energy = bulkTags.energy;

          const { error: insErr } = await supabase
            .from("inspiration_items")
            .insert({
              image_url: path,
              title: bulkTitle || file.name,
              source: "curated",
              tags: tagsObj,
            });
          if (insErr) throw insErr;
          ok++;
        } catch (err: any) {
          console.error("Upload failed for", file.name, err);
          failed++;
        }
      }
      if (ok) toast.success(`Uploaded ${ok} image${ok !== 1 ? "s" : ""}`);
      if (failed) toast.error(`${failed} upload${failed !== 1 ? "s" : ""} failed`);
      await fetchItems();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openEdit = (item: InspirationItem) => {
    setEditing(item);
    setEditTitle(item.title || "");
    setEditTags({
      format: item.tags?.format || "",
      style: item.tags?.style || "",
      hook: item.tags?.hook || "",
      energy: item.tags?.energy || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const tagsObj: Record<string, string> = { ...(editing.tags || {}) };
      ["format", "style", "hook", "energy"].forEach((k) => {
        const v = (editTags as any)[k];
        if (v) tagsObj[k] = v; else delete tagsObj[k];
      });
      const { error } = await supabase
        .from("inspiration_items")
        .update({ title: editTitle || null, tags: tagsObj })
        .eq("id", editing.id)
        .select()
        .single();
      if (error) throw error;
      toast.success("Saved");
      setEditing(null);
      await fetchItems();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save");
    }
  };

  const deleteItem = async (item: InspirationItem) => {
    if (!confirm("Delete this inspiration item? This cannot be undone.")) return;
    try {
      // Best-effort remove from storage only when it's a path in the inspiration bucket
      if (item.image_url && !item.image_url.startsWith("http")) {
        await supabase.storage.from("inspiration").remove([item.image_url]);
      }
      const { error } = await supabase.from("inspiration_items").delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Deleted");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete");
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
          <h1 className="text-2xl font-bold">Inspiration Library</h1>
          <p className="text-sm text-muted-foreground">
            Curate the global ad inspiration library. Bulk-upload images, tag them, and they'll appear on every user's /inspiration page.
          </p>
        </div>

        {/* Upload card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulk upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Title prefix (optional — applied to every file)</Label>
                <Input value={bulkTitle} onChange={(e) => setBulkTitle(e.target.value)} placeholder="e.g. Summer drop" />
              </div>
              <div />
              <TagSelect label="Format" options={FORMATS} value={bulkTags.format} onChange={(v) => setBulkTags({ ...bulkTags, format: v })} />
              <TagSelect label="Style" options={STYLES} value={bulkTags.style} onChange={(v) => setBulkTags({ ...bulkTags, style: v })} />
              <TagSelect label="Hook" options={HOOKS} value={bulkTags.hook} onChange={(v) => setBulkTags({ ...bulkTags, hook: v })} />
              <TagSelect label="Energy" options={ENERGIES} value={bulkTags.energy} onChange={(v) => setBulkTags({ ...bulkTags, energy: v })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Tags are applied to every file in this batch. Edit individual items below after upload.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleBulkUpload(e.target.files)}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading…" : "Choose images"}
            </Button>
          </CardContent>
        </Card>

        {/* Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current library ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center flex flex-col items-center gap-2">
                <ImageIcon className="h-8 w-8 opacity-40" />
                No items yet. Upload some above.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="group relative rounded-lg overflow-hidden border bg-muted/20">
                    <div className="aspect-square bg-muted">
                      {item.signedUrl && (
                        <img src={item.signedUrl} alt={item.title || ""} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="p-2 space-y-1.5">
                      {item.title && <p className="text-xs font-medium truncate">{item.title}</p>}
                      <div className="flex flex-wrap gap-1">
                        {item.source === "community" && (
                          <Badge variant="outline" className="text-[10px]">community</Badge>
                        )}
                        {["format", "style", "hook", "energy"].map((k) =>
                          item.tags?.[k] ? (
                            <Badge key={k} variant="secondary" className="text-[10px]">{item.tags[k]}</Badge>
                          ) : null
                        )}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => openEdit(item)}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => deleteItem(item)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit inspiration item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TagSelect label="Format" options={FORMATS} value={editTags.format} onChange={(v) => setEditTags({ ...editTags, format: v })} />
              <TagSelect label="Style" options={STYLES} value={editTags.style} onChange={(v) => setEditTags({ ...editTags, style: v })} />
              <TagSelect label="Hook" options={HOOKS} value={editTags.hook} onChange={(v) => setEditTags({ ...editTags, hook: v })} />
              <TagSelect label="Energy" options={ENERGIES} value={editTags.energy} onChange={(v) => setEditTags({ ...editTags, energy: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function TagSelect({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— none —</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
