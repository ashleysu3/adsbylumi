import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Lock } from "lucide-react";
import { TemplatesTab } from "@/components/creative-toolkit/TemplatesTab";
import { BRollTab } from "@/components/creative-toolkit/BRollTab";
import { MusicToolsTab } from "@/components/creative-toolkit/MusicToolsTab";

import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { ToolkitConfig } from "@/components/admin/CreativeToolkitManager";

export default function CreativeToolkit() {
  const [config, setConfig] = useState<ToolkitConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "creative_toolkit_config")
      .single()
      .then(({ data, error }) => {
        if (data?.value) {
          setConfig(data.value as unknown as ToolkitConfig);
        }
        setLoading(false);
      });
  }, []);

  const isLive = config?.live === true;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 relative">
        {/* Page Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
              Creative Toolkit
            </h1>
            <p className="text-muted-foreground mt-1">
              Everything you need to go from brief to finished ad.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="broll">B-Roll</TabsTrigger>
            <TabsTrigger value="music-tools">Music & Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <TemplatesTab templates={config?.templates} />
          </TabsContent>
          <TabsContent value="broll">
            <BRollTab
              brollSources={config?.broll_sources}
              shotLists={config?.shot_lists}
            />
          </TabsContent>
          <TabsContent value="music-tools">
            <MusicToolsTab
              musicSources={config?.music_sources}
              productionTools={config?.production_tools}
            />
          </TabsContent>
          <TabsContent value="marketplace">
            <MarketplaceTab packs={config?.marketplace_packs} />
          </TabsContent>
        </Tabs>

        {/* Coming Soon Overlay — only shown when NOT live */}
        {!loading && !isLive && (
          <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[2px] rounded-2xl overflow-hidden pointer-events-auto">
            <div className="sticky top-20 flex justify-center pt-8 pointer-events-none">
              <div className="flex flex-col items-center gap-3 text-center px-6 py-8 rounded-2xl bg-card border shadow-lg max-w-sm pointer-events-auto">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">Coming Soon</Badge>
                <h2 className="text-lg font-bold font-display text-foreground">We're building this for you</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Templates, B-roll ideas, music sources, and designer packs — all in one place. Stay tuned!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
