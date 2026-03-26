import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatInvokeError } from '@/lib/formatInvokeError';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Link2, Unlink, ChevronRight } from 'lucide-react';

interface FlodeskIntegrationCardProps {
  brand: any;
  onRefresh: () => void;
}

export function FlodeskIntegrationCard({ brand, onRefresh }: FlodeskIntegrationCardProps) {
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const isConnected = !!(brand?.flodesk_api_key);
  const hasWebhook = !!(brand?.flodesk_webhook_id);
  const hasMetaPixel = !!(brand?.meta_pixel_id && brand?.meta_access_token);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error('Please paste your Flodesk connection key');
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
        toast.success(data.message || 'Flodesk connected! 🎉');
        setApiKey('');
        setShowSteps(false);
        onRefresh();
      } else {
        toast.error(data?.error || 'Failed to connect Flodesk');
      }
    } catch (err: any) {
      console.error('Flodesk connect error:', err);
      toast.error(formatInvokeError(err) || 'Failed to connect Flodesk');
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
      toast.error(formatInvokeError(err) || 'Failed to disconnect Flodesk');
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
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
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
        ) : !showSteps ? (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Flodesk account so LUMI can automatically tell Meta when someone fills out one of your forms — giving your ads better data to find more people like your leads.
            </p>

            <Button
              variant="lumi"
              onClick={() => setShowSteps(true)}
              className="w-full gap-2"
            >
              <Link2 className="h-4 w-4" />
              Connect Flodesk
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </>
        ) : (
          <>
            {/* Guided walkthrough */}
            <div className="space-y-4">
              <p className="text-sm font-medium">
                This takes about 30 seconds ✨
              </p>

              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div className="space-y-1.5 flex-1">
                  <p className="text-sm font-medium">Open your Flodesk integrations page</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open('https://app.flodesk.com/account/integrations', '_blank')}
                  >
                    Open Flodesk Integrations
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Scroll to "API Key" and click <span className="font-semibold text-primary">Copy</span></p>
                  <p className="text-xs text-muted-foreground">
                    Look for the section labeled "API & Integrations" — your key will be a long string of letters and numbers.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium">Paste it here and hit connect</p>
                  <Input
                    type="password"
                    variant="glow"
                    placeholder="Paste your Flodesk key here"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="lumi"
                onClick={handleConnect}
                disabled={connecting || !apiKey.trim()}
                className="gap-2 flex-1"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {connecting ? 'Connecting...' : 'Connect Flodesk'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowSteps(false); setApiKey(''); }}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Your key is stored securely and only used to listen for form submissions.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
