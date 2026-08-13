import DashboardLayout from "@/components/DashboardLayout";
import CreativeStudio from "@/pages/CreativeStudio";

/**
 * /creative — single hub for all creative work in the campaign workflow.
 *
 * Renders only Creative Studio's internal step sequence
 * (Angles · Concepts · Ad Copy · Produce · Saved · Launch).
 */
export default function Creative() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        <CreativeStudio embedded />
      </div>
    </DashboardLayout>
  );
}
