import { ThumbsUp, MessageCircle, Share2 } from "lucide-react";

// The generated ad framed as a real Meta feed post — no explanation needed,
// it instantly reads as "a finished ad that could run today."
export function AdFeedMock({
  brandName,
  imageUrl,
  primaryText,
  headline,
}: {
  brandName: string | null | undefined;
  imageUrl: string;
  primaryText?: string;
  headline?: string;
}) {
  return (
    <div>
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden max-w-sm mx-auto">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-gradient-lumi flex items-center justify-center text-primary-foreground text-sm font-bold">
            {(brandName || "You").charAt(0).toUpperCase()}
          </div>
          <div className="text-left leading-tight">
            <p className="text-sm font-semibold">{brandName || "Your brand"}</p>
            <p className="text-[11px] text-muted-foreground">Sponsored</p>
          </div>
        </div>
        {primaryText && <p className="px-4 pb-3 text-sm text-left leading-snug">{primaryText}</p>}
        <img src={imageUrl} alt="Your ad" className="w-full" />
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">adsbylumi.com</span>
          <span className="text-xs font-semibold rounded-md border border-border px-3 py-1.5 bg-background">
            Learn more
          </span>
        </div>
        <div className="flex items-center gap-6 px-4 py-2.5 border-t border-border text-muted-foreground">
          <ThumbsUp className="w-4 h-4" />
          <MessageCircle className="w-4 h-4" />
          <Share2 className="w-4 h-4" />
        </div>
      </div>
      {headline && primaryText !== headline && (
        <p className="text-center text-sm text-muted-foreground mt-6">
          Headline: <span className="text-foreground font-medium">“{headline}”</span>
        </p>
      )}
    </div>
  );
}
