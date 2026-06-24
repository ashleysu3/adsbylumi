import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Instagram,
  Heart,
  MessageCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  PlayCircle,
  Pause,
  Link as LinkIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface FetchedPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  like_count?: number;
  comments_count?: number;
}

interface FitResult {
  verdict: "good_fit" | "worth_a_tweak" | "off_strategy";
  headline: string;
  reason: string;
  fix: string;
  checks: {
    goal_match: "pass" | "weak" | "fail";
    audience_fit: "pass" | "weak" | "fail";
    funnel_stage: "pass" | "weak" | "fail";
  };
}

interface CreatedAd {
  adId: string;
  postId: string;
  previewIframeUrl: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  brandId: string;
  workspaceName: string;
  campaignObjective?: string | null;
}

type Step = "pick" | "fit" | "place" | "preview" | "done";

function disabledReason(p: FetchedPost): string | null {
  // Stories or unsupported media types
  const t = p.media_type;
  if (!t) return "Meta couldn't read this post type.";
  // Carousels are technically promotable but trickier in existing-post mode — allow them.
  return null;
}

function VerdictBanner({ fit }: { fit: FitResult }) {
  const map = {
    good_fit: {
      icon: CheckCircle2,
      bg: "bg-emerald-500/10 border-emerald-500/30",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "Good fit",
    },
    worth_a_tweak: {
      icon: AlertTriangle,
      bg: "bg-amber-500/10 border-amber-500/30",
      text: "text-amber-700 dark:text-amber-400",
      label: "Worth a tweak first",
    },
    off_strategy: {
      icon: XCircle,
      bg: "bg-destructive/10 border-destructive/30",
      text: "text-destructive",
      label: "Off-strategy",
    },
  } as const;
  const v = map[fit.verdict];
  const Icon = v.icon;
  return (
    <div className={cn("rounded-xl border p-4 space-y-2", v.bg)}>
      <div className={cn("flex items-center gap-2 font-semibold text-sm", v.text)}>
        <Icon className="h-4 w-4" />
        {v.label}
      </div>
      <p className="text-sm text-foreground">{fit.headline}</p>
      {fit.reason && <p className="text-xs text-muted-foreground">{fit.reason}</p>}
      {fit.fix && (
        <div className="text-xs text-foreground border-t border-current/10 pt-2">
          <span className="font-medium">Suggested tweak:</span> {fit.fix}
        </div>
      )}
    </div>
  );
}

export function PromoteExistingPostDialog({
  open,
  onOpenChange,
  workspaceId,
  brandId,
  workspaceName,
  campaignObjective,
}: Props) {
  const [step, setStep] = useState<Step>("pick");

  // Step 1: pick
  const [postsLoading, setPostsLoading] = useState(false);
  const [posts, setPosts] = useState<FetchedPost[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [igAccountId, setIgAccountId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<FetchedPost | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [useManualUrl, setUseManualUrl] = useState(false);

  // Step 2: fit
  const [fitLoading, setFitLoading] = useState(false);
  const [fit, setFit] = useState<FitResult | null>(null);

  // Step 3: placement
  const [placement, setPlacement] = useState<"new" | "existing">("new");

  // Step 4: preview
  const [submitting, setSubmitting] = useState(false);
  const [createdAds, setCreatedAds] = useState<CreatedAd[]>([]);
  const [createdAdSetId, setCreatedAdSetId] = useState<string | null>(null);
  const [newAdSetCreated, setNewAdSetCreated] = useState(false);
  const [activating, setActivating] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("pick");
        setPosts([]);
        setSelectedPost(null);
        setFit(null);
        setPlacement("new");
        setCreatedAds([]);
        setCreatedAdSetId(null);
        setNewAdSetCreated(false);
        setPostsError(null);
        setManualUrl("");
        setUseManualUrl(false);
      }, 250);
    }
  }, [open]);

  // Load posts on open
  useEffect(() => {
    if (!open || !brandId) return;
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const { data: brand } = await supabase
          .from("brands")
          .select("instagram_account_id, instagram_account_name")
          .eq("id", brandId)
          .maybeSingle();
        if (cancelled) return;
        if (!brand?.instagram_account_id) {
          setPostsError(
            "No Instagram account is connected to this brand. Connect one in Meta Settings to promote existing posts."
          );
          return;
        }
        setIgAccountId(brand.instagram_account_id);

        const { data, error } = await supabase.functions.invoke("analyze-instagram-posts", {
          body: { brandId, instagramAccountId: brand.instagram_account_id, simple: false },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) {
          setPostsError(data.error);
          return;
        }
        const list: FetchedPost[] = data?.posts || [];
        // Sort by engagement so high-performers surface first
        list.sort((a, b) => {
          const ae = (a.like_count || 0) + (a.comments_count || 0);
          const be = (b.like_count || 0) + (b.comments_count || 0);
          return be - ae;
        });
        setPosts(list);
      } catch (e: any) {
        if (!cancelled) {
          setPostsError(e?.message || "Couldn't load posts.");
        }
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, brandId]);

  async function runFitCheck(post: FetchedPost) {
    setFitLoading(true);
    setFit(null);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-post-fit", {
        body: {
          workspaceId,
          post: {
            id: post.id,
            caption: post.caption || "",
            media_type: post.media_type,
            like_count: post.like_count,
            comments_count: post.comments_count,
            platform: "instagram",
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Fit check failed");
      setFit({
        verdict: data.verdict,
        headline: data.headline,
        reason: data.reason,
        fix: data.fix,
        checks: data.checks,
      });
    } catch (e: any) {
      // Graceful — let user proceed with a soft default
      setFit({
        verdict: "worth_a_tweak",
        headline: "Fit check unavailable right now.",
        reason: e?.message || "We couldn't run the full check, but you can still promote this post.",
        fix: "Double-check the caption has a clear next step (link or CTA) before going live.",
        checks: { goal_match: "weak", audience_fit: "weak", funnel_stage: "weak" },
      });
    } finally {
      setFitLoading(false);
    }
  }

  async function handleCreatePausedAd() {
    if (!selectedPost && !(useManualUrl && manualUrl.trim())) return;
    setSubmitting(true);
    try {
      const postPayload = selectedPost
        ? {
            id: selectedPost.id,
            media_type: selectedPost.media_type,
            caption: selectedPost.caption || "",
            instagram_account_id: igAccountId,
            platform: "instagram",
          }
        : {
            url: manualUrl.trim(),
            instagram_account_id: igAccountId,
            platform: "instagram",
          };
      const { data, error } = await supabase.functions.invoke("add-posts-to-campaign", {
        body: {
          workspaceId,
          status: "PAUSED", // always paused — user confirms next
          createNewAdSet: placement === "new",
          posts: [postPayload],
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const reason = data?.failedAds?.[0]?.error || data?.error || "Failed to create ad";
        toast.error(reason);
        setSubmitting(false);
        return;
      }
      setCreatedAds(data.ads || []);
      setCreatedAdSetId(data.adSetId || null);
      setNewAdSetCreated(!!data.newAdSetCreated);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create ad");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("activate-meta-ads", {
        body: {
          workspaceId,
          adIds: createdAds.map((a) => a.adId),
          alsoActivateAdSetId: newAdSetCreated ? createdAdSetId : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.message || data?.error || "Couldn't activate");
        setActivating(false);
        return;
      }
      toast.success("Ad is live! ✨");
      setStep("done");
    } catch (e: any) {
      toast.error(e?.message || "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Promote an existing post
          </DialogTitle>
          <DialogDescription>
            Add a post you've already published as a new ad inside{" "}
            <span className="font-medium text-foreground">{workspaceName}</span> — your organic likes,
            comments, and shares come along as social proof.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* STEP 1 — PICK */}
          {step === "pick" && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-muted-foreground">
                Showing your recent Instagram posts, sorted by engagement.
              </div>

              {postsLoading && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              )}

              {!postsLoading && postsError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                    <ShieldAlert className="h-4 w-4" />
                    We couldn't load your posts
                  </div>
                  <p className="text-muted-foreground text-xs">{postsError}</p>
                </div>
              )}

              {!postsLoading && !postsError && posts.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No recent posts found on the connected Instagram account.
                </p>
              )}

              {!postsLoading && posts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {posts.map((p) => {
                    const reason = disabledReason(p);
                    const disabled = !!reason;
                    const selected = selectedPost?.id === p.id;
                    const eng = (p.like_count || 0) + (p.comments_count || 0);
                    const thumb = p.thumbnail_url || p.media_url;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedPost(p)}
                        title={reason || undefined}
                        className={cn(
                          "relative rounded-lg overflow-hidden border-2 text-left transition-all group",
                          disabled && "opacity-40 cursor-not-allowed",
                          !disabled && selected && "border-primary ring-2 ring-primary/30",
                          !disabled && !selected && "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="aspect-square bg-muted relative">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Instagram className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          {selected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <CheckCircle2 className="h-6 w-6 text-primary-foreground bg-primary rounded-full p-1" />
                            </div>
                          )}
                          {p.media_type === "VIDEO" && (
                            <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 bg-background/70 text-foreground backdrop-blur-sm">
                              Reel
                            </Badge>
                          )}
                        </div>
                        <div className="p-2 space-y-1">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {p.like_count ?? "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {p.comments_count ?? "—"}
                            </span>
                            {eng > 0 && (
                              <span className="ml-auto text-[10px] text-foreground/70">{eng} total</span>
                            )}
                          </div>
                          {p.caption && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                              {p.caption}
                            </p>
                          )}
                          {reason && (
                            <p className="text-[10px] text-destructive/80">{reason}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Manual URL fallback — works even when Meta's post fetch fails */}
              <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  Don't see the post you want? Paste its URL.
                </div>
                <p className="text-xs text-muted-foreground">
                  Meta sometimes hides posts from this list. Drop in the link to any post on your
                  connected Instagram account and we'll pull it directly.
                </p>
                <Input
                  type="url"
                  placeholder="https://www.instagram.com/p/…  or  /reel/…"
                  value={manualUrl}
                  onChange={(e) => {
                    setManualUrl(e.target.value);
                    setUseManualUrl(!!e.target.value.trim());
                    if (e.target.value.trim()) setSelectedPost(null);
                  }}
                  className="bg-background"
                />
                {useManualUrl && (
                  <p className="text-[11px] text-muted-foreground">
                    We'll match this URL to your connected Instagram account before creating the ad
                    (paused).
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 — FIT */}
          {step === "fit" && selectedPost && (
            <div className="space-y-4 py-2">
              <div className="flex gap-3 items-start">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  {selectedPost.thumbnail_url || selectedPost.media_url ? (
                    <img
                      src={selectedPost.thumbnail_url || selectedPost.media_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Instagram className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Promoting into</p>
                  <p className="text-sm font-medium truncate">{workspaceName}</p>
                  {campaignObjective && (
                    <p className="text-xs text-muted-foreground">Objective: {campaignObjective}</p>
                  )}
                </div>
              </div>

              {fitLoading ? (
                <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking how this post fits your campaign…
                </div>
              ) : fit ? (
                <VerdictBanner fit={fit} />
              ) : null}

              <p className="text-xs text-muted-foreground italic">
                Advisory only — you can still promote this post even if we flag it.
              </p>
            </div>
          )}

          {/* STEP 3 — PLACE */}
          {step === "place" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Where should this ad live inside the campaign?
              </p>
              <RadioGroup value={placement} onValueChange={(v) => setPlacement(v as "new" | "existing")}>
                <Label
                  htmlFor="place-new"
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all",
                    placement === "new" && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value="new" id="place-new" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      New ad set
                      <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We'll duplicate the campaign's existing ad set settings so this post's performance
                      is measured cleanly on its own.
                    </p>
                  </div>
                </Label>
                <Label
                  htmlFor="place-existing"
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all",
                    placement === "existing" && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value="existing" id="place-existing" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium text-sm">Add to existing ad set</div>
                    <p className="text-xs text-muted-foreground">
                      Drop it in alongside other ads. Faster, but its results blend with the rest.
                    </p>
                  </div>
                </Label>
              </RadioGroup>

              <div className="rounded-xl bg-muted/40 border border-border/60 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Pause className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <p>
                  The new ad will be created <span className="font-medium text-foreground">paused</span>.
                  You'll preview it next and confirm before it goes live.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4 — PREVIEW + CONFIRM */}
          {step === "preview" && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Ad created and{" "}
                  <span className="font-medium">paused</span>. Preview it below, then activate when you're ready.
                </span>
              </div>

              {createdAds.map((ad) => (
                <div key={ad.adId} className="rounded-xl border overflow-hidden bg-card">
                  {ad.previewIframeUrl ? (
                    <iframe
                      src={ad.previewIframeUrl}
                      title={`Ad preview ${ad.adId}`}
                      className="w-full"
                      style={{ height: 540, border: 0 }}
                      sandbox="allow-scripts allow-same-origin"
                    />
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Preview isn't available right now. The ad is in your campaign — you can preview it
                      from Ads Manager before activating.
                    </div>
                  )}
                  <div className="p-3 border-t text-xs text-muted-foreground">
                    Ad ID: {ad.adId}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 5 — DONE */}
          {step === "done" && (
            <div className="py-10 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-display font-bold">Your post is now an ad ✨</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Give Meta a day or two to start showing it. You'll see it in Live Ads with the rest of
                this campaign.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* FOOTER */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t">
          {step === "pick" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                disabled={!selectedPost}
                onClick={() => {
                  setStep("fit");
                  if (selectedPost) runFitCheck(selectedPost);
                }}
              >
                Next: fit check
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </>
          )}
          {step === "fit" && (
            <>
              <Button variant="ghost" onClick={() => setStep("pick")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
              <Button onClick={() => setStep("place")} disabled={fitLoading}>
                {fit?.verdict === "off_strategy" ? "Promote anyway" : "Continue"}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </>
          )}
          {step === "place" && (
            <>
              <Button variant="ghost" onClick={() => setStep("fit")}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
              <Button onClick={handleCreatePausedAd} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating paused ad…</>
                ) : (
                  <>Create paused ad <ArrowRight className="h-4 w-4 ml-1.5" /></>
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Keep paused — close
              </Button>
              <Button onClick={handleActivate} disabled={activating || createdAds.length === 0}>
                {activating ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Activating…</>
                ) : (
                  <><PlayCircle className="h-4 w-4 mr-1.5" /> Activate ad</>
                )}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button className="ml-auto" onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
