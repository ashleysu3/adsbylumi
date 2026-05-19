import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Film,
  Trash2,
  Upload,
  Loader2,
  Search,
  X,
  Tag as TagIcon,
  Pencil,
  Check,
  Plus,
  Type,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BRollTextEditor } from "@/components/BRollTextEditor";
import type { OverlayStyle } from "@/components/VideoTextPreview";

export interface BRollClip {
  id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  tags?: string[];
  uploaded_at: string;
  trim_start?: number;
  trim_end?: number;
  duration?: number;
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
  /** Stable id used to persist search/filter state per library. */
  libraryKey?: string;
  /**
   * Brand-level overlay styling (from OverlayStylePicker). Passed through
   * to the BRollTextEditor so preview + export match the brand's default
   * font / color / position. When absent the editor falls back to the
   * VideoTextPreview default.
   */
  overlayStyle?: OverlayStyle;
}

type SortMode = "newest" | "filename" | "tag_matches";

interface ParsedQuery {
  tags: string[]; // lower-cased
  phrases: string[]; // lower-cased exact substrings
  terms: string[]; // lower-cased loose terms
}

/**
 * Parse a search string supporting:
 *   #tag        → tag filter (must match a clip tag exactly, case-insensitive)
 *   "phrase"    → exact substring match in filename
 *   bare word   → loose substring match in filename or any tag
 */
function parseQuery(raw: string): ParsedQuery {
  const tags: string[] = [];
  const phrases: string[] = [];
  const terms: string[] = [];

  // Extract quoted phrases first (single or double quotes).
  const phraseRegex = /"([^"]+)"|'([^']+)'/g;
  let working = raw;
  let m: RegExpExecArray | null;
  while ((m = phraseRegex.exec(raw)) !== null) {
    const phrase = (m[1] ?? m[2] ?? "").trim();
    if (phrase) phrases.push(phrase.toLowerCase());
  }
  working = working.replace(phraseRegex, " ");

  // Tokenize remainder by whitespace.
  for (const tokenRaw of working.split(/\s+/)) {
    const token = tokenRaw.trim();
    if (!token) continue;
    if (token.startsWith("#") && token.length > 1) {
      tags.push(token.slice(1).toLowerCase());
    } else {
      terms.push(token.toLowerCase());
    }
  }

  return { tags, phrases, terms };
}

function clipMatches(clip: BRollClip, parsed: ParsedQuery): boolean {
  const name = clip.file_name.toLowerCase();
  const clipTags = (clip.tags || []).map((t) => t.toLowerCase());

  // Tag tokens: every #tag must be present on the clip.
  for (const t of parsed.tags) {
    if (!clipTags.includes(t)) return false;
  }
  // Quoted phrases: every phrase must appear in the filename.
  for (const p of parsed.phrases) {
    if (!name.includes(p)) return false;
  }
  // Loose terms: each must hit filename OR any tag.
  for (const term of parsed.terms) {
    const inName = name.includes(term);
    const inTags = clipTags.some((t) => t.includes(term));
    if (!inName && !inTags) return false;
  }
  return true;
}

/** Count how many of the query's tag/term/phrase tokens hit the clip's tags. */
function tagMatchScore(clip: BRollClip, parsed: ParsedQuery): number {
  const clipTags = (clip.tags || []).map((t) => t.toLowerCase());
  let score = 0;
  for (const t of parsed.tags) if (clipTags.includes(t)) score++;
  for (const term of parsed.terms) {
    if (clipTags.some((t) => t.includes(term))) score++;
  }
  for (const p of parsed.phrases) {
    if (clipTags.some((t) => t.includes(p))) score++;
  }
  return score;
}

function normalizeTag(input: string): string {
  return input.replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, "-");
}

const STORAGE_NS = "broll-lib-filters:v1";

function loadPersistedFilters(
  key: string
): { search: string; activeTag: string | null; sort: SortMode } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_NS}:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      activeTag:
        typeof parsed.activeTag === "string" ? parsed.activeTag : null,
      sort:
        parsed.sort === "filename" ||
        parsed.sort === "tag_matches" ||
        parsed.sort === "newest"
          ? parsed.sort
          : "newest",
    };
  } catch {
    return null;
  }
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
  libraryKey,
  overlayStyle,
}: BRollLibraryProps) {
  const persistKey = libraryKey || storagePrefix || brandId;

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Clip currently open in the text-overlay editor (null when closed).
  const [editingTextClip, setEditingTextClip] = useState<BRollClip | null>(null);

  // Lazy-init from localStorage so the value is restored on mount.
  const initial = useMemo(() => loadPersistedFilters(persistKey), [persistKey]);
  const [search, setSearch] = useState<string>(initial?.search ?? "");
  const [activeTag, setActiveTag] = useState<string | null>(
    initial?.activeTag ?? null
  );
  const [sort, setSort] = useState<SortMode>(initial?.sort ?? "newest");

  // Tag edit mode
  const [editMode, setEditMode] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  // Persist filters whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `${STORAGE_NS}:${persistKey}`,
        JSON.stringify({ search, activeTag, sort })
      );
    } catch {
      /* ignore quota errors */
    }
  }, [persistKey, search, activeTag, sort]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => (c.tags || []).forEach((t) => t && set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [clips]);

  const parsedQuery = useMemo(() => parseQuery(search), [search]);

  const filteredClips = useMemo(() => {
    const base = clips.filter((c) => {
      if (activeTag && !(c.tags || []).includes(activeTag)) return false;
      return clipMatches(c, parsedQuery);
    });

    const sorted = [...base];
    if (sort === "filename") {
      sorted.sort((a, b) =>
        a.file_name.localeCompare(b.file_name, undefined, {
          sensitivity: "base",
          numeric: true,
        })
      );
    } else if (sort === "tag_matches") {
      sorted.sort((a, b) => {
        const diff = tagMatchScore(b, parsedQuery) - tagMatchScore(a, parsedQuery);
        if (diff !== 0) return diff;
        // Fallback: newest first.
        return (
          new Date(b.uploaded_at).getTime() -
          new Date(a.uploaded_at).getTime()
        );
      });
    } else {
      // newest
      sorted.sort(
        (a, b) =>
          new Date(b.uploaded_at).getTime() -
          new Date(a.uploaded_at).getTime()
      );
    }
    return sorted;
  }, [clips, activeTag, parsedQuery, sort]);

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
          const msg: string = err.message ?? "";
          const isSizeError =
            err.statusCode === "413" ||
            msg.toLowerCase().includes("payload too large") ||
            msg.toLowerCase().includes("file size") ||
            msg.toLowerCase().includes("entity too large");
          toast.error(
            isSizeError
              ? `${file.name} exceeds the 250 MB server limit. Please trim or compress the video before uploading.`
              : `Failed to upload ${file.name}: ${msg}`
          );
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

  // ---- Tag edit operations (per clip) ----
  const updateClips = async (next: BRollClip[]) => {
    setSavingTags(true);
    try {
      await persistClips(next);
      onUpdate(next);
    } catch {
      toast.error("Failed to save tags");
    } finally {
      setSavingTags(false);
    }
  };

  const addTagToClip = async (clipId: string, raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    const next = clips.map((c) => {
      if (c.id !== clipId) return c;
      const existing = c.tags || [];
      if (existing.map((t) => t.toLowerCase()).includes(tag.toLowerCase()))
        return c;
      return { ...c, tags: [...existing, tag] };
    });
    setTagDrafts((d) => ({ ...d, [clipId]: "" }));
    await updateClips(next);
  };

  const removeTagFromClip = async (clipId: string, tag: string) => {
    const next = clips.map((c) =>
      c.id === clipId
        ? { ...c, tags: (c.tags || []).filter((t) => t !== tag) }
        : c
    );
    // If the active tag filter was this one and it no longer exists anywhere, clear it.
    if (activeTag === tag) {
      const stillUsed = next.some((c) => (c.tags || []).includes(tag));
      if (!stillUsed) setActiveTag(null);
    }
    await updateClips(next);
  };

  // ---- Library-wide tag operations ----
  const renameLibraryTag = async (oldTag: string, newRaw: string) => {
    const newTag = normalizeTag(newRaw);
    if (!newTag) {
      toast.error("Tag name can't be empty");
      return;
    }
    if (newTag === oldTag) {
      setRenameTarget(null);
      return;
    }
    const next = clips.map((c) => {
      if (!c.tags || !c.tags.includes(oldTag)) return c;
      const merged = Array.from(
        new Set(c.tags.map((t) => (t === oldTag ? newTag : t)))
      );
      return { ...c, tags: merged };
    });
    if (activeTag === oldTag) setActiveTag(newTag);
    setRenameTarget(null);
    setRenameValue("");
    await updateClips(next);
    toast.success(`Renamed #${oldTag} → #${newTag}`);
  };

  const deleteLibraryTag = async (tag: string) => {
    const next = clips.map((c) =>
      c.tags && c.tags.includes(tag)
        ? { ...c, tags: c.tags.filter((t) => t !== tag) }
        : c
    );
    if (activeTag === tag) setActiveTag(null);
    await updateClips(next);
    toast.success(`Deleted tag #${tag}`);
  };

  const clearFilters = () => {
    setSearch("");
    setActiveTag(null);
  };

  const hasActiveFilters =
    search.trim() !== "" || activeTag !== null || sort !== "newest";

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

      {/* Search & Filter */}
      {clips.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search e.g. coffee #morning "intro shot"'
                className="pl-8 pr-8 h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="h-9 sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="filename">Filename (A–Z)</SelectItem>
                <SelectItem value="tag_matches">Tag matches</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={editMode ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit tags
                </>
              )}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Tip: use{" "}
            <code className="px-1 py-0.5 rounded bg-muted">#tag</code> to filter
            by tag and{" "}
            <code className="px-1 py-0.5 rounded bg-muted">"exact phrase"</code>{" "}
            for filename matches.
          </p>

          {(allTags.length > 0 || hasActiveFilters) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={activeTag === null ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setActiveTag(null)}
              >
                All
              </Badge>
              {allTags.map((tag) => (
                <div key={tag} className="flex items-center">
                  {editMode && renameTarget === tag ? (
                    <div className="flex items-center gap-1 rounded border bg-background px-1">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            renameLibraryTag(tag, renameValue);
                          } else if (e.key === "Escape") {
                            setRenameTarget(null);
                          }
                        }}
                        className="h-6 w-28 text-xs px-1"
                      />
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => renameLibraryTag(tag, renameValue)}
                        aria-label="Save tag name"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setRenameTarget(null)}
                        aria-label="Cancel rename"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Badge
                      variant={activeTag === tag ? "default" : "outline"}
                      className="cursor-pointer text-xs gap-1 pr-1"
                      onClick={() =>
                        !editMode &&
                        setActiveTag(activeTag === tag ? null : tag)
                      }
                    >
                      <span>#{tag}</span>
                      {editMode && (
                        <span className="flex items-center gap-0.5 ml-0.5">
                          <button
                            type="button"
                            className="rounded hover:bg-foreground/10 p-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget(tag);
                              setRenameValue(tag);
                            }}
                            aria-label={`Rename tag ${tag}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded hover:bg-foreground/10 p-0.5 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLibraryTag(tag);
                            }}
                            aria-label={`Delete tag ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </Badge>
                  )}
                </div>
              ))}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Showing {filteredClips.length} of {clips.length} clip
            {clips.length !== 1 ? "s" : ""}
            {savingTags && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> saving…
              </span>
            )}
          </p>
        </div>
      )}

      {/* Clips Grid */}
      {filteredClips.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredClips.map((clip) => (
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
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white truncate">{clip.file_name}</p>
                {clip.tags && clip.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {clip.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white inline-flex items-center gap-1"
                      >
                        #{t}
                        {editMode && (
                          <button
                            type="button"
                            className="hover:text-destructive"
                            onClick={() => removeTagFromClip(clip.id, t)}
                            aria-label={`Remove tag ${t}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                    {clip.tags.length > 4 && !editMode && (
                      <span className="text-[10px] text-white/70">
                        +{clip.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {editMode ? (
                <div className="absolute top-2 left-2 right-2 flex gap-1">
                  <div className="relative flex-1">
                    <TagIcon className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <Input
                      value={tagDrafts[clip.id] || ""}
                      onChange={(e) =>
                        setTagDrafts((d) => ({
                          ...d,
                          [clip.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTagToClip(
                            clip.id,
                            tagDrafts[clip.id] || ""
                          );
                        }
                      }}
                      placeholder="Add tag"
                      className="h-7 text-xs pl-6 pr-1 bg-background/95"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    onClick={() =>
                      addTagToClip(clip.id, tagDrafts[clip.id] || "")
                    }
                    disabled={!tagDrafts[clip.id]?.trim()}
                    aria-label="Add tag"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(clip)}
                    disabled={deleting === clip.id}
                    aria-label="Delete clip"
                  >
                    {deleting === clip.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-background/95 hover:bg-background"
                    onClick={() => setEditingTextClip(clip)}
                    aria-label="Add text overlay"
                    title="Add text to this clip"
                  >
                    <Type className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* B-roll text editor modal — opens when user clicks the Type icon
          on any clip. Exports a rendered MP4 with text burned in. */}
      {editingTextClip && (
        <BRollTextEditor
          open={!!editingTextClip}
          onOpenChange={(o) => { if (!o) setEditingTextClip(null); }}
          videoUrl={editingTextClip.file_url}
          clipName={editingTextClip.file_name}
          style={overlayStyle}
        />
      )}

      {clips.length > 0 && filteredClips.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">
            No clips match your search.
          </p>
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
