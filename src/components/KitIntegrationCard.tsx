import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Link2, Unlink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface KitIntegrationCardProps {
  brand: any;
  onRefresh: () => void;
}

export function KitIntegrationCard({ brand, onRefresh }: KitIntegrationCardProps) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const isConnected = !!(brand?.kit_access_token);
  const hasWebhook = !!(brand?.kit_webhook_id);
  const hasMetaPixel = !!(brand?.meta_pixel_id && brand?.meta_access_token);

  // Handle OAuth callback result
  useEffect(() => {
    const kitStatus = searchParams.get('kit');
    if (kitStatus === 'success') {
      toast.success('Kit connected successfully! 🎉');
      searchParams.delete('kit');
      setSearchParams(searchParams, { replace: true });
      onRefresh();
    } else if (kitStatus === 'error') {
      toast.error('Failed to connect Kit. Please try again.');
      searchParams.delete('kit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const handleConnect = async () => {
    if (!brand?.id) {
      toast.error('No brand found');
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('kit-oauth-init', {
        body: { brandId: brand.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to start Kit connection');
      }
    } catch (err: any) {
      console.error('Kit connect error:', err);
      toast.error(err.message || 'Failed to connect Kit');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!brand?.id) return;

    setDisconnecting(true);
    try {
      // Clear Kit tokens from brand
      const { error } = await supabase
        .from('brands')
        .update({
          kit_access_token: null,
          kit_refresh_token: null,
          kit_webhook_id: null,
        })
        .eq('id', brand.id);

      if (error) throw error;

      toast.success('Kit disconnected');
      onRefresh();
    } catch (err: any) {
      console.error('Kit disconnect error:', err);
      toast.error('Failed to disconnect Kit');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary" fill="currentColor">
                <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-base">Kit</CardTitle>
              <CardDescription className="text-xs">
                Form submissions → Meta Lead events
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={isConnected
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : ''
            }
          >
            {isConnected ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Not Connected
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Webhook Status</span>
                <Badge variant={hasWebhook ? 'default' : 'destructive'} className={hasWebhook ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : ''}>
                  {hasWebhook ? 'Active' : 'Not Registered'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Meta CAPI</span>
                <Badge variant={hasMetaPixel ? 'default' : 'secondary'} className={hasMetaPixel ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : ''}>
                  {hasMetaPixel ? 'Ready' : 'No Pixel Connected'}
                </Badge>
              </div>
            </div>

            {!hasMetaPixel && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Connect your Meta account and pixel to enable Lead event forwarding from Kit form submissions.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              When someone submits a Kit form, LUMI automatically sends a Lead conversion event to your Meta Pixel via the Conversions API.
            </p>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-2"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Disconnect Kit
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Kit account so LUMI can automatically tell Meta when someone fills out one of your forms — giving your ads better data to find more people like your leads.
            </p>

            <Button
              variant="lumi"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full gap-2"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {connecting ? 'Connecting...' : 'Sign in with Kit'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              You'll be redirected to Kit to authorize the connection.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
