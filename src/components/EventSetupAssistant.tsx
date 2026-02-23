import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Copy, ShoppingBag, Globe, BookOpen, Code2, ChevronDown, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EventSetupAssistantProps {
  brandId: string;
  offerUrl?: string | null;
  campaignGoal: 'leads' | 'sales';
  onStatusChange?: (verified: boolean) => void;
  onSkip?: () => void;
}

const GOAL_TO_EVENT: Record<string, string> = {
  leads: 'Lead',
  sales: 'Purchase',
};

const platformGuides = [
  {
    id: 'shopify',
    name: 'Shopify',
    icon: ShoppingBag,
    steps: [
      'Go to your Shopify admin → Settings → Customer events',
      'Click "Add custom pixel" and select "Facebook Pixel"',
      'Enter your Pixel ID and enable the event you need',
      'Save — events will start firing automatically',
    ],
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    icon: Globe,
    steps: [
      'Install the "PixelYourSite" plugin',
      'Go to Settings → PixelYourSite and enter your Pixel ID',
      'Enable the event you need (Lead or Purchase)',
      'Save — test with Meta Pixel Helper extension',
    ],
  },
  {
    id: 'kajabi',
    name: 'Kajabi',
    icon: BookOpen,
    steps: [
      'Go to Settings → Site → Tracking Codes',
      'Paste the event code in the "Thank You" page tracking section',
      'Save — the event fires when someone hits that page',
    ],
  },
  {
    id: 'other',
    name: 'Other / Manual',
    icon: Code2,
    steps: [
      'Copy the code snippet below',
      'Paste it on your form\'s "Thank You" page or confirmation page',
      'The event fires when someone loads that page',
    ],
  },
];

export function EventSetupAssistant({
  brandId,
  offerUrl,
  campaignGoal,
  onStatusChange,
  onSkip,
}: EventSetupAssistantProps) {
  const [status, setStatus] = useState<'checking' | 'pass' | 'fail' | 'error' | 'idle'>('idle');
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [detectedEvents, setDetectedEvents] = useState<string[]>([]);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [showWhyItMatters, setShowWhyItMatters] = useState(false);

  const requiredEvent = GOAL_TO_EVENT[campaignGoal];

  useEffect(() => {
    // Fetch brand pixel ID
    supabase
      .from('brands')
      .select('meta_pixel_id')
      .eq('id', brandId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.meta_pixel_id) setPixelId(data.meta_pixel_id);
      });
  }, [brandId]);

  useEffect(() => {
    if (offerUrl) {
      verifyTracking();
    }
  }, [offerUrl]);

  const verifyTracking = async () => {
    if (!offerUrl) return;
    setStatus('checking');

    try {
      const { data, error } = await supabase.functions.invoke('verify-landing-page-pixel', {
        body: { brandId, url: offerUrl },
      });

      if (error) throw error;

      if (data?.success) {
        const events = data.detection?.detectedEvents || [];
        setDetectedEvents(events);

        const hasRequiredEvent = events.some(
          (e: string) => e.toLowerCase() === requiredEvent.toLowerCase()
        );

        setStatus(hasRequiredEvent ? 'pass' : 'fail');
        onStatusChange?.(hasRequiredEvent);
      } else {
        setStatus('error');
        onStatusChange?.(false);
      }
    } catch {
      setStatus('error');
      onStatusChange?.(false);
    }
  };

  const codeSnippet = pixelId
    ? `<!-- Add this to your Thank You / confirmation page -->\n<script>\n  fbq('track', '${requiredEvent}');\n</script>`
    : `<!-- Connect your Meta account first to get your Pixel ID -->`;

  const copySnippet = () => {
    navigator.clipboard.writeText(codeSnippet);
    toast.success('Code copied!');
  };

  return (
    <Card variant="gradient" className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold">
            Let's make sure Meta can track results
          </h3>
          <p className="text-sm text-muted-foreground">
            Your campaign goal: <span className="font-medium text-foreground capitalize">{campaignGoal}</span>
            {offerUrl && (
              <>
                {' · '}
                <span className="text-xs truncate">{offerUrl}</span>
              </>
            )}
          </p>
        </div>

        {/* Status */}
        {status === 'checking' && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Checking your page for the "{requiredEvent}" event...</span>
          </div>
        )}

        {status === 'pass' && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-700">
                "{requiredEvent}" event detected — you're all set!
              </p>
              {detectedEvents.length > 1 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Also found: {detectedEvents.filter(e => e !== requiredEvent).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {status === 'fail' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">
                  We couldn't find a "{requiredEvent}" event on this page
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Without this, Meta won't know when someone {campaignGoal === 'leads' ? 'fills out your form' : 'makes a purchase'}.
                </p>
              </div>
            </div>

            {/* What does this mean? */}
            <Collapsible open={showWhyItMatters} onOpenChange={setShowWhyItMatters}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                  What does this mean?
                  <ChevronDown className={cn('h-3 w-3 transition-transform', showWhyItMatters && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground mt-1">
                  When someone {campaignGoal === 'leads' ? 'fills out your form' : 'completes a purchase'},
                  Meta needs a small signal to know it worked. This signal is called an "event."
                  Without it, Meta can't learn which people are most likely to convert — so your ads
                  won't improve over time.
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Platform Guides */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                How to fix it
              </p>
              <div className="grid grid-cols-2 gap-2">
                {platformGuides.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Collapsible
                      key={p.id}
                      open={expandedPlatform === p.id}
                      onOpenChange={() =>
                        setExpandedPlatform(expandedPlatform === p.id ? null : p.id)
                      }
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            'flex items-center gap-2 p-3 rounded-xl border text-sm w-full transition-colors',
                            expandedPlatform === p.id
                              ? 'bg-primary/10 border-primary/30'
                              : 'bg-card hover:bg-muted/50'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {p.name}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="col-span-2">
                        <div className="p-3 mt-1 rounded-lg bg-muted/50 space-y-1.5">
                          {p.steps.map((step, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex gap-2">
                              <span className="font-medium text-foreground shrink-0">{i + 1}.</span>
                              {step}
                            </p>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>

            {/* Code Snippet */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Or copy this code:</p>
              <div className="relative">
                <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {codeSnippet}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-1 right-1 h-7 w-7 p-0"
                  onClick={copySnippet}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Re-check + Skip */}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={verifyTracking} className="text-xs">
                Re-check my page
              </Button>
              {onSkip && (
                <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs text-muted-foreground">
                  Skip for now — I'll set it up later
                </Button>
              )}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                We couldn't check this page right now. You can try again or skip for now.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={verifyTracking} className="text-xs">
                Try again
              </Button>
              {onSkip && (
                <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs text-muted-foreground">
                  Skip for now
                </Button>
              )}
            </div>
          </div>
        )}

        {status === 'idle' && !offerUrl && (
          <div className="p-4 rounded-xl bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">
              Add an offer URL to your campaign to verify event tracking.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
