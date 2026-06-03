import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Upload, Trash2, MessageSquare, Loader2, Image as ImageIcon, Info } from "lucide-react";
import { toast } from "sonner";

interface BoardItem {
  id: string;
  inspiration_item_id: string | null;
  uploaded_image_url: string | null;
  note: string | null;
  status: string;
  created_at: string;
  inspiration_items?: { image_url: string; title: string | null; source: string | null; tags: any } | null;
  displayUrl?: string;
}

async function resolveDisplayUrl(image_url: string): Promise<string> {
  if (!image_url) return "";
  if (image_url.startsWith("http")) return image_url;
  const { data } = await supabase.storage.from("inspiration").createSignedUrl(image_url, 60 * 60);
  return data?.signedUrl || "";
}

export default function BoardDetail() {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [board, setBoard] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [noteItem, setNoteItem] = useState<BoardItem | null>(null);
  const [noteValue, setNoteValue] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setAuthChecked(true);
      fetchBoard();
    })();
  }, [navigate, boardId]);

  const fetchBoard = async () => {
    if (!boardId) return;
    setLoading(true);
    try {
      const { data: b, error: bErr } = await supabase
        .from("boards")
        .select("id, name")
        .eq("id", boardId)
        .maybeSingle();
      if (bErr) throw bErr;
      if (!b) { toast.error("Board not found"); navigate("/boards"); return; }
      setBoard(b as any);

      const { data, error } = await supabase
        .from("board_items")
        .select("id, inspiration_item_id, uploaded_image_url, note, status, created_at, inspiration_items(image_url, title, source, tags)")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (it: any) => {
          const src = it.uploaded_image_url || it.inspiration_items?.image_url;
          return { ...it, displayUrl: src ? await resolveDisplayUrl(src) : "" } as BoardItem;
        })
      );
      setItems(enriched);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load board");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !boardId) return;
    setUploading(true);
    let ok = 0;
    let failed = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      for (const file of Array.from(files)) {
        if (file.size > 250 * 1024 * 1024) {
          toast.error(`${file.name} is over 250MB`);
          failed++;
          continue;
        }
        try {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${user.id}/boards/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("ad-photos")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("ad-photos").getPublicUrl(path);
          const { error: insErr } = await supabase
            .from("board_items")
            .insert({
              board_id: boardId,
              user_id: user.id,
              uploaded_image_url: pub.publicUrl,
              status: "pending",
            });
          if (insErr) throw insErr;
          ok++;
        } catch (err) {
          console.error("Upload failed for", file.name, err);
          failed++;
        }
      }
      if (ok) toast.success(`Uploaded ${ok} image${ok !== 1 ? "s" : ""}`);
      if (failed) toast.error(`${failed} upload${failed !== 1 ? "s" : ""} failed`);
      await fetchBoard();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeItem = async (item: BoardItem) => {
    if (!confirm("Remove this item from the board?")) return;
    try {
      const { error } = await supabase.from("board_items").delete().eq("id", item.id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success("Removed");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to remove");
    }
  };

  const openNote = (item: BoardItem) => {
    setNoteItem(item);
    setNoteValue(item.note || "");
  };

  const saveNote = async () => {
    if (!noteItem) return;
    try {
      const { error } = await supabase
        .from("board_items")
        .update({ note: noteValue || null })
        .eq("id", noteItem.id)
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.id === noteItem.id ? { ...x, note: noteValue || null } : x)));
      toast.success("Note saved");
      setNoteItem(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save note");
    }
  };

  if (!authChecked) {
    return <DashboardLayout><div className="p-8 text-sm text-muted-foreground">Loading…</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <button onClick={() => navigate("/boards")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> All boards
            </button>
            <h1 className="text-2xl font-bold">{board?.name || "Board"}</h1>
            <p className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading…" : "Upload images"}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border rounded-md p-3">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>Your uploads are private to your boards. The LUMI team may feature great ones in the shared library.</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center flex flex-col items-center gap-3 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
              <p className="text-sm">This board is empty. Save items from the inspiration library or upload your own.</p>
              <Button variant="outline" onClick={() => navigate("/inspiration")}>Browse inspiration</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const isUpload = !!item.uploaded_image_url;
              return (
                <div key={item.id} className="group rounded-lg border bg-muted/20 overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    {item.displayUrl && (
                      <img src={item.displayUrl} alt={item.note || ""} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {isUpload && (
                      <Badge
                        variant="outline"
                        className="absolute top-2 left-2 text-[10px] bg-background/90 backdrop-blur"
                      >
                        {item.status === "pending" ? "Pending review" : item.status === "approved" ? "Featured" : item.status === "rejected" ? "Private" : "Your upload"}
                      </Badge>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {item.note && <p className="text-xs text-foreground/80 line-clamp-2">{item.note}</p>}
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => openNote(item)}>
                        <MessageSquare className="h-3 w-3 mr-1" /> {item.note ? "Edit note" : "Add note"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-destructive" onClick={() => removeItem(item)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!noteItem} onOpenChange={(o) => !o && setNoteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Note</DialogTitle></DialogHeader>
          <Textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="What do you like about this ad? Anything you want to remember for your version…"
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteItem(null)}>Cancel</Button>
            <Button onClick={saveNote}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
