import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";

const EMPTY_COLORS = {
  bg: "#ffffff",
  ink: "#111111",
  accent: "#3b82f6",
  pop: "#22c55e",
  highlight: "#f59e0b",
  cream: "#f5f5f5",
};

const DEFAULT_COPY = {
  eyebrow: "Free Live Class",
  headlinePre: "The",
  headlineHL: "#1 mistake",
  headlinePost: "new wedding planners make",
  accent: "— and what to do instead.",
  sub: "Start your business and book your first 5 clients in 60 days.",
  cta: "Save your seat →",
  badgeTop: "Free",
  badgeBottom: "Live Class",
};

const PLACEMENT_LABELS: Record<string, string> = {
  feed: "Feed 1080×1080",
  story: "Story 1080×1920",
};

type BrandKitColors = { bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string };
type BrandKitFonts = { displayItalicUrl?: string };
type RenderImage = { placement: string; width: number; height: number; base64: string };

export default function AdGenerator() {
  const navigate = useNavigate();
  const [colors, setColors] = useState<BrandKitColors>(EMPTY_COLORS);
  const [fontUrl, setFontUrl] = useState<string>("");
  const [copy, setCopy] = useState(DEFAULT_COPY);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<RenderImage[]>([]);
  const [kitLoading, setKitLoading] = useState(true);
  const [hasKit, setHasKit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setKitLoading(true);
      try {
        const { data, error } = await supabase
          .from("brand_kits")
          .select("colors, fonts")
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          if (data?.colors) {
            const c = data.colors as Record<string, string>;
            setColors({
              bg: c.bg || EMPTY_COLORS.bg,
              ink: c.ink || EMPTY_COLORS.ink,
              accent: c.accent || EMPTY_COLORS.accent,
              pop: c.pop || EMPTY_COLORS.pop,
              highlight: c.highlight || EMPTY_COLORS.highlight,
              cream: c.cream || EMPTY_COLORS.cream,
            });
          }
          if (data?.fonts) {
            const f = data.fonts as BrandKitFonts;
            setFontUrl(f.displayItalicUrl || "");
          }
          setHasKit(!!data);
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to load brand kit");
      } finally {
        if (!cancelled) setKitLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `ad-generator/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("ad-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from("ad-photos")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !data?.signedUrl) throw signErr || new Error("Could not sign URL");
      setPhotoUrl(data.signedUrl);
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    setLoading(true);
    setImages([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad", {
        body: {
          template: "cutout",
          brandKit: {
            colors,
            fonts: {
              displayItalicUrl: fontUrl || undefined,
            },
          },
          copy,
          photo: { url: photoUrl, removeBackground: true },
          placements: ["feed", "story"],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setImages(data?.images || []);
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const download = (img: RenderImage) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img.base64}`;
    a.download = `ad-${img.placement}-${img.width}x${img.height}.png`;
    a.click();
  };

  const ColorPicker = ({ label, k }: { label: string; k: keyof BrandKitColors }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colors[k]}
          onChange={(e) => setColors({ ...colors, [k]: e.target.value })}
          className="h-9 w-12 rounded border border-border bg-background cursor-pointer"
        />
        <Input
          value={colors[k]}
          onChange={(e) => setColors({ ...colors, [k]: e.target.value })}
          className="h-9 text-xs font-mono"
        />
      </div>
    </div>
  );

  const TextField = ({ label, k, multiline }: { label: string; k: keyof typeof copy; multiline?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea
          value={copy[k]}
          onChange={(e) => setCopy({ ...copy, [k]: e.target.value })}
          rows={2}
        />
      ) : (
        <Input value={copy[k]} onChange={(e) => setCopy({ ...copy, [k]: e.target.value })} />
      )}
    </div>
  );

  if (kitLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading your brand kit…</p>
        </div>
      </div>
    );
  }

  if (!hasKit) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-sm w-full text-center p-8">
          <h2 className="text-xl font-semibold mb-2">Set up your brand first</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Pull your colors and fonts from your website before generating ads.
          </p>
          <Button onClick={() => navigate("/brand-setup")}>Set up your brand</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Ad Generator</h1>
          <p className="text-muted-foreground">Generate branded ad creatives in seconds.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT - Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brand colors</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ColorPicker label="Background" k="bg" />
                <ColorPicker label="Ink" k="ink" />
                <ColorPicker label="Accent" k="accent" />
                <ColorPicker label="Pop" k="pop" />
                <ColorPicker label="Highlight" k="highlight" />
                <ColorPicker label="Cream" k="cream" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TextField label="Eyebrow" k="eyebrow" />
                <div className="grid grid-cols-3 gap-2">
                  <TextField label="Headline start" k="headlinePre" />
                  <TextField label="Highlighted word(s)" k="headlineHL" />
                  <TextField label="Headline rest" k="headlinePost" />
                </div>
                <TextField label="Italic accent (optional)" k="accent" />
                <TextField label="Subtext" k="sub" multiline />
                <TextField label="Button text" k="cta" />
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Badge top" k="badgeTop" />
                  <TextField label="Badge bottom" k="badgeBottom" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Photo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="file" accept="image/*" onChange={onPhoto} disabled={uploading} />
                {uploading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                  </p>
                )}
                {photoUrl && (
                  <img src={photoUrl} alt="Uploaded" className="h-24 rounded border border-border object-cover" />
                )}
              </CardContent>
            </Card>

            <Button onClick={generate} disabled={loading || !photoUrl} size="lg" className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
                </>
              ) : (
                "Generate ads"
              )}
            </Button>
          </div>

          {/* RIGHT - Results */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Results</CardTitle>
              </CardHeader>
              <CardContent>
                {loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p className="text-sm">Generating your ads (~6–8s)…</p>
                  </div>
                )}
                {!loading && images.length === 0 && (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    Upload a photo and click "Generate ads" to see results.
                  </p>
                )}
                {!loading && images.length > 0 && (
                  <div className="space-y-6">
                    {images.map((img, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {PLACEMENT_LABELS[img.placement] || `${img.placement} ${img.width}×${img.height}`}
                          </p>
                          <Button size="sm" variant="outline" onClick={() => download(img)}>
                            <Download className="h-3 w-3 mr-1" /> Download
                          </Button>
                        </div>
                        <img
                          src={`data:image/png;base64,${img.base64}`}
                          alt={img.placement}
                          className="w-full rounded border border-border"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
