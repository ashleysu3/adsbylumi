import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Activity, CheckCircle2, XCircle, AlertTriangle, 
  Loader2, Search, Copy, ExternalLink, Zap,
  Globe, ShoppingBag, Code2, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PixelEvent {
  active: boolean;
  count_7d: number;
}

interface PixelData {
  id: string;
  name: string;
  events: Record<string, PixelEvent>;
}

interface PixelVerificationCardProps {
  brandId: string;
  isMetaConnected: boolean;
  initialPixelData?: PixelData | null;
  onPixelVerified?: (pixel: PixelData) => void;
}

interface LandingPageResult {
  status: 'success' | 'warning' | 'error';
  message: string;
  detection: {
    hasPixel: boolean;
    pixelIds: string[];
    matchesBrand: boolean;
    brandPixelId: string | null;
    detectedEvents: string[];
    hasEventTracking: boolean;
  };
}

const platformGuides = [
  {
    id: 'shopify',
    name: 'Shopify',
    icon: ShoppingBag,
    steps: [
      'Go to your Shopify admin → Settings → Customer events',
      'Click "Add custom pixel" and select "Facebook Pixel"',
      'Enter your Pixel ID (shown above)',
      'Enable "Purchase" and "Lead" events in the configuration',
      'Click Save to activate tracking'
    ],
    codeExample: null,
    docsUrl: 'https://help.shopify.com/en/manual/promoting-marketing/analyze-marketing/facebook-pixel'
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    icon: Globe,
    steps: [
      'Install the "PixelYourSite" or "Facebook for WordPress" plugin',
      'Go to Settings → PixelYourSite',
      'Enter your Pixel ID in the configuration',
      'Enable the events you want to track (Purchase, Lead, etc.)',
      'Save changes and test with Meta Pixel Helper browser extension'
    ],
    codeExample: null,
    docsUrl: 'https://wordpress.org/plugins/pixelyoursite/'
  },
  {
    id: 'kajabi',
    name: 'Kajabi',
    icon: BookOpen,
    steps: [
      'Go to Settings → Site → Tracking Codes',
      'Paste your Meta Pixel base code in the "Header tracking code" section',
      'For specific page events, add event code to individual page settings',
      'Use the "Thank You" page for Lead/Purchase event tracking'
    ],
    codeExample: null,
    docsUrl: 'https://help.kajabi.com/hc/en-us/articles/360037067614'
  },
  {
    id: 'custom',
    name: 'Custom / Manual',
    icon: Code2,
    steps: [
      'Copy the Meta Pixel base code below',
      'Paste it in the <head> section of your website',
      'Add event tracking code on relevant pages',
      'For purchases: Add fbq(\'track\', \'Purchase\') on order confirmation',
      'For leads: Add fbq(\'track\', \'Lead\') on form submission'
    ],
    codeExample: `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`,
    docsUrl: 'https://developers.facebook.com/docs/meta-pixel/get-started'
  }
];

const eventDescriptions: Record<string, string> = {
  Purchase: 'Tracks completed purchases/sales',
  Lead: 'Tracks form submissions and signups',
  ViewContent: 'Tracks page views on key content',
  AddToCart: 'Tracks add-to-cart actions',
  InitiateCheckout: 'Tracks checkout starts',
  CompleteRegistration: 'Tracks account registrations'
};

export function PixelVerificationCard({ 
  brandId, 
  isMetaConnected, 
  initialPixelData,
  onPixelVerified 
}: PixelVerificationCardProps) {
  const [loading, setLoading] = useState(false);
  const [verifyingUrl, setVerifyingUrl] = useState(false);
  const [pixelData, setPixelData] = useState<PixelData | null>(initialPixelData || null);
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [landingPageResult, setLandingPageResult] = useState<LandingPageResult | null>(null);

  const checkPixelStatus = async () => {
    if (!brandId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-pixel-status', {
        body: { brandId }
      });

      if (error) throw error;

      if (data.success && data.primaryPixel) {
        setPixelData(data.primaryPixel);
        onPixelVerified?.(data.primaryPixel);
        toast.success('Pixel status updated');
      } else if (data.needsConnection) {
        toast.error('Please connect your Meta account first');
      } else {
        toast.error(data.error || 'No pixels found');
      }
    } catch (error) {
      console.error('Error checking pixel status:', error);
      toast.error('Failed to check pixel status');
    } finally {
      setLoading(false);
    }
  };

  const verifyLandingPage = async () => {
    if (!landingPageUrl.trim()) {
      toast.error('Please enter a URL to verify');
      return;
    }

    setVerifyingUrl(true);
    setLandingPageResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-landing-page-pixel', {
        body: { brandId, url: landingPageUrl }
      });

      if (error) throw error;

      if (data.success) {
        setLandingPageResult(data);
        
        if (data.status === 'success') {
          toast.success(data.message);
        } else if (data.status === 'warning') {
          toast.warning(data.message);
        } else {
          toast.error(data.message);
        }
      } else {
        toast.error(data.error || 'Failed to verify landing page');
      }
    } catch (error) {
      console.error('Error verifying landing page:', error);
      toast.error('Failed to verify landing page');
    } finally {
      setVerifyingUrl(false);
    }
  };

  const copyCode = (code: string, pixelId?: string) => {
    const finalCode = pixelId ? code.replace(/YOUR_PIXEL_ID/g, pixelId) : code;
    navigator.clipboard.writeText(finalCode);
    toast.success('Code copied to clipboard');
  };

  const primaryEvents = ['Purchase', 'Lead'];
  const secondaryEvents = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'CompleteRegistration'];

  if (!isMetaConnected) {
    return (
      <Card variant="gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Pixel & Event Tracking
          </CardTitle>
          <CardDescription>
            Connect your Meta account to view pixel status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connect your Meta ad account above to check your pixel and event tracking status.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="gradient" id="pixel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Pixel & Event Tracking
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkPixelStatus}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Check Status
          </Button>
        </div>
        <CardDescription>
          Verify your Meta Pixel installation and event tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pixel Status */}
        {pixelData ? (
          <div className="space-y-4">
            {/* Pixel Info */}
            <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Connected Pixel</p>
                <p className="font-medium">{pixelData.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{pixelData.id}</p>
              </div>
              <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>

            {/* Event Status Table */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                Event Tracking Status
                <Badge variant="secondary" className="text-xs font-normal">Last 7 days</Badge>
              </h4>
              
              {/* Primary Events */}
              <div className="space-y-2">
                {primaryEvents.map(event => {
                  const eventData = pixelData.events[event];
                  const isActive = eventData?.active && eventData.count_7d > 0;
                  
                  return (
                    <div 
                      key={event}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isActive 
                          ? "bg-green-500/5 border-green-500/20" 
                          : "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isActive ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="font-medium">{event}</p>
                          <p className="text-xs text-muted-foreground">{eventDescriptions[event]}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isActive ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                            {eventData.count_7d.toLocaleString()} events
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Not receiving</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Secondary Events (Collapsed) */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="secondary-events" className="border-none">
                  <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                    View additional events
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {secondaryEvents.map(event => {
                        const eventData = pixelData.events[event];
                        const isActive = eventData?.active && eventData.count_7d > 0;
                        
                        return (
                          <div 
                            key={event}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              {isActive ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">{event}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {eventData?.count_7d?.toLocaleString() || 0} events
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Warning if primary events not firing */}
            {primaryEvents.some(e => !pixelData.events[e]?.active || pixelData.events[e]?.count_7d === 0) && (
              <Alert className="border-yellow-500/30 bg-yellow-500/5">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-sm">
                  <strong>Missing event tracking:</strong> Purchase or Lead events aren't being received. 
                  Set up event tracking on your conversion pages using the guides below.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Click "Check Status" to view your pixel and event tracking data
            </p>
            <Button onClick={checkPixelStatus} disabled={loading} variant="lumi">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Checking...
                </>
              ) : (
                'Check Pixel Status'
              )}
            </Button>
          </div>
        )}

        {/* Verify Landing Page */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Verify Landing Page
          </h4>
          <p className="text-xs text-muted-foreground">
            Check if your pixel is installed correctly on a specific page
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://yoursite.com/landing-page"
              value={landingPageUrl}
              onChange={(e) => setLandingPageUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={verifyLandingPage} 
              disabled={verifyingUrl || !landingPageUrl.trim()}
              variant="outline"
            >
              {verifyingUrl ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Verify'
              )}
            </Button>
          </div>

          {/* Landing Page Result */}
          {landingPageResult && (
            <div className={cn(
              "p-4 rounded-lg border",
              landingPageResult.status === 'success' && "bg-green-500/5 border-green-500/20",
              landingPageResult.status === 'warning' && "bg-yellow-500/5 border-yellow-500/20",
              landingPageResult.status === 'error' && "bg-destructive/5 border-destructive/20"
            )}>
              <div className="flex items-start gap-3">
                {landingPageResult.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />}
                {landingPageResult.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />}
                {landingPageResult.status === 'error' && <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
                <div className="flex-1">
                  <p className="font-medium text-sm">{landingPageResult.message}</p>
                  {landingPageResult.detection.pixelIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Found pixel(s): {landingPageResult.detection.pixelIds.join(', ')}
                    </p>
                  )}
                  {landingPageResult.detection.detectedEvents.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Events detected: {landingPageResult.detection.detectedEvents.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Setup Guides */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-semibold">Setup Guides</h4>
          <p className="text-xs text-muted-foreground">
            Follow these guides to install your pixel and set up event tracking
          </p>
          
          <Accordion type="single" collapsible className="w-full">
            {platformGuides.map((platform) => (
              <AccordionItem key={platform.id} value={platform.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <platform.icon className="h-4 w-4" />
                    {platform.name}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                      {platform.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    
                    {platform.codeExample && (
                      <div className="relative">
                        <pre className="p-3 bg-muted/50 rounded-lg text-xs overflow-x-auto">
                          <code>{pixelData ? platform.codeExample.replace(/YOUR_PIXEL_ID/g, pixelData.id) : platform.codeExample}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={() => copyCode(platform.codeExample!, pixelData?.id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    <Button variant="link" className="p-0 h-auto text-xs" asChild>
                      <a href={platform.docsUrl} target="_blank" rel="noopener noreferrer">
                        View full documentation
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Event Code Examples */}
        {pixelData && (
          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Event Tracking Code
            </h4>
            <p className="text-xs text-muted-foreground">
              Add these to your conversion pages (e.g., thank you page, order confirmation)
            </p>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <p className="text-xs font-medium mb-1">Purchase Event</p>
                <pre className="p-3 bg-muted/50 rounded-lg text-xs">
                  <code>{`fbq('track', 'Purchase', {
  value: 99.00,
  currency: 'USD'
});`}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-6 right-2 h-7 w-7"
                  onClick={() => copyCode(`fbq('track', 'Purchase', {\n  value: 99.00,\n  currency: 'USD'\n});`)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="relative">
                <p className="text-xs font-medium mb-1">Lead Event</p>
                <pre className="p-3 bg-muted/50 rounded-lg text-xs">
                  <code>{`fbq('track', 'Lead', {
  content_name: 'Form Name'
});`}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-6 right-2 h-7 w-7"
                  onClick={() => copyCode(`fbq('track', 'Lead', {\n  content_name: 'Form Name'\n});`)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
