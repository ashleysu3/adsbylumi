import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Wrench, Save, Plus, Pencil, Trash2, ExternalLink, Film, Music, Video,
  MessageSquare, Scissors, FileText, Info, Sparkles, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";

import type {
  ToolkitConfig,
  ToolkitTemplate,
  ToolkitResource,
  ToolkitMarketplacePack,
  ToolkitShotList,
} from "@/components/admin/CreativeToolkitManager";

// ── Hardcoded defaults (same as in the tab components) ──────────────
const DEFAULT_TEMPLATES: ToolkitTemplate[] = [
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

const DEFAULT_BROLL: ToolkitResource[] = [
  { name: "Artgrid", badge: "Paid Subscription", badgeColor: "", description: "Cinema-quality footage shot by independent filmmakers.", url: "https://artgrid.io", buttonLabel: "Browse Artgrid →" },
  { name: "Packsia", badge: "Paid Subscription", badgeColor: "", description: "Authentic, lofi-style footage and photos that look like real life.", url: "http://packsia.com/", buttonLabel: "Browse Packsia →" },
  { name: "Dupe Photos", badge: "Free", badgeColor: "bg-green-100 text-green-700 border-green-200", description: "Free, aesthetic photos and short clips that look organic.", url: "https://dupephotos.com/home", buttonLabel: "Browse Dupe →" },
  { name: "Pexels", badge: "Free", badgeColor: "bg-green-100 text-green-700 border-green-200", description: "Massive free library of photos and videos.", url: "https://www.pexels.com", buttonLabel: "Browse Pexels →" },
];

const DEFAULT_MUSIC: ToolkitResource[] = [
  { name: "CapCut Commercial Music", badge: "Free with CapCut", badgeColor: "bg-green-100 text-green-700 border-green-200", description: "CapCut's built-in commercial sound library is cleared for use in paid ads.", note: "⭐ LUMI's top pick", url: "https://www.capcut.com", buttonLabel: "Get CapCut Free →" },
  { name: "Epidemic Sound", badge: "Paid Subscription", badgeColor: "", description: "The gold standard for royalty-free music.", url: "https://www.epidemicsound.com", buttonLabel: "Browse Epidemic Sound →" },
  { name: "Pixabay Music", badge: "Free", badgeColor: "bg-green-100 text-green-700 border-green-200", description: "Completely free, no attribution required, commercial use allowed.", url: "https://pixabay.com/music/", buttonLabel: "Browse Pixabay Music →" },
];

const DEFAULT_TOOLS: ToolkitResource[] = [
  { name: "CapCut", badge: "Free", badgeColor: "bg-green-100 text-green-700 border-green-200", badge2: "⭐ LUMI's top pick", description: "Our go-to editing tool. Free, intuitive, built for short-form content.", url: "https://www.capcut.com", buttonLabel: "Get CapCut →" },
  { name: "Captions", badge: "Free + Paid", badgeColor: "", description: "AI-powered captions and video editing in one app.", url: "https://www.captions.ai", buttonLabel: "Get Captions →" },
  { name: "Edits (by Instagram)", badge: "Free", badgeColor: "bg-green-100 text-green-700 border-green-200", description: "Instagram's own editing app.", url: "https://www.editsapp.com", buttonLabel: "Get Edits →" },
  { name: "Descript", badge: "Free + Paid", badgeColor: "", description: "Edit video by editing the transcript.", url: "https://www.descript.com", buttonLabel: "Get Descript →" },
];

const DEFAULT_MARKETPLACE: ToolkitMarketplacePack[] = [
  { name: "The Clean Minimal Pack", contributor: { name: "Designer Name", avatar: null, url: "#" }, price: "$27", priceNum: 27, category: "Ad Graphics", formats: ["9:16", "4:5", "1:1"], description: "A sleek, minimal aesthetic for premium brands.", externalUrl: "#" },
  { name: "Bold & Bright Template Set", contributor: { name: "Designer Name", avatar: null, url: "#" }, price: "$37", priceNum: 37, category: "Story & Reel Overlays", formats: ["9:16"], description: "High-energy overlays for coaches who make noise.", externalUrl: "#" },
  { name: "Earthy Lifestyle Collection", contributor: { name: "Designer Name", avatar: null, url: "#" }, price: "$47", priceNum: 47, category: "B-Roll Overlays", formats: ["9:16", "4:5"], description: "Warm, earthy tones for wellness and lifestyle brands.", externalUrl: "#" },
];

const DEFAULT_SHOTS: ToolkitShotList[] = [
  { title: "Morning Routine", shots: ["Pouring coffee or tea, close up on the liquid", "Sitting down at your desk, opening your laptop", "Writing in a journal or planner", "Looking out a window with coffee in hand", "Getting dressed or brushing hair in mirror"] },
  { title: "Working & Thinking", shots: ["Typing on your laptop, slightly out of focus background", "Scrolling your phone, natural reaction face", "Taking notes by hand during a call", "Closing your laptop at end of day", "Staring thoughtfully at a screen, then looking up"] },
  { title: "Everyday Life", shots: ["Walking outside, phone in hand or arms free", "Sitting in a coffee shop, drink on table", "Chatting and laughing with a friend", "Walking to your car or from your car", "Grocery shopping, farmers market browsing"] },
  { title: "Home & Space", shots: ["Plants, candles, or cozy home details", "Clean desk setup, no clutter", "Bookshelf or reading corner", "Sunlight coming through a window", "Cooking or preparing food in kitchen"] },
  { title: "With Your Pet", shots: ["Petting your dog or cat while sitting", "Dog walking on a leash, your perspective", "Pet lying near your workspace", "Playing with your pet in the yard"] },
];

const defaultConfig: ToolkitConfig = {
  live: false,
  templates: [],
  broll_sources: [],
  music_sources: [],
  production_tools: [],
  marketplace_packs: [],
  shot_lists: [],
};

// ── Helper: resolve arrays (use DB data if present, else defaults) ────
function resolve<T>(arr: T[] | undefined, fallback: T[]): T[] {
  return arr && arr.length > 0 ? arr : fallback;
}

// ── Main Component ───────────────────────────────────────────────────
export default function AdminCreativeToolkit() {
  const [config, setConfig] = useState<ToolkitConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editType, setEditType] = useState<string | null>(null);
  const [editIndex, setEditIndex] = useState<number>(-1);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings").select("value").eq("key", "creative_toolkit_config").single();
      if (error && error.code !== "PGRST116") throw error;
      if (data?.value) setConfig({ ...defaultConfig, ...(data.value as unknown as ToolkitConfig) });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("site_settings").select("id").eq("key", "creative_toolkit_config").single();
      if (existing) {
        const { error } = await supabase.from("site_settings")
          .update({ value: config as unknown as Json, updated_at: new Date().toISOString() })
          .eq("key", "creative_toolkit_config");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings")
          .insert([{ key: "creative_toolkit_config", value: config as unknown as Json }]);
        if (error) throw error;
      }
      toast.success("Creative Toolkit saved!");
    } catch (e) { console.error(e); toast.error("Failed to save"); } finally { setSaving(false); }
  };

  // Seed defaults into config for a section if empty
  const seedDefaults = (section: string) => {
    const map: Record<string, any> = {
      templates: { templates: DEFAULT_TEMPLATES },
      broll_sources: { broll_sources: DEFAULT_BROLL },
      music_sources: { music_sources: DEFAULT_MUSIC },
      production_tools: { production_tools: DEFAULT_TOOLS },
      marketplace_packs: { marketplace_packs: DEFAULT_MARKETPLACE },
      shot_lists: { shot_lists: DEFAULT_SHOTS },
    };
    if (map[section]) {
      setConfig(prev => ({ ...prev, ...map[section] }));
      toast.success("Defaults loaded — click Save to persist");
    }
  };

  // Resolved arrays for rendering
  const templates = resolve(config.templates, DEFAULT_TEMPLATES);
  const brollSources = resolve(config.broll_sources, DEFAULT_BROLL);
  const musicSources = resolve(config.music_sources, DEFAULT_MUSIC);
  const productionTools = resolve(config.production_tools, DEFAULT_TOOLS);
  const marketplacePacks = resolve(config.marketplace_packs, DEFAULT_MARKETPLACE);
  const shotLists = resolve(config.shot_lists, DEFAULT_SHOTS);

  // Whether a section is using DB data (editable) vs fallback defaults
  const isEditable = (arr: any[] | undefined) => arr !== undefined && arr.length > 0;

  // ── Edit helpers ────────────────────────────────────────────────
  const openEdit = (type: string, index: number, data: any) => {
    setEditType(type); setEditIndex(index); setEditData({ ...data });
  };

  const saveEdit = () => {
    if (!editType || editIndex < 0 || !editData) return;
    setConfig(prev => {
      const key = editType as keyof ToolkitConfig;
      const arr = [...(prev[key] as any[])];
      arr[editIndex] = editData;
      return { ...prev, [key]: arr };
    });
    closeEdit();
  };

  const deleteItem = (type: string, index: number) => {
    setConfig(prev => {
      const key = type as keyof ToolkitConfig;
      const arr = [...(prev[key] as any[])];
      arr.splice(index, 1);
      return { ...prev, [key]: arr };
    });
  };

  const addItem = (type: string, blank: any) => {
    setConfig(prev => {
      const key = type as keyof ToolkitConfig;
      const arr = [...(prev[key] as any[]), blank];
      return { ...prev, [key]: arr };
    });
  };

  const closeEdit = () => { setEditType(null); setEditIndex(-1); setEditData(null); };

  if (loading) return (
    <DashboardLayout><div className="flex items-center justify-center py-12"><div className="animate-pulse">Loading...</div></div></DashboardLayout>
  );

  const canEdit = (section: string) => isEditable((config as any)[section]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />

        {/* Admin bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${config.live ? "bg-green-500" : "bg-muted-foreground/40"}`} />
            <span className="text-sm font-medium">
              {config.live ? "Toolkit is live" : "Coming Soon overlay active"}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <Label htmlFor="tk-live" className="text-xs text-muted-foreground">{config.live ? "Live" : "Coming Soon"}</Label>
              <Switch id="tk-live" checked={config.live} onCheckedChange={(v) => setConfig(p => ({ ...p, live: v }))} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>

        {/* Toolkit preview with edit buttons */}
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">Creative Toolkit</h1>
                <Badge variant="outline" className="text-xs">Admin Edit Mode</Badge>
              </div>
              <p className="text-muted-foreground mt-1">Click the edit icon on any card to modify it. Changes save when you click "Save All Changes".</p>
            </div>
          </div>

          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
              <TabsTrigger value="broll">B-Roll ({brollSources.length})</TabsTrigger>
              <TabsTrigger value="music-tools">Music & Tools ({musicSources.length + productionTools.length})</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace ({marketplacePacks.length})</TabsTrigger>
              <TabsTrigger value="shots">Shot Lists ({shotLists.length})</TabsTrigger>
            </TabsList>

            {/* ── Templates ─────────────────────────── */}
            <TabsContent value="templates">
              <SectionHeader
                label="Templates"
                section="templates"
                canEdit={canEdit("templates")}
                onSeed={() => seedDefaults("templates")}
                onAdd={() => addItem("templates", { name: "", category: "", formats: [], description: "", canvaUrl: "" })}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {templates.map((pack, i) => (
                  <EditableCard key={i} onEdit={() => openEdit("templates", i, pack)} onDelete={canEdit("templates") ? () => deleteItem("templates", i) : undefined}>
                    <AspectRatio ratio={16 / 9}>
                      <div className="w-full h-full bg-[image:var(--gradient-lumi)] opacity-80 flex items-center justify-center relative">
                        <span className="text-white font-display font-bold text-lg text-center px-4 drop-shadow-md">{pack.name}</span>
                        <img src={lumiLogo} alt="" className="absolute bottom-2 right-2 h-5 opacity-60" />
                      </div>
                    </AspectRatio>
                    <CardContent className="p-4 flex flex-col gap-2">
                      <h3 className="font-display font-bold text-foreground">{pack.name || "Untitled"}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{pack.description}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">{pack.category || "No category"}</Badge>
                        {pack.formats.map(f => <span key={f} className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{f}</span>)}
                      </div>
                    </CardContent>
                  </EditableCard>
                ))}
              </div>
            </TabsContent>

            {/* ── B-Roll ────────────────────────────── */}
            <TabsContent value="broll">
              <SectionHeader label="B-Roll Sources" section="broll_sources" canEdit={canEdit("broll_sources")} onSeed={() => seedDefaults("broll_sources")}
                onAdd={() => addItem("broll_sources", { name: "", badge: "", badgeColor: "", description: "", url: "", buttonLabel: "" })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {brollSources.map((src, i) => (
                  <EditableCard key={i} onEdit={() => openEdit("broll_sources", i, src)} onDelete={canEdit("broll_sources") ? () => deleteItem("broll_sources", i) : undefined}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-lumi)] flex items-center justify-center"><Film className="h-4 w-4 text-white" /></div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-foreground">{src.name}</h3>
                          <Badge variant="secondary">{src.badge}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{src.description}</p>
                    </CardContent>
                  </EditableCard>
                ))}
              </div>

              {/* Shot Lists */}
              <div className="mt-8">
                <SectionHeader label="Shot Lists" section="shot_lists" canEdit={canEdit("shot_lists")} onSeed={() => seedDefaults("shot_lists")}
                  onAdd={() => addItem("shot_lists", { title: "", shots: [""] })} />
                <Accordion type="multiple" className="space-y-2 mt-4">
                  {shotLists.map((list, i) => (
                    <AccordionItem key={i} value={String(i)} className="border rounded-lg px-4 relative group">
                      {canEdit("shot_lists") && (
                        <div className="absolute top-2 right-10 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => openEdit("shot_lists", i, list)} className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => deleteItem("shot_lists", i)} className="h-7 w-7 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                      <AccordionTrigger className="text-foreground font-display font-semibold text-sm">{list.title || "Untitled"}</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-5 space-y-1.5">
                          {list.shots.map((shot, si) => <li key={si} className="text-sm text-muted-foreground">{shot}</li>)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </TabsContent>

            {/* ── Music & Tools ─────────────────────── */}
            <TabsContent value="music-tools">
              <SectionHeader label="Music Sources" section="music_sources" canEdit={canEdit("music_sources")} onSeed={() => seedDefaults("music_sources")}
                onAdd={() => addItem("music_sources", { name: "", badge: "", badgeColor: "", description: "", url: "", buttonLabel: "" })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {musicSources.map((src, i) => (
                  <EditableCard key={i} onEdit={() => openEdit("music_sources", i, src)} onDelete={canEdit("music_sources") ? () => deleteItem("music_sources", i) : undefined}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0"><Music className="h-4 w-4 text-white" /></div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-bold text-foreground">{src.name}</h3>
                            <Badge variant="secondary">{src.badge}</Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{src.description}</p>
                    </CardContent>
                  </EditableCard>
                ))}
              </div>

              <div className="mt-8">
                <SectionHeader label="Production Tools" section="production_tools" canEdit={canEdit("production_tools")} onSeed={() => seedDefaults("production_tools")}
                  onAdd={() => addItem("production_tools", { name: "", badge: "", badgeColor: "", description: "", url: "", buttonLabel: "" })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {productionTools.map((tool, i) => (
                    <EditableCard key={i} onEdit={() => openEdit("production_tools", i, tool)} onDelete={canEdit("production_tools") ? () => deleteItem("production_tools", i) : undefined}>
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-lg bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0"><Video className="h-4 w-4 text-white" /></div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-display font-bold text-foreground">{tool.name}</h3>
                              <Badge variant="secondary">{tool.badge}</Badge>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </CardContent>
                    </EditableCard>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Marketplace ───────────────────────── */}
            <TabsContent value="marketplace">
              <SectionHeader label="Marketplace Packs" section="marketplace_packs" canEdit={canEdit("marketplace_packs")} onSeed={() => seedDefaults("marketplace_packs")}
                onAdd={() => addItem("marketplace_packs", { name: "", contributor: { name: "", avatar: null, url: "#" }, price: "", priceNum: 0, category: "", formats: [], description: "", externalUrl: "" })} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {marketplacePacks.map((pack, i) => (
                  <EditableCard key={i} onEdit={() => openEdit("marketplace_packs", i, pack)} onDelete={canEdit("marketplace_packs") ? () => deleteItem("marketplace_packs", i) : undefined}>
                    <AspectRatio ratio={16 / 9}>
                      <div className="w-full h-full bg-[image:var(--gradient-lumi)] opacity-80 flex items-center justify-center relative">
                        <span className="text-white font-display font-bold text-lg text-center px-4 drop-shadow-md">{pack.name}</span>
                      </div>
                    </AspectRatio>
                    <CardContent className="p-4 flex flex-col gap-2">
                      <h3 className="font-display font-bold text-foreground">{pack.name || "Untitled"}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{pack.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{pack.category || "No category"}</Badge>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">{pack.price || "$0"}</Badge>
                      </div>
                    </CardContent>
                  </EditableCard>
                ))}
              </div>
            </TabsContent>

            {/* ── Shot Lists (standalone tab) ───────── */}
            <TabsContent value="shots">
              <SectionHeader label="Shot Lists" section="shot_lists" canEdit={canEdit("shot_lists")} onSeed={() => seedDefaults("shot_lists")}
                onAdd={() => addItem("shot_lists", { title: "", shots: [""] })} />
              <Accordion type="multiple" className="space-y-2 mt-4">
                {shotLists.map((list, i) => (
                  <AccordionItem key={i} value={String(i)} className="border rounded-lg px-4 relative group">
                    {canEdit("shot_lists") && (
                      <div className="absolute top-2 right-10 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={() => openEdit("shot_lists", i, list)} className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => deleteItem("shot_lists", i)} className="h-7 w-7 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                    <AccordionTrigger className="text-foreground font-display font-semibold text-sm">{list.title || "Untitled"}</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-5 space-y-1.5">
                        {list.shots.map((shot, si) => <li key={si} className="text-sm text-muted-foreground">{shot}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Universal Edit Dialog ──────────────────────────────────── */}
      <Dialog open={!!editType} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editType?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</DialogTitle>
          </DialogHeader>
          {editData && editType === "templates" && (
            <TemplateEditForm data={editData} onChange={setEditData} />
          )}
          {editData && (editType === "broll_sources" || editType === "music_sources" || editType === "production_tools") && (
            <ResourceEditForm data={editData} onChange={setEditData} />
          )}
          {editData && editType === "marketplace_packs" && (
            <MarketplaceEditForm data={editData} onChange={setEditData} />
          )}
          {editData && editType === "shot_lists" && (
            <ShotListEditForm data={editData} onChange={setEditData} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionHeader({ label, section, canEdit, onSeed, onAdd }: {
  label: string; section: string; canEdit: boolean; onSeed: () => void; onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-display font-bold text-foreground">{label}</h2>
      <div className="flex gap-2">
        {!canEdit && (
          <Button variant="outline" size="sm" onClick={onSeed} className="gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Load Defaults to Edit
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onAdd} className="gap-1.5 text-xs">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}

function EditableCard({ children, onEdit, onDelete }: { children: React.ReactNode; onEdit: () => void; onDelete?: () => void }) {
  return (
    <Card className="overflow-hidden flex flex-col relative group">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button onClick={onEdit} className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 shadow-md">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {onDelete && (
          <button onClick={onDelete} className="h-8 w-8 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90 shadow-md">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}

// ── Edit Forms ──────────────────────────────────────────────────────

function TemplateEditForm({ data, onChange }: { data: ToolkitTemplate; onChange: (d: ToolkitTemplate) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Name"><Input value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} /></Field>
      <Field label="Category"><Input value={data.category} onChange={e => onChange({ ...data, category: e.target.value })} placeholder="e.g. Story & Reel Overlays" /></Field>
      <Field label="Formats">
        <div className="flex gap-4">
          {["9:16", "1:1"].map(fmt => (
            <label key={fmt} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={data.formats.includes(fmt)}
                onCheckedChange={(val) => {
                  const next = val ? [...data.formats, fmt] : data.formats.filter(f => f !== fmt);
                  if (next.length > 0) onChange({ ...data, formats: next });
                }}
              />
              <span className="text-sm">{fmt}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Description"><Textarea value={data.description} onChange={e => onChange({ ...data, description: e.target.value })} rows={2} /></Field>
      <Field label="Canva URL"><Input value={data.canvaUrl} onChange={e => onChange({ ...data, canvaUrl: e.target.value })} placeholder="https://..." /></Field>
    </div>
  );
}

function ResourceEditForm({ data, onChange }: { data: ToolkitResource; onChange: (d: ToolkitResource) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Name"><Input value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Badge"><Input value={data.badge} onChange={e => onChange({ ...data, badge: e.target.value })} placeholder="Free / Paid" /></Field>
        <Field label="Button Label"><Input value={data.buttonLabel} onChange={e => onChange({ ...data, buttonLabel: e.target.value })} placeholder="Browse →" /></Field>
      </div>
      <Field label="Description"><Textarea value={data.description} onChange={e => onChange({ ...data, description: e.target.value })} rows={3} /></Field>
      <Field label="URL"><Input value={data.url} onChange={e => onChange({ ...data, url: e.target.value })} /></Field>
      <Field label="Note (optional)"><Input value={data.note || ""} onChange={e => onChange({ ...data, note: e.target.value })} /></Field>
    </div>
  );
}

function MarketplaceEditForm({ data, onChange }: { data: ToolkitMarketplacePack; onChange: (d: ToolkitMarketplacePack) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Name"><Input value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category"><Input value={data.category} onChange={e => onChange({ ...data, category: e.target.value })} /></Field>
        <Field label="Price"><Input value={data.price} onChange={e => onChange({ ...data, price: e.target.value, priceNum: parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} placeholder="$27" /></Field>
      </div>
      <Field label="Formats">
        <div className="flex gap-4">
          {["9:16", "1:1"].map(fmt => (
            <label key={fmt} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={data.formats.includes(fmt)}
                onCheckedChange={(val) => {
                  const next = val ? [...data.formats, fmt] : data.formats.filter(f => f !== fmt);
                  if (next.length > 0) onChange({ ...data, formats: next });
                }}
              />
              <span className="text-sm">{fmt}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Description"><Textarea value={data.description} onChange={e => onChange({ ...data, description: e.target.value })} rows={2} /></Field>
      <Field label="External URL"><Input value={data.externalUrl} onChange={e => onChange({ ...data, externalUrl: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contributor Name"><Input value={data.contributor.name} onChange={e => onChange({ ...data, contributor: { ...data.contributor, name: e.target.value } })} /></Field>
        <Field label="Contributor URL"><Input value={data.contributor.url} onChange={e => onChange({ ...data, contributor: { ...data.contributor, url: e.target.value } })} /></Field>
      </div>
    </div>
  );
}

function ShotListEditForm({ data, onChange }: { data: ToolkitShotList; onChange: (d: ToolkitShotList) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Title"><Input value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} /></Field>
      <Label className="text-xs font-medium">Shots</Label>
      {data.shots.map((shot, i) => (
        <div key={i} className="flex gap-2">
          <Input value={shot} onChange={e => {
            const shots = [...data.shots]; shots[i] = e.target.value; onChange({ ...data, shots });
          }} placeholder="Describe the shot" className="flex-1" />
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => {
            onChange({ ...data, shots: data.shots.filter((_, idx) => idx !== i) });
          }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...data, shots: [...data.shots, ""] })} className="gap-1">
        <Plus className="h-3 w-3" /> Add Shot
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}
