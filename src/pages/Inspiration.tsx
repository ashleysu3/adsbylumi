import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bookmark, Plus, Loader2, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FILTERS: Record<string, string[]> = {
  format: ["single", "carousel", "video-still"],
  style: ["photo-forward", "type-led", "highlighter", "testimonial", "device-mockup"],
  hook: ["curiosity", "mistake", "outcome", "contrarian", "question"],
  energy: ["bold", "minimal", "warm", "playful"],
};

interface InspirationItem {
  id: string;
  image_url: string;
  title: string | null;
  source: string | null;
  tags: any;
  signedUrl?: string;
}

interface Board {
  id: string;
  name: string;
}

async function resolveDisplayUrl(image_url: string): Promise<string> {
  if (!image_url) return "";
  if (image_url.startsWith("http")) return image_url;
  const { data } = await supabase.storage.from("inspiration").createSignedUrl(image_url, 60 * 60);
  return data?.signedUrl || "";
}

export default function Inspiration() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string | null>>({
    format: null, style: null, hook: null, energy: null,
  });

  // Save-to-board dialog
  const [saveItem, setSaveItem] = useState<InspirationItem | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [savedBoardIds, setSavedBoardIds] = useState<Set<string>>(new Set());
  const [newBoardName, setNewBoardName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingTo, setSavingTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
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
      toast.error(e.message || "Failed to load inspiration");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return items.filter((it) => {
      for (const key of Object.keys(filters)) {
        const v = filters[key];
        if (v && it.tags?.[key] !== v) return false;
      }
      return true;
    });
  }, [items, filters]);

  const openSave = async (item: InspirationItem) => {
    setSaveItem(item);
    setSavedBoardIds(new Set());
    setNewBoardName("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: bds }, { data: existing }] = await Promise.all([
        supabase.from("boards").select("id, name").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("board_items").select("board_id").eq("user_id", user.id).eq("inspiration_item_id", item.id),
      ]);
      setBoards(bds || []);
      setSavedBoardIds(new Set((existing || []).map((r: any) => r.board_id)));
    } catch (e: any) {
      console.error(e);
    }
  };

  const saveToBoard = async (board: Board) => {
    if (!saveItem) return;
    setSavingTo(board.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("board_items").insert({
        board_id: board.id,
        user_id: user.id,
        inspiration_item_id: saveItem.id,
        status: "private",
      });
      if (error) throw error;
      setSavedBoardIds((prev) => new Set(prev).add(board.id));
      toast.success(`Saved to ${board.name}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save");
    } finally {
      setSavingTo(null);
    }
  };

  const createBoard = async () => {
    const name = newBoardName.trim();
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
      setBoards((prev) => [data as Board, ...prev]);
      setNewBoardName("");
      // Auto-save to the new board
      await saveToBoard(data as Board);
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

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Inspiration</h1>
            <p className="text-sm text-muted-foreground">
              Browse the LUMI library. Save ads to a board to use as references later.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/boards")}>
            <Bookmark className="h-4 w-4 mr-2" /> My boards
          </Button>
        </div>

        {/* Filter chips */}
        <div className="space-y-3">
          {Object.entries(FILTERS).map(([key, options]) => (
            <div key={key} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wide text-muted-foreground w-16 shrink-0">{key}</span>
              <button
                onClick={() => setFilters((f) => ({ ...f, [key]: null }))}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border transition-colors",
                  !filters[key] ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                )}
              >
                All
              </button>
              {options.map((opt) => {
                const active = filters[key] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setFilters((f) => ({ ...f, [key]: active ? null : opt }))}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs border transition-colors",
                      active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters({ format: null, style: null, hook: null, energy: null })}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Masonry */}
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="py-16 text-center flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <p className="text-sm">No matches. Try removing some filters.</p>
          </Card>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
            {filtered.map((item) => (
              <div key={item.id} className="break-inside-avoid mb-4">
                <div className="group relative rounded-lg overflow-hidden border bg-muted/20">
                  {item.signedUrl ? (
                    <img
                      src={item.signedUrl}
                      alt={item.title || ""}
                      className="w-full h-auto block"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-square bg-muted" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => openSave(item)}
                    >
                      <Bookmark className="h-3 w-3 mr-1.5" /> Save to board
                    </Button>
                  </div>
                </div>
                {(item.title || (item.tags && Object.keys(item.tags).length > 0)) && (
                  <div className="px-1 pt-1.5 space-y-1">
                    {item.title && <p className="text-xs font-medium truncate">{item.title}</p>}
                    <div className="flex flex-wrap gap-1">
                      {["format", "style", "hook", "energy"].map((k) =>
                        item.tags?.[k] ? (
                          <Badge key={k} variant="secondary" className="text-[10px]">{item.tags[k]}</Badge>
                        ) : null
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save to board dialog */}
      <Dialog open={!!saveItem} onOpenChange={(o) => !o && setSaveItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {boards.length > 0 ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {boards.map((b) => {
                  const saved = savedBoardIds.has(b.id);
                  const isLoading = savingTo === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => !saved && saveToBoard(b)}
                      disabled={saved || isLoading}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm text-left transition-colors",
                        saved ? "bg-muted text-muted-foreground" : "hover:bg-muted"
                      )}
                    >
                      <span className="truncate">{b.name}</span>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : saved ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You don't have any boards yet — create one below.</p>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="New board name"
                onKeyDown={(e) => { if (e.key === "Enter") createBoard(); }}
              />
              <Button onClick={createBoard} disabled={creating || !newBoardName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> New</>}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveItem(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
