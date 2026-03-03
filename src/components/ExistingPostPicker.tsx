import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Instagram, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [posts, setPosts] = useState<SelectedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "analyze-instagram-posts",
        {
          body: { brandId, instagramAccountId, simple: true },
        }
      );
      if (fnError) throw fnError;
      const fetched = (data?.posts || []).map((p: any) => ({
        id: p.id,
        caption: p.caption || "",
        media_type: p.media_type,
        media_url: p.media_url,
        thumbnail_url: p.thumbnail_url,
        permalink: p.permalink,
      }));
      setPosts(fetched);
    } catch (e: any) {
      setError(e.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [brandId, instagramAccountId]);

  const togglePost = (post: SelectedPost) => {
    const exists = selectedPosts.find((p) => p.id === post.id);
    if (exists) {
      onSelectionChange(selectedPosts.filter((p) => p.id !== post.id));
    } else {
      onSelectionChange([...selectedPosts, post]);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchPosts}>
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No recent posts found on this Instagram account.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {selectedPosts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""} selected
        </p>
      )}
      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
        {posts.map((post) => {
          const isSelected = selectedPosts.some((p) => p.id === post.id);
          const thumb = post.thumbnail_url || post.media_url;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => togglePost(post)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent hover:border-muted-foreground/30"
              }`}
            >
              <img
                src={thumb}
                alt={post.caption?.slice(0, 40) || "Instagram post"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Overlay checkbox */}
              <div className="absolute top-1.5 right-1.5">
                <Checkbox
                  checked={isSelected}
                  className="h-5 w-5 bg-background/80 backdrop-blur-sm border-2"
                  tabIndex={-1}
                />
              </div>
              {/* Media type badge */}
              {post.media_type === "VIDEO" && (
                <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 bg-background/70 text-foreground backdrop-blur-sm">
                  Video
                </Badge>
              )}
              {post.media_type === "CAROUSEL_ALBUM" && (
                <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 bg-background/70 text-foreground backdrop-blur-sm">
                  Carousel
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
