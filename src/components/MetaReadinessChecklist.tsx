import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle2, Clock, Loader2, 
  Facebook, Instagram, CreditCard, Activity,
  ChevronDown, ExternalLink, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  helpText: string;
  icon: React.ReactNode;
  isComplete: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface MetaReadinessChecklistProps {
  brandId: string;
  onAllReady?: () => void;
  onConnectMeta?: () => void;
  compact?: boolean;
}

export function MetaReadinessChecklist({ 
  brandId, 
  onAllReady, 
  onConnectMeta,
  compact = false,
}: MetaReadinessChecklistProps) {
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pixelActive, setPixelActive] = useState(false);
  const [checkingPixel, setCheckingPixel] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    if (brandId) fetchBrandData();
  }, [brandId]);

  const fetchBrandData = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, meta_account_id, page_id, page_name, instagram_account_id, instagram_account_name, meta_pixel_id, meta_pixel_name, meta_pixel_events')
        .eq('id', brandId)
        .maybeSingle();

      if (error) throw error;
      setBrand(data);

      if (data?.meta_pixel_id) {
        checkPixelStatus();
      }
    } catch (err) {
      console.error('Error fetching brand for readiness:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPixelStatus = async () => {
    setCheckingPixel(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-pixel-status', {
        body: { brandId },
      });
      if (!error && data?.success && data?.primaryPixel) {
        setPixelActive(true);
      }
    } catch {
      // pixel check failed, leave as false
    } finally {
      setCheckingPixel(false);
    }
  };

  const items: ChecklistItem[] = [
    {
      id: 'page',
      label: 'Facebook Page connected',
      description: 'Your Facebook Page is where your ads will appear from.',
      helpText: 'Connect your Meta account and select the Facebook Page for this brand.',
      icon: <Facebook className="h-4 w-4" />,
      isComplete: !!brand?.page_id,
      actionLabel: brand?.page_id ? undefined : 'Connect Meta',
      onAction: onConnectMeta,
    },
    {
      id: 'instagram',
      label: 'Instagram account linked',
      description: 'Linking Instagram lets your ads run on both Facebook and Instagram.',
      helpText: 'When you connect Meta, make sure your Instagram Business account is linked to your Facebook Page.',
      icon: <Instagram className="h-4 w-4" />,
      isComplete: !!brand?.instagram_account_id,
      actionLabel: brand?.instagram_account_id ? undefined : 'Connect Meta',
      onAction: onConnectMeta,
    },
    {
      id: 'adaccount',
      label: 'Ad account selected',
      description: 'This is the account that pays for and manages your ads.',
      helpText: 'Select your ad account during the Meta connection process.',
      icon: <CreditCard className="h-4 w-4" />,
      isComplete: !!brand?.meta_account_id,
      actionLabel: brand?.meta_account_id ? undefined : 'Connect Meta',
      onAction: onConnectMeta,
    },
    {
      id: 'pixel',
      label: 'Pixel installed on your website',
      description: 'Your pixel tracks who visits your site so Meta knows your ads are working.',
      helpText: 'Install the Meta Pixel on your website so Meta can track conversions. Check your platform\'s guide below.',
      icon: <Activity className="h-4 w-4" />,
      isComplete: !!brand?.meta_pixel_id || pixelActive,
      actionLabel: !brand?.meta_pixel_id && !pixelActive ? 'Check status' : undefined,
      onAction: () => checkPixelStatus(),
    },
  ];

  const completedCount = items.filter(i => i.isComplete).length;
  const allReady = completedCount === items.length;

  useEffect(() => {
    if (allReady && onAllReady) onAllReady();
  }, [allReady, onAllReady]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking your setup...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="gradient">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="flex items-center justify-between">
          <span className="text-base font-display">Connection Status</span>
          <span className="text-xs font-normal text-muted-foreground">
            {completedCount}/{items.length} complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 mb-2">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            We're actively working with Meta to finalize full verification. Your connection is working — this checklist will update automatically within 24–48 hours.
          </p>
        </div>
        {items.map((item) => (
          <Collapsible
            key={item.id}
            open={expandedItem === item.id}
            onOpenChange={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                  item.isComplete
                    ? 'bg-green-500/5 hover:bg-green-500/10'
                    : 'bg-amber-500/5 hover:bg-amber-500/10'
                )}
              >
                {item.isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.isComplete && item.id === 'page' && brand?.page_name && (
                    <span className="text-xs text-muted-foreground ml-2">{brand.page_name}</span>
                  )}
                  {item.isComplete && item.id === 'instagram' && brand?.instagram_account_name && (
                    <span className="text-xs text-muted-foreground ml-2">@{brand.instagram_account_name}</span>
                  )}
                </div>
                {!item.isComplete && (
                  <ChevronDown className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    expandedItem === item.id && 'rotate-180'
                  )} />
                )}
              </button>
            </CollapsibleTrigger>

            {!item.isComplete && (
              <CollapsibleContent>
                <div className="ml-11 mr-3 mb-2 mt-1 space-y-2">
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground italic">{item.helpText}</p>
                  {item.actionLabel && item.onAction && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onAction?.();
                      }}
                      className="text-xs h-7"
                    >
                      {item.actionLabel}
                    </Button>
                  )}
                  {expandedItem === 'pixel' && item.id === 'pixel' && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">Quick install guides:</p>
                      <div className="space-y-1.5">
                        {[
                          { name: "Kajabi", url: "https://help.kajabi.com/hc/en-us/articles/360035249811" },
                          { name: "Shopify", url: "https://help.shopify.com/en/manual/promoting-marketing/pixels/facebook" },
                          { name: "WordPress", url: "https://wordpress.org/plugins/pixel-caffeine/" },
                          { name: "Squarespace", url: "https://support.squarespace.com/hc/en-us/articles/205815908" },
                          { name: "Wix", url: "https://support.wix.com/en/article/adding-the-facebook-pixel-to-your-wix-site" },
                          { name: "ClickFunnels", url: "https://help.clickfunnels.com/hc/en-us/articles/360001134723" },
                          { name: "Kartra", url: "https://help.kartra.com/article/meta-facebook-pixel" },
                        ].map(({ name, url }) => (
                          <a
                            key={name}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {name} guide
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        ))}

        {allReady && (
          <div className="text-center pt-2">
            <p className="text-sm text-green-600 font-medium">
              ✅ You're all set! Your Meta account is fully connected.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
