import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Paintbrush } from "lucide-react";
import { toast } from "sonner";

// Curated Google Fonts the renderer can actually load.
// Keep in sync with renderer/ALLOWED_FONTS.
const DISPLAY_FONTS = [
  "Playfair Display",
  "Bebas Neue",
  "Oswald",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Lora",
  "DM Serif Display",
  "Cormorant Garamond",
  "Abril Fatface",
  "Archivo Black",
  "Anton",
  "Fraunces",
  "Space Grotesk",
] as const;

const BODY_FONTS = [
  "Inter",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Lora",
  "Work Sans",
  "DM Sans",
  "Nunito",
  "Source Sans 3",
  "Karla",
  "Manrope",
  "Open Sans",
] as const;

const ALL_FONTS = Array.from(new Set([...DISPLAY_FONTS, ...BODY_FONTS]));

function googleFontHref(families: readonly string[]) {
  const params = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

type BrandColors = {
  bg?: string;
  ink?: string;
  accent?: string;
  pop?: string;
  highlight?: string;
  cream?: string;
};

type BrandFonts = {
  displayItalicUrl?: string;
  displayFamily?: string;
  bodyFamily?: string;
};

const COLOR_FIELDS: { key: keyof BrandColors; label: string }[] = [
  { key: "bg", label: "Background" },
  { key: "ink", label: "Ink / text" },
  { key: "accent", label: "Accent" },
  { key: "pop", label: "Pop" },
  { key: "highlight", label: "Highlight" },
  { key: "cream", label: "Cream" },
];

interface Props {
  websiteUrl?: string | null;
}

export default function BrandColorsAndFonts({ websiteUrl }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [url, setUrl] = useState(websiteUrl || "");
  const [colors, setColors] = useState<BrandColors>({});
  const [fonts, setFonts] = useState<BrandFonts>({});
  const [sourceUrl, setSourceUrl] = useState<string>("");

  useEffect(() => {
    if (websiteUrl) setUrl(websiteUrl);
  }, [websiteUrl]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const id = "brand-google-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleFontHref(ALL_FONTS);
  }, []);

  const load = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("brand_kits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setColors((data.colors as BrandColors) || {});
        setFonts((data.fonts as BrandFonts) || {});
        setSourceUrl(data.source_url || "");
        if (!websiteUrl && data.source_url) setUrl(data.source_url);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load brand colors");
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    if (!url.trim()) {
      toast.error("Enter a website URL");
      return;
    }
    setPulling(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("extract-brand", {
        body: { url: url.trim() },
      });
      if (error) throw error;
      const s = (res as any)?.suggested || {};
      setColors({
        bg: s.colors?.background || colors.bg || "",
        ink: s.colors?.ink || colors.ink || "",
        accent: s.colors?.accent || colors.accent || "",
        pop: s.colors?.pops?.[0] || colors.pop || "",
        highlight: s.colors?.pops?.[1] || colors.highlight || "",
        cream: s.colors?.background || colors.cream || "",
      });
      setFonts({
        displayItalicUrl: s.fonts?.display?.url || fonts.displayItalicUrl || "",
        displayFamily: s.fonts?.display?.family || fonts.displayFamily || "",
        bodyFamily: s.fonts?.body?.family || fonts.bodyFamily || "",
      });
      toast.success("Pulled colors & fonts from your site");
    } catch (e: any) {
      toast.error(e?.message || "Failed to pull brand");
    } finally {
      setPulling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("You must be signed in");
      const { error } = await supabase
        .from("brand_kits")
        .upsert(
          {
            user_id: userId,
            source_url: url.trim() || sourceUrl || null,
            colors,
            fonts,
            status: "confirmed",
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Brand colors & fonts saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paintbrush className="h-5 w-5" />
          Brand Colors & Fonts
        </CardTitle>
        <CardDescription>
          The palette and typography used on your generated ads. Pull from your site, or fine-tune below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                />
                <Button variant="outline" onClick={handlePull} disabled={pulling}>
                  {pulling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Pull from site
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base">Colors</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colors[key] || "#000000"}
                        onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent"
                      />
                      <Input
                        value={colors[key] || ""}
                        onChange={(e) => setColors((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="#000000"
                        className="font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base">Fonts</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Display font family</Label>
                  <Input
                    value={fonts.displayFamily || ""}
                    onChange={(e) => setFonts((prev) => ({ ...prev, displayFamily: e.target.value }))}
                    placeholder="e.g. Playfair Display"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Body font family</Label>
                  <Input
                    value={fonts.bodyFamily || ""}
                    onChange={(e) => setFonts((prev) => ({ ...prev, bodyFamily: e.target.value }))}
                    placeholder="e.g. Inter"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Display font URL (optional)</Label>
                <Input
                  value={fonts.displayItalicUrl || ""}
                  onChange={(e) =>
                    setFonts((prev) => ({ ...prev, displayItalicUrl: e.target.value }))
                  }
                  placeholder="https://.../font.woff2"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleSave} disabled={saving} variant="lumi">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save colors & fonts
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
