import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { PixelVerificationCard } from '@/components/PixelVerificationCard';
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Activity, ShieldCheck, AlertTriangle, Sparkles,
  MessageCircle, ExternalLink, HelpCircle, Loader2, Link2Off
} from 'lucide-react';
import { useLumiAssistant } from '@/components/LumiAssistant';

export default function TrackingSetup() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandLoading } = useBrand();
  const { open: openLumi } = useLumi() as any;
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!activeBrand?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data } = await supabase
          .from('brands')
          .select('id, name, meta_account_id, meta_pixel_id, meta_pixel_name, meta_pixel_events')
          .eq('id', activeBrand.id)
          .maybeSingle();
        setBrand(data);
      } finally {
        setLoading(false);
      }
    };
    if (!brandLoading) load();
  }, [activeBrand?.id, brandLoading]);

  const isConnected = !!brand?.meta_account_id;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/meta-settings')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Meta Connection
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold font-display">Tracking & Pixel Setup</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            This is where we make sure Meta knows when someone takes action on your site —
            views your offer, signs up, or buys. Tracking is the #1 thing that trips creators up,
            so we built this page to walk you through it without the jargon.
          </p>
        </div>

        {/* Reassurance banner */}
        <Alert className="border-primary/30 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertTitle>Don't panic if you see a warning</AlertTitle>
          <AlertDescription>
            Tracking errors look scary but are almost always a 5-minute fix. Read the plain-English
            explanations below, or tap <strong>Ask Lumi</strong> at the bottom and we'll walk you through
            it step-by-step.
          </AlertDescription>
        </Alert>

        {/* Not connected state */}
        {!loading && !isConnected && (
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <Link2Off className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">Connect Meta first</h3>
                <p className="text-sm text-muted-foreground">
                  You'll need to connect your Meta ad account before we can set up your pixel.
                </p>
              </div>
              <Button onClick={() => navigate('/meta-settings')}>
                Go to Meta Connection
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your tracking setup…
            </CardContent>
          </Card>
        )}

        {/* The actual pixel verification */}
        {!loading && isConnected && brand?.id && (
          <PixelVerificationCard
            brandId={brand.id}
            isMetaConnected={isConnected}
            initialPixelData={brand?.meta_pixel_id ? {
              id: brand.meta_pixel_id,
              name: brand.meta_pixel_name || 'Meta Pixel',
              events: brand.meta_pixel_events || {}
            } : null}
          />
        )}

        {/* Plain-English education */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Tracking, explained simply
            </CardTitle>
            <CardDescription>
              The basics every creator should know — no marketing degree required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="what">
                <AccordionTrigger>What is the Meta Pixel?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Think of the pixel as a little reporter sitting on your website.
                    Every time someone visits a page, signs up, or buys, the pixel sends a
                    message back to Meta saying "hey, this person did the thing."
                  </p>
                  <p>
                    Meta uses those reports to find <em>more</em> people just like the ones who
                    convert — which is how your ads get cheaper and better over time.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="why">
                <AccordionTrigger>Why do I have to set it up?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Without a pixel, Meta is basically running your ads blindfolded. You'll spend
                    more money to get the same result, and you won't know which ad actually drove
                    the sale.
                  </p>
                  <p>
                    Setting it up takes ~10 minutes and is the single highest-ROI thing you can do
                    before launching a campaign.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="events">
                <AccordionTrigger>What's an "event"? (PageView, Lead, Purchase…)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>An event is just an action you want to track. The most common ones:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>PageView</strong> — someone landed on your site</li>
                    <li><strong>Lead</strong> — someone gave you their email</li>
                    <li><strong>Purchase</strong> — someone paid you</li>
                    <li><strong>CompleteRegistration</strong> — someone signed up for your webinar/course</li>
                  </ul>
                  <p>
                    You want at least <strong>PageView + Lead</strong> firing before you launch
                    lead-gen campaigns, and <strong>Purchase</strong> for sales campaigns.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="errors">
                <AccordionTrigger>Common errors and what they actually mean</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-3">
                  <div>
                    <p className="font-medium text-foreground">"Pixel not detected on landing page"</p>
                    <p>The pixel code isn't installed on the page you're sending traffic to.
                    Add the pixel to your site builder (Showit, Squarespace, Kajabi, etc.) — see the
                    platform guides in the card above.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">"No events received in last 7 days"</p>
                    <p>The pixel is installed but no one has triggered an event recently. This is
                    usually fine if you haven't been driving traffic. Click "Test events" in your
                    pixel to verify it's working.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">"Multiple pixels detected"</p>
                    <p>You've got more than one pixel on the same page. Pick one and remove the rest,
                    otherwise Meta gets confused and your data gets fuzzy.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ios">
                <AccordionTrigger>What about iOS 14 / Apple privacy changes?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Short version: iPhone users can opt out of tracking, so Meta misses some events.
                    To recover that data, Meta uses something called the <strong>Conversions API
                    (CAPI)</strong> — server-to-server tracking that doesn't rely on the browser.
                  </p>
                  <p>
                    Most modern site builders (Shopify, Kajabi, Showit with plugins) have CAPI
                    built-in. If you want hands-on help wiring this up, tap Ask Lumi.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="domain">
                <AccordionTrigger>Domain verification (the other thing you'll see)</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Meta wants to confirm you actually own your website. You verify your domain in
                    Business Manager → Brand Safety → Domains by adding a meta tag, DNS record, or
                    HTML file.
                  </p>
                  <p>
                    Without it, Meta limits you to 8 conversion events and your iOS tracking suffers.
                    Worth doing once and forgetting about.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Hands-on help */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Still stuck? Get hands-on help
            </CardTitle>
            <CardDescription>
              Tracking is the part where most creators want a human in the loop. We've got you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Button
                variant="default"
                className="justify-start"
                onClick={() => openLumi?.({ topic: 'pixel_help' })}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Ask Lumi about my pixel
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a
                  href="https://www.facebook.com/business/help/952192354843755"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Meta's official pixel guide
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Coming soon: book a 15-min office hours call with our team to set up your pixel together.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
