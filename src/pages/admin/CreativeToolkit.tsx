import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Wrench, Save, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

import { TemplatesTab } from "@/components/creative-toolkit/TemplatesTab";
import { BRollTab } from "@/components/creative-toolkit/BRollTab";
import { MusicToolsTab } from "@/components/creative-toolkit/MusicToolsTab";
import { MarketplaceTab } from "@/components/creative-toolkit/MarketplaceTab";
import CreativeToolkitManager from "@/components/admin/CreativeToolkitManager";
import type { ToolkitConfig } from "@/components/admin/CreativeToolkitManager";

const defaultConfig: ToolkitConfig = {
  live: false,
  templates: [],
  broll_sources: [],
  music_sources: [],
  production_tools: [],
  marketplace_packs: [],
  shot_lists: [],
};

export default function AdminCreativeToolkit() {
  const [config, setConfig] = useState<ToolkitConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
    } catch (e) {
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
    } catch (e) {
      console.error("Failed to save:", e);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleLive = (checked: boolean) => {
    setConfig((prev) => ({ ...prev, live: checked }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminTabs />

        {/* Admin control bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${config.live ? "bg-green-500" : "bg-muted-foreground/40"}`} />
            <span className="text-sm font-medium">
              {config.live ? "Toolkit is live for all users" : "Showing Coming Soon overlay"}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <Label htmlFor="toolkit-live-toggle" className="text-xs text-muted-foreground">
                {config.live ? "Live" : "Coming Soon"}
              </Label>
              <Switch id="toolkit-live-toggle" checked={config.live} onCheckedChange={toggleLive} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={editOpen} onOpenChange={setEditOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Content
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Edit Toolkit Content</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <CreativeToolkitManager
                    externalConfig={config}
                    onConfigChange={setConfig}
                    hideSaveBar
                    hideLiveToggle
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Actual Creative Toolkit preview — no overlay */}
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  Creative Toolkit
                </h1>
                <Badge variant="outline" className="text-xs">Admin Preview</Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Everything you need to go from brief to finished ad.
              </p>
            </div>
          </div>

          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="broll">B-Roll</TabsTrigger>
              <TabsTrigger value="music-tools">Music & Tools</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            </TabsList>

            <TabsContent value="templates">
              <TemplatesTab templates={config.templates} />
            </TabsContent>
            <TabsContent value="broll">
              <BRollTab />
            </TabsContent>
            <TabsContent value="music-tools">
              <MusicToolsTab
                musicSources={config.music_sources}
                productionTools={config.production_tools}
              />
            </TabsContent>
            <TabsContent value="marketplace">
              <MarketplaceTab packs={config.marketplace_packs} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
