import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, Film, ExternalLink, RefreshCw, Upload, Loader2 } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { QuickFixDialog } from "@/components/QuickFixDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface BrandDetails {
  target_audience: string | null;
  value_proposition: string | null;
}

interface BRollIdea {
  emoji: string;
  scene: string;
  direction: string;
  mood: string;
  whyItResonates?: string;
}

const MOOD_COLORS: Record<string, string> = {
  Calm: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Productive: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Relatable: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Warm: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Authentic: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Energetic: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Aspirational: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Grounded: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400",
};

const STOCK_SOURCES = [
  {
    name: "Artgrid",
    badge: "Paid Subscription",
    badgeColor: "",
    description: "Cinema-quality footage shot by independent filmmakers. Artgrid is best for elevated lifestyle and editorial B-roll that still feels human and real.",
    url: "https://artgrid.io",
    buttonLabel: "Browse Artgrid →",
  },
  {
    name: "Packsia",
    badge: "Paid Subscription",
    badgeColor: "",
    description: "Authentic, lofi-style footage and photos that look like real life — not stock. Perfect for the everyday aesthetic that performs best on Meta right now.",
    url: "http://packsia.com/",
    buttonLabel: "Browse Packsia →",
  },
  {
    name: "Dupe Photos",
    badge: "Free",
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    description: "Free, aesthetic photos and short clips that look organic and lifestyle-driven. No watermarks, no attribution required. A hidden gem for authentic creative.",
    url: "https://dupephotos.com/home",
    buttonLabel: "Browse Dupe →",
  },
  {
    name: "Pexels",
    badge: "Free",
    badgeColor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    description: "Massive free library of photos and videos. Quality varies but there are genuine gems if you search with intention. Great for everyday lifestyle shots.",
    url: "https://www.pexels.com",
    buttonLabel: "Browse Pexels →",
  },
];

const SHOT_LISTS: { title: string; shots: string[] }[] = [
  {
    title: "Morning Routine",
    shots: [
      "Pouring coffee or tea, close up on the liquid",
      "Sitting down at your desk, opening your laptop",
      "Writing in a journal or planner",
      "Looking out a window with coffee in hand",
      "Getting dressed or brushing hair in mirror (from behind or side angle)",
    ],
  },
  {
    title: "Working & Thinking",
    shots: [
      "Typing on your laptop, slightly out of focus background",
      "Scrolling your phone, natural reaction face",
      "Taking notes by hand during a call",
      "Closing your laptop at end of day",
      "Staring thoughtfully at a screen, then looking up",
    ],
  },
  {
    title: "Everyday Life",
    shots: [
      "Walking outside, phone in hand or arms free",
      "Sitting in a coffee shop, drink on table",
      "Chatting and laughing with a friend",
      "Walking to your car or from your car",
      "Grocery shopping, farmers market browsing",
    ],
  },
  {
    title: "Home & Space",
    shots: [
      "Plants, candles, or cozy home details",
      "Clean desk setup, no clutter",
      "Bookshelf or reading corner",
      "Sunlight coming through a window",
      "Cooking or preparing food in kitchen",
    ],
  },
  {
    title: "With Your Pet",
    shots: [
      "Petting your dog or cat while sitting",
      "Dog walking on a leash, your perspective",
      "Pet lying near your workspace",
      "Playing with your pet in the yard",
    ],
  },
];

interface BRollTabProps {
  brollSources?: { name: string; badge: string; badgeColor?: string; description: string; url: string; buttonLabel: string }[];
  shotLists?: { title: string; shots: string[] }[];
}

export function BRollTab({ brollSources, shotLists }: BRollTabProps = {}) {
  const stockSources = brollSources && brollSources.length > 0 ? brollSources : STOCK_SOURCES;
  const shotListData = shotLists && shotLists.length > 0 ? shotLists : SHOT_LISTS;
  const { activeBrand } = useBrand();
  // Missing b-roll is fixed inline — never bounce the user to another page.
  const [brollFixOpen, setBrollFixOpen] = useState(false);
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<BRollIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [brandDetails, setBrandDetails] = useState<BrandDetails | null>(null);
  const [libraryClips, setLibraryClips] = useState<Array<{ file_name: string; tags?: string[] }>>([]);

  // Fetch extra brand fields + uploaded b-roll library
  useEffect(() => {
    if (!activeBrand?.id) return;
    supabase
      .from("brands")
      .select("target_audience, value_proposition, broll_library")
      .eq("id", activeBrand.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setBrandDetails({
          target_audience: (data as any).target_audience ?? null,
          value_proposition: (data as any).value_proposition ?? null,
        });
        const lib = (data as any).broll_library;
        setLibraryClips(Array.isArray(lib) ? lib : []);
      });
  }, [activeBrand?.id]);

  const generateIdeas = async () => {
    if (!activeBrand) return;
    setLoading(true);
    setHasGenerated(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-broll-ideas", {
        body: {
          brandId: activeBrand.id,
          brandName: activeBrand.name,
          industry: activeBrand.industry,
          targetAudience: brandDetails?.target_audience,
          valueProposition: brandDetails?.value_proposition,
          libraryClips: libraryClips.map((c) => ({
            file_name: c.file_name,
            tags: Array.isArray(c.tags) ? c.tags : [],
          })),
        },
      });
      if (error) throw error;
      const nextIdeas = data?.ideas || [];
      setIdeas(nextIdeas);
      if (nextIdeas.length === 0) {
        toast.error(data?.error || "No B-roll ideas came back. Try again in a moment.");
      }
    } catch (e: any) {
      console.error("B-roll generation error:", e);
      toast.error(e?.message || "Failed to generate ideas. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Section 1: AI B-Roll Idea Generator */}
      <section className="space-y-4">
        <Card className="border-2 border-transparent bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 relative overflow-hidden">
          <div className="absolute inset-0 rounded-[inherit] border-2 border-transparent [background:var(--gradient-lumi)] [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] [-webkit-mask-composite:xor] [mask-composite:exclude] pointer-events-none opacity-40" />
          <CardContent className="p-6 space-y-4 relative">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[image:var(--gradient-lumi)] flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-foreground">Get B-Roll Ideas for Your Brand</h2>
                <p className="text-sm text-muted-foreground">
                  LUMI knows your offer, your audience, and your niche. Get a custom list of everyday B-roll shots you can film today — no production crew needed.
                </p>
              </div>
            </div>

            {!activeBrand ? (
              <div className="rounded-xl bg-muted p-5 text-center space-y-2">
                <p className="text-foreground font-medium">Set up your brand profile first</p>
                <p className="text-sm text-muted-foreground">LUMI will generate B-roll ideas tailored to your business.</p>
                <Button variant="outline" onClick={() => navigate("/onboarding")}>Set Up Brand</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {libraryClips.length > 0 ? (
                    <Badge variant="secondary" className="text-[11px]">
                      <Film className="h-3 w-3 mr-1" />
                      Using {libraryClips.length} clip{libraryClips.length === 1 ? "" : "s"} from your library
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px]">
                      No library clips yet — ideas will be generic
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={generateIdeas}
                  disabled={loading}
                  className="bg-[image:var(--gradient-lumi)] text-white hover:opacity-90"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> LUMI is thinking about your brand...</>
                  ) : (
                    "Generate My B-Roll Ideas"
                  )}
                </Button>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && ideas.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            )}

            {/* Empty state after a generation attempt */}
            {!loading && hasGenerated && ideas.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center space-y-3">
                <Film className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No ideas came back this time.</p>
                {libraryClips.length === 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Upload a few B-roll clips to your library so LUMI can build ideas around footage you already have.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setBrollFixOpen(true)}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload B-roll
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={generateIdeas}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
                  </Button>
                )}
              </div>
            )}

            {/* Results */}
            {ideas.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ideas.map((idea, i) => (
                    <Card key={i} className="bg-card">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{idea.emoji}</span>
                          <h4 className="font-display font-bold text-sm text-foreground">{idea.scene}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">{idea.direction}</p>
                        {idea.whyItResonates && (
                          <p className="text-[11px] italic text-foreground/70 border-l-2 border-primary/40 pl-2">
                            {idea.whyItResonates}
                          </p>
                        )}
                        <Badge className={`text-[10px] ${MOOD_COLORS[idea.mood] || "bg-muted text-muted-foreground"}`}>
                          {idea.mood}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={generateIdeas} disabled={loading}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate Ideas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Stock B-Roll Sources */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Where to Find Great B-Roll</h2>
          <p className="text-sm text-muted-foreground">
            The best lofi, authentic stock footage for coaches, course creators, and service providers — no overly produced, corporate stock.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stockSources.map((src) => (
            <Card key={src.name}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-lumi)] flex items-center justify-center">
                    <Film className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-foreground">{src.name}</h3>
                    <Badge className={src.badgeColor || undefined} variant={src.badgeColor ? undefined : "secondary"}>
                      {src.badge}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{src.description}</p>
                <Button variant="outline" size="sm" asChild>
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    {src.buttonLabel} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Section 3: Shot List Library */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Ready-to-Film Shot Lists</h2>
          <p className="text-sm text-muted-foreground">
            Not sure what to film? Start here. These everyday scenes perform consistently well for coaches, course creators, and service providers.
          </p>
        </div>
        <Accordion type="multiple" className="space-y-2">
          {shotListData.map((list) => (
            <AccordionItem key={list.title} value={list.title} className="border rounded-lg px-4">
              <AccordionTrigger className="text-foreground font-display font-semibold text-sm">
                {list.title}
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-5 space-y-1.5">
                  {list.shots.map((shot) => (
                    <li key={shot} className="text-sm text-muted-foreground">{shot}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-xs text-muted-foreground">
          💡 Pro tip: Film everything on your phone in natural light. The less staged it looks, the better it performs.
        </p>
      </section>
    </div>
  );
}
