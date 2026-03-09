import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench, Lock } from "lucide-react";
import { TemplatesTab } from "@/components/creative-toolkit/TemplatesTab";
import { BRollTab } from "@/components/creative-toolkit/BRollTab";
import { MusicToolsTab } from "@/components/creative-toolkit/MusicToolsTab";
import { MarketplaceTab } from "@/components/creative-toolkit/MarketplaceTab";
import { Badge } from "@/components/ui/badge";

export default function CreativeToolkit() {
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
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="broll">
            <BRollTab />
          </TabsContent>
          <TabsContent value="music-tools">
            <MusicToolsTab />
          </TabsContent>
          <TabsContent value="marketplace">
            <MarketplaceTab />
          </TabsContent>
        </Tabs>

        {/* Coming Soon Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
          <div className="flex flex-col items-center gap-3 text-center px-6 py-10 rounded-2xl bg-card border shadow-lg max-w-sm">
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
    </DashboardLayout>
  );
}
