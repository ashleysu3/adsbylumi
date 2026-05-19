import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Instagram, X, Link, Loader2, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SelectedPost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  instagram_account_id?: string;
}

interface ApiFetchedPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
}

interface ExistingPostPickerProps {
  brandId: string;
  instagramAccountId: string;
  instagramAccountName?: string;
  selectedPosts: SelectedPost[];
  onSelectionChange: (posts: SelectedPost[]) => void;
}

export function ExistingPostPicker({
  brandId,
  instagramAccountId,
  instagramAccountName,
  selectedPosts,
  onSelectionChange,
}: ExistingPostPickerProps) {
  const navigate = useNavigate();
  const [inputUrl, setInputUrl] = useState("");
  const [resolving, setResolving] = useState(false);

  // API-loaded posts
  const [apiPosts, setApiPosts] = useState<ApiFetchedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  // Auto-load posts from API on mount
  useEffect(() => {
    if (!brandId || !instagramAccountId) return;
    loadPosts();
  }, [brandId, instagramAccountId]);

  const loadPosts = async () => {
    setLoading(true);
    setFallbackMode(false);
    setNeedsReconnect(false);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-instagram-posts", {
        body: { brandId, instagramAccountId, simple: true },
      });

      if (error) throw error;

      if (data?.fallbackMode === "url_paste") {
        // Permission issue — user likely needs to reconnect to get instagram_basic
        setNeedsReconnect(true);
        setFallbackMode(true);
        setApiPosts([]);
        return;
      }
      
      if (!data?.posts?.length && !data?.error) {
        setFallbackMode(true);
        setApiPosts([]);
        return;
      }

      if (data?.error) {
        console.warn("API returned error:", data.error);
        // Check if it's a permission/access error
        const errMsg = (data.error || "").toLowerCase();
        if (errMsg.includes("permission") || errMsg.includes("code 10") || errMsg.includes("access")) {
          setNeedsReconnect(true);
        }
        setFallbackMode(true);
        return;
      }

      setApiPosts(data?.posts || []);
    } catch (e: any) {
      console.error("Failed to load posts:", e);
      setFallbackMode(true);
    } finally {
      setLoading(false);
    }
  };

  const isPostSelected = (permalink: string) => {
    const clean = permalink.replace(/\/$/, "");
    return selectedPosts.some((p) => p.permalink.replace(/\/$/, "") === clean);
  };

  const toggleApiPost = (post: ApiFetchedPost) => {
    const clean = post.permalink.replace(/\/$/, "");
    if (isPostSelected(post.permalink)) {
      onSelectionChange(selectedPosts.filter((p) => p.permalink.replace(/\/$/, "") !== clean));
    } else {
      const newPost: SelectedPost = {
        id: post.id,
        caption: post.caption || "",
        media_type: post.media_type,
        media_url: post.media_url || post.thumbnail_url || "",
        thumbnail_url: post.thumbnail_url || post.media_url || "",
        permalink: post.permalink,
        instagram_account_id: instagramAccountId,
      };
      onSelectionChange([...selectedPosts, newPost]);
    }
  };

  const resolvePost = async () => {
    const url = inputUrl.trim();
    if (!url) return;

    if (!/instagram\.com\/(p|reel|tv)\/[\w-]/i.test(url)) {
      toast.error("Please paste a valid Instagram post or reel URL");
      return;
    }

    const cleanUrl = url.split("?")[0].replace(/\/$/, "");
    if (selectedPosts.some((p) => p.permalink.replace(/\/$/, "") === cleanUrl)) {
      toast.error("This post is already added");
      return;
    }

    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-instagram-post", {
        body: { url },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const newPost: SelectedPost = {
        id: data.shortcode || url,
        caption: data.caption || "",
        media_type: data.media_type === "VIDEO" ? "VIDEO" : "IMAGE",
        media_url: data.thumbnail_url || "",
        thumbnail_url: data.thumbnail_url || "",
        permalink: data.permalink || cleanUrl,
      };
      onSelectionChange([...selectedPosts, newPost]);
      setInputUrl("");
    } catch (e: any) {
      toast.error(e?.message || "Could not resolve this post.");
    } finally {
      setResolving(false);
    }
  };

  const removePost = (permalink: string) => {
    onSelectionChange(selectedPosts.filter((p) => p.permalink !== permalink));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      resolvePost();
    }
  };

  return (
    <div className="space-y-4">
      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your Instagram posts...
        </div>
      )}

      {/* API-loaded posts grid */}
      {!loading && apiPosts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              Your recent posts — tap to select
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={loadPosts}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {apiPosts.map((post) => {
              const selected = isPostSelected(post.permalink);
              const thumb = post.thumbnail_url || post.media_url;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => toggleApiPost(post)}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden border-2 transition-all group",
                    selected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const next = (e.target as HTMLImageElement).nextElementSibling;
                        if (next) next.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div className={cn("w-full h-full bg-muted flex items-center justify-center absolute inset-0", thumb ? "hidden" : "")}>
                    <Instagram className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {selected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  {post.media_type === "VIDEO" && !selected && (
                    <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 bg-background/70 text-foreground backdrop-blur-sm">
                      Reel
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* URL paste fallback */}
      <div className="space-y-2">
        {apiPosts.length > 0 && (
          <p className="text-xs text-muted-foreground font-medium">
            Don't see your post? Paste the URL
          </p>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste Instagram post URL..."
              className="pl-9"
              disabled={resolving}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={resolvePost}
            disabled={resolving || !inputUrl.trim()}
          >
            {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        {/* Reconnect banner when posts can't load due to missing permission */}
        {needsReconnect && !loading && (
          <Alert className="border-primary/30 bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <span className="font-medium">We've added new features!</span>{" "}
              Reconnect your Meta account to browse and select posts directly.
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-primary font-medium"
                onClick={() => navigate("/meta-settings")}
              >
                Reconnect now →
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {apiPosts.length === 0 && !loading && !needsReconnect && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Instagram className="h-3 w-3" />
            {fallbackMode
              ? "Paste an Instagram post or reel URL to add it to your campaign"
              : "Open Instagram → tap ··· on a post → Copy Link → paste here"}
          </p>
        )}
      </div>

      {/* Selected posts summary */}
      {selectedPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""} selected
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {selectedPosts.map((post) => (
              <div
                key={post.permalink}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary ring-1 ring-primary/30 group"
              >
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt="Selected post"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const next = (e.target as HTMLImageElement).nextElementSibling;
                      if (next) next.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={`w-full h-full bg-muted flex items-center justify-center ${post.thumbnail_url ? "hidden absolute inset-0" : ""}`}
                >
                  <Instagram className="h-5 w-5 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={() => removePost(post.permalink)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
