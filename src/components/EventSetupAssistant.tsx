import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Copy, ChevronDown, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LumiManualSetupGuides } from '@/components/LumiManualSetupGuides';

interface EventSetupAssistantProps {
  brandId: string;
  workspaceId?: string;
  offerUrl?: string | null;
  campaignGoal: 'leads' | 'sales';
  onStatusChange?: (verified: boolean) => void;
  onSkip?: () => void;
}

const GOAL_TO_EVENT: Record<string, string> = {
  leads: 'Lead',
  sales: 'Purchase',
};

const GOAL_TO_META_EVENT: Record<string, string> = {
  leads: 'LEAD',
  sales: 'PURCHASE',
};

export function EventSetupAssistant({
  brandId,
  workspaceId,
  offerUrl,
  campaignGoal,
  onStatusChange,
  onSkip,
}: EventSetupAssistantProps) {
  const [status, setStatus] = useState<'checking' | 'pass' | 'fail' | 'creating' | 'created' | 'error' | 'idle'>('idle');
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [detectedEvents, setDetectedEvents] = useState<string[]>([]);
  const [confirmationUrl, setConfirmationUrl] = useState('');
  const [createdConversionName, setCreatedConversionName] = useState('');
  const [showManualSetup, setShowManualSetup] = useState(false);

  const requiredEvent = GOAL_TO_EVENT[campaignGoal];

  useEffect(() => {
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
        setStatus('fail');
        onStatusChange?.(false);
      }
    } catch {
      setStatus('fail');
      onStatusChange?.(false);
    }
  };

  const createCustomConversion = async () => {
    if (!confirmationUrl.trim() || !workspaceId) return;

    setStatus('creating');

    try {
      const { data, error } = await supabase.functions.invoke('create-custom-conversion', {
        body: {
          brandId,
          workspaceId,
          confirmationUrl: confirmationUrl.trim(),
          eventType: GOAL_TO_META_EVENT[campaignGoal],
        },
      });

      if (error) throw error;

      if (data?.success) {
        setCreatedConversionName(data.name);
        setStatus('created');
        onStatusChange?.(true);
        toast.success('Tracking set up successfully!');
      } else {
        throw new Error(data?.error || 'Failed to create tracking');
      }
    } catch (err: any) {
      console.error('Failed to create custom conversion:', err);
      toast.error(err.message || 'Failed to set up tracking. Please try again.');
      setStatus('fail');
    }
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

        {/* Checking */}
        {status === 'checking' && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Checking your page for the "{requiredEvent}" event...</span>
          </div>
        )}

        {/* Pass */}
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

        {/* Created — Lumi set it up */}
        {status === 'created' && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700">
                Lumi set up tracking for you!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Meta will count anyone who lands on <span className="font-medium">{confirmationUrl}</span> as a <span className="capitalize">{requiredEvent}</span>.
              </p>
              {createdConversionName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rule name: {createdConversionName}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Creating */}
        {status === 'creating' && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Setting up your tracking...</p>
              <p className="text-xs text-muted-foreground">This only takes a moment.</p>
            </div>
          </div>
        )}

        {/* Fail — primary: Lumi sets it up */}
        {status === 'fail' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">
                  We couldn't detect a "{requiredEvent}" event on this page — but Lumi can fix that.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Without tracking, Meta won't know when someone {campaignGoal === 'leads' ? 'fills out your form' : 'makes a purchase'}.
                </p>
              </div>
            </div>

            {/* Primary: Let Lumi set it up */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Let Lumi set it up for you</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Just tell us: what's the page people see <span className="font-medium text-foreground">after</span> they {campaignGoal === 'leads' ? 'sign up' : 'purchase'}?
              </p>
              <Input
                variant="glow"
                placeholder="e.g. example.com/thank-you"
                value={confirmationUrl}
                onChange={(e) => setConfirmationUrl(e.target.value)}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={createCustomConversion}
                disabled={!confirmationUrl.trim() || !workspaceId}
                className="w-full"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Set up tracking for me
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                We'll tell Meta to count anyone who lands on this page as a {requiredEvent}.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Secondary: Manual setup */}
            <Collapsible open={showManualSetup} onOpenChange={setShowManualSetup}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center">
                  I want to do it myself
                  <ChevronDown className={cn('h-3 w-3 transition-transform', showManualSetup && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <LumiManualSetupGuides
                  campaignGoal={campaignGoal}
                  requiredEvent={requiredEvent}
                  pixelId={pixelId}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Re-check + Skip */}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={verifyTracking} className="text-xs">
                Re-check my page
              </Button>
              {onSkip && (
                <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs text-muted-foreground">
                  Skip for now
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error */}
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

        {/* Idle — no URL yet */}
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
