import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bookmark, Plus, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Board {
  id: string;
  name: string;
  created_at: string;
  thumbnails: string[];
  count: number;
}

async function resolveDisplayUrl(image_url: string): Promise<string> {
  if (!image_url) return "";
  if (image_url.startsWith("http")) return image_url;
  const { data } = await supabase.storage.from("inspiration").createSignedUrl(image_url, 60 * 60);
  return data?.signedUrl || "";
}

export default function Boards() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setAuthChecked(true);
      fetchBoards();
    })();
  }, [navigate]);

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("boards")
        .select("id, name, created_at, board_items(uploaded_image_url, inspiration_item_id, inspiration_items(image_url))")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const enriched: Board[] = await Promise.all(
        (data || []).map(async (b: any) => {
          const items = (b.board_items || []) as any[];
          const previewItems = items.slice(0, 4);
          const thumbs = await Promise.all(
            previewItems.map(async (it) => {
              const src = it.uploaded_image_url || it.inspiration_items?.image_url;
              return src ? await resolveDisplayUrl(src) : "";
            })
          );
          return {
            id: b.id,
            name: b.name,
            created_at: b.created_at,
            thumbnails: thumbs.filter(Boolean),
            count: items.length,
          };
        })
      );
      setBoards(enriched);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load boards");
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("boards")
        .insert({ user_id: user.id, name })
        .select()
        .single();
      if (error) throw error;
      setCreateOpen(false);
      setNewName("");
      navigate(`/boards/${data.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to create board");
    } finally {
      setCreating(false);
    }
  };

  if (!authChecked) {
    return <DashboardLayout><div className="p-8 text-sm text-muted-foreground">Loading…</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">My boards</h1>
            <p className="text-sm text-muted-foreground">Save ads from the inspiration library or upload your own references.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/inspiration")}>
              <Bookmark className="h-4 w-4 mr-2" /> Browse inspiration
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New board
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : boards.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center flex flex-col items-center gap-3 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
              <p className="text-sm">No boards yet. Create one to start collecting references.</p>
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New board</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((b) => (
              <Card
                key={b.id}
                onClick={() => navigate(`/boards/${b.id}`)}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="grid grid-cols-2 grid-rows-2 aspect-[4/3] gap-0.5 bg-muted">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-muted overflow-hidden">
                      {b.thumbnails[i] ? (
                        <img src={b.thumbnails[i]} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                  ))}
                </div>
                <CardContent className="p-3">
                  <p className="font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.count} item{b.count !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New board</DialogTitle></DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Spring launch references"
            onKeyDown={(e) => { if (e.key === "Enter") createBoard(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createBoard} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
