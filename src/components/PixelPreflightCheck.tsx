import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Calendar, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface PixelPreflightCheckProps {
  brandId: string;
  landingPageUrl?: string;
  campaignGoal?: string;
  onStatusChange?: (status: 'ready' | 'warning' | 'error') => void;
  /** Optional: called when user opts to switch this campaign to a Traffic objective instead of fighting with pixel setup. */
  onSwitchToTraffic?: () => void;
}

/** Shared fallback shown whenever pixel/events aren't ready so users are never stuck. */
function PixelStuckHelp({ onSwitchToTraffic }: { onSwitchToTraffic?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">Stuck on pixel setup? You have options:</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/office-hours')}
        >
          <Calendar className="h-3 w-3 mr-1" />
          Book a 1:1 with Ashley
        </Button>
        {onSwitchToTraffic ? (
          <Button size="sm" variant="outline" onClick={onSwitchToTraffic}>
            <ArrowRightLeft className="h-3 w-3 mr-1" />
            Run a Traffic campaign instead
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/create?objective=traffic')}
          >
            <ArrowRightLeft className="h-3 w-3 mr-1" />
            Run a Traffic campaign instead
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Traffic campaigns don't require a working pixel — Meta optimizes for clicks to your page so you can still launch today while we fix tracking.
      </p>
    </div>
  );
}

interface PixelStatus {
  hasPixel: boolean;
  pixelId?: string;
  pixelName?: string;
  events: {
    Purchase: { active: boolean; count_7d: number };
    Lead: { active: boolean; count_7d: number };
  };
  landingPageCheck?: {
    status: 'success' | 'warning' | 'error';
    message: string;
    hasPixel: boolean;
    matchesBrand: boolean;
  };
}

export function PixelPreflightCheck({ 
  brandId, 
  landingPageUrl, 
  campaignGoal,
  onStatusChange 
}: PixelPreflightCheckProps) {
  const [loading, setLoading] = useState(true);
  const [pixelStatus, setPixelStatus] = useState<PixelStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brandId) {
      checkPixelStatus();
    }
  }, [brandId, landingPageUrl]);

  const checkPixelStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check pixel status from Meta API
      const { data: pixelData, error: pixelError } = await supabase.functions.invoke('check-pixel-status', {
        body: { brandId }
      });

      if (pixelError) throw pixelError;

      if (!pixelData.success) {
        if (pixelData.needsConnection) {
          setError('Meta account not connected');
          onStatusChange?.('error');
        } else {
          setError(pixelData.error || 'Failed to check pixel status');
          onStatusChange?.('error');
        }
        setLoading(false);
        return;
      }

      const primaryPixel = pixelData.primaryPixel;
      let status: PixelStatus = {
        hasPixel: !!primaryPixel,
        pixelId: primaryPixel?.id,
        pixelName: primaryPixel?.name,
        events: {
          Purchase: primaryPixel?.events?.Purchase || { active: false, count_7d: 0 },
          Lead: primaryPixel?.events?.Lead || { active: false, count_7d: 0 }
        }
      };

      // If landing page URL provided, verify pixel on that page
      if (landingPageUrl) {
        const { data: lpData } = await supabase.functions.invoke('verify-landing-page-pixel', {
          body: { brandId, url: landingPageUrl }
        });

        if (lpData?.success) {
          status.landingPageCheck = {
            status: lpData.status,
            message: lpData.message,
            hasPixel: lpData.detection?.hasPixel || false,
            matchesBrand: lpData.detection?.matchesBrand || false
          };
        }
      }

      setPixelStatus(status);

      // Determine overall status
      const requiredEvent = campaignGoal === 'leads' ? 'Lead' : 'Purchase';
      const hasRequiredEvent = status.events[requiredEvent]?.active;
      const landingPageOk = !status.landingPageCheck || status.landingPageCheck.status === 'success';

      if (!status.hasPixel) {
        onStatusChange?.('error');
      } else if (!hasRequiredEvent || !landingPageOk) {
        onStatusChange?.('warning');
      } else {
        onStatusChange?.('ready');
      }

    } catch (err: any) {
      console.error('Error checking pixel status:', err);
      setError(err.message || 'Failed to check pixel status');
      onStatusChange?.('error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Alert className="border-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Checking Pixel & Event Tracking</AlertTitle>
        <AlertDescription>
          Verifying your Meta Pixel is configured correctly...
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Pixel Check Failed</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => window.location.href = '/settings/meta#pixel'}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Go to Pixel Settings
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!pixelStatus?.hasPixel) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>No Meta Pixel Found</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>No Meta Pixel is connected to your ad account. You need a pixel to track conversions.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => window.location.href = '/settings/meta#pixel'}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Set Up Pixel
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const requiredEvent = campaignGoal === 'leads' ? 'Lead' : 'Purchase';
  const hasRequiredEvent = pixelStatus.events[requiredEvent]?.active;
  const eventCount = pixelStatus.events[requiredEvent]?.count_7d || 0;
  const landingPageStatus = pixelStatus.landingPageCheck;

  // All good
  if (hasRequiredEvent && (!landingPageStatus || landingPageStatus.status === 'success')) {
    return (
      <Alert className="border-green-500/30 bg-green-500/5">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-600">Pixel & Events Ready</AlertTitle>
        <AlertDescription className="text-green-600/80">
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {pixelStatus.pixelName}
            </span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
              {requiredEvent}: {eventCount} events (7d)
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Warning state
  return (
    <Alert className="border-yellow-500/30 bg-yellow-500/5">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-600">Event Tracking Issue</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="space-y-2 text-sm">
          {/* Pixel status */}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Pixel connected: {pixelStatus.pixelName}</span>
          </div>

          {/* Event status */}
          <div className="flex items-center gap-2">
            {hasRequiredEvent ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={cn(!hasRequiredEvent && "text-destructive")}>
              {requiredEvent} events: {hasRequiredEvent ? `${eventCount} in last 7 days` : 'Not receiving'}
            </span>
          </div>

          {/* Landing page status */}
          {landingPageStatus && (
            <div className="flex items-center gap-2">
              {landingPageStatus.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : landingPageStatus.status === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={cn(
                landingPageStatus.status === 'error' && "text-destructive",
                landingPageStatus.status === 'warning' && "text-yellow-600"
              )}>
                Landing page: {landingPageStatus.message}
              </span>
            </div>
          )}
        </div>

        {!hasRequiredEvent && (
          <p className="text-xs text-yellow-600/80">
            Without {requiredEvent} event tracking, Meta can't optimize your ads for conversions. 
            You can still publish, but performance may be limited.
          </p>
        )}

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.location.href = '/settings/meta#pixel'}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Set Up Event Tracking
        </Button>
      </AlertDescription>
    </Alert>
  );
}
