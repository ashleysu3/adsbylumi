import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Type, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OverlayStyle } from "./VideoTextPreview";

const GOOGLE_FONT_FAMILIES = [
  "Playfair+Display",
  "Montserrat",
  "Bebas+Neue",
  "Poppins",
  "Oswald",
  "Lora",
  "Raleway",
];

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

  useEffect(() => {
    const linkId = "overlay-google-fonts";
    if (document.getElementById(linkId)) return;
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONT_FAMILIES.map(f => `family=${f}:wght@400;700`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }, []);

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

        {/* Font Size */}
        <div className="space-y-2">
          <Label>Font Size ({style.fontSize}px)</Label>
          <Slider
            value={[style.fontSize]}
            onValueChange={([v]) => update({ fontSize: v })}
            min={16}
            max={72}
            step={1}
          />
          <p className="text-[11px] text-muted-foreground">
            Size of the text overlay on the rendered 9:16 video.
          </p>
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
        </div>

        {/* Position */}
        <div className="space-y-2">
          <Label>Text Position</Label>
          <div className="flex gap-2">
            {POSITION_OPTIONS.map((p) => (
              <Button
                key={p.value}
                variant={style.position === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => update({ position: p.value as OverlayStyle["position"] })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Text Shadow */}
        <div className="flex items-center justify-between">
          <Label>Text Shadow</Label>
          <Switch checked={style.textShadow} onCheckedChange={(v) => update({ textShadow: v })} />
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
              fontFamily: style.fontFamily,
              fontSize: `${Math.max(12, style.fontSize * 0.5)}px`,
              color: style.textColor,
              backgroundColor: hexToRgba(style.bgColor, style.bgOpacity),
              textShadow: style.textShadow ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
              padding: "6px 16px",
              borderRadius: "4px",
              display: "inline-block",
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
