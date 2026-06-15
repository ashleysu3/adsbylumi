import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignSpine } from "@/components/CampaignSpine";
import { LaunchTray } from "@/components/LaunchTray";
import CreativeStudio from "@/pages/CreativeStudio";
import AdGenerator from "@/pages/AdGenerator";
import CreativeToolkit from "@/pages/CreativeToolkit";
import ContentLibrary from "@/pages/ContentLibrary";
import { Sparkles, Image as ImageIcon, Wrench, Bookmark } from "lucide-react";

/**
 * /creative — single hub for all creative work in the campaign workflow.
 *
 * Step 2 of the campaign spine. Wraps the existing CreativeStudio,
 * AdGenerator, CreativeToolkit, and ContentLibrary pages as tabs so
 * each one keeps its full functionality (angles, concepts, copy
 * variations, designer, toolkit, saved library) while presenting a
 * single front door.
 *
 * Selection state for "which concepts will launch" lives in
 * CampaignDraftContext; LaunchTray reads from it live.
 */
export default function Creative() {
  const [tab, setTab] = useState<"angles" | "design" | "toolkit" | "saved">(
    "angles",
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <CampaignSpine currentStep={2} />
        <LaunchTray />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="angles" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Angles &amp; copy
            </TabsTrigger>
            <TabsTrigger value="design" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />
              Design
            </TabsTrigger>
            <TabsTrigger value="toolkit" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              Toolkit
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5">
              <Bookmark className="h-4 w-4" />
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="angles" className="mt-4">
            <CreativeStudio embedded />
          </TabsContent>
          <TabsContent value="design" className="mt-4">
            <AdGenerator />
          </TabsContent>
          <TabsContent value="toolkit" className="mt-4">
            <CreativeToolkit embedded />
          </TabsContent>
          <TabsContent value="saved" className="mt-4">
            <ContentLibrary embedded />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
