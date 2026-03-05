import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ExternalLink, Plus, Link2 } from "lucide-react";
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
];

const PRICE_FILTERS = ["All", "Under $20", "$20–$50", "$50+"];

interface ContributorPack {
  name: string;
  contributor: { name: string; avatar: null; url: string };
  price: string;
  priceNum: number;
  category: string;
  formats: string[];
  description: string;
  externalUrl: string;
}

// Placeholder contributor packs — replace with real data later
const CONTRIBUTOR_PACKS: ContributorPack[] = [
  { name: "The Clean Minimal Pack", contributor: { name: "Designer Name", avatar: null, url: "#" }, price: "$27", priceNum: 27, category: "Ad Graphics", formats: ["9:16", "4:5", "1:1"], description: "A sleek, minimal aesthetic for premium brands.", externalUrl: "#" },
  { name: "Bold & Bright Template Set", contributor: { name: "Designer Name", avatar: null, url: "#" }, price: "$37", priceNum: 37, category: "Story & Reel Overlays", formats: ["9:16"], description: "High-energy overlays for coaches who make noise.", externalUrl: "#" },
  { name: "Earthy Lifestyle Collection", contributor: { name: "Designer Name", avatar: null, url: "#" }, price: "$47", priceNum: 47, category: "B-Roll Overlays", formats: ["9:16", "4:5"], description: "Warm, earthy tones for wellness and lifestyle brands.", externalUrl: "#" },
];

export function MarketplaceTab() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [priceFilter, setPriceFilter] = useState("All");

  const filtered = CONTRIBUTOR_PACKS.filter((p) => {
    if (activeCategory !== "All" && p.category !== activeCategory) return false;
    if (priceFilter === "Under $20" && p.priceNum >= 20) return false;
    if (priceFilter === "$20–$50" && (p.priceNum < 20 || p.priceNum > 50)) return false;
    if (priceFilter === "$50+" && p.priceNum < 50) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="rounded-xl bg-[image:var(--gradient-lumi)] p-6 sm:p-8 text-white space-y-2">
        <h2 className="text-xl sm:text-2xl font-display font-bold">Templates from the Creative Community</h2>
        <p className="text-white/90 text-sm sm:text-base">
          Premium template packs from independent designers — each one vetted by the LUMI team. Purchase directly from the creator.
        </p>
        <p className="text-white/60 text-xs">
          Are you a designer? We'd love to feature your work. Email hello@adsbylumi.com
        </p>
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
          {CATEGORIES.map((cat) => (
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
        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground w-full sm:w-auto"
        >
          {PRICE_FILTERS.map((pf) => (
            <option key={pf} value={pf}>{pf === "All" ? "Price: All" : pf}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((pack) => (
          <Card key={pack.name} className="overflow-hidden flex flex-col">
            <AspectRatio ratio={16 / 9}>
              <div className="w-full h-full bg-[image:var(--gradient-lumi)] opacity-80 flex items-center justify-center relative">
                <span className="text-white font-display font-bold text-lg text-center px-4 drop-shadow-md">
                  {pack.name}
                </span>
                <img src={lumiLogo} alt="" className="absolute bottom-2 right-2 h-5 opacity-60" />
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

              {/* Contributor credit */}
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-[image:var(--gradient-lumi)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {pack.contributor.name.charAt(0)}
                </div>
                <a
                  href={pack.contributor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  By {pack.contributor.name} <Link2 className="h-3 w-3" />
                </a>
              </div>

              <Badge className="w-fit bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                {pack.price}
              </Badge>

              <div className="flex gap-2 mt-auto">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={pack.externalUrl} target="_blank" rel="noopener noreferrer">Preview</a>
                </Button>
                <Button size="sm" className="flex-1 bg-[image:var(--gradient-lumi)] text-white hover:opacity-90" asChild>
                  <a href={pack.externalUrl} target="_blank" rel="noopener noreferrer">
                    Buy Now <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state / coming soon */}
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-display font-bold text-foreground">More packs coming soon</p>
          <p className="text-sm text-muted-foreground">
            We're onboarding new designers every month. Check back soon — or email us if you'd like to contribute.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
