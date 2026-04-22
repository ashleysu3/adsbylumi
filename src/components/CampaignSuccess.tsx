import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, ExternalLink, Copy, ArrowRight, Loader2, Play, Pause, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface CampaignSuccessProps {
  workspace: any;
  campaignIds: any;
  onBackToDashboard: (campaignId?: string) => void;
  onOpenWalkthrough?: () => void;
}

// Confetti burst — pure CSS/motion, one-shot on mount
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 600,
        y: -(Math.random() * 300 + 120),
        rotate: Math.random() * 540 - 270,
        delay: Math.random() * 0.15,
        color: [
          "hsl(var(--primary))",
          "hsl(var(--accent))",
          "#F4C9D9",
          "#F7E5A4",
          "#A6D8C8",
        ][i % 5],
        size: Math.random() * 6 + 6,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center" aria-hidden="true">
      <div className="relative">
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate }}
            transition={{ duration: 1.6, delay: p.delay, ease: "easeOut" }}
            style={{
              position: "absolute",
              width: p.size,
              height: p.size * 0.4,
              background: p.color,
              borderRadius: 2,
              left: 0,
              top: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function CampaignSuccess({ workspace, campaignIds, onBackToDashboard, onOpenWalkthrough }: CampaignSuccessProps) {
  // Handle both naming conventions from build-meta-campaign
  const campaignId = campaignIds?.campaignId || campaignIds?.campaign_id;
  const adSetIds = campaignIds?.adSetIds || campaignIds?.ad_set_ids || [];
  const adIds = campaignIds?.adIds || campaignIds?.ad_ids || [];
  const initialLaunchStatus = campaignIds?.launchStatus || 'paused';

  const [isActive, setIsActive] = useState(initialLaunchStatus === 'active');
  const [toggling, setToggling] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  // Auto-trigger walkthrough on first-ever campaign launch — runs at most once per mount,
  // and only if the user has never had `first_campaign_launched_at` set before.
  const autoOpenAttemptedRef = useRef(false);
  useEffect(() => {
    if (!onOpenWalkthrough) return;
    if (autoOpenAttemptedRef.current) return;
    autoOpenAttemptedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // Session-level guard: if we already auto-opened in this browser session, skip.
        const sessionKey = `lumi_walkthrough_autoopened_${user.id}`;
        if (sessionStorage.getItem(sessionKey)) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_campaign_launched_at')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;

        // Only fire if the profile has NEVER recorded a first launch.
        if (profile && !profile.first_campaign_launched_at) {
          // Stamp the profile FIRST so subsequent loads can never re-trigger.
          const { error: stampError } = await supabase
            .from('profiles')
            .update({ first_campaign_launched_at: new Date().toISOString() })
            .eq('id', user.id)
            .is('first_campaign_launched_at', null);

          if (stampError) {
            console.warn('first-launch stamp failed', stampError);
            return;
          }

          sessionStorage.setItem(sessionKey, '1');
          setTimeout(() => {
            if (!cancelled) onOpenWalkthrough();
          }, 1200);
        }
      } catch (err) {
        console.warn('first-launch check failed', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop rendering confetti DOM after animation completes
  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const metaAdsManagerUrl = `https://business.facebook.com/adsmanager`;

  const handleToggleCampaign = async () => {
    if (!campaignId) return;

    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-campaign-status', {
        body: {
          workspaceId: workspace?.id,
          action: isActive ? 'pause' : 'unpause',
          entityId: campaignId,
          entityType: 'campaign'
        }
      });

      if (error) throw error;

      setIsActive(!isActive);
      toast.success(isActive ? "Campaign paused" : "Campaign activated! Ads will deliver after Meta approval.");
    } catch (error: any) {
      console.error('Error toggling campaign:', error);
      toast.error(error.message || "Failed to update campaign status");
    } finally {
      setToggling(false);
    }
  };

  const isLive = isActive;

  return (
    <div className="space-y-6">
      {/* Celebration Header */}
      <div className="relative text-center py-10">
        {showConfetti && <ConfettiBurst />}

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className={`relative inline-flex items-center justify-center w-24 h-24 rounded-full mb-5 ${
            isLive
              ? 'bg-gradient-to-br from-green-400/20 to-primary/20'
              : 'bg-gradient-to-br from-primary/20 to-accent/20'
          }`}
        >
          {isLive ? (
            <Play className="h-12 w-12 text-green-500" />
          ) : (
            <Sparkles className="h-12 w-12 text-primary" />
          )}
          <motion.span
            className="absolute -top-1 -right-1"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Sparkles className="h-5 w-5 text-amber-400" />
          </motion.span>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="text-4xl md:text-5xl font-display font-bold mb-3 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent"
        >
          {isLive ? "🚀 Your campaign is LIVE" : "🎉 Your campaign is Published"}
        </motion.h1>

        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-base font-medium text-foreground/80 mb-1"
        >
          {workspace?.offer_name || workspace?.name || "Your Campaign"}
        </motion.p>

        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-sm text-muted-foreground max-w-md mx-auto"
        >
          {isLive
            ? "Your ads are in Meta's review queue and will start delivering once approved (usually 15–30 minutes)."
            : "Your campaign is paused and ready to activate. Flip the switch when you're ready."}
        </motion.p>

        {/* Primary CTAs */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          {onOpenWalkthrough && (
            <Button
              size="lg"
              onClick={onOpenWalkthrough}
              className="rounded-xl gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 shadow-lg"
            >
              <Target className="h-4 w-4" />
              Let's set your success goal
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            onClick={() => onBackToDashboard(campaignId)}
            className="rounded-xl gap-2"
          >
            View campaign in dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* Post-publish recap */}
      <Card className="text-left">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What you just launched</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campaign</span>
            <span className="font-medium">{workspace?.offer_name || workspace?.name || "Your Campaign"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="secondary">{isLive ? "Active" : "Paused"}</Badge>
          </div>
          <Separator className="my-2" />
          <p className="text-xs text-muted-foreground">
            Your ads are now in Meta's review process. Most ads are approved within 24 hours.
          </p>
        </CardContent>
      </Card>

      {/* Campaign Status Control */}
      <Card className={isLive ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLive ? (
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Play className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Pause className="h-5 w-5 text-amber-500" />
                </div>
              )}
              <div>
                <p className="font-semibold">
                  Campaign Status: {isLive ? 'Active' : 'Paused'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isLive
                    ? 'Your ads are delivering or pending Meta approval'
                    : 'Turn on to start delivering ads'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {toggling && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleCampaign}
                disabled={toggling}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaignId && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Campaign ID</p>
                <p className="font-mono text-sm">{campaignId}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(campaignId, 'Campaign ID')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {adSetIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Ad Sets</p>
              {adSetIds.map((id: string, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Ad Set {index + 1}
                    </p>
                    <p className="font-mono text-xs">{id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(id, `Ad Set ${index + 1} ID`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Badge variant={isLive ? "default" : "secondary"}>
              Status: {isLive ? 'Active' : 'Paused'}
            </Badge>
            <Badge variant="outline">
              {adIds.length} Ads Created
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => {
            const rawAccountId = workspace?.brands?.meta_account_id || workspace?.brand_meta_account_id;
            const metaAccountId = rawAccountId?.replace(/^act_/, '');

            if (metaAccountId && campaignId) {
              window.open(
                `https://business.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId}&selected_campaign_ids=${campaignId}`,
                '_blank'
              );
            } else if (metaAccountId) {
              window.open(
                `https://business.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId}`,
                '_blank'
              );
            } else {
              window.open(metaAdsManagerUrl, '_blank');
            }
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View in Ads Manager
        </Button>
        <Button onClick={onBackToDashboard} size="lg" variant="secondary">
          Back to Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
