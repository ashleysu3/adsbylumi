// Human-readable labels for campaign progress_status values
const STATUS_LABELS: Record<string, string> = {
  draft: "Just Started",
  creative_in_progress: "Building Your Creative",
  waiting_for_assets: "Waiting for Your Video or Image",
  ready_to_publish: "Ready to Launch 🚀",
  publishing_to_meta: "Publishing...",
  live: "Running Live ✅",
  completed: "Completed",
  paused: "Paused",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}
