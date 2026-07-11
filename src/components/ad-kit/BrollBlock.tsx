import { Film, Download } from "lucide-react";

// The b-roll video ad. Renders the video when it exists; when it doesn't and
// `pendingNote` is set, says plainly that it's still rendering — a missing
// asset is a status, never an apology.
export function BrollBlock({
  videoUrl,
  credit,
  downloadName,
  pendingNote,
  variant = "full",
}: {
  videoUrl: string | null | undefined;
  credit?: { name: string; url: string | null } | null;
  downloadName?: string;
  pendingNote?: boolean;
  variant?: "compact" | "full";
}) {
  if (!videoUrl) {
    if (!pendingNote) return null;
    return (
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <Film className="w-3.5 h-3.5" /> Your b-roll video ad is still rendering — it'll appear right here.
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3 animate-fade-in">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          <Film className="h-3.5 w-3.5" /> Your b-roll ad
        </div>
        <video src={videoUrl} controls muted loop className="w-full rounded-xl bg-black mx-auto" style={{ maxWidth: 460 }} />
        <div className="flex items-center justify-between flex-wrap gap-2">
          {downloadName && (
            <a
              href={videoUrl}
              download={downloadName}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              <Download className="h-3.5 w-3.5" /> Download this video
            </a>
          )}
          {credit &&
            (credit.url ? (
              <a
                href={credit.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                Footage via {credit.name}
              </a>
            ) : (
              <span className="text-[11px] text-muted-foreground">Footage via {credit.name}</span>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h3 className="font-heading text-lg font-semibold mb-4 flex items-center justify-center gap-2">
        <Film className="w-5 h-5" /> Your b-roll video ad
      </h3>
      <video
        src={videoUrl}
        controls
        playsInline
        className="mx-auto max-w-full sm:max-w-sm rounded-2xl shadow-card border border-border"
      />
    </div>
  );
}
