import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, ShoppingBag, Globe, BookOpen, Code2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface LumiManualSetupGuidesProps {
  campaignGoal: 'leads' | 'sales';
  requiredEvent: string;
  pixelId: string | null;
}

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

export function LumiManualSetupGuides({ campaignGoal, requiredEvent, pixelId }: LumiManualSetupGuidesProps) {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [showWhyItMatters, setShowWhyItMatters] = useState(false);

  const codeSnippet = pixelId
    ? `<!-- Add this to your Thank You / confirmation page -->\n<script>\n  fbq('track', '${requiredEvent}');\n</script>`
    : `<!-- Connect your Meta account first to get your Pixel ID -->`;

  const copySnippet = () => {
    navigator.clipboard.writeText(codeSnippet);
    toast.success('Code copied!');
  };

  return (
    <div className="space-y-3 mt-3">
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
          How to fix it manually
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
    </div>
  );
}
