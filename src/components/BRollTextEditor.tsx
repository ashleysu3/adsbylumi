import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, Type, Film } from 'lucide-react';
import { toast } from 'sonner';
import {
  VideoTextPreview,
  DEFAULT_OVERLAY_STYLE,
  type TextOverlay,
  type OverlayStyle,
} from '@/components/VideoTextPreview';
import { DEFAULT_RENDER_STYLE } from '@/lib/ffmpeg-renderer';
import { useRenderQueue } from '@/contexts/RenderQueueContext';

// ============================================================================
// BRollTextEditor
//
// Modal UI for adding text overlays to a b-roll clip and exporting an MP4
// with the text burned in. Matches the scope agreed with Ashley 2026-04-23:
//
//   - Per-use editing (overlays live with the export, not with the clip).
//   - Standard features: multi-line text + timing (appears at X–Y seconds).
//   - Live in-browser preview that matches the exported file.
//   - Export → download MP4; caller's onExported gets the Blob if it wants
//     to also save to Supabase storage or hand off to a campaign flow.
//
// Uses the existing VideoTextPreview for live preview and the new
// ffmpeg-renderer for the actual burn-in. The brand's OverlayStylePicker
// styling (font, colors, position) is passed in via `style` so the preview
// and the exported file look consistent with the rest of the app.
// ============================================================================

interface BRollTextEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The clip being edited. */
  videoUrl: string;
  /** Display name shown in the dialog header. */
  clipName?: string;
  /**
   * Optional brand-level overlay style from OverlayStylePicker. When absent
   * we use DEFAULT_OVERLAY_STYLE which matches what users see in any other
   * VideoTextPreview that isn't brand-styled.
   */
  style?: OverlayStyle;
  /** Optional brand context — if provided, the queued render stores it so
   * the email + any future auto-attach flows know which brand this is for. */
  brandId?: string;
}

function parseTimingRange(raw: string): { start: number; end: number } | null {
  const m = raw.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (!m) return null;
  const start = parseFloat(m[1]);
  const end = parseFloat(m[2]);
  if (!isFinite(start) || !isFinite(end) || end <= start) return null;
  return { start, end };
}

export function BRollTextEditor({
  open,
  onOpenChange,
  videoUrl,
  clipName,
  style = DEFAULT_OVERLAY_STYLE,
  brandId,
}: BRollTextEditorProps) {
  const { enqueue } = useRenderQueue();
  const [overlays, setOverlays] = useState<TextOverlay[]>([
    { text: 'Your hook here', timing: '0-3s', type: 'hook' },
  ]);

  const addOverlay = () => {
    setOverlays([
      ...overlays,
      { text: '', timing: '3-6s', type: 'insight' },
    ]);
  };
  const updateOverlay = (i: number, patch: Partial<TextOverlay>) => {
    setOverlays(overlays.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  };
  const removeOverlay = (i: number) => {
    setOverlays(overlays.filter((_, idx) => idx !== i));
  };

  const allValid = overlays.every(
    o => o.text.trim().length > 0 && parseTimingRange(o.timing || '') !== null,
  );

  const handleQueue = () => {
    if (!allValid) {
      toast.error('Each overlay needs text and a valid timing (e.g. "0-3s").');
      return;
    }
    // Map UI overlays → renderer specs. The `type` is forwarded so the
    // renderer can apply hook/CTA emphasis to match the live preview.
    const specs = overlays
      .map(o => {
        const t = parseTimingRange(o.timing || '');
        if (!t) return null;
        return {
          text: o.text,
          startSeconds: t.start,
          endSeconds: t.end,
          type: o.type,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    enqueue({
      title: clipName || 'B-roll video',
      sourceClipName: clipName,
      videoUrl,
      overlays: specs,
      style: {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        textColor: style.textColor,
        bgColor: style.bgColor,
        bgOpacity: style.bgOpacity,
        position: style.position,
        textShadow: style.textShadow,
        emphasizeHookCta: style.emphasizeHookCta,
        emphasisBoost: style.emphasisBoost,
        emphasisStyle: style.emphasisStyle,
      },
      context: brandId ? { brandId } : undefined,
    });

    // Immediately close the modal. The queue context fires its own toast +
    // the bell icon tracks progress; we don't need a modal-scoped UI here.
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Add Text to "{clipName || 'B-roll clip'}"
          </DialogTitle>
          <DialogDescription>
            Write one or more text blocks, pick when each appears, then queue the
            render. Your MP4 will appear in the bell icon + get emailed to you when
            it's done. Styling (font, color, position) uses your brand's overlay settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 mt-2">
          {/* LEFT: overlay editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Text overlays</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={addOverlay}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add text
              </Button>
            </div>

            {overlays.map((o, i) => {
              const timing = parseTimingRange(o.timing || '');
              const timingInvalid = (o.timing || '').length > 0 && !timing;
              return (
                <div
                  key={i}
                  className="p-3 border rounded-xl bg-muted/20 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">
                      Text {i + 1}
                    </Label>
                    {overlays.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removeOverlay(i)}
                        aria-label="Remove overlay"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={o.text}
                    onChange={e => updateOverlay(i, { text: e.target.value })}
                    placeholder="Type the text for this overlay… use Enter for a new line"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Timing (seconds)
                      </Label>
                      <Input
                        value={o.timing || ''}
                        onChange={e => updateOverlay(i, { timing: e.target.value })}
                        placeholder="0-3s"
                        className={timingInvalid ? 'border-destructive' : ''}
                      />
                      {timingInvalid && (
                        <p className="text-[11px] text-destructive mt-1">
                          Use the format "start-end", e.g. "0-3s" or "2.5-5".
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Type</Label>
                      <Select
                        value={o.type || 'hook'}
                        onValueChange={v => updateOverlay(i, { type: v as TextOverlay['type'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hook">Hook</SelectItem>
                          <SelectItem value="insight">Insight</SelectItem>
                          <SelectItem value="transition">Transition</SelectItem>
                          <SelectItem value="cta">CTA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}

            {overlays.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-xl">
                No text blocks yet. Click "Add text" to start.
              </div>
            )}
          </div>

          {/* RIGHT: preview */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-2 block">
              Preview
            </Label>
            <VideoTextPreview
              videoUrl={videoUrl}
              overlays={overlays}
              style={style}
            />
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Scrub the video to see each overlay appear at its timing.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="lumi"
            onClick={handleQueue}
            disabled={overlays.length === 0 || !allValid}
            className="gap-2"
          >
            <Film className="h-4 w-4" />
            Queue Render
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export the renderer's style default so callers can reach it via the
// same import surface.
export { DEFAULT_RENDER_STYLE };
