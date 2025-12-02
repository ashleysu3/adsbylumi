import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface CampaignSuccessProps {
  workspace: any;
  campaignIds: any;
  onBackToDashboard: () => void;
}

export function CampaignSuccess({ workspace, campaignIds, onBackToDashboard }: CampaignSuccessProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Handle both naming conventions from build-meta-campaign
  const campaignId = campaignIds?.campaignId || campaignIds?.campaign_id;
  const adSetIds = campaignIds?.adSetIds || campaignIds?.ad_set_ids || [];
  const adIds = campaignIds?.adIds || campaignIds?.ad_ids || [];

  const metaAdsManagerUrl = `https://business.facebook.com/adsmanager`;

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-4">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2">🎉 Campaign Published!</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your campaign is now live on Meta. It may take a few minutes to appear in Ads Manager.
        </p>
      </div>

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
            <Badge variant="secondary">Status: Paused (Ready to Activate)</Badge>
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
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium text-sm">Review in Meta Ads Manager</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your campaign is in "Paused" status. Review the settings and activate when ready.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                2
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
                3
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
                4
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
            // Access meta_account_id from the brand (brands is a single object from the join)
            const rawAccountId = workspace?.brands?.meta_account_id;
            // Strip "act_" prefix if present - Meta URLs need just the numeric ID
            const metaAccountId = rawAccountId?.replace(/^act_/, '');
            
            if (metaAccountId && campaignId) {
              // Link directly to the campaign in Ads Manager
              window.open(
                `https://business.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId}&selected_campaign_ids=${campaignId}`,
                '_blank'
              );
            } else {
              // Fallback to general Ads Manager
              window.open(metaAdsManagerUrl, '_blank');
            }
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Campaign in Ads Manager
        </Button>
        <Button onClick={onBackToDashboard} size="lg">
          Back to Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
