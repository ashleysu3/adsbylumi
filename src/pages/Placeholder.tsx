// TODO: replace these placeholder pages with the real implementations as they ship.
import DashboardLayout from "@/components/DashboardLayout";

function Stub({ title, body }: { title: string; body: string }) {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-16 px-6 text-center space-y-4">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
        <p className="text-xs text-muted-foreground/70">This page is coming soon.</p>
      </div>
    </DashboardLayout>
  );
}

export const TasksPlaceholder = () => (
  <Stub title="My Tasks" body="Your action items and AI-generated tasks will live here." />
);
export const AudiencePlaceholder = () => (
  <Stub title="Audience" body="Define and refine the people your ads should reach." />
);
export const GoalsPlaceholder = () => (
  <Stub title="Goals" body="Set the business outcomes LUMI should optimize against." />
);
export const VoicePlaceholder = () => (
  <Stub title="Voice + Examples" body="Your brand voice rules, examples, and dos/don'ts." />
);
export const TroubleshootingPlaceholder = () => (
  <Stub title="Troubleshooting" body="Common issues, fixes, and diagnostics." />
);
export const CloserLookPlaceholder = () => (
  <Stub title="Closer Look" body="Per-campaign deep dive — ads, KPIs over time, and recommendations." />
);
