import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Trash2, Edit, Loader2, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";

// Keep this in sync with the beat-tagging categories the talking-head-script generator
// uses to pick matching footage — a clip can belong to more than one category.
const CATEGORIES = [
  "working-laptop",
  "coffee",
  "hobby",
  "lifestyle",
  "animals",
  "driving-in-car",
  "work-event",
  "meeting-podcast",
  "teaching",
  "travel-vacation",
  "misc",
];

interface StockBrollClip {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string | null;
  categories: string[];
  duration_seconds: number | null;
  created_at: string;
  signedUrl?: string;
}

function publicUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("stock-broll").getPublicUrl(path);
  return data.publicUrl;
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}

export default function AdminStockBroll() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [clips, setClips] = useState<StockBrollClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkCategories, setBulkCategories] = useState<string[]>([]);

  const [editing, setEditing] = useState<StockBrollClip | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) { navigate("/"); return; }
      setAuthChecked(true);
      fetchClips();
    })();
  }, [navigate]);

  const fetchClips = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stock_broll_clips" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClips(((data as any) || []).map((c: StockBrollClip) => ({ ...c, signedUrl: publicUrl(c.video_url) })));
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load stock b-roll library");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (list: string[], setList: (v: string[]) => void, cat: string) => {
    setList(list.includes(cat) ? list.filter((c) => c !== cat) : [...list, cat]);
  };

  const handleBulkUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          const duration = await readDuration(file);
          const ext = file.name.split(".").pop() || "mp4";
          const path = `${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("stock-broll")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;

          const { error: insErr } = await supabase
            .from("stock_broll_clips" as any)
            .insert({
              video_url: path,
              title: bulkTitle || file.name,
              categories: bulkCategories.length ? bulkCategories : ["misc"],
              duration_seconds: duration,
              source: "stock",
            });
          if (insErr) throw insErr;
          ok++;
        } catch (err: any) {
          console.error("Upload failed for", file.name, err);
          failed++;
        }
      }
      if (ok) toast.success(`Uploaded ${ok} clip${ok !== 1 ? "s" : ""}`);
      if (failed) toast.error(`${failed} upload${failed !== 1 ? "s" : ""} failed`);
      await fetchClips();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openEdit = (clip: StockBrollClip) => {
    setEditing(clip);
    setEditTitle(clip.title || "");
    setEditCategories(clip.categories || []);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const { error } = await supabase
        .from("stock_broll_clips" as any)
        .update({
          title: editTitle || null,
          categories: editCategories.length ? editCategories : ["misc"],
        })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Saved");
      setEditing(null);
      await fetchClips();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save");
    }
  };

  const deleteClip = async (clip: StockBrollClip) => {
    if (!confirm("Delete this stock clip? This cannot be undone.")) return;
    try {
      if (clip.video_url && !clip.video_url.startsWith("http")) {
        await supabase.storage.from("stock-broll").remove([clip.video_url]);
      }
      const { error } = await supabase.from("stock_broll_clips" as any).delete().eq("id", clip.id);
      if (error) throw error;
      toast.success("Deleted");
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
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
          <h1 className="text-2xl font-bold">Stock B-Roll Library</h1>
          <p className="text-sm text-muted-foreground">
            Generic stock footage used to auto-assemble a b-roll ad for brand-new visitors before they've
            uploaded any of their own footage. Tag each clip by category so it can be matched to the right
            script beat.
          </p>
        </div>

        {/* Upload card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulk upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title prefix (optional — applied to every file)</Label>
              <Input value={bulkTitle} onChange={(e) => setBulkTitle(e.target.value)} placeholder="e.g. Coffee shop b-roll pack" />
            </div>
            <div>
              <Label className="text-xs">Categories (applied to every file in this batch)</Label>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={bulkCategories.includes(cat)}
                      onCheckedChange={() => toggleCategory(bulkCategories, setBulkCategories, cat)}
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              No category selected defaults every file in the batch to "misc". Edit individual clips below after upload.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleBulkUpload(e.target.files)}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading…" : "Choose videos"}
            </Button>
          </CardContent>
        </Card>

        {/* Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current library ({clips.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
            ) : clips.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center flex flex-col items-center gap-2">
                <VideoIcon className="h-8 w-8 opacity-40" />
                No clips yet. Upload some above.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {clips.map((clip) => (
                  <div key={clip.id} className="group relative rounded-lg overflow-hidden border bg-muted/20">
                    <div className="aspect-video bg-black">
                      {clip.signedUrl && (
                        <video src={clip.signedUrl} className="w-full h-full object-cover" muted controls preload="metadata" />
                      )}
                    </div>
                    <div className="p-2 space-y-1.5">
                      {clip.title && <p className="text-xs font-medium truncate">{clip.title}</p>}
                      <div className="flex flex-wrap gap-1">
                        {(clip.categories || []).map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                        ))}
                        {clip.duration_seconds != null && (
                          <Badge variant="outline" className="text-[10px]">{Math.round(clip.duration_seconds)}s</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => openEdit(clip)}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => deleteClip(clip)}>
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
            <DialogTitle>Edit stock clip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Categories</Label>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={editCategories.includes(cat)}
                      onCheckedChange={() => toggleCategory(editCategories, setEditCategories, cat)}
                    />
                    {cat}
                  </label>
                ))}
              </div>
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
