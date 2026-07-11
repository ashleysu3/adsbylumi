import { useState } from "react";
import { ThumbsUp, MessageCircle, Share2 } from "lucide-react";

// The generated ad framed as a real Meta feed post — no explanation needed,
// it instantly reads as "a finished ad that could run today." The headline
// sits where Meta actually puts it: in the link card below the image, next
// to the CTA button, with the brand's real domain above it.
export function AdFeedMock({
  brandName,
  imageUrl,
  primaryText,
  headline,
  domain,
  avatarUrl,
  ctaLabel,
}: {
  brandName: string | null | undefined;
  imageUrl: string;
  primaryText?: string;
  headline?: string;
  domain?: string | null;
  avatarUrl?: string | null;
  ctaLabel?: string | null;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [avatarOk, setAvatarOk] = useState(true);
  const initial = (brandName || "You").charAt(0).toUpperCase();
  // Only show body text when it's genuinely different from the headline —
  // the headline already lives in the link card, no point echoing it.
  const body = primaryText && primaryText.trim() && primaryText.trim() !== (headline || "").trim()
    ? primaryText.trim()
    : "";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden max-w-sm mx-auto">
      {/* Poster row — avatar (brand logo when we have one) + Sponsored */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        {avatarUrl && avatarOk ? (
          <img
            src={avatarUrl}
            alt={brandName || "Brand"}
            className="h-9 w-9 rounded-full object-cover bg-muted"
            onError={() => setAvatarOk(false)}
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-lumi flex items-center justify-center text-primary-foreground text-sm font-bold">
            {initial}
          </div>
        )}
        <div className="text-left leading-tight">
          <p className="text-sm font-semibold">{brandName || "Your brand"}</p>
          <p className="text-[11px] text-muted-foreground">Sponsored · 🌐</p>
        </div>
      </div>

      {body && <p className="px-4 pb-3 text-sm text-left leading-snug whitespace-pre-line">{body}</p>}

      {/* The creative */}
      {imgOk ? (
        <img src={imageUrl} alt="Your ad" className="w-full block" onError={() => setImgOk(false)} />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
          Your ad preview
        </div>
      )}

      {/* Link card — this is where a Meta ad's headline actually renders:
          domain on top, headline bold below, CTA button on the right */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40">
        <div className="text-left min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
            {domain || "your website"}
          </p>
          {headline && <p className="text-sm font-semibold leading-tight line-clamp-2">{headline}</p>}
        </div>
        <span className="shrink-0 text-xs font-semibold rounded-md border border-border px-3 py-1.5 bg-background">
          {ctaLabel || "Learn more"}
        </span>
      </div>

      {/* Reactions chrome */}
      <div className="flex items-center gap-6 px-4 py-2.5 border-t border-border text-muted-foreground">
        <ThumbsUp className="w-4 h-4" />
        <MessageCircle className="w-4 h-4" />
        <Share2 className="w-4 h-4" />
      </div>
    </div>
  );
}
