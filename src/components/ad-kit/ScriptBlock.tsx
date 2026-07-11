import { Mic, Download } from "lucide-react";
import type { ScriptBeat } from "./types";

// The talking-head script. `compact` = onboarding card (joined paragraph +
// download); `full` = kit-page beat-by-beat with category chips.
export function ScriptBlock({
  beats,
  variant = "full",
  onDownload,
}: {
  beats: ScriptBeat[] | null | undefined;
  variant?: "compact" | "full";
  onDownload?: () => void;
}) {
  if (!beats || !beats.length) return null;

  if (variant === "compact") {
    return (
      <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3 animate-fade-in">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          <Mic className="h-3.5 w-3.5" /> Talking-head script — read this on camera
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {beats.map((b) => b.line).join(" ")}
        </p>
        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
          >
            <Download className="h-3.5 w-3.5" /> Download this script
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl text-center mb-2 flex items-center justify-center gap-2">
        <Mic className="w-6 h-6" /> Your talking-head script
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Read this on camera — it's already in your voice.
      </p>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        {beats.map((b, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold rounded bg-muted px-2 py-1 mt-0.5 whitespace-nowrap">
              {b.category}
            </span>
            <p className="text-sm leading-relaxed">{b.line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
