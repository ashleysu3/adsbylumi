import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, ExternalLink, Copy, ArrowRight, Loader2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CampaignSuccessProps {
  workspace: any;
  campaignIds: any;
  onBackToDashboard: () => void;
}

export function CampaignSuccess({ workspace, campaignIds, onBackToDashboard }: CampaignSuccessProps) {
  // Handle both naming conventions from build-meta-campaign
  const campaignId = campaignIds?.campaignId || campaignIds?.campaign_id;
  const adSetIds = campaignIds?.adSetIds || campaignIds?.ad_set_ids || [];
  const adIds = campaignIds?.adIds || campaignIds?.ad_ids || [];
  const initialLaunchStatus = campaignIds?.launchStatus || 'paused';

  const [isActive, setIsActive] = useState(initialLaunchStatus === 'active');
  const [toggling, setToggling] = useState(false);

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
      {/* Success Header */}
      <div className="text-center py-8">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
          isLive ? 'bg-green-500/10' : 'bg-amber-500/10'
        }`}>
          {isLive ? (
            <Play className="h-10 w-10 text-green-500" />
          ) : (
            <CheckCircle className="h-10 w-10 text-amber-500" />
          )}
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {isLive ? '🚀 Campaign is Live!' : '🎉 Campaign Published!'}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {isLive 
            ? "Your ads are now in Meta's review queue and will start delivering once approved (usually 15-30 minutes)."
            : "Your campaign is paused and ready to activate. Turn it on when you're ready to start delivering ads."
          }
        </p>
      </div>

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
                    : 'Turn on to start delivering ads'
                  }
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
                      {index === 0 ? 'Cold Audience' : 'Warm Retargeting'}
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

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {!isLive && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium text-sm">Activate Your Campaign</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the toggle above to turn your campaign on when you're ready.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                {isLive ? '1' : '2'}
              </div>
              <div>
                <p className="font-medium text-sm">Wait for Meta's Approval</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta will review your ads (usually takes 15-30 minutes). You'll receive a notification.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                {isLive ? '2' : '3'}
              </div>
              <div>
                <p className="font-medium text-sm">Let It Learn (3-5 Days)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Don't make changes during the learning phase. Let Meta's algorithm optimize delivery.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                {isLive ? '3' : '4'}
              </div>
              <div>
                <p className="font-medium text-sm">Monitor & Optimize</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Check performance daily. Look for fatigue signals (frequency &gt; 4) after 7-10 days.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => {
            // Access meta_account_id from the brand - check both nested 'brands' and direct brand_meta_account_id
            const rawAccountId = workspace?.brands?.meta_account_id || workspace?.brand_meta_account_id;
            // Strip "act_" prefix if present - Meta URLs need just the numeric ID
            const metaAccountId = rawAccountId?.replace(/^act_/, '');
            
            console.log('Opening Ads Manager:', { rawAccountId, metaAccountId, campaignId, workspace });
            
            if (metaAccountId && campaignId) {
              // Link directly to the campaign in Ads Manager
              window.open(
                `https://business.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId}&selected_campaign_ids=${campaignId}`,
                '_blank'
              );
            } else if (metaAccountId) {
              // At least link to the correct ad account
              window.open(
                `https://business.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId}`,
                '_blank'
              );
            } else {
              // Fallback to general Ads Manager
              console.warn('No meta_account_id found in workspace:', workspace);
              window.open(metaAdsManagerUrl, '_blank');
            }
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View in Ads Manager
        </Button>
        <Button onClick={onBackToDashboard} size="lg">
          Back to Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
