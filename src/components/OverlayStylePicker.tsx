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
