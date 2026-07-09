import DashboardLayout from "@/components/DashboardLayout";
import { CampaignSpine } from "@/components/CampaignSpine";
import { LaunchTray } from "@/components/LaunchTray";
import CreativeStudio from "@/pages/CreativeStudio";

/**
 * /creative — single hub for all creative work in the campaign workflow.
 *
 * Renders only TWO navigation levels:
 *  1) The journey spine (Strategy → Creative → Launch → Optimize)
 *  2) Creative Studio's internal step sequence
 *     (Angles · Concepts · Ad Copy · Produce · Saved)
 *
 * Design (Ad Generator), Toolkit (templates / B-roll / music) and the
 * Concept Library all live inside that sequence — see CreativeStudio.
 */
export default function Creative() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <CampaignSpine currentStep={2} compact />
        <LaunchTray />
        <CreativeStudio embedded />
      </div>
    </DashboardLayout>
  );
}
