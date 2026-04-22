import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ThumbsUp, MessageCircle, Share2 } from "lucide-react";
import type { OverlayStyle } from "@/components/VideoTextPreview";
import { cn } from "@/lib/utils";

interface StylePreviewPanelProps {
  brandName?: string;
  copyPerspective: "I" | "We";
  useEmojis: boolean;
  brandEmojis: string[];
  bulletEmoji: string;
  overlayStyle: OverlayStyle;
}

function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function StylePreviewPanel({
  brandName,
  copyPerspective,
  useEmojis,
  brandEmojis,
  bulletEmoji,
  overlayStyle,
}: StylePreviewPanelProps) {
  const isWe = copyPerspective === "We";
  const pronoun = isWe ? "we" : "I";
  const pronounCap = isWe ? "We" : "I";
  const possessive = isWe ? "our" : "my";
  const verbHelp = isWe ? "help" : "help"; // both "I help" / "we help"

  const accentEmoji = useEmojis && brandEmojis[0] ? brandEmojis[0] : "";
  const secondaryEmoji = useEmojis && brandEmojis[1] ? brandEmojis[1] : "";

  const headline = useMemo(() => {
    const base = `${pronounCap} ${verbHelp} coaches book more clients`;
    return useEmojis && accentEmoji ? `${accentEmoji} ${base}` : base;
  }, [pronounCap, verbHelp, useEmojis, accentEmoji]);

  const bullets = useMemo(
    () => [
      `Stop guessing what to post — get a clear plan`,
      `Turn ${possessive} content into ad-ready scripts`,
      `Launch campaigns in minutes, not days`,
    ],
    [possessive],
  );

  const primaryCopy = useMemo(() => {
    const opener = useEmojis && secondaryEmoji
      ? `${secondaryEmoji} Tired of ads that flop?`
      : `Tired of ads that flop?`;
    const close = isWe
      ? `We built this for creators who want results without the agency price tag.`
      : `I built this for creators who want results without the agency price tag.`;
    return { opener, close };
  }, [useEmojis, secondaryEmoji, isWe]);

  const overlayBg = hexToRgba(overlayStyle.bgColor, overlayStyle.bgOpacity);
  const overlayPositionClass =
    overlayStyle.position === "top"
      ? "top-4"
      : overlayStyle.position === "center"
      ? "top-1/2 -translate-y-1/2"
      : "bottom-4";

  return (
    <Card variant="glow" className="md:sticky md:top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Live Preview
          </CardTitle>
          <Badge variant="secondary" className="text-xs">Updates as you edit</Badge>
        </div>
        <CardDescription>
          Sample ad using your selected voice, emojis, bullet style, and overlay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mock Meta Ad Preview */}
        <div className="rounded-xl border bg-background overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 p-3 border-b">
            <div className="h-8 w-8 rounded-full bg-[image:var(--gradient-lumi)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {brandName || "Your Brand"}
              </p>
              <p className="text-[10px] text-muted-foreground">Sponsored · 🌐</p>
            </div>
          </div>

          {/* Primary copy (above creative) */}
          <div className="p-3 text-sm whitespace-pre-line">
            <p className="font-medium">{primaryCopy.opener}</p>
            <p className="mt-2">
              {pronounCap} {verbHelp} coaches and creators turn {possessive} ideas into ads that actually convert.
            </p>
            <div className="mt-2 space-y-1">
              {bullets.map((b, i) => (
                <p key={i}>
                  <span className="mr-2">{bulletEmoji}</span>
                  {b}
                </p>
              ))}
            </div>
            <p className="mt-2">{primaryCopy.close}</p>
          </div>

          {/* 9:16 creative mock with overlay */}
          <div className="relative mx-3 mb-3 rounded-lg overflow-hidden bg-[image:var(--gradient-lumi)]" style={{ aspectRatio: "9 / 16", maxHeight: 360 }}>
            {/* Subtle pattern */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
            {/* Overlay text */}
            <div className={cn("absolute left-3 right-3 px-3 py-2 rounded-md", overlayPositionClass)}>
              <div
                className="rounded-md px-3 py-2 text-center"
                style={{
                  backgroundColor: overlayBg,
                  color: overlayStyle.textColor,
                  fontFamily: overlayStyle.fontFamily,
                  fontSize: Math.max(12, overlayStyle.fontSize * 0.45),
                  textShadow: overlayStyle.textShadow ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {useEmojis && accentEmoji ? `${accentEmoji} ` : ""}
                {pronounCap} {verbHelp} coaches book more clients
              </div>
            </div>
          </div>

          {/* Headline + CTA strip */}
          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                yourbrand.com
              </p>
              <p className="text-sm font-semibold truncate">{headline}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                Free training inside.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-medium px-3 py-2 rounded-md bg-muted hover:bg-muted/80 transition"
            >
              Learn more
            </button>
          </div>

          {/* Reactions strip */}
          <div className="flex items-center gap-4 px-3 py-2 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> 248</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> 32</span>
            <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> 14</span>
          </div>
        </div>

        {/* What's reflected */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">Voice:</span> {isWe ? 'Team "We"' : 'Personal "I"'}</p>
          <p>
            <span className="font-medium text-foreground">Emojis:</span>{" "}
            {useEmojis ? (brandEmojis.slice(0, 6).join(" ") || "On (none chosen)") : "Off"}
          </p>
          <p><span className="font-medium text-foreground">Bullet:</span> {bulletEmoji}</p>
          <p>
            <span className="font-medium text-foreground">Overlay:</span> {overlayStyle.fontFamily} · {overlayStyle.position} · {overlayStyle.fontSize}px
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
