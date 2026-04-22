import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Film, Plus, Pencil, Trash2, Loader2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BRollLibrary, type BRollClip } from "@/components/BRollLibrary";

interface NamedLibrary {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  clips: BRollClip[];
}

interface BRollLibrariesManagerProps {
  brandId: string;
  brandClips: BRollClip[];
  onBrandClipsChange: (clips: BRollClip[]) => void;
}

export function BRollLibrariesManager({
  brandId,
  brandClips,
  onBrandClipsChange,
}: BRollLibrariesManagerProps) {
  const [libraries, setLibraries] = useState<NamedLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<NamedLibrary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    fetchLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const fetchLibraries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("broll_libraries")
        .select("id, brand_id, name, description, clips")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setLibraries(
        (data || []).map((row: any) => ({
          ...row,
          clips: Array.isArray(row.clips) ? row.clips : [],
        }))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load b-roll libraries");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Give your library a name");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("broll_libraries")
        .insert({ brand_id: brandId, name, clips: [] })
        .select("id, brand_id, name, description, clips")
        .single();
      if (error) throw error;
      setLibraries((prev) => [
        ...prev,
        { ...(data as any), clips: [] as BRollClip[] },
      ]);
      setNewName("");
      toast.success(`Created "${name}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create library");
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (lib: NamedLibrary) => {
    const name = renameValue.trim();
    if (!name) return;
    try {
      const { error } = await supabase
        .from("broll_libraries")
        .update({ name })
        .eq("id", lib.id);
      if (error) throw error;
      setLibraries((prev) =>
        prev.map((l) => (l.id === lib.id ? { ...l, name } : l))
      );
      setRenamingId(null);
      toast.success("Renamed");
    } catch (err: any) {
      toast.error(err.message || "Failed to rename");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Best effort: clean up storage objects for this library
      const paths = (deleteTarget.clips || [])
        .map((c) => c.storage_path)
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("broll-library").remove(paths);
      }
      const { error } = await supabase
        .from("broll_libraries")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      setLibraries((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.name}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete library");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const persistLibraryClips = (libId: string) => async (clips: BRollClip[]) => {
    const { error } = await supabase
      .from("broll_libraries")
      .update({ clips: clips as any })
      .eq("id", libId);
    if (error) throw error;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          B-Roll Libraries
        </CardTitle>
        <CardDescription>
          Organize clips into named libraries (e.g. "Coffee shop", "Home office",
          "Black Friday"). Your <span className="font-medium">brand-wide</span>{" "}
          library is always available; named libraries can be assigned to
          specific campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New library name (e.g. Black Friday)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add library
          </Button>
        </div>

        <Accordion type="multiple" className="w-full">
          {/* Brand-wide default */}
          <AccordionItem value="__brand__">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2 text-left">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Brand-wide (default)</span>
                <Badge variant="secondary" className="text-xs">
                  {brandClips.length} clip{brandClips.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Always available
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <BRollLibrary
                brandId={brandId}
                clips={brandClips}
                onUpdate={onBrandClipsChange}
                libraryKey={`brand:${brandId}`}
                embedded
              />
            </AccordionContent>
          </AccordionItem>

          {/* Named libraries */}
          {loading && (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading &&
            libraries.map((lib) => (
              <AccordionItem key={lib.id} value={lib.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 text-left flex-1 min-w-0">
                    <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                    {renamingId === lib.id ? (
                      <Input
                        value={renameValue}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRename(lib);
                          } else if (e.key === "Escape") {
                            setRenamingId(null);
                          }
                        }}
                        className="h-7 max-w-[240px]"
                      />
                    ) : (
                      <span className="font-medium truncate">{lib.name}</span>
                    )}
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {lib.clips.length} clip
                      {lib.clips.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mr-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(lib.id);
                          setRenameValue(lib.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      asChild
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(lib);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </Button>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <BRollLibrary
                    brandId={brandId}
                    clips={lib.clips}
                    storagePrefix={`${brandId}/lib-${lib.id}`}
                    libraryKey={`lib:${lib.id}`}
                    persist={persistLibraryClips(lib.id)}
                    onUpdate={(clips) =>
                      setLibraries((prev) =>
                        prev.map((l) => (l.id === lib.id ? { ...l, clips } : l))
                      )
                    }
                    embedded
                  />
                </AccordionContent>
              </AccordionItem>
            ))}

          {!loading && libraries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No named libraries yet. Add one above to organize clips for
              specific campaigns.
            </p>
          )}
        </Accordion>
      </CardContent>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this library?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" and all {deleteTarget?.clips.length || 0}{" "}
              clip{(deleteTarget?.clips.length || 0) !== 1 ? "s" : ""} inside it
              will be permanently removed. Campaigns assigned to this library
              will fall back to your brand-wide library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
