import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Link2, Unlink } from 'lucide-react';

interface FlodeskIntegrationCardProps {
  brand: any;
  onRefresh: () => void;
}

export function FlodeskIntegrationCard({ brand, onRefresh }: FlodeskIntegrationCardProps) {
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !!(brand?.flodesk_api_key);
  const hasWebhook = !!(brand?.flodesk_webhook_id);
  const hasMetaPixel = !!(brand?.meta_pixel_id && brand?.meta_access_token);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your Flodesk API key');
      return;
    }
    if (!brand?.id) {
      toast.error('No brand found');
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('flodesk-connect', {
        body: { brandId: brand.id, apiKey: apiKey.trim(), action: 'connect' },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Flodesk connected!');
        setApiKey('');
        onRefresh();
      } else {
        toast.error(data?.error || 'Failed to connect Flodesk');
      }
    } catch (err: any) {
      console.error('Flodesk connect error:', err);
      toast.error(err.message || 'Failed to connect Flodesk');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!brand?.id) return;

    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('flodesk-connect', {
        body: { brandId: brand.id, action: 'disconnect' },
      });

      if (error) throw error;

      toast.success('Flodesk disconnected');
      onRefresh();
    } catch (err: any) {
      console.error('Flodesk disconnect error:', err);
      toast.error('Failed to disconnect Flodesk');
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
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div>
              <CardTitle className="text-base">Flodesk</CardTitle>
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
                ⚠️ Connect your Meta account and pixel to enable Lead event forwarding from Flodesk form submissions.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              When someone submits a Flodesk form, LUMI automatically sends a Lead conversion event to your Meta Pixel via the Conversions API.
            </p>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="gap-2"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Disconnect Flodesk
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Flodesk account to automatically send Lead events to Meta when someone submits one of your forms.
            </p>

            <div className="space-y-2">
              <Label htmlFor="flodesk-api-key">Flodesk API Key</Label>
              <Input
                id="flodesk-api-key"
                type="password"
                variant="glow"
                placeholder="Enter your Flodesk API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Find your API key in{' '}
                <a
                  href="https://app.flodesk.com/account/integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Flodesk → Account → Integrations
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <Button
              variant="lumi"
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="gap-2"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Connect Flodesk
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
