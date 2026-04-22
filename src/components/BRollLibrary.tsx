import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Film, Trash2, Upload, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BRollClip {
  id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  tags?: string[];
  uploaded_at: string;
}

interface BRollLibraryProps {
  brandId: string;
  clips: BRollClip[];
  onUpdate: (clips: BRollClip[]) => void;
  /** Where to persist the updated clip list. Defaults to brands.broll_library. */
  persist?: (clips: BRollClip[]) => Promise<void>;
  title?: string;
  description?: string;
  /** Optional folder prefix inside the storage bucket. Defaults to brandId. */
  storagePrefix?: string;
  /** Hide the surrounding card chrome (used when embedded inside another card). */
  embedded?: boolean;
}

export function BRollLibrary({
  brandId,
  clips,
  onUpdate,
  persist,
  title = "B-Roll Library",
  description = "Upload your everyday b-roll clips (under 30 seconds each). Lumi will auto-pair them with text overlays in the production checklist.",
  storagePrefix,
  embedded = false,
}: BRollLibraryProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => (c.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set).sort();
  }, [clips]);

  const filteredClips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clips.filter((c) => {
      if (activeTag && !(c.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      const inName = c.file_name.toLowerCase().includes(q);
      const inTags = (c.tags || []).some((t) => t.toLowerCase().includes(q));
      return inName || inTags;
    });
  }, [clips, search, activeTag]);

  const persistClips = useCallback(
    async (next: BRollClip[]) => {
      if (persist) {
        await persist(next);
        return;
      }
      const { error } = await supabase
        .from("brands")
        .update({ broll_library: next as any })
        .eq("id", brandId);
      if (error) throw error;
    },
    [persist, brandId]
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const validFiles = Array.from(files).filter((f) => {
        if (!f.type.startsWith("video/")) {
          toast.error(`${f.name} is not a video file`);
          return false;
        }
        if (f.size > 250 * 1024 * 1024) {
          toast.error(`${f.name} exceeds 250MB limit`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      setUploading(true);
      const newClips: BRollClip[] = [];
      const prefix = storagePrefix || brandId;

      for (const file of validFiles) {
        const id = crypto.randomUUID();
        const storagePath = `${prefix}/${id}-${file.name}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from("broll-library")
            .upload(storagePath, file, { contentType: file.type });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("broll-library")
            .getPublicUrl(storagePath);

          newClips.push({
            id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            storage_path: storagePath,
            tags: [],
            uploaded_at: new Date().toISOString(),
          });
        } catch (err: any) {
          toast.error(`Failed to upload ${file.name}: ${err.message}`);
        }
      }

      if (newClips.length > 0) {
        const updated = [...clips, ...newClips];
        try {
          await persistClips(updated);
          onUpdate(updated);
          toast.success(
            `${newClips.length} clip${newClips.length > 1 ? "s" : ""} uploaded`
          );
        } catch {
          toast.error("Failed to save clips");
        }
      }

      setUploading(false);
      e.target.value = "";
    },
    [brandId, clips, onUpdate, persistClips, storagePrefix]
  );

  const handleDelete = async (clip: BRollClip) => {
    setDeleting(clip.id);
    try {
      await supabase.storage.from("broll-library").remove([clip.storage_path]);
      const updated = clips.filter((c) => c.id !== clip.id);
      await persistClips(updated);
      onUpdate(updated);
      toast.success("Clip removed");
    } catch {
      toast.error("Failed to delete clip");
    }
    setDeleting(null);
  };

  const body = (
    <div className="space-y-4">
      {/* Upload Zone */}
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground">
          {uploading
            ? "Uploading..."
            : "Click to upload video clips (max 250MB each)"}
        </span>
        <input
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {/* Clips Grid */}
      {clips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="relative group rounded-lg overflow-hidden border bg-muted/30"
            >
              <video
                src={clip.file_url}
                className="w-full aspect-[9/16] object-contain bg-black"
                muted
                preload="metadata"
                playsInline
                onMouseEnter={(e) =>
                  (e.target as HTMLVideoElement).play().catch(() => {})
                }
                onMouseLeave={(e) => {
                  const v = e.target as HTMLVideoElement;
                  v.pause();
                  v.currentTime = 0;
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-xs text-white truncate">{clip.file_name}</p>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(clip)}
                disabled={deleting === clip.id}
              >
                {deleting === clip.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {clips.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            💡 Upload clips like: pouring coffee, typing on a laptop, walking the
            dog, fixing your hair, driving...
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Film className="h-5 w-5" />
          {title}
          {clips.length > 0 && (
            <Badge variant="secondary">
              {clips.length} clip{clips.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
