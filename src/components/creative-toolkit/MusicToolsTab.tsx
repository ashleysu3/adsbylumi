import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, Video, MessageSquare, Scissors, FileText, ExternalLink, Info } from "lucide-react";

const MUSIC_SOURCES = [
  {
    icon: Music,
    name: "CapCut Commercial Music",
    badge: "Free with CapCut",
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    description: "CapCut's built-in commercial sound library is cleared for use in paid ads. It's our top recommendation — massive selection, zero licensing headaches, and it's already in the tool you're probably editing in.",
    note: "⭐ LUMI's top pick",
    url: "https://www.capcut.com",
    buttonLabel: "Get CapCut Free →",
  },
  {
    icon: Music,
    name: "Epidemic Sound",
    badge: "Paid Subscription",
    badgeColor: "",
    description: "The gold standard for royalty-free music. Huge library, every track cleared for commercial use including paid ads. Worth it if you're producing at volume.",
    url: "https://www.epidemicsound.com",
    buttonLabel: "Browse Epidemic Sound →",
  },
  {
    icon: Music,
    name: "Pixabay Music",
    badge: "Free",
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    description: "Completely free, no attribution required, commercial use allowed. Quality varies but there are solid options — especially for background ambience and lofi vibes.",
    url: "https://pixabay.com/music/",
    buttonLabel: "Browse Pixabay Music →",
  },
];

const PRODUCTION_TOOLS = [
  {
    icon: Video,
    name: "CapCut",
    badge: "Free",
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    badge2: "⭐ LUMI's top pick",
    description: "Our go-to editing tool. Free, intuitive, built for short-form content. Has auto-captions, templates, transitions, music, and everything you need to take your ad from raw footage to finished in under 20 minutes.",
    url: "https://www.capcut.com",
    buttonLabel: "Get CapCut →",
  },
  {
    icon: MessageSquare,
    name: "Captions",
    badge: "Free + Paid",
    badgeColor: "",
    description: "AI-powered captions and video editing in one app. Automatically adds styled subtitles to your talking head videos — essential since 85% of people watch without sound. Also great for quick edits and cleanup.",
    url: "https://www.captions.ai",
    buttonLabel: "Get Captions →",
  },
  {
    icon: Scissors,
    name: "Edits (by Instagram)",
    badge: "Free",
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    description: "Instagram's own editing app — great for adding music, transitions, and text overlays quickly. Seamless for content going back into Meta. Clean interface, easy to learn.",
    url: "https://www.editsapp.com",
    buttonLabel: "Get Edits →",
  },
  {
    icon: FileText,
    name: "Descript",
    badge: "Free + Paid",
    badgeColor: "",
    description: "Edit video by editing the transcript — delete words, and the video cuts itself. Great for longer talking head content. Also has AI voice cleanup and filler word removal.",
    url: "https://www.descript.com",
    buttonLabel: "Get Descript →",
  },
];

function ResourceCard({ item }: { item: typeof MUSIC_SOURCES[0] & { badge2?: string } }) {
  const Icon = item.icon;
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-foreground">{item.name}</h3>
              <Badge className={item.badgeColor || undefined} variant={item.badgeColor ? undefined : "secondary"}>
                {item.badge}
              </Badge>
              {"badge2" in item && item.badge2 && (
                <Badge variant="outline" className="text-xs">{item.badge2}</Badge>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{item.description}</p>
        {"note" in item && item.note && (
          <p className="text-xs text-muted-foreground font-medium">{item.note}</p>
        )}
        <Button variant="outline" size="sm" asChild>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            {item.buttonLabel} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function MusicToolsTab() {
  return (
    <div className="space-y-10">
      {/* Section 1: Music */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Music That Won't Get Your Ads Rejected</h2>
          <p className="text-sm text-muted-foreground">
            Using the wrong music is one of the fastest ways to get your ad flagged. These are the sources we recommend — all commercial-use safe.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MUSIC_SOURCES.map((src) => (
            <ResourceCard key={src.name} item={src} />
          ))}
        </div>
      </section>

      {/* Section 2: Production Tools */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Tools We Actually Use</h2>
          <p className="text-sm text-muted-foreground">
            Simple, powerful tools for editing your ads without a production team.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRODUCTION_TOOLS.map((tool) => (
            <ResourceCard key={tool.name} item={tool as any} />
          ))}
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 rounded-xl bg-muted p-4">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            All tools listed here are independently recommended by the LUMI team. We are not sponsored by or affiliated with any of these products.
          </p>
        </div>
      </section>
    </div>
  );
}
