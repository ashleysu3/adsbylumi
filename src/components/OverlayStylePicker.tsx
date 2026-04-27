import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Type, Upload, X, ImageIcon, Sparkles, Move } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OverlayStyle, EmphasisStyle, OverlayXY } from "./VideoTextPreview";

// ============================================================================
// OverlayStylePicker (patch #15)
//
// Per-brand text overlay style. Stored on brands.overlay_style (JSONB) so
// no schema migration is needed when we add fields here — new keys just
// live alongside the old ones.
//
// Changes in this patch:
//   - Removed the dynamic Google Fonts <link> injection. Those fonts are
//     now loaded globally from index.html, so they're available in the
//     queue-render flow too (which didn't mount this component).
//   - Added "Emphasize Hook & CTA" section: toggle, size boost slider, and
//     emphasis style select. The renderer reads these fields at render
//     time and applies them to overlays whose `type` is 'hook' or 'cta'.
// ============================================================================

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Bebas Neue", label: "Bebas Neue" },
  { value: "Poppins", label: "Poppins" },
  { value: "Oswald", label: "Oswald" },
  { value: "Lora", label: "Lora" },
  { value: "Raleway", label: "Raleway" },
];

const POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

const EMPHASIS_STYLE_OPTIONS: { value: EmphasisStyle; label: string }[] = [
  { value: "bold", label: "Bold only" },
  { value: "upper", label: "ALL CAPS" },
  { value: "bold-upper", label: "Bold + ALL CAPS" },
];

interface OverlayStylePickerProps {
  style: OverlayStyle;
  onChange: (style: OverlayStyle) => void;
  onSave: () => void;
  saving?: boolean;
  brandId: string;
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function OverlayStylePicker({ style, onChange, onSave, saving, brandId }: OverlayStylePickerProps) {
  const update = (partial: Partial<OverlayStyle>) => onChange({ ...style, ...partial });
  const [uploadingCta, setUploadingCta] = useState(false);

  // Emphasis defaults when the brand's saved style pre-dates patch #15.
  const emphasizeHookCta = style.emphasizeHookCta ?? true;
  const emphasisBoost = style.emphasisBoost ?? 0.3;
  const emphasisStyle: EmphasisStyle = style.emphasisStyle ?? "bold-upper";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Type className="h-5 w-5" />
          Text Overlay Style
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose how text overlays appear on your b-roll videos
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Font Family */}
        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select value={style.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Colors Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Text Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{style.textColor}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Background Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={style.bgColor}
                onChange={(e) => update({ bgColor: e.target.value })}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{style.bgColor}</span>
            </div>
          </div>
        </div>

        {/* BG Opacity */}
        <div className="space-y-2">
          <Label>Background Opacity ({Math.round(style.bgOpacity * 100)}%)</Label>
          <Slider
            value={[style.bgOpacity]}
            onValueChange={([v]) => update({ bgOpacity: v })}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-[11px] text-muted-foreground">
            Set to 0% for no pill background (recommended — relies on text shadow / stroke for readability).
          </p>
        </div>

        {/* Default text position + size — auto-applies to every b-roll */}
        <DefaultTextPositionEditor
          style={style}
          onChange={(patch) => update(patch)}
        />

        {/* Text Shadow */}
        <div className="flex items-center justify-between">
          <Label>Text Shadow</Label>
          <Switch checked={style.textShadow} onCheckedChange={(v) => update({ textShadow: v })} />
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Hook / CTA Emphasis                                                 */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                Emphasize Hook & CTA
              </Label>
              <p className="text-[12px] text-muted-foreground leading-snug">
                Make the first line (hook) and last line (CTA) stand out against the rest of the text — bigger,
                bolder, or capitalized. Applied automatically based on the overlay's type.
              </p>
            </div>
            <Switch
              checked={emphasizeHookCta}
              onCheckedChange={(v) => update({ emphasizeHookCta: v })}
            />
          </div>

          {emphasizeHookCta && (
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label className="text-xs">
                  Size boost (+{Math.round(emphasisBoost * 100)}%)
                </Label>
                <Slider
                  value={[emphasisBoost]}
                  onValueChange={([v]) => update({ emphasisBoost: v })}
                  min={0.2}
                  max={0.8}
                  step={0.05}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Emphasis style</Label>
                <Select
                  value={emphasisStyle}
                  onValueChange={(v) => update({ emphasisStyle: v as EmphasisStyle })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPHASIS_STYLE_OPTIONS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* CTA Mockup Overlay */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" />
            CTA Mockup Overlay (PNG)
          </Label>
          <p className="text-xs text-muted-foreground">
            Upload a transparent PNG (e.g. product mockup) that appears at the end of each b-roll video with the CTA
          </p>
          {style.ctaOverlayUrl ? (
            <div className="relative inline-block">
              <img
                src={style.ctaOverlayUrl}
                alt="CTA overlay"
                className="h-20 object-contain rounded border bg-muted/30 p-1"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={() => update({ ctaOverlayUrl: undefined })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              {uploadingCta ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {uploadingCta ? "Uploading..." : "Upload transparent PNG"}
              </span>
              <input
                type="file"
                accept="image/png"
                className="hidden"
                disabled={uploadingCta}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.includes("png")) {
                    toast.error("Please upload a PNG file");
                    return;
                  }
                  setUploadingCta(true);
                  const path = `${brandId}/cta-overlay-${Date.now()}.png`;
                  const { error } = await supabase.storage
                    .from("broll-library")
                    .upload(path, file, { contentType: "image/png" });
                  if (error) {
                    toast.error("Upload failed: " + error.message);
                  } else {
                    const { data } = supabase.storage.from("broll-library").getPublicUrl(path);
                    update({ ctaOverlayUrl: data.publicUrl });
                    toast.success("CTA overlay uploaded");
                  }
                  setUploadingCta(false);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* Live Preview Strip */}
        <div
          className="rounded-lg p-6 text-center"
          style={{ backgroundColor: "#1a1a2e" }}
        >
          <span
            style={{
              fontFamily: `"${style.fontFamily}", Inter, sans-serif`,
              fontSize: "20px",
              fontWeight: style.fontWeight === "black" ? 900 : 700,
              color: style.textColor,
              backgroundColor: style.bgOpacity > 0 ? hexToRgba(style.bgColor, style.bgOpacity) : "transparent",
              textShadow: style.textShadow
                ? style.bgOpacity > 0
                  ? "0 2px 4px rgba(0,0,0,0.5)"
                  : "0 2px 6px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.5)"
                : "none",
              padding: style.bgOpacity > 0 ? "6px 16px" : "0",
              borderRadius: style.bgOpacity > 0 ? "4px" : "0",
              display: "inline-block",
              letterSpacing: style.fontFamily === "Bebas Neue" ? "0.02em" : "normal",
            }}
          >
            Your text overlay preview
          </span>
        </div>

        <Button onClick={onSave} disabled={saving} variant="lumi" className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Overlay Style
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DefaultTextPositionEditor
//
// Mini 9:16 stage where the user drags a "Aa" sample chip to set the brand
// default text position. Also exposes a default font-size slider. Both
// values are written to the OverlayStyle as `defaultXY` and `defaultScale`
// and auto-applied to every b-roll overlay that doesn't have its own
// per-clip override.
// ============================================================================

const POSITION_PRESETS: { value: OverlayStyle["position"]; label: string; xy: OverlayXY }[] = [
  { value: "top", label: "Top", xy: { x: 0.5, y: 0.18 } },
  { value: "center", label: "Center", xy: { x: 0.5, y: 0.5 } },
  { value: "bottom", label: "Bottom", xy: { x: 0.5, y: 0.82 } },
];

interface DefaultTextPositionEditorProps {
  style: OverlayStyle;
  onChange: (patch: Partial<OverlayStyle>) => void;
}

function clamp01(n: number) {
  return Math.max(0.04, Math.min(0.96, n));
}

function DefaultTextPositionEditor({ style, onChange }: DefaultTextPositionEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const xy: OverlayXY = style.defaultXY ??
    POSITION_PRESETS.find(p => p.value === style.position)?.xy ??
    { x: 0.5, y: 0.82 };
  const scale = style.defaultScale ?? 1;

  const computeXY = (clientX: number, clientY: number): OverlayXY | null => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    const next = computeXY(e.clientX, e.clientY);
    if (next) onChange({ defaultXY: next });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const next = computeXY(e.clientX, e.clientY);
    if (next) onChange({ defaultXY: next });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-1">
        <Label className="flex items-center gap-1.5 text-sm font-semibold">
          <Move className="h-4 w-4" />
          Default Text Position & Size
        </Label>
        <p className="text-[12px] text-muted-foreground leading-snug">
          Where should text land on every b-roll by default? Drag the sample below. You can still
          reposition individual lines per clip.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {POSITION_PRESETS.map((p) => {
          const isActive =
            style.position === p.value &&
            (!style.defaultXY ||
              (Math.abs(style.defaultXY.x - p.xy.x) < 0.02 &&
                Math.abs(style.defaultXY.y - p.xy.y) < 0.02));
          return (
            <Button
              key={p.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() =>
                onChange({ position: p.value, defaultXY: p.xy })
              }
            >
              {p.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Mini 9:16 stage */}
        <div
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative rounded-md overflow-hidden border bg-[image:var(--gradient-lumi)] cursor-crosshair shrink-0"
          style={{ width: 140, height: 250, touchAction: "none" }}
        >
          {/* IG safe-zone bands */}
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{
              height: "20%",
              backgroundColor: "rgba(0,0,0,0.35)",
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 4px, transparent 4px 8px)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: "20%",
              backgroundColor: "rgba(0,0,0,0.35)",
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 4px, transparent 4px 8px)",
            }}
          />
          {/* Sample text chip */}
          <div
            className="absolute select-none px-2 py-1 rounded bg-black/55 text-white text-center pointer-events-none shadow"
            style={{
              left: `${xy.x * 100}%`,
              top: `${xy.y * 100}%`,
              transform: "translate(-50%, -50%)",
              fontFamily: `"${style.fontFamily}", Inter, sans-serif`,
              fontSize: Math.max(10, 14 * scale),
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Aa
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Default text size ({scale.toFixed(2)}×)
            </Label>
            <Slider
              value={[scale]}
              onValueChange={([v]) => onChange({ defaultScale: v })}
              min={0.5}
              max={2}
              step={0.05}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Multiplier applied to every b-roll's overlay font size by default.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground space-y-1">
            <p>
              Position: <span className="font-mono">{Math.round(xy.x * 100)}%, {Math.round(xy.y * 100)}%</span>
            </p>
            <p className="text-amber-600 dark:text-amber-400">
              Amber bands = Instagram's profile (top) and caption (bottom) areas — keep text in the middle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
