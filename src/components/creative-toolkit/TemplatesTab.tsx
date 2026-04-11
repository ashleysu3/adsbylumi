import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ExternalLink } from "lucide-react";
import lumiLogo from "@/assets/lumi-logo.png";

const CATEGORIES = [
  "All",
  "Webinar & Events",
  "Lead Magnet & Freebie",
  "Course & Program Launch",
  "Story & Reel Overlays",
  "Talking Head Overlays",
  "B-Roll Overlays",
  "Quote & Testimonial",
  "Ad Graphics",
] as const;

interface TemplatePack {
  name: string;
  category: string;
  formats: string[];
  description: string;
  canvaUrl: string;
}

const TEMPLATE_PACKS: TemplatePack[] = [
  { name: "Webinar Promo Pack Vol. 1", category: "Webinar & Events", formats: ["9:16", "4:5"], description: "Announce and fill your next webinar with confidence.", canvaUrl: "#" },
  { name: "Webinar Promo Pack Vol. 2", category: "Webinar & Events", formats: ["9:16", "1:1"], description: "A second style for webinar promos with a bold aesthetic.", canvaUrl: "#" },
  { name: "Lead Magnet Promo Pack Vol. 1", category: "Lead Magnet & Freebie", formats: ["9:16", "4:5"], description: "Drive downloads for your freebie or checklist.", canvaUrl: "#" },
  { name: "Lead Magnet Promo Pack Vol. 2", category: "Lead Magnet & Freebie", formats: ["1:1", "4:5"], description: "Clean and minimal style for lead magnet promotions.", canvaUrl: "#" },
  { name: "Course Launch Pack Vol. 1", category: "Course & Program Launch", formats: ["9:16", "4:5", "1:1"], description: "Launch your course or program with scroll-stopping graphics.", canvaUrl: "#" },
  { name: "Course Launch Pack Vol. 2", category: "Course & Program Launch", formats: ["9:16", "4:5"], description: "A warmer, lifestyle-driven course launch aesthetic.", canvaUrl: "#" },
  { name: "Story Overlay Pack Vol. 1", category: "Story & Reel Overlays", formats: ["9:16"], description: "Text overlays designed to drop over any B-roll or footage.", canvaUrl: "#" },
  { name: "Story Overlay Pack Vol. 2", category: "Story & Reel Overlays", formats: ["9:16"], description: "Minimal, modern overlays for Reels and Stories.", canvaUrl: "#" },
  { name: "Story Overlay Pack Vol. 3", category: "Story & Reel Overlays", formats: ["9:16"], description: "Bold, high-contrast text overlays for stopping the scroll.", canvaUrl: "#" },
  { name: "Talking Head Overlay Pack Vol. 1", category: "Talking Head Overlays", formats: ["9:16", "4:5"], description: "Lower thirds and text overlays built for talking head videos.", canvaUrl: "#" },
  { name: "Talking Head Overlay Pack Vol. 2", category: "Talking Head Overlays", formats: ["9:16"], description: "Subtitle-style overlays with branded accent colors.", canvaUrl: "#" },
  { name: "B-Roll Overlay Pack Vol. 1", category: "B-Roll Overlays", formats: ["9:16"], description: "Drop these overlays over lifestyle B-roll for instant polish.", canvaUrl: "#" },
  { name: "B-Roll Overlay Pack Vol. 2", category: "B-Roll Overlays", formats: ["9:16", "4:5"], description: "Soft, editorial-style overlays for lofi B-roll footage.", canvaUrl: "#" },
  { name: "Quote Card Pack Vol. 1", category: "Quote & Testimonial", formats: ["1:1", "4:5"], description: "Turn client quotes and testimonials into thumb-stopping graphics.", canvaUrl: "#" },
  { name: "Quote Card Pack Vol. 2", category: "Quote & Testimonial", formats: ["1:1", "9:16"], description: "Screenshot-style testimonial cards that look organic.", canvaUrl: "#" },
  { name: "Testimonial Graphic Pack", category: "Quote & Testimonial", formats: ["1:1", "4:5", "9:16"], description: "Full-format testimonial graphics for every placement.", canvaUrl: "#" },
  { name: "Ad Graphics Pack Vol. 1", category: "Ad Graphics", formats: ["4:5", "1:1"], description: "Bold static ad graphics designed to drive clicks.", canvaUrl: "#" },
  { name: "Ad Graphics Pack Vol. 2", category: "Ad Graphics", formats: ["4:5", "9:16"], description: "Clean, conversion-focused ad graphics for feed and stories.", canvaUrl: "#" },
  { name: "Checklist & Freebie Mockup Pack", category: "Lead Magnet & Freebie", formats: ["1:1", "4:5"], description: "Mockup-style graphics to make your freebie look irresistible.", canvaUrl: "#" },
  { name: "Course Mockup & Launch Graphics", category: "Course & Program Launch", formats: ["4:5", "1:1"], description: "Device mockups and launch countdown graphics for courses.", canvaUrl: "#" },
];

interface TemplatesTabProps {
  templates?: TemplatePack[];
}

export function TemplatesTab({ templates }: TemplatesTabProps) {
  const packs = templates && templates.length > 0 ? templates : TEMPLATE_PACKS;
  const categories = ["All", ...Array.from(new Set(packs.map(p => p.category)))];
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = activeCategory === "All"
    ? packs
    : packs.filter((p) => p.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all border ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((pack) => (
          <Card key={pack.name} className="overflow-hidden flex flex-col">
            {/* Preview */}
            <AspectRatio ratio={16 / 9}>
              <div className="w-full h-full bg-[image:var(--gradient-lumi)] opacity-80 flex items-center justify-center relative">
                <span className="text-white font-display font-bold text-lg text-center px-4 drop-shadow-md">
                  {pack.name}
                </span>
                <img
                  src={lumiLogo}
                  alt=""
                  className="absolute bottom-2 right-2 h-5 opacity-60"
                />
              </div>
            </AspectRatio>

            <CardContent className="p-4 flex flex-col gap-3 flex-1">
              <div>
                <h3 className="font-display font-bold text-foreground">{pack.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">{pack.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">{pack.category}</Badge>
                {pack.formats.map((f) => (
                  <span key={f} className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-medium">{f}</span>
                ))}
              </div>

              <Badge className="w-fit bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                Free with LUMI
              </Badge>

              <Button
                className="w-full mt-auto bg-[image:var(--gradient-lumi)] text-white hover:opacity-90"
                asChild
              >
                <a href={pack.canvaUrl} target="_blank" rel="noopener noreferrer">
                  Open in Canva <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer banner */}
      <div className="rounded-xl bg-muted p-6 text-center space-y-1">
        <p className="text-foreground font-medium">More template packs added monthly — included free with your LUMI subscription.</p>
        <p className="text-sm text-muted-foreground">Have a template style you'd love to see? Email us at hello@adsbylumi.com</p>
      </div>
    </div>
  );
}
