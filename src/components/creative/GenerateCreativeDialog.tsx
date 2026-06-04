import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Pencil, Download, Wand2, RefreshCw, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreativeBrief } from "./ProductionChecklistPanel";

type Colors = { bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string };
const DEFAULT_COLORS: Colors = {
  bg: "#ffffff", ink: "#111111", accent: "#3b82f6",
  pop: "#22c55e", highlight: "#f59e0b", cream: "#f5f5f5",
};

type SingleOption = Record<string, string>;
type Slide = Record<string, string>;
type CarouselOption = { slides: Slide[] };
type Photo = { id: string; path: string; url: string };
type RenderImage = { placement: string; width: number; height: number; base64: string; label?: string };
type CustomTemplate = {
  id: string;
  name: string;
  type: "single" | "carousel";
  html: string;
  copy_slots: any;
  slide_slots: any;
  needs_photo: boolean;
  placements: string[];
};

const BUILT_IN_TEMPLATES = ["cutout", "spotlight", "framed", "split", "highlighter", "overlay", "carousel"] as const;

const PHOTO_TREATMENT: Record<string, "cutout" | "with-background"> = {
  cutout: "cutout", highlighter: "cutout",
  spotlight: "with-background", framed: "with-background", split: "with-background", overlay: "with-background",
};

// Friendly labels for known slot keys (anything unknown falls back to the key)
const SLOT_LABELS: Record<string, string> = {
  eyebrow: "Eyebrow",
  headline: "Headline",
  headlinePre: "Headline start",
  headlineHL: "Highlight",
  headlinePost: "Headline end",
  accent: "Accent",
  sub: "Sub",
  cta: "CTA",
  sig: "Signature",
  badgeTop: "Badge top",
  badgeBottom: "Badge bottom",
};
const MULTILINE_KEYS = new Set(["sub", "accent"]);

// Local fallback: mirror the compose-ad mapping so the UI can guess a template
function mapStyleToTemplate(styleHint?: string, format?: string): string {
  if (format === "carousel") return "carousel";
  const m: Record<string, string> = {
    "photo-forward": "cutout", card: "spotlight", framed: "framed",
    "type-led": "split", testimonial: "spotlight", highlighter: "highlighter",
  };
  return (styleHint && m[styleHint]) || "cutout";
}

export function GenerateCreativeDialog() {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<CreativeBrief | null>(null);

  const [colors, setColors] = useState<Colors>(DEFAULT_COLORS);
  const [fontUrl, setFontUrl] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [brandVoice, setBrandVoice] = useState<any>(null);
  const [kitLoading, setKitLoading] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>("");
  const [removeBackground, setRemoveBackground] = useState(true);
  const [generatedPhoto, setGeneratedPhoto] = useState<Photo | null>(null);
  const [generatingConcept, setGeneratingConcept] = useState(false);

  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState<string>("cutout");

  // single-template state
  const [singleOptions, setSingleOptions] = useState<SingleOption[]>([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const [editedSingle, setEditedSingle] = useState<SingleOption>({});
  const [editingCopy, setEditingCopy] = useState(false);

  // carousel state
  const [carouselOptions, setCarouselOptions] = useState<CarouselOption[]>([]);
  const [editedSlides, setEditedSlides] = useState<Slide[]>([]);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [images, setImages] = useState<RenderImage[]>([]);

  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [customTemplateId, setCustomTemplateId] = useState<string>("");
  const activeCustom = useMemo(
    () => customTemplates.find((t) => t.id === customTemplateId) || null,
    [customTemplates, customTemplateId],
  );

  const isCarousel = activeCustom
    ? activeCustom.type === "carousel"
    : template === "carousel" || brief?.format === "carousel";
  const briefRef = useRef<CreativeBrief | null>(null);
  briefRef.current = brief;

  // Listen for handoff event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { brief?: CreativeBrief };
      if (!detail?.brief) return;
      setBrief(detail.brief);
      const isGen = detail.brief.imageSource === "generated";
      setTemplate(isGen ? "overlay" : mapStyleToTemplate(detail.brief.styleHint, detail.brief.format));
      if (isGen) setRemoveBackground(false);
      setGeneratedPhoto(null);
      setOpen(true);
      setSingleOptions([]);
      setCarouselOptions([]);
      setEditedSlides([]);
      setEditedSingle({});
      setEditingCopy(false);
      setImages([]);
      setProgress("");
      setSelectedOptionIdx(0);
    };
    window.addEventListener("creative-brief:generate", handler as EventListener);
    return () => window.removeEventListener("creative-brief:generate", handler as EventListener);
  }, []);

  const generateConceptImage = useCallback(async () => {
    const b = briefRef.current;
    if (!b || b.imageSource !== "generated" || !b.imagePrompt) return;
    setGeneratingConcept(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-concept-image", {
        body: { prompt: b.imagePrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No image returned");
      setGeneratedPhoto({ id: "generated", path: "generated", url: data.url });
    } catch (err: any) {
      toast.error(err?.message || "Could not generate concept image");
    } finally {
      setGeneratingConcept(false);
    }
  }, []);

  useEffect(() => {
    if (open && brief?.imageSource === "generated" && !generatedPhoto && !generatingConcept) {
      generateConceptImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brief]);

  // Tie background removal to chosen template (except for generated-concept images, which stay full-bleed)
  useEffect(() => {
    if (brief?.imageSource === "generated") return;
    const t = PHOTO_TREATMENT[template];
    if (t) setRemoveBackground(t === "cutout");
  }, [template, brief?.imageSource]);

  // Load brand kit + photos on first open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setKitLoading(true);
      try {
        const { data } = await supabase
          .from("brand_kits")
          .select("colors, fonts, voice, logo_url")
          .maybeSingle();
        if (cancelled) return;
        if (data?.colors) {
          const c = data.colors as Record<string, string>;
          setColors({
            bg: c.bg || DEFAULT_COLORS.bg,
            ink: c.ink || DEFAULT_COLORS.ink,
            accent: c.accent || DEFAULT_COLORS.accent,
            pop: c.pop || DEFAULT_COLORS.pop,
            highlight: c.highlight || DEFAULT_COLORS.highlight,
            cream: c.cream || DEFAULT_COLORS.cream,
          });
        }
        if (data?.fonts) {
          const f = data.fonts as { displayItalicUrl?: string };
          setFontUrl(f.displayItalicUrl || "");
        }
        setLogoUrl((data as any)?.logo_url || "");
        setBrandVoice((data as any)?.voice ?? null);
      } catch (err: any) {
        toast.error(err?.message || "Could not load brand kit");
      } finally {
        if (!cancelled) setKitLoading(false);
      }
    })();
    (async () => {
      setPhotosLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_assets")
          .select("id, original_url")
          .eq("kind", "photo")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = data || [];
        const paths = rows.map((r) => r.original_url as string);
        let signed: { signedUrl: string }[] = [];
        if (paths.length) {
          const { data: s } = await supabase.storage
            .from("ad-photos")
            .createSignedUrls(paths, 60 * 60);
          signed = (s || []) as { signedUrl: string }[];
        }
        if (cancelled) return;
        const next: Photo[] = rows.map((r, i) => ({
          id: r.id as string,
          path: r.original_url as string,
          url: signed[i]?.signedUrl || "",
        }));
        setPhotos(next);
        if (next[0]) setSelectedPhotoId(next[0].id);
      } catch (err: any) {
        toast.error(err?.message || "Could not load photos");
      } finally {
        if (!cancelled) setPhotosLoading(false);
      }
    })();
    (async () => {
      try {
        const { data, error } = await supabase
          .from("templates")
          .select("id, name, type, html, copy_slots, slide_slots, needs_photo, placements")
          .eq("status", "approved")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        setCustomTemplates(
          (data || []).map((r: any) => ({
            id: r.id,
            name: r.name || "Untitled",
            type: r.type === "carousel" ? "carousel" : "single",
            html: r.html || "",
            copy_slots: r.copy_slots || [],
            slide_slots: r.slide_slots || [],
            needs_photo: r.needs_photo ?? true,
            placements: Array.isArray(r.placements) ? r.placements : ["feed", "story"],
          })),
        );
      } catch {
        /* templates table may not be available; ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const compose = useCallback(async () => {
    const b = briefRef.current;
    if (!b) return;
    setComposing(true);
    setImages([]);
    try {
      const voicePayload = brandVoice && Object.keys(brandVoice).length > 0 ? brandVoice : {};

      // If a custom template is selected, prefill its slot keys so the user can edit
      // and the render button enables even if AI copy generation isn't slot-aware.
      if (activeCustom) {
        if (activeCustom.type === "carousel") {
          const slots: string[] = Array.isArray(activeCustom.slide_slots) ? activeCustom.slide_slots : [];
          const blankSlide: Slide = {};
          slots.forEach((k) => (blankSlide[k] = ""));
          setCarouselOptions([{ slides: [blankSlide] }]);
          setEditedSlides([blankSlide]);
          setSingleOptions([]);
          setEditedSingle({});
        } else {
          const slots: string[] = Array.isArray(activeCustom.copy_slots) ? activeCustom.copy_slots : [];
          const blank: SingleOption = {};
          slots.forEach((k) => (blank[k] = ""));
          setSingleOptions([blank]);
          setEditedSingle(blank);
          setCarouselOptions([]);
          setEditedSlides([]);
        }
        setSelectedOptionIdx(0);
        setEditingCopy(true);
        return;
      }

      const briefWithTemplate = { ...b, template };
      const { data, error } = await supabase.functions.invoke("compose-ad", {
        body: { brief: briefWithTemplate, brandVoice: voicePayload, count: 3 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const returnedTemplate: string =
        data?.template || mapStyleToTemplate(b.styleHint, b.format);
      setTemplate(returnedTemplate);
      const options: any[] = data?.options || [];
      if (returnedTemplate === "carousel" || b.format === "carousel") {
        const carOpts: CarouselOption[] = options.map((o) => ({
          slides: (o?.slides || []).map((sl: any) => ({ ...sl })),
        }));
        setCarouselOptions(carOpts);
        setSelectedOptionIdx(0);
        setEditedSlides(carOpts[0]?.slides || []);
        setSingleOptions([]);
      } else {
        // Pass through option fields as-is; the option's keys ARE the slots.
        const opts: SingleOption[] = options.map((o) => {
          const clean: SingleOption = {};
          for (const [k, v] of Object.entries(o || {})) {
            if (typeof v === "string") clean[k] = v;
          }
          return clean;
        });
        setSingleOptions(opts);
        setSelectedOptionIdx(0);
        setEditedSingle(opts[0] || {});
        setCarouselOptions([]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to write copy");
    } finally {
      setComposing(false);
    }
  }, [brandVoice, template, activeCustom]);

  // Auto-compose on open AND whenever the template selection changes
  useEffect(() => {
    if (open && brief && !kitLoading && !composing) {
      compose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brief, kitLoading, template, customTemplateId]);


  // Sync editor to currently selected option
  useEffect(() => {
    if (isCarousel) {
      setEditedSlides(carouselOptions[selectedOptionIdx]?.slides || []);
    } else if (singleOptions[selectedOptionIdx]) {
      setEditedSingle(singleOptions[selectedOptionIdx]);
    }
  }, [selectedOptionIdx, singleOptions, carouselOptions, isCarousel]);

  const isGeneratedConcept = brief?.imageSource === "generated";
  const selectedPhoto = useMemo(
    () => (isGeneratedConcept ? generatedPhoto : photos.find((p) => p.id === selectedPhotoId)),
    [isGeneratedConcept, generatedPhoto, photos, selectedPhotoId],
  );

  const callRender = async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("generate-ad", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.images || []) as RenderImage[];
  };

  const generate = async () => {
    if (!selectedPhoto) {
      toast.error("Pick a photo first");
      return;
    }
    setGenerating(true);
    setImages([]);
    setProgress("");
    try {
      const brandKit = { colors, fonts: { displayItalicUrl: fontUrl || undefined }, logoUrl: logoUrl || undefined };
      const photo = { url: selectedPhoto.url, removeBackground };

      const templateField = activeCustom
        ? {
            customTemplate: {
              html: activeCustom.html,
              type: activeCustom.type,
              copySlots: activeCustom.copy_slots,
              placements: activeCustom.placements,
              needsPhoto: activeCustom.needs_photo,
            },
          }
        : { template };

      if (isCarousel) {
        setProgress("Rendering carousel slides…");
        const slides = editedSlides;
        const imgs = await callRender({
          ...templateField,
          brandKit,
          copy: { slides },
          photo,
          placements: activeCustom?.placements ?? ["feed"],
        });
        const labelled = imgs.map((im, i) => ({ ...im, label: `Slide ${i + 1}` }));
        setImages(labelled);
        setProgress("");
        toast.success("Carousel rendered");
      } else {
        setProgress("Rendering feed + story…");
        const imgs = await callRender({
          ...templateField,
          brandKit,
          copy: editedSingle,
          photo,
          placements: activeCustom?.placements ?? ["feed", "story"],
        });
        setImages(imgs);
        setProgress("");
        toast.success("Ad rendered");
      }
    } catch (err: any) {
      toast.error(err?.message || "Generation failed");
      setProgress("");
    } finally {
      setGenerating(false);
    }
  };

  const download = (img: RenderImage, idx: number) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img.base64}`;
    a.download = `ad-${img.label?.replace(/\s+/g, "-").toLowerCase() || img.placement}-${idx + 1}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Generate this creative
          </DialogTitle>
          <DialogDescription>
            {brief?.concept || "Generate copy + render using your brand kit."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.1fr] gap-6 py-2">
            <div className="space-y-4">
              {brief && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase">{brief.format}</Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {activeCustom ? activeCustom.name : template}
                    </Badge>
                    {brief.styleHint && <Badge variant="outline" className="text-[10px]">{brief.styleHint}</Badge>}
                    {brief.angle && <Badge variant="outline" className="text-[10px]">{brief.angle}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground"><b>Key message:</b> {brief.keyMessage}</p>
                  {brief.offer && <p className="text-xs text-muted-foreground"><b>Offer:</b> {brief.offer}</p>}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">Template style</Label>
                <Select
                  value={activeCustom ? `custom:${activeCustom.id}` : `built:${template}`}
                  onValueChange={(v) => {
                    if (v.startsWith("custom:")) {
                      setCustomTemplateId(v.slice(7));
                    } else {
                      setCustomTemplateId("");
                      setTemplate(v.slice(6));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUILT_IN_TEMPLATES.map((t) => (
                      <SelectItem key={t} value={`built:${t}`}>{t} (built-in)</SelectItem>
                    ))}
                    {customTemplates.length > 0 && (
                      <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Custom</div>
                    )}
                    {customTemplates.map((ct) => (
                      <SelectItem key={ct.id} value={`custom:${ct.id}`}>{ct.name} · {ct.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {composing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin" /> Writing copy in your brand voice…
                </div>
              ) : !activeCustom && !isCarousel && singleOptions.length === 0 ? (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
                  <p>We couldn't write copy for this concept. Want to try again?</p>
                  <Button size="sm" variant="outline" onClick={compose}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry copy
                  </Button>
                </div>
              ) : !activeCustom && isCarousel && carouselOptions.length === 0 ? (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
                  <p>We couldn't write carousel copy for this concept. Want to try again?</p>
                  <Button size="sm" variant="outline" onClick={compose}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry copy
                  </Button>
                </div>
              ) : isCarousel ? (
                <CarouselEditor
                  options={carouselOptions}
                  selectedIdx={selectedOptionIdx}
                  setSelectedIdx={setSelectedOptionIdx}
                  slides={editedSlides}
                  setSlides={setEditedSlides}
                  editing={editingCopy}
                  setEditing={setEditingCopy}
                  onRegenerate={compose}
                />
              ) : (
                <SingleEditor
                  options={singleOptions}
                  selectedIdx={selectedOptionIdx}
                  setSelectedIdx={setSelectedOptionIdx}
                  edited={editedSingle}
                  setEdited={setEditedSingle}
                  editing={editingCopy}
                  setEditing={setEditingCopy}
                  onRegenerate={compose}
                />
              )}

              <div className="space-y-2">
                <Label className="text-xs">Photo</Label>
                {isGeneratedConcept ? (
                  generatingConcept ? (
                    <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Generating image…
                    </div>
                  ) : generatedPhoto ? (
                    <div className="space-y-2">
                      <div className="relative aspect-square rounded border-2 border-primary overflow-hidden max-w-[240px]">
                        <img src={generatedPhoto.url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <Button size="sm" variant="ghost" onClick={generateConceptImage} disabled={generatingConcept}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Regenerate image
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={generateConceptImage}>
                      <Sparkles className="h-3 w-3 mr-1" /> Generate image
                    </Button>
                  )
                ) : photosLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading your photos…
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-xs text-muted-foreground rounded border p-3 flex items-center gap-2">
                    <ImageOff className="h-4 w-4" />
                    Upload photos in My Photos first.
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {photos.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPhotoId(p.id)}
                        className={`relative aspect-square rounded border-2 overflow-hidden transition ${
                          selectedPhotoId === p.id ? "border-primary" : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {!isGeneratedConcept && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={removeBackground}
                      onChange={(e) => setRemoveBackground(e.target.checked)}
                    />
                    Remove background
                  </label>
                )}
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={generate}
                disabled={
                  generating || composing || !selectedPhoto ||
                  (isCarousel
                    ? !editedSlides.some((s) => (s?.headline || "").trim().length > 0)
                    : !((editedSingle.headline || "").trim() || (editedSingle.headlineHL || "").trim()))
                }
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {progress || "Generating…"}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />
                    {isCarousel ? `Render ${editedSlides.length || "carousel"} slides` : "Use this · render feed + story"}
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase text-muted-foreground">Results</Label>
              {generating && images.length === 0 && (
                <div className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  {progress || "Rendering…"}
                </div>
              )}
              {!generating && images.length === 0 && (
                <div className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Your renders will appear here.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="rounded border overflow-hidden bg-muted/20">
                    <img src={`data:image/png;base64,${img.base64}`} alt="" className="w-full h-auto block" />
                    <div className="flex items-center justify-between p-2 text-xs">
                      <span className="text-muted-foreground">
                        {img.label ? `${img.label} · ` : ""}{img.placement} {img.width}×{img.height}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => download(img, i)}>
                        <Download className="h-3 w-3 mr-1" /> PNG
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function labelFor(k: string) {
  return SLOT_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function SingleEditor({
  options, selectedIdx, setSelectedIdx, edited, setEdited, editing, setEditing, onRegenerate,
}: {
  options: SingleOption[];
  selectedIdx: number;
  setSelectedIdx: (i: number) => void;
  edited: SingleOption;
  setEdited: (c: SingleOption) => void;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onRegenerate: () => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No copy options yet.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">Copy options</Label>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onRegenerate}>
            <RefreshCw className="h-3 w-3 mr-1" /> Rewrite
          </Button>
          <Button size="sm" variant={editing ? "secondary" : "ghost"} onClick={() => setEditing(!editing)}>
            <Pencil className="h-3 w-3 mr-1" /> {editing ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      <Tabs value={String(selectedIdx)} onValueChange={(v) => setSelectedIdx(Number(v))}>
        <TabsList className="w-full">
          {options.map((_, i) => (
            <TabsTrigger key={i} value={String(i)} className="flex-1">Option {i + 1}</TabsTrigger>
          ))}
        </TabsList>
        {options.map((opt, i) => (
          <TabsContent key={i} value={String(i)} className="space-y-2 mt-2">
            {editing && i === selectedIdx ? (
              <div className="space-y-2">
                {Object.keys(opt).map((k) => (
                  <Field
                    key={k}
                    label={labelFor(k)}
                    v={edited[k] ?? ""}
                    onChange={(v) => setEdited({ ...edited, [k]: v })}
                    multiline={MULTILINE_KEYS.has(k)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded border p-3 space-y-1">
                {Object.entries(opt).map(([k, v]) =>
                  v ? (
                    <p key={k} className="text-sm">
                      <span className="text-[10px] uppercase text-muted-foreground mr-2">{labelFor(k)}</span>
                      {v}
                    </p>
                  ) : null,
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CarouselEditor({
  options, selectedIdx, setSelectedIdx, slides, setSlides, editing, setEditing, onRegenerate,
}: {
  options: CarouselOption[];
  selectedIdx: number;
  setSelectedIdx: (i: number) => void;
  slides: Slide[];
  setSlides: (s: Slide[]) => void;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onRegenerate: () => void;
}) {
  if (slides.length === 0) {
    return <p className="text-sm text-muted-foreground">No slides yet.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">{slides.length} slides</Label>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onRegenerate}>
            <RefreshCw className="h-3 w-3 mr-1" /> Rewrite
          </Button>
          <Button size="sm" variant={editing ? "secondary" : "ghost"} onClick={() => setEditing(!editing)}>
            <Pencil className="h-3 w-3 mr-1" /> {editing ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      {options.length > 1 && (
        <Tabs value={String(selectedIdx)} onValueChange={(v) => setSelectedIdx(Number(v))}>
          <TabsList className="w-full">
            {options.map((_, i) => (
              <TabsTrigger key={i} value={String(i)} className="flex-1">Option {i + 1}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="space-y-2">
        {slides.map((s, i) => {
          const keys = Object.keys(s);
          return (
            <div key={i} className="rounded border p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Slide {i + 1}</Badge>
                {!editing && s.eyebrow && (
                  <span className="text-[11px] uppercase text-muted-foreground">{s.eyebrow}</span>
                )}
              </div>
              {editing ? (
                <div className="space-y-2 pt-1">
                  {keys.map((k) => (
                    <Field
                      key={k}
                      label={labelFor(k)}
                      v={s[k] ?? ""}
                      onChange={(v) => {
                        const next = [...slides];
                        next[i] = { ...s, [k]: v };
                        setSlides(next);
                      }}
                      multiline={MULTILINE_KEYS.has(k)}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {s.headline && <p className="font-semibold">{s.headline}</p>}
                  {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
                  {s.cta && <p className="text-xs mt-1"><b>CTA:</b> {s.cta}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, v, onChange, multiline }: { label: string; v: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={v} onChange={(e) => onChange(e.target.value)} rows={2} />
      ) : (
        <Input value={v} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      )}
    </div>
  );
}
