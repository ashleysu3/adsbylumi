import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Trash2, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface ToolkitConfig {
  live: boolean;
  templates: ToolkitTemplate[];
  broll_sources: ToolkitResource[];
  music_sources: ToolkitResource[];
  production_tools: ToolkitResource[];
  marketplace_packs: ToolkitMarketplacePack[];
  shot_lists: ToolkitShotList[];
}

export interface ToolkitTemplate {
  name: string;
  category: string;
  formats: string[];
  description: string;
  canvaUrl: string;
}

export interface ToolkitResource {
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  url: string;
  buttonLabel: string;
  note?: string;
  badge2?: string;
}

export interface ToolkitMarketplacePack {
  name: string;
  contributor: { name: string; avatar: null; url: string };
  price: string;
  priceNum: number;
  category: string;
  formats: string[];
  description: string;
  externalUrl: string;
}

export interface ToolkitShotList {
  title: string;
  shots: string[];
}

const defaultConfig: ToolkitConfig = {
  live: false,
  templates: [],
  broll_sources: [],
  music_sources: [],
  production_tools: [],
  marketplace_packs: [],
  shot_lists: [],
};

export default function CreativeToolkitManager() {
  const [config, setConfig] = useState<ToolkitConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "creative_toolkit_config")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data?.value) {
        setConfig({ ...defaultConfig, ...(data.value as unknown as ToolkitConfig) });
      }
    } catch (e: any) {
      console.error("Failed to fetch toolkit config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "creative_toolkit_config")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: config as unknown as Json, updated_at: new Date().toISOString() })
          .eq("key", "creative_toolkit_config");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert([{ key: "creative_toolkit_config", value: config as unknown as Json }]);
        if (error) throw error;
      }

      toast.success("Creative Toolkit settings saved!");
    } catch (e: any) {
      console.error("Failed to save toolkit config:", e);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse py-8 text-center text-muted-foreground">Loading toolkit config...</div>;

  return (
    <div className="space-y-6">
      {/* Live toggle bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${config.live ? "bg-green-500" : "bg-muted-foreground/40"}`} />
          <span className="text-sm font-medium">
            {config.live ? "Toolkit is live for all users" : "Toolkit shows Coming Soon overlay"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="toolkit-live" className="text-sm">
            {config.live ? "Live" : "Coming Soon"}
          </Label>
          <Switch
            id="toolkit-live"
            checked={config.live}
            onCheckedChange={(checked) => setConfig({ ...config, live: checked })}
          />
        </div>
      </div>

      {/* Content tabs */}
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="templates" className="gap-1.5">
            Templates
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{config.templates.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="broll" className="gap-1.5">
            B-Roll
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{config.broll_sources.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="music" className="gap-1.5">
            Music
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{config.music_sources.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            Tools
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{config.production_tools.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-1.5">
            Marketplace
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{config.marketplace_packs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="shots" className="gap-1.5">
            Shot Lists
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{config.shot_lists.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplateEditor
            items={config.templates}
            onChange={(templates) => setConfig({ ...config, templates })}
          />
        </TabsContent>

        <TabsContent value="broll">
          <ResourceEditor
            items={config.broll_sources}
            onChange={(broll_sources) => setConfig({ ...config, broll_sources })}
            label="B-Roll Source"
          />
        </TabsContent>

        <TabsContent value="music">
          <ResourceEditor
            items={config.music_sources}
            onChange={(music_sources) => setConfig({ ...config, music_sources })}
            label="Music Source"
          />
        </TabsContent>

        <TabsContent value="tools">
          <ResourceEditor
            items={config.production_tools}
            onChange={(production_tools) => setConfig({ ...config, production_tools })}
            label="Production Tool"
          />
        </TabsContent>

        <TabsContent value="marketplace">
          <MarketplaceEditor
            items={config.marketplace_packs}
            onChange={(marketplace_packs) => setConfig({ ...config, marketplace_packs })}
          />
        </TabsContent>

        <TabsContent value="shots">
          <ShotListEditor
            items={config.shot_lists}
            onChange={(shot_lists) => setConfig({ ...config, shot_lists })}
          />
        </TabsContent>
      </Tabs>

      {/* Save bar */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Toolkit Settings"}
        </Button>
      </div>
    </div>
  );
}

// --- Template Editor ---
function TemplateEditor({ items, onChange }: { items: ToolkitTemplate[]; onChange: (v: ToolkitTemplate[]) => void }) {
  const addItem = () => onChange([...items, { name: "", category: "", formats: [], description: "", canvaUrl: "" }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const duplicateItem = (i: number) => {
    const copy = { ...items[i], name: `${items[i].name} (copy)` };
    onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)]);
  };
  const updateItem = (i: number, field: keyof ToolkitTemplate, value: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Leave empty to use built-in defaults. Add items here to override.</p>
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => onChange([])}>
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>
      <Accordion type="multiple" className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem key={i} value={String(i)} className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium">
              {item.name || `Template ${i + 1}`}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} placeholder="Pack name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)} placeholder="e.g. Story & Reel Overlays" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Formats (comma-separated)</Label>
                  <Input value={item.formats.join(", ")} onChange={(e) => updateItem(i, "formats", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="9:16, 4:5, 1:1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Canva URL</Label>
                  <Input value={item.canvaUrl} onChange={(e) => updateItem(i, "canvaUrl", e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Short description" />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => duplicateItem(i)} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
        <Plus className="h-3.5 w-3.5" /> Add Template
      </Button>
    </div>
  );
}

// --- Resource Editor (Music, B-Roll Sources, Tools) ---
function ResourceEditor({ items, onChange, label }: { items: ToolkitResource[]; onChange: (v: ToolkitResource[]) => void; label: string }) {
  const addItem = () => onChange([...items, { name: "", badge: "", badgeColor: "", description: "", url: "", buttonLabel: "" }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const duplicateItem = (i: number) => {
    const copy = { ...items[i], name: `${items[i].name} (copy)` };
    onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)]);
  };
  const updateItem = (i: number, field: keyof ToolkitResource, value: string) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Leave empty to use built-in defaults.</p>
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => onChange([])}>
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>
      <Accordion type="multiple" className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem key={i} value={String(i)} className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium">
              {item.name || `${label} ${i + 1}`}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Badge Label</Label>
                  <Input value={item.badge} onChange={(e) => updateItem(i, "badge", e.target.value)} placeholder="Free / Paid" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input value={item.url} onChange={(e) => updateItem(i, "url", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Button Label</Label>
                  <Input value={item.buttonLabel} onChange={(e) => updateItem(i, "buttonLabel", e.target.value)} placeholder="Browse →" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => duplicateItem(i)} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
        <Plus className="h-3.5 w-3.5" /> Add {label}
      </Button>
    </div>
  );
}

// --- Marketplace Editor ---
function MarketplaceEditor({ items, onChange }: { items: ToolkitMarketplacePack[]; onChange: (v: ToolkitMarketplacePack[]) => void }) {
  const addItem = () => onChange([...items, {
    name: "", contributor: { name: "", avatar: null, url: "#" },
    price: "", priceNum: 0, category: "", formats: [], description: "", externalUrl: ""
  }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const duplicateItem = (i: number) => {
    const copy = { ...items[i], name: `${items[i].name} (copy)`, contributor: { ...items[i].contributor } };
    onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)]);
  };
  const updateItem = (i: number, updates: Partial<ToolkitMarketplacePack>) => {
    const updated = [...items];
    updated[i] = { ...updated[i], ...updates };
    onChange(updated);
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Leave empty to use built-in defaults.</p>
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => onChange([])}>
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>
      <Accordion type="multiple" className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem key={i} value={String(i)} className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium">
              {item.name || `Pack ${i + 1}`}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input value={item.category} onChange={(e) => updateItem(i, { category: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Price</Label>
                  <Input value={item.price} onChange={(e) => updateItem(i, { price: e.target.value, priceNum: parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} placeholder="$27" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Formats</Label>
                  <Input value={item.formats.join(", ")} onChange={(e) => updateItem(i, { formats: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="9:16, 4:5" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">External URL</Label>
                  <Input value={item.externalUrl} onChange={(e) => updateItem(i, { externalUrl: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Contributor Name</Label>
                  <Input value={item.contributor.name} onChange={(e) => updateItem(i, { contributor: { ...item.contributor, name: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contributor URL</Label>
                  <Input value={item.contributor.url} onChange={(e) => updateItem(i, { contributor: { ...item.contributor, url: e.target.value } })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => duplicateItem(i)} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
        <Plus className="h-3.5 w-3.5" /> Add Pack
      </Button>
    </div>
  );
}

// --- Shot List Editor ---
function ShotListEditor({ items, onChange }: { items: ToolkitShotList[]; onChange: (v: ToolkitShotList[]) => void }) {
  const addItem = () => onChange([...items, { title: "", shots: [""] }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const duplicateItem = (i: number) => {
    const copy = { ...items[i], title: `${items[i].title} (copy)`, shots: [...items[i].shots] };
    onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)]);
  };
  const updateTitle = (i: number, title: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], title };
    onChange(updated);
  };
  const updateShot = (listIdx: number, shotIdx: number, value: string) => {
    const updated = [...items];
    const shots = [...updated[listIdx].shots];
    shots[shotIdx] = value;
    updated[listIdx] = { ...updated[listIdx], shots };
    onChange(updated);
  };
  const addShot = (listIdx: number) => {
    const updated = [...items];
    updated[listIdx] = { ...updated[listIdx], shots: [...updated[listIdx].shots, ""] };
    onChange(updated);
  };
  const removeShot = (listIdx: number, shotIdx: number) => {
    const updated = [...items];
    updated[listIdx] = { ...updated[listIdx], shots: updated[listIdx].shots.filter((_, idx) => idx !== shotIdx) };
    onChange(updated);
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Leave empty to use built-in defaults.</p>
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => onChange([])}>
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>
      <Accordion type="multiple" className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem key={i} value={String(i)} className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-medium">
              {item.title || `Shot List ${i + 1}`}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={item.title} onChange={(e) => updateTitle(i, e.target.value)} placeholder="e.g. Morning Routine" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Shots</Label>
                {item.shots.map((shot, si) => (
                  <div key={si} className="flex gap-2">
                    <Input value={shot} onChange={(e) => updateShot(i, si, e.target.value)} placeholder="Describe the shot" className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeShot(i, si)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addShot(i)} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Shot
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => duplicateItem(i)} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove List
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
        <Plus className="h-3.5 w-3.5" /> Add Shot List
      </Button>
    </div>
  );
}
