import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wrench } from "lucide-react";
import { TemplatesTab } from "@/components/creative-toolkit/TemplatesTab";
import { BRollTab } from "@/components/creative-toolkit/BRollTab";
import { MusicToolsTab } from "@/components/creative-toolkit/MusicToolsTab";
import { MarketplaceTab } from "@/components/creative-toolkit/MarketplaceTab";

export default function CreativeToolkit() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
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
      </div>
    </DashboardLayout>
  );
}
