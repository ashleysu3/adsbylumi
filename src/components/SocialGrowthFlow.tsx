import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Instagram, Play, Users, CheckCircle2, AlertCircle, ArrowRight, Image, AlertTriangle, Link, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";
import { cn } from "@/lib/utils";
import { LumiThinkingInline } from "@/components/LumiThinking";
import { formatInvokeError } from "@/lib/formatInvokeError";

interface InstagramPost {
  id: string;
  caption: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface SocialGrowthFlowProps {
  brandId: string;
  brandName: string;
  instagramAccountId: string | null;
  instagramAccountName: string | null;
  audiencePsychology: any;
  onComplete: (data: {
    objective: "traffic" | "video_views" | "engagement";
    selectedPosts: InstagramPost[];
  }) => void;
  onConnectInstagram: () => void;
  onBack: () => void;
  /** When set, skips the objective selection step and goes directly to post picker */
  fixedObjective?: "traffic" | "video_views" | "engagement";
  /** Custom header text for the post picker intro */
  headerText?: string;
  /** Custom subtext for the post picker intro */
  headerSubtext?: string;
}

type FlowStep = "objective" | "post_selection";

export function SocialGrowthFlow({
  brandId,
  brandName,
  instagramAccountId,
  instagramAccountName,
  audiencePsychology,
  onComplete,
  onConnectInstagram,
  onBack,
  fixedObjective,
  headerText,
  headerSubtext,
}: SocialGrowthFlowProps) {
  const [step, setStep] = useState<FlowStep>(fixedObjective ? "post_selection" : "objective");
  const [objective, setObjective] = useState<"traffic" | "video_views" | "engagement" | null>(fixedObjective || null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [resolvingUrl, setResolvingUrl] = useState(false);

  // Skip scraping — go straight to post selection with URL paste UX
  const handleObjectiveSelect = (selected: "traffic" | "video_views" | "engagement") => {
    setObjective(selected);
    setStep("post_selection");
  };

  // Auto-advance when fixedObjective is set
  useEffect(() => {
    if (fixedObjective && step !== "post_selection") {
      setStep("post_selection");
    }
  }, [fixedObjective]);

  const togglePostSelection = (postId: string) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId].slice(0, 6)
    );
  };

  const addPostFromUrl = async () => {
    const url = pasteUrl.trim();
    if (!url) return;

    if (!/instagram\.com\/(p|reel|tv)\/[\w-]/i.test(url)) {
      toast.error("Please paste a valid Instagram post or reel URL");
      return;
    }

    if (posts.some((p) => p.permalink.replace(/\/$/, "") === url.split("?")[0].replace(/\/$/, ""))) {
      toast.error("This post is already added");
      return;
    }

    setResolvingUrl(true);
    try {
      const { data, error: resolveError } = await supabase.functions.invoke("resolve-instagram-post", {
        body: { url },
      });
      if (resolveError) throw resolveError;
      if (data?.error) { toast.error(data.error); return; }

      const newPost: InstagramPost = {
        id: data.shortcode || url,
        caption: "",
        media_type: data.media_type === "VIDEO" ? "VIDEO" : "IMAGE",
        media_url: data.thumbnail_url || "",
        thumbnail_url: data.thumbnail_url || "",
        permalink: data.permalink || url,
        timestamp: "",
      };

      setPosts(prev => [...prev, newPost]);
      setSelectedPosts(prev => [...prev, newPost.id].slice(0, 6));
      setPasteUrl("");
    } catch (e: any) {
      toast.error(e?.message || "Could not resolve this post");
    } finally {
      setResolvingUrl(false);
    }
  };

  const handleComplete = () => {
    if (!objective) return;
    const selectedPostsData = posts.filter(p => selectedPosts.includes(p.id));
    onComplete({ objective, selectedPosts: selectedPostsData });
  };

  // Loading state
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8">
        <LumiThinkingInline isOpen={true} customCopy={["Pulling up your Instagram posts..."]} />
      </motion.div>
    );
  }

  // Objective selection
  if (step === "objective") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20">
          <img src={lumiLogo} alt="Lumi" className="h-10 w-10 rounded-full" />
          <div>
            <h3 className="font-semibold">Let's grow your Instagram following! 🚀</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your approach — we'll pull up your posts so you can pick which ones to promote.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <ObjectiveOption
            selected={objective === "traffic"}
            onSelect={() => setObjective("traffic")}
            icon={<Users className="h-6 w-6" />}
            title="Traffic to Instagram"
            subtitle="Send people directly to your profile"
            description="Best when you have strong content on your feed that showcases your expertise. People land on your profile and decide to follow based on what they see."
            bestFor="Coaches, creators, and brands with an established aesthetic and valuable content"
          />
          
          <ObjectiveOption
            selected={objective === "video_views"}
            onSelect={() => setObjective("video_views")}
            icon={<Play className="h-6 w-6" />}
            title="Video Views"
            subtitle="Get more eyes on your Reels"
            description="Best when you have engaging video content. People see your video, love it, and tap through to follow. Tends to be more cost-effective per follower."
            bestFor="Anyone who's comfortable on camera or has great video content ready to repurpose"
          />
        </div>

        {!instagramAccountId && objective && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Connect your Instagram first</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We need access to your Instagram to pull up your posts.
                  </p>
                  <Button className="mt-3" onClick={onConnectInstagram} size="sm">
                    <Instagram className="h-4 w-4 mr-2" />
                    Connect Instagram
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {instagramAccountId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Connected as <strong>@{instagramAccountName}</strong></span>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={() => objective && handleObjectiveSelect(objective)}
            disabled={!objective || (!instagramAccountId && !!objective)}
            className="flex-1"
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // Post selection
  if (step === "post_selection") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <img src={lumiLogo} alt="Lumi" className="h-10 w-10 rounded-full" />
          <div>
            <h3 className="font-semibold">{headerText || "Add the posts you want to promote ✨"}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {headerSubtext || "Paste Instagram post URLs below — we'll preview them and add them to your campaign. You can add up to 6."}
            </p>
          </div>
        </div>

        {/* Show selected posts as a grid */}
        {posts.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                selected={selectedPosts.includes(post.id)}
                onToggle={() => togglePostSelection(post.id)}
              />
            ))}
          </div>
        )}

        {/* URL paste input — primary UX */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            {posts.length > 0 ? "Add another post" : "Paste an Instagram post URL"}
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostFromUrl(); } }}
                placeholder="https://www.instagram.com/p/..."
                className="pl-9"
                disabled={resolvingUrl}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addPostFromUrl}
              disabled={resolvingUrl || !pasteUrl.trim()}
            >
              {resolvingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Instagram className="h-3 w-3" />
            Open Instagram → tap ··· on a post → Copy Link → paste here
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">
            {selectedPosts.length}/6 posts selected
          </span>
          <Button onClick={handleComplete} disabled={selectedPosts.length === 0}>
            Continue with {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
}

// Sub-components
function ObjectiveOption({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  description,
  bestFor,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  bestFor: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "p-2 rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          {icon}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{title}</span>
            {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
          <p className="text-xs text-primary mt-2">
            <strong>Best for:</strong> {bestFor}
          </p>
        </div>
      </div>
    </button>
  );
}

function getPostIssue(post: InstagramPost): string | null {
  if (post.media_type === "CAROUSEL_ALBUM") {
    return "Carousel albums can't be used directly as ads. Consider using individual images or videos instead.";
  }
  if (!post.media_url && !post.thumbnail_url) {
    return "This post's media is unavailable or expired and can't be used in ads.";
  }
  return null;
}

function PostCard({
  post,
  selected,
  onToggle,
}: {
  post: InstagramPost;
  selected: boolean;
  onToggle: () => void;
}) {
  const issue = getPostIssue(post);
  const caption = post.caption || "No caption";
  const truncatedCaption = caption.length > 120 ? caption.substring(0, 120) + "…" : caption;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => !issue && onToggle()}
            className={cn(
              "relative rounded-xl overflow-hidden border-2 transition-all aspect-square group",
              issue
                ? "border-amber-500/50 opacity-75 cursor-not-allowed"
                : selected
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50"
            )}
          >
            <img
              src={post.thumbnail_url || post.media_url}
              alt=""
              className="w-full h-full object-cover"
            />
            
            {/* Media type badge */}
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-black/60 text-white text-xs">
                {post.media_type === "VIDEO" ? <Play className="h-3 w-3" /> : <Image className="h-3 w-3" />}
              </Badge>
            </div>

            {/* Caution badge for unusable posts */}
            {issue && (
              <div className="absolute top-2 right-2">
                <div className="bg-amber-500 text-white rounded-full p-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
              </div>
            )}

            {/* Selected overlay */}
            {selected && !issue && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <div className="bg-primary text-primary-foreground rounded-full p-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
            )}

            {/* Hover caption overlay */}
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5 pointer-events-none">
              <p className="text-white text-[11px] leading-tight line-clamp-4">
                {truncatedCaption}
              </p>
            </div>

            {/* Engagement stats (visible when not hovered) */}
            {(post.like_count || post.comments_count) && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 group-hover:opacity-0 transition-opacity">
                <div className="flex items-center gap-2 text-white text-xs">
                  {post.like_count != null && post.like_count > 0 && <span>❤️ {post.like_count}</span>}
                  {post.comments_count != null && post.comments_count > 0 && <span>💬 {post.comments_count}</span>}
                </div>
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px]">
          {issue ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs">{issue}</p>
            </div>
          ) : (
            <p className="text-xs">{truncatedCaption}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
