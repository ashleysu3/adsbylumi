import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Instagram, Play, Users, TrendingUp, Sparkles, CheckCircle2, AlertCircle, ExternalLink, Image, Video, Zap, ArrowRight, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";
import { cn } from "@/lib/utils";

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
  engagement_score?: number;
  ai_recommendation?: string;
  is_recommended?: boolean;
}

interface ContentSuggestion {
  id: string;
  title: string;
  description: string;
  hook: string;
  format: "video" | "image" | "carousel";
  psychologyTrigger: string;
}

interface SocialGrowthFlowProps {
  brandId: string;
  brandName: string;
  instagramAccountId: string | null;
  instagramAccountName: string | null;
  audiencePsychology: any;
  onComplete: (data: {
    objective: "traffic" | "video_views";
    selectedPosts: InstagramPost[];
    contentSuggestions: ContentSuggestion[];
  }) => void;
  onConnectInstagram: () => void;
  onBack: () => void;
}

type FlowStep = "objective" | "analyzing" | "post_selection" | "content_suggestions";

export function SocialGrowthFlow({
  brandId,
  brandName,
  instagramAccountId,
  instagramAccountName,
  audiencePsychology,
  onComplete,
  onConnectInstagram,
  onBack,
}: SocialGrowthFlowProps) {
  const [step, setStep] = useState<FlowStep>("objective");
  const [objective, setObjective] = useState<"traffic" | "video_views" | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [contentSuggestions, setContentSuggestions] = useState<ContentSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleObjectiveSelect = async (selected: "traffic" | "video_views") => {
    setObjective(selected);
    
    if (!instagramAccountId) {
      // User needs to connect Instagram first
      return;
    }
    
    // Proceed to analyze posts
    setStep("analyzing");
    await analyzeInstagramPosts(selected);
  };

  const analyzeInstagramPosts = async (selectedObjective: "traffic" | "video_views") => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('analyze-instagram-posts', {
        body: {
          brandId,
          instagramAccountId,
          objective: selectedObjective,
          audiencePsychology,
        }
      });

      if (fetchError) throw fetchError;

      const analyzedPosts = data.posts || [];
      const suggestions = data.contentSuggestions || [];
      
      setPosts(analyzedPosts);
      setContentSuggestions(suggestions);
      
      // Check if we have suitable posts
      const recommendedPosts = analyzedPosts.filter((p: InstagramPost) => p.is_recommended);
      
      if (recommendedPosts.length === 0) {
        // No good posts - show content suggestions
        setShowSuggestions(true);
        setStep("content_suggestions");
      } else {
        // Auto-select recommended posts
        setSelectedPosts(recommendedPosts.slice(0, 3).map((p: InstagramPost) => p.id));
        setStep("post_selection");
      }
    } catch (err: any) {
      console.error("Error analyzing Instagram posts:", err);
      setError(err.message || "Failed to analyze Instagram posts");
      // Fall back to content suggestions
      await generateContentSuggestions(selectedObjective);
    } finally {
      setIsLoading(false);
    }
  };

  const generateContentSuggestions = async (selectedObjective: "traffic" | "video_views") => {
    setIsLoading(true);
    try {
      const { data, error: genError } = await supabase.functions.invoke('generate-content-ideas', {
        body: {
          brandId,
          type: 'social_growth',
          objective: selectedObjective,
          audiencePsychology,
          count: 5,
        }
      });

      if (genError) throw genError;

      const suggestions = (data.ideas || []).map((idea: any, index: number) => ({
        id: `suggestion-${index}`,
        title: idea.title,
        description: idea.description,
        hook: idea.hook || idea.title,
        format: idea.format || (selectedObjective === "video_views" ? "video" : "image"),
        psychologyTrigger: idea.psychologyTrigger || "Curiosity",
      }));

      setContentSuggestions(suggestions);
      setShowSuggestions(true);
      setStep("content_suggestions");
    } catch (err: any) {
      console.error("Error generating suggestions:", err);
      // Use fallback suggestions
      const fallbackSuggestions = getFallbackSuggestions(selectedObjective);
      setContentSuggestions(fallbackSuggestions);
      setShowSuggestions(true);
      setStep("content_suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackSuggestions = (selectedObjective: "traffic" | "video_views"): ContentSuggestion[] => {
    if (selectedObjective === "video_views") {
      return [
        {
          id: "fallback-1",
          title: "Behind the Scenes",
          description: "Show the human side of your brand - your workspace, process, or team. Authenticity builds connection.",
          hook: "Here's what goes into every...",
          format: "video",
          psychologyTrigger: "Authenticity & Trust",
        },
        {
          id: "fallback-2",
          title: "Quick Tip Tutorial",
          description: "Share a valuable 30-second tip related to your expertise. Position yourself as the go-to authority.",
          hook: "The #1 mistake I see...",
          format: "video",
          psychologyTrigger: "Authority & Value",
        },
        {
          id: "fallback-3",
          title: "Transformation Story",
          description: "Share a before/after or client success story that showcases the results you deliver.",
          hook: "From struggling with X to...",
          format: "video",
          psychologyTrigger: "Social Proof",
        },
      ];
    }
    return [
      {
        id: "fallback-1",
        title: "Value-First Carousel",
        description: "Create a 5-slide carousel teaching something actionable. End with a soft CTA to follow for more.",
        hook: "5 things I wish I knew...",
        format: "carousel",
        psychologyTrigger: "Reciprocity",
      },
      {
        id: "fallback-2",
        title: "Hot Take / Opinion",
        description: "Share a bold perspective that challenges common beliefs in your industry. Controversy drives engagement.",
        hook: "Unpopular opinion: ...",
        format: "image",
        psychologyTrigger: "Controversy & Curiosity",
      },
      {
        id: "fallback-3",
        title: "Personal Story Post",
        description: "Share your origin story or a pivotal moment. People follow people, not businesses.",
        hook: "Nobody knows this, but...",
        format: "image",
        psychologyTrigger: "Connection & Relatability",
      },
    ];
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId].slice(0, 3) // Max 3 posts
    );
  };

  const handleComplete = () => {
    if (!objective) return;
    
    const selectedPostsData = posts.filter(p => selectedPosts.includes(p.id));
    
    onComplete({
      objective,
      selectedPosts: selectedPostsData,
      contentSuggestions: showSuggestions ? contentSuggestions : [],
    });
  };

  const canProceed = () => {
    if (step === "objective") return !!objective;
    if (step === "post_selection") return selectedPosts.length > 0;
    if (step === "content_suggestions") return true; // Can proceed with suggestions
    return false;
  };

  // Render objective selection
  if (step === "objective") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20">
          <img src={lumiLogo} alt="Lumi" className="h-10 w-10 rounded-full" />
          <div>
            <h3 className="font-semibold">Let's grow your Instagram following! 🚀</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your approach - both work great, but here's how to decide:
            </p>
          </div>
        </div>

        {/* Objective Options */}
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

        {/* Instagram Connection Status */}
        {!instagramAccountId && objective && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Connect your Instagram first</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We'll analyze your posts to find the best ones to promote, or suggest new content ideas.
                  </p>
                  <Button
                    className="mt-3"
                    onClick={onConnectInstagram}
                    size="sm"
                  >
                    <Instagram className="h-4 w-4 mr-2" />
                    Connect Instagram
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connected status */}
        {instagramAccountId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Connected as <strong>@{instagramAccountName}</strong></span>
          </div>
        )}

        {/* Action Buttons */}
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

  // Render analyzing state
  if (step === "analyzing" || isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-16 space-y-4"
      >
        <div className="relative">
          <img src={lumiLogo} alt="Lumi" className="h-16 w-16 rounded-full" />
          <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">Analyzing your Instagram...</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            I'm looking through your recent posts to find the ones most likely to attract your ideal followers.
          </p>
        </div>
      </motion.div>
    );
  }

  // Render post selection
  if (step === "post_selection") {
    const recommendedPosts = posts.filter(p => p.is_recommended);
    const otherPosts = posts.filter(p => !p.is_recommended);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <img src={lumiLogo} alt="Lumi" className="h-10 w-10 rounded-full" />
          <div>
            <h3 className="font-semibold">I found some great posts! ✨</h3>
            <p className="text-sm text-muted-foreground mt-1">
              These are most likely to resonate with your audience. Select up to 3 to promote.
            </p>
          </div>
        </div>

        {/* Recommended posts */}
        {recommendedPosts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Recommended for you</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {recommendedPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  selected={selectedPosts.includes(post.id)}
                  onToggle={() => togglePostSelection(post.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other posts */}
        {otherPosts.length > 0 && (
          <div className="space-y-3">
            <span className="text-sm text-muted-foreground">Other recent posts</span>
            <div className="grid grid-cols-2 gap-3">
              {otherPosts.slice(0, 6).map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  selected={selectedPosts.includes(post.id)}
                  onToggle={() => togglePostSelection(post.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Switch to suggestions */}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => {
            setShowSuggestions(true);
            setStep("content_suggestions");
          }}
        >
          <Zap className="h-4 w-4 mr-2" />
          None of these? Get content ideas instead
        </Button>

        {/* Selection count */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">
            {selectedPosts.length}/3 posts selected
          </span>
          <Button onClick={handleComplete} disabled={selectedPosts.length === 0}>
            Continue with {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </motion.div>
    );
  }

  // Render content suggestions
  if (step === "content_suggestions") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
          <img src={lumiLogo} alt="Lumi" className="h-10 w-10 rounded-full" />
          <div>
            <h3 className="font-semibold">Here's what I'd recommend posting 💡</h3>
            <p className="text-sm text-muted-foreground mt-1">
              These content ideas are tailored to attract your ideal audience. Create these, then come back to promote them!
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {contentSuggestions.map((suggestion, index) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} index={index} />
          ))}
        </div>

        {/* Back to posts option */}
        {posts.length > 0 && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              setShowSuggestions(false);
              setStep("post_selection");
            }}
          >
            ← Back to my posts
          </Button>
        )}

        {/* Action */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button onClick={handleComplete} className="flex-1">
            Save Ideas & Continue
            <ArrowRight className="h-4 w-4 ml-2" />
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

function PostCard({
  post,
  selected,
  onToggle,
}: {
  post: InstagramPost;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all aspect-square",
        selected
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

      {/* Recommended badge */}
      {post.is_recommended && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-primary text-primary-foreground text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Top pick
          </Badge>
        </div>
      )}

      {/* Selection indicator */}
      {selected && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <div className="bg-primary text-primary-foreground rounded-full p-2">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      )}

      {/* Engagement stats */}
      {(post.like_count || post.comments_count) && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <div className="flex items-center gap-2 text-white text-xs">
            {post.like_count && <span>❤️ {post.like_count}</span>}
            {post.comments_count && <span>💬 {post.comments_count}</span>}
          </div>
        </div>
      )}
    </button>
  );
}

function SuggestionCard({
  suggestion,
  index,
}: {
  suggestion: ContentSuggestion;
  index: number;
}) {
  const formatIcon = suggestion.format === "video" 
    ? <Video className="h-4 w-4" />
    : suggestion.format === "carousel"
    ? <Layers className="h-4 w-4" />
    : <Image className="h-4 w-4" />;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm">
            {index + 1}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{suggestion.title}</span>
              <Badge variant="outline" className="text-xs">
                {formatIcon}
                <span className="ml-1 capitalize">{suggestion.format}</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.description}</p>
            <div className="p-2 rounded-lg bg-muted/50 border-l-2 border-primary">
              <p className="text-sm font-medium italic">"{suggestion.hook}"</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Sparkles className="h-3 w-3" />
              <span>{suggestion.psychologyTrigger}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
