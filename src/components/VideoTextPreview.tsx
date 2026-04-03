import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TextOverlay {
  text: string;
  timing?: string;
  type?: "hook" | "insight" | "transition" | "cta";
}

export interface OverlayStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  position: "top" | "center" | "bottom";
  textShadow: boolean;
  ctaOverlayUrl?: string;
}

export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  fontFamily: "Inter",
  fontSize: 32,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  bgOpacity: 0.6,
  position: "bottom",
  textShadow: true,
};

interface VideoTextPreviewProps {
  videoUrl: string;
  overlays: TextOverlay[];
  style?: OverlayStyle;
  className?: string;
  compact?: boolean;
}

function parseTimingString(timing?: string): { start: number; end: number } | null {
  if (!timing) return null;
  const match = timing.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!match) return null;
  return { start: parseFloat(match[1]), end: parseFloat(match[2]) };
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function VideoTextPreview({ videoUrl, overlays, style = DEFAULT_OVERLAY_STYLE, className, compact }: VideoTextPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const positionClass = {
    top: "top-4",
    center: "top-1/2 -translate-y-1/2",
    bottom: "bottom-4",
  }[style.position];

  const fontSize = compact ? Math.max(12, style.fontSize * 0.5) : style.fontSize * 0.6;

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[400px]", className)}>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        controls
        muted
        loop
        playsInline
        preload="metadata"
      />

      {/* Text overlays */}
      <div className={cn("absolute left-0 right-0 px-3 pointer-events-none z-10", positionClass)}>
        {overlays.map((overlay, i) => {
          const timing = parseTimingString(overlay.timing);
          const isVisible = !timing || (currentTime >= timing.start && currentTime < timing.end) || !isPlaying;

          if (!isVisible) return null;

          return (
            <div
              key={i}
              className="text-center mb-1 transition-opacity duration-300"
              style={{
                opacity: isVisible ? 1 : 0,
              }}
            >
              <span
                style={{
                  fontFamily: style.fontFamily,
                  fontSize: `${fontSize}px`,
                  color: style.textColor,
                  backgroundColor: hexToRgba(style.bgColor, style.bgOpacity),
                  textShadow: style.textShadow ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
                  padding: "4px 12px",
                  borderRadius: "4px",
                  display: "inline-block",
                  lineHeight: 1.3,
                }}
              >
                {overlay.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
