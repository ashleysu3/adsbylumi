import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Instagram, X, Link, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface SelectedPost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
}

interface ExistingPostPickerProps {
  brandId: string;
  instagramAccountId: string;
  selectedPosts: SelectedPost[];
  onSelectionChange: (posts: SelectedPost[]) => void;
}

export function ExistingPostPicker({
  brandId,
  instagramAccountId,
  selectedPosts,
  onSelectionChange,
}: ExistingPostPickerProps) {
  const [inputUrl, setInputUrl] = useState("");
  const [resolving, setResolving] = useState(false);

  const resolvePost = async () => {
    const url = inputUrl.trim();
    if (!url) return;

    // Basic validation
    if (!/instagram\.com\/(p|reel|tv)\/[\w-]/i.test(url)) {
      toast.error("Please paste a valid Instagram post or reel URL");
      return;
    }

    // Check for duplicates
    if (selectedPosts.some((p) => p.permalink === url.split("?")[0])) {
      toast.error("This post is already added");
      return;
    }

    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "resolve-instagram-post",
        { body: { url } }
      );

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const newPost: SelectedPost = {
        id: data.media_id || data.shortcode || url,
        caption: `@${data.author_name || "instagram"}`,
        media_type: "IMAGE", // oEmbed doesn't expose type, default to IMAGE
        media_url: data.thumbnail_url || "",
        thumbnail_url: data.thumbnail_url || "",
        permalink: data.permalink || url.split("?")[0],
      };

      onSelectionChange([...selectedPosts, newPost]);
      setInputUrl("");
    } catch (e: any) {
      toast.error(e?.message || "Could not resolve this post. Make sure it's public.");
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
    <div className="space-y-3">
      {/* URL Input */}
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

      {/* Helper tip */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Instagram className="h-3 w-3" />
        Open Instagram → tap ··· on a post → Copy Link → paste here
      </p>

      {/* Selected posts */}
      {selectedPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""} selected
          </p>
          <div className="grid grid-cols-3 gap-2">
            {selectedPosts.map((post) => (
              <div
                key={post.permalink}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary ring-2 ring-primary/30 group"
              >
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt={post.caption?.slice(0, 40) || "Instagram post"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Instagram className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removePost(post.permalink)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                {/* Author badge */}
                <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 bg-background/70 text-foreground backdrop-blur-sm max-w-[calc(100%-8px)] truncate">
                  {post.caption}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
