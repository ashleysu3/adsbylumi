import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Scissors, RotateCcw } from "lucide-react";
import type { BRollClip } from "./BRollLibrary";

interface BRollTrimDialogProps {
  open: boolean;
  clip: BRollClip | null;
  onClose: () => void;
  onSave: (trimStart: number, trimEnd: number, duration: number) => Promise<void>;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function BRollTrimDialog({ open, clip, onClose, onSave }: BRollTrimDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [saving, setSaving] = useState(false);

  // Initialize trim values when clip changes
  useEffect(() => {
    if (!clip) return;
    setTrimStart(clip.trim_start ?? 0);
    setTrimEnd(clip.trim_end ?? clip.duration ?? 0);
    setDuration(clip.duration ?? 0);
  }, [clip?.id]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration || 0;
    setDuration(d);
    // If we don't yet have an end set, default to full duration
    if (!trimEnd || trimEnd > d) setTrimEnd(d);
  };

  // Loop playback within trim bounds for a live preview
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= trimEnd) {
      video.currentTime = trimStart;
    } else if (video.currentTime < trimStart) {
      video.currentTime = trimStart;
    }
  };

  const seekTo = (t: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = t;
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    seekTo(0);
  };

  const handleSave = async () => {
    if (!clip) return;
    setSaving(true);
    try {
      await onSave(trimStart, trimEnd, duration);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const trimmedLength = Math.max(0, trimEnd - trimStart);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Trim clip
          </DialogTitle>
        </DialogHeader>

        {clip && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground truncate">{clip.file_name}</p>

            <div className="rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={clip.file_url}
                className="w-full aspect-[9/16] max-h-[420px] object-contain mx-auto"
                controls
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Start: {formatTime(trimStart)}</Label>
                <Label className="text-xs">End: {formatTime(trimEnd)}</Label>
              </div>
              <Slider
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.1}
                value={[trimStart, trimEnd]}
                onValueChange={([s, e]) => {
                  if (s === undefined || e === undefined) return;
                  // Enforce minimum 0.5s clip and ordering
                  const newStart = Math.min(s, e - 0.5);
                  const newEnd = Math.max(e, newStart + 0.5);
                  if (newStart !== trimStart) {
                    setTrimStart(Math.max(0, newStart));
                    seekTo(Math.max(0, newStart));
                  }
                  if (newEnd !== trimEnd) {
                    setTrimEnd(Math.min(duration, newEnd));
                  }
                }}
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>0:00</span>
                <span>
                  Trimmed length: <strong className="text-foreground">{formatTime(trimmedLength)}</strong>
                </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
              Trim points are saved with this clip and applied wherever it's used (preview, downloads, and rendered videos).
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="lumi" size="sm" onClick={handleSave} disabled={saving || trimmedLength < 0.5}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save trim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
