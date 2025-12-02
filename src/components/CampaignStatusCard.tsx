import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Play, 
  Pause, 
  ExternalLink, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle
} from "lucide-react";

interface CampaignStatusCardProps {
  workspaceId: string;
  workspaceName: string;
  metaCampaignIds: any;
  metaAccountId: string;
  initialStatus?: string;
  onStatusChange?: () => void;
}

interface CampaignStatus {
  campaignId: string;
  status: string;
  effectiveStatus: string;
  deliveryStatus?: string;
  adSets?: Array<{
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
  }>;
  ads?: Array<{
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
    reviewStatus?: string;
  }>;
}

export function CampaignStatusCard({ 
  workspaceId, 
  workspaceName,
  metaCampaignIds,
  metaAccountId,
  initialStatus,
  onStatusChange
}: CampaignStatusCardProps) {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [loading, setLoading] = useState(true); // Start loading by default
  const [toggling, setToggling] = useState(false);

  const campaignId = metaCampaignIds?.campaignId || metaCampaignIds?.campaign_id;

  // Auto-fetch status on mount
  useEffect(() => {
    if (campaignId) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchStatus = async () => {
    if (!campaignId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-campaign-status', {
        body: { workspaceId }
      });

      if (error) throw error;
      
      if (data?.status) {
        setStatus(data.status);
      }
    } catch (error: any) {
      console.error('Error fetching status:', error);
      toast.error('Failed to fetch campaign status');
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaign = async (pause: boolean) => {
    if (!campaignId) return;
    
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-campaign-status', {
        body: { 
          workspaceId,
          action: pause ? 'pause' : 'unpause'
        }
      });

      if (error) throw error;
      
      toast.success(data.message);
      await fetchStatus();
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error toggling campaign:', error);
      toast.error(error.message || 'Failed to update campaign');
    } finally {
      setToggling(false);
    }
  };

  const getStatusBadge = (effectiveStatus: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
      'ACTIVE': { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Active' },
      'PAUSED': { variant: 'secondary', icon: <Pause className="h-3 w-3" />, label: 'Paused' },
      'PENDING_REVIEW': { variant: 'outline', icon: <Clock className="h-3 w-3" />, label: 'In Review' },
      'IN_PROCESS': { variant: 'outline', icon: <Clock className="h-3 w-3" />, label: 'Processing' },
      'WITH_ISSUES': { variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" />, label: 'Issues' },
      'DISAPPROVED': { variant: 'destructive', icon: <XCircle className="h-3 w-3" />, label: 'Rejected' },
      'CAMPAIGN_PAUSED': { variant: 'secondary', icon: <Pause className="h-3 w-3" />, label: 'Campaign Paused' },
      'ADSET_PAUSED': { variant: 'secondary', icon: <Pause className="h-3 w-3" />, label: 'Ad Set Paused' },
    };

    const config = statusConfig[effectiveStatus] || { variant: 'outline' as const, icon: <AlertCircle className="h-3 w-3" />, label: effectiveStatus };
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const adsManagerUrl = campaignId && metaAccountId 
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId}&selected_campaign_ids=${campaignId}`
    : null;

  const isActive = status?.effectiveStatus === 'ACTIVE';
  const isPaused = status?.effectiveStatus === 'PAUSED' || status?.effectiveStatus === 'CAMPAIGN_PAUSED';
  const canToggle = isActive || isPaused;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{workspaceName}</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {adsManagerUrl && (
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
              >
                <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !status ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : status ? (
          <>
            {/* Main Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Campaign Status</p>
                {getStatusBadge(status.effectiveStatus)}
              </div>
              
              {/* Pause/Unpause Toggle */}
              {canToggle && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {isActive ? 'Active' : 'Paused'}
                  </span>
                  <Switch 
                    checked={isActive}
                    onCheckedChange={(checked) => toggleCampaign(!checked)}
                    disabled={toggling}
                  />
                </div>
              )}
            </div>

            {/* Delivery Status */}
            {status.deliveryStatus && (
              <div>
                <p className="text-sm text-muted-foreground">Delivery</p>
                <p className="text-sm font-medium">{status.deliveryStatus}</p>
              </div>
            )}

            {/* Ad Sets */}
            {status.adSets && status.adSets.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ad Sets ({status.adSets.length})</p>
                <div className="space-y-1">
                  {status.adSets.slice(0, 3).map((adSet) => (
                    <div key={adSet.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                      <span className="truncate max-w-[150px]">{adSet.name}</span>
                      {getStatusBadge(adSet.effectiveStatus)}
                    </div>
                  ))}
                  {status.adSets.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{status.adSets.length - 3} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Ads */}
            {status.ads && status.ads.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Ads ({status.ads.length})</p>
                <div className="space-y-1">
                  {status.ads.slice(0, 3).map((ad) => (
                    <div key={ad.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                      <span className="truncate max-w-[150px]">{ad.name}</span>
                      <div className="flex items-center gap-1">
                        {ad.reviewStatus && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {ad.reviewStatus}
                          </Badge>
                        )}
                        {getStatusBadge(ad.effectiveStatus)}
                      </div>
                    </div>
                  ))}
                  {status.ads.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{status.ads.length - 3} more</p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : !campaignId ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No campaign ID available</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}