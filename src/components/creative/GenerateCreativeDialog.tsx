import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HexColorPicker } from "react-colorful";
import { Loader2, Sparkles, Pencil, Download, Wand2, RefreshCw, ImageOff, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import type { CreativeBrief } from "./ProductionChecklistPanel";
import { TemplatePreview } from "./TemplatePreview";
import { CopyRegenerateDialog, type CopyFeedback } from "./CopyRegenerateDialog";
import cutoutThumb from "@/assets/template-thumbs/cutout.png.asset.json";
import spotlightThumb from "@/assets/template-thumbs/spotlight.png.asset.json";
import framedThumb from "@/assets/template-thumbs/framed.png.asset.json";
import splitThumb from "@/assets/template-thumbs/split.png.asset.json";
import highlighterThumb from "@/assets/template-thumbs/highlighter.png.asset.json";
import overlayThumb from "@/assets/template-thumbs/overlay.png.asset.json";

import devicemockupThumb from "@/assets/template-thumbs/devicemockup.png.asset.json";
import testimonialThumb from "@/assets/template-thumbs/testimonial.png.asset.json";
import carouselThumb from "@/assets/template-thumbs/carousel.png.asset.json";
import statgridThumb from "@/assets/template-thumbs/statgrid.png.asset.json";
import checklistThumb from "@/assets/template-thumbs/checklist.png.asset.json";
import chatproofThumb from "@/assets/template-thumbs/chatproof.png.asset.json";
import eventThumb from "@/assets/template-thumbs/event.png.asset.json";
import offerThumb from "@/assets/template-thumbs/offer.png.asset.json";
import bigtypeThumb from "@/assets/template-thumbs/bigtype.png.asset.json";
import collageThumb from "@/assets/template-thumbs/collage.png.asset.json";

const BUILT_IN_THUMBS: Record<string, string> = {
  cutout: cutoutThumb.url,
  spotlight: spotlightThumb.url,
  framed: framedThumb.url,
  split: splitThumb.url,
  highlighter: highlighterThumb.url,
  overlay: overlayThumb.url,
  devicemockup: devicemockupThumb.url,
  testimonial: testimonialThumb.url,
  carousel: carouselThumb.url,
  statgrid: statgridThumb.url,
  checklist: checklistThumb.url,
  chatproof: chatproofThumb.url,
  event: eventThumb.url,
  offer: offerThumb.url,
  bigtype: bigtypeThumb.url,
  collage: collageThumb.url,
};

type Colors = { bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string };
const DEFAULT_COLORS: Colors = {
  bg: "#ffffff", ink: "#111111", accent: "#3b82f6",
  pop: "#22c55e", highlight: "#f59e0b", cream: "#f5f5f5",
};

type SingleOption = Record<string, string>;
type Slide = Record<string, string>;
type CarouselOption = { slides: Slide[] };
type Photo = { id: string; path: string; url: string; source?: "upload" | "brand"; role?: string };
type BrandAssetRow = { id: string; url: string; role: string };
type LogoCorner = "tl" | "tr" | "bl" | "br";
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
  preview_url?: string;
};

const BUILT_IN_TEMPLATES = [
  "cutout", "spotlight", "framed", "split", "highlighter", "overlay", "imageonly", "devicemockup", "testimonial", "statgrid", "checklist", "chatproof", "event", "offer", "bigtype", "collage", "carousel",
] as const;

const BUILT_IN_LABELS: Record<string, string> = {
  cutout: "Photo cut-out",
  spotlight: "Spotlight card",
  framed: "Framed editorial",
  split: "Photo + headline",
  highlighter: "Bold highlighter",
  overlay: "Image + text",
  imageonly: "Image only",
  devicemockup: "Device mockup",
  testimonial: "Testimonial card",
  statgrid: "Stat grid",
  checklist: "Checklist",
  chatproof: "Chat proof",
  event: "Event / class",
  offer: "Sale / offer",
  bigtype: "Big type",
  collage: "Photo collage",
  carousel: "Carousel",
};

const PHOTO_TREATMENT: Record<string, "cutout" | "with-background"> = {
  cutout: "cutout", highlighter: "cutout",
  spotlight: "with-background", framed: "with-background", split: "with-background",
  overlay: "with-background", imageonly: "with-background",
  devicemockup: "with-background", testimonial: "with-background",
};

// The external rendering engine only ships with these built-in template names.
// New copy-only templates must fall back to a supported layout at render time
// (their richer slots collapse to eyebrow + headline + sub) so they don't error.
const ENGINE_SUPPORTED_TEMPLATES = new Set([
  "cutout", "spotlight", "framed", "split", "highlighter", "overlay",
  "imageonly", "devicemockup", "testimonial", "carousel",
]);
const RENDER_FALLBACK: Record<string, string> = {
  statgrid: "spotlight",
  checklist: "spotlight",
  chatproof: "testimonial",
  event: "spotlight",
  offer: "spotlight",
  bigtype: "spotlight",
  collage: "split",
};
const toEngineTemplate = (t: string) =>
  ENGINE_SUPPORTED_TEMPLATES.has(t) ? t : (RENDER_FALLBACK[t] || "spotlight");
// Collapse rich slots (stats, items, msgs, etc.) into the eyebrow/headline/sub
// shape the supported templates expect.
function collapseCopyForFallback(template: string, copy: any): any {
  if (!copy || ENGINE_SUPPORTED_TEMPLATES.has(template)) return copy;
  const out: any = { ...copy };
  const join = (arr: any[]) => arr.filter((x) => typeof x === "string" && x.trim()).join(" · ");
  if (template === "statgrid") {
    const stats = [1, 2, 3, 4]
      .map((i) => {
        const n = copy[`stat${i}Num`];
        const l = copy[`stat${i}Label`];
        return n ? `${n}${l ? ` ${l}` : ""}` : "";
      })
      .filter(Boolean);
    out.sub = out.sub || join(stats);
  } else if (template === "checklist") {
    const items = [1, 2, 3, 4, 5, 6].map((i) => copy[`item${i}`]).filter(Boolean);
    out.sub = out.sub || items.map((x: string) => `✓ ${x}`).join("  ");
  } else if (template === "chatproof") {
    const msgs = [1, 2, 3, 4].map((i) => copy[`msg${i}`]).filter(Boolean);
    out.sub = out.sub || msgs.map((m: string) => `“${m}”`).join("  ");
  } else if (template === "event") {
    out.sub = out.sub || join([copy.datetime, copy.location]);
  } else if (template === "offer") {
    out.eyebrow = out.eyebrow || copy.discount || copy.eyebrow;
    out.sub = out.sub || join([copy.terms, copy.cta]);
  } else if (template === "bigtype") {
    // headline already carries it; nothing else to collapse
  }
  return out;
}


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
  stat1Num: "Stat 1 number", stat1Label: "Stat 1 label",
  stat2Num: "Stat 2 number", stat2Label: "Stat 2 label",
  stat3Num: "Stat 3 number", stat3Label: "Stat 3 label",
  stat4Num: "Stat 4 number", stat4Label: "Stat 4 label",
  item1: "Item 1", item2: "Item 2", item3: "Item 3",
  item4: "Item 4", item5: "Item 5", item6: "Item 6",
  msg1: "Message 1", msg2: "Message 2", msg3: "Message 3", msg4: "Message 4",
  meta: "Date / time", host: "Host", offerBig: "Big offer", expiry: "Deadline",
  tickerTop: "Ticker (top)", tickerBottom: "Ticker (bottom)",
};
const MULTILINE_KEYS = new Set(["sub", "accent", "msg1", "msg2", "msg3", "msg4", "meta"]);

// Local fallback: mirror the compose-ad mapping so the UI can guess a template
function mapStyleToTemplate(styleHint?: string, format?: string): string {
  if (format === "carousel") return "carousel";
  const m: Record<string, string> = {
    "photo-forward": "cutout", card: "spotlight", framed: "framed",
    "type-led": "split", testimonial: "testimonial", highlighter: "highlighter",
    stats: "statgrid", data: "statgrid",
    checklist: "checklist", list: "checklist", steps: "checklist",
    chat: "chatproof", proof: "chatproof", testimonialchat: "chatproof",
    event: "event", webinar: "event",
    offer: "offer", sale: "offer", discount: "offer",
    bigtype: "bigtype", "type-hero": "bigtype",
    collage: "collage", grid: "collage",
  };
  return (styleHint && m[styleHint]) || "cutout";
}

export function GenerateCreativeDialog() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandsLoading } = useBrand();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<CreativeBrief | null>(null);
  const [itemId, setItemId] = useState<string>("");
  const [approvingIdx, setApprovingIdx] = useState<number | null>(null);
  const [approvedIdxs, setApprovedIdxs] = useState<Set<number>>(new Set());


  const [colors, setColors] = useState<Colors>(DEFAULT_COLORS);
  const [fontUrl, setFontUrl] = useState<string>("");
  const [displayFamily, setDisplayFamily] = useState<string>("");
  const [bodyFamily, setBodyFamily] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [brandVoice, setBrandVoice] = useState<any>(null);
  const [kitLoading, setKitLoading] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [brandPhotoAssets, setBrandPhotoAssets] = useState<Photo[]>([]);
  const [brandBackgroundAssets, setBrandBackgroundAssets] = useState<Photo[]>([]);
  const [brandLogoAsset, setBrandLogoAsset] = useState<Photo | null>(null);
  const [placeLogo, setPlaceLogo] = useState(false);
  const [logoCorner, setLogoCorner] = useState<LogoCorner>("br");
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>("");
  const [removeBackground, setRemoveBackground] = useState(true);
  const [textCase, setTextCase] = useState<"original" | "upper" | "lower" | "title">("original");
  const [headlineScale, setHeadlineScale] = useState<number>(1);
  const [bodyScale, setBodyScale] = useState<number>(1);

  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState<string>("cutout");

  // Two-step UX: pick a style, then provide image + copy.
  const [step, setStep] = useState<"style" | "image-copy">("style");
  const [imageSource, setImageSource] = useState<"uploads" | "brand">("uploads");

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

  // Copy feedback dialog
  const [feedbackOpen, setFeedbackOpen] = useState(false);


  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [customTemplateId, setCustomTemplateId] = useState<string>("");
  const activeCustom = useMemo(
    () => customTemplates.find((t) => t.id === customTemplateId) || null,
    [customTemplates, customTemplateId],
  );

  const isCarousel = activeCustom
    ? activeCustom.type === "carousel"
    : template === "carousel" || brief?.format === "carousel";
  const isImageOnly = !activeCustom && template === "imageonly";
  const needsPhoto = activeCustom ? activeCustom.needs_photo : true; // all built-ins need a photo

  const briefRef = useRef<CreativeBrief | null>(null);
  briefRef.current = brief;

  // Listen for handoff event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { brief?: CreativeBrief; itemId?: string };
      if (!detail?.brief) return;
      setItemId(detail.itemId || "");
      setApprovedIdxs(new Set());
      setBrief(detail.brief);

      setImageSource("uploads");
      setTemplate(mapStyleToTemplate(detail.brief.styleHint, detail.brief.format));
      setCustomTemplateId("");
      setStep("style");
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



  // Tie background removal to chosen template (cutout/highlighter only).
  useEffect(() => {
    const t = PHOTO_TREATMENT[template];
    setRemoveBackground(t === "cutout");
  }, [template]);

  // Load brand kit + photos on first open
  useEffect(() => {
    if (!open || brandsLoading) return;
    let cancelled = false;
    (async () => {
      setKitLoading(true);
      setColors(DEFAULT_COLORS);
      setFontUrl("");
      setDisplayFamily("");
      setBodyFamily("");
      setLogoUrl("");
      setBrandVoice(null);
      setPhotos([]);
      setBrandPhotoAssets([]);
      setBrandBackgroundAssets([]);
      setBrandLogoAsset(null);
      setSelectedPhotoId("");
      try {
        if (!activeBrand?.id) {
          toast.error("Choose a brand before generating creative.");
          setOpen(false);
          navigate("/style");
          return;
        }
        const { data } = await supabase
          .from("brand_kits")
          .select("colors, fonts, voice, logo_url, status")
          .eq("brand_id", activeBrand.id)
          .maybeSingle();
        if (cancelled) return;

        const c = (data?.colors || {}) as Record<string, string>;
        const f = (data?.fonts || {}) as { displayUrl?: string; displayItalicUrl?: string; displayFamily?: string; bodyFamily?: string };
        const hasAnyColor = !!(c.bg || c.ink || c.accent || c.pop || c.highlight || c.cream);
        const hasAnyFont = !!(f.displayFamily || f.bodyFamily || f.displayUrl || f.displayItalicUrl);

        if (!data || !hasAnyColor || !hasAnyFont) {
          toast.error("Pick your brand colors & fonts first — these go on every ad we generate.");
          setOpen(false);
          navigate("/style");
          return;
        }

        setColors({
          bg: c.bg || DEFAULT_COLORS.bg,
          ink: c.ink || DEFAULT_COLORS.ink,
          accent: c.accent || DEFAULT_COLORS.accent,
          pop: c.pop || DEFAULT_COLORS.pop,
          highlight: c.highlight || DEFAULT_COLORS.highlight,
          cream: c.cream || DEFAULT_COLORS.cream,
        });
        setFontUrl(f.displayUrl || f.displayItalicUrl || "");
        setDisplayFamily(f.displayFamily || "");
        setBodyFamily(f.bodyFamily || "");
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
          .from("user_assets" as any)
          .select("id, original_url")
          .eq("kind", "photo")
          .eq("brand_id", activeBrand.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data || []) as unknown as Array<{ id: string; original_url: string }>;
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
          .from("brand_assets" as any)
          .select("id, url, role, kept")
          .eq("brand_id", activeBrand.id)
          .eq("kept", true)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data || []) as unknown as Array<BrandAssetRow & { kept: boolean }>;
        const pathFromUrl = (u: string): string | null => {
          const m = u.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
          return m ? decodeURIComponent(m[1]) : null;
        };
        const paths = rows.map((r) => pathFromUrl(r.url)).filter(Boolean) as string[];
        let signed: { signedUrl: string }[] = [];
        if (paths.length) {
          const { data: s } = await supabase.storage
            .from("brand-assets")
            .createSignedUrls(paths, 60 * 60);
          signed = (s || []) as { signedUrl: string }[];
        }
        let i = 0;
        const resolved: Photo[] = rows.map((r) => {
          const hasPath = !!pathFromUrl(r.url);
          const url = hasPath ? signed[i++]?.signedUrl || r.url : r.url;
          return { id: `ba:${r.id}`, path: r.url, url, source: "brand", role: r.role };
        });
        if (cancelled) return;
        setBrandPhotoAssets(resolved.filter((a) => a.role === "photo"));
        setBrandBackgroundAssets(
          resolved.filter((a) => a.role === "background" || a.role === "texture"),
        );
        const logo = resolved.find((a) => a.role === "logo") || null;
        setBrandLogoAsset(logo);
      } catch {
        /* brand_assets table may not exist yet; ignore */
      }
    })();
    (async () => {
      try {
        const { data, error } = await supabase
          .from("templates")
          .select("id, name, type, html, copy_slots, slide_slots, needs_photo, placements, preview_url")
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
            preview_url: r.preview_url || undefined,
          })),
        );
      } catch {
        /* templates table may not be available; ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [open, activeBrand?.id, brandsLoading, navigate]);

  const compose = useCallback(async (feedback?: CopyFeedback | null) => {
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

      // Pull rich context so copy actually sounds like THIS brand for THIS offer.
      let offerContext: any = null;
      let offerPsychology: any = null;
      let audiencePsychology: any = null;
      let brandContext: any = null;
      try {
        if (activeBrand?.id) {
          const [{ data: brandRow }, { data: offerRows }] = await Promise.all([
            supabase
              .from("brands")
              .select("name, target_audience, value_proposition, audience_psychology, brand_voice, voice_profile")
              .eq("id", activeBrand.id)
              .maybeSingle(),
            supabase
              .from("offers")
              .select("id, name, page_goal, target_outcome, price_point, url, description, messaging_guidelines, offer_audience_psychology, product_psychology, created_at")
              .eq("brand_id", activeBrand.id)
              .order("created_at", { ascending: false }),
          ]);
          if (brandRow) {
            brandContext = {
              name: (brandRow as any).name,
              idealClient: (brandRow as any).target_audience || (brandRow as any).value_proposition,
              voiceNotes: (brandRow as any).voice_profile || (brandRow as any).brand_voice,
            };
            audiencePsychology = (brandRow as any).audience_psychology || null;
          }
          const offers = (offerRows || []) as any[];
          if (offers.length) {
            const briefOffer = String(b.offer || "").toLowerCase().trim();
            const match = briefOffer
              ? offers.find((o) =>
                  briefOffer.includes(String(o.name || "").toLowerCase()) ||
                  String(o.name || "").toLowerCase().includes(briefOffer),
                )
              : null;
            const chosen = match || offers[0];
            offerContext = {
              name: chosen.name,
              type: chosen.page_goal || chosen.target_outcome,
              price: chosen.price_point,
              url: chosen.url,
              description: chosen.description,
              messagingGuidelines: chosen.messaging_guidelines,
            };
            offerPsychology = chosen.offer_audience_psychology || chosen.product_psychology || null;
          }
        }
      } catch (ctxErr) {
        console.warn("compose-ad context fetch failed:", ctxErr);
      }

      const { data, error } = await supabase.functions.invoke("compose-ad", {
        body: {
          brief: briefWithTemplate,
          brandVoice: voicePayload,
          count: 3,
          feedback: feedback || null,
          offerContext,
          offerPsychology,
          audiencePsychology,
          brandContext,
        },
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

  // Auto-compose when we hit Screen 2, AND whenever the template selection changes.
  // Skip for imageonly (no copy needed) and while still on the style picker.
  useEffect(() => {
    if (!open || !brief || kitLoading || composing) return;
    if (step !== "image-copy") return;
    if (isImageOnly) return;
    compose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brief, kitLoading, step, template, customTemplateId]);


  // Sync editor to currently selected option
  useEffect(() => {
    if (isCarousel) {
      setEditedSlides(carouselOptions[selectedOptionIdx]?.slides || []);
    } else if (singleOptions[selectedOptionIdx]) {
      setEditedSingle(singleOptions[selectedOptionIdx]);
    }
  }, [selectedOptionIdx, singleOptions, carouselOptions, isCarousel]);

  // Build the photo picker list based on the active source + template.
  // - "uploads": user uploads only
  // - "brand": brand_assets (photos always; backgrounds/textures for overlay/imageonly)
  const pickerImages = useMemo<Photo[]>(() => {
    const allowsBackgrounds = template === "overlay" || template === "imageonly";
    if (imageSource === "uploads") {
      return photos.map((p) => ({ ...p, source: "upload" as const }));
    }
    if (imageSource === "brand") {
      return [
        ...brandPhotoAssets,
        ...(allowsBackgrounds ? brandBackgroundAssets : []),
      ];
    }
    return [];
  }, [imageSource, template, photos, brandPhotoAssets, brandBackgroundAssets]);

  const selectedPhoto = useMemo(
    () => pickerImages.find((p) => p.id === selectedPhotoId),
    [pickerImages, selectedPhotoId],
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
      const effectiveLogoUrl = (placeLogo && brandLogoAsset?.url) || logoUrl || undefined;
      // Force the CTA/button/primary swatches to the brand accent so the
      // engine can't fall back to a tinted/derived peach. We pass several
      // common slot names because the engine spec isn't published here.
      const colorsForEngine = {
        ...colors,
        primary: colors.accent,
        secondary: colors.pop,
        cta: colors.accent,
        ctaBg: colors.accent,
        ctaText: colors.bg,
        button: colors.accent,
        buttonBg: colors.accent,
        buttonText: colors.bg,
        badge: colors.accent,
        badgeBg: colors.accent,
        badgeText: colors.bg,
      };
      const brandKit = {
        colors: colorsForEngine,
        palette: colorsForEngine,
        fonts: {
          displayUrl: fontUrl || undefined,
          displayItalicUrl: fontUrl || undefined,
          displayFamily: displayFamily || undefined,
          bodyFamily: bodyFamily || undefined,
        },
        logoUrl: effectiveLogoUrl,
      };
      const logoOverlay = placeLogo && brandLogoAsset?.url
        ? { url: brandLogoAsset.url, corner: logoCorner }
        : undefined;
      const photo = { url: selectedPhoto.url, removeBackground };
      // Collage uses 2–4 photos. Take the most recently uploaded/brand photos.
      const collagePool = [...photos, ...brandPhotoAssets].filter((p) => !!p.url);
      const collagePhotos = template === "collage"
        ? Array.from(new Map(collagePool.map((p) => [p.url, p.url])).values()).slice(0, 4)
        : undefined;

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
        : { template: toEngineTemplate(template) };

      // Strip any stray HTML/markdown tags (e.g. <b>...</b>) from copy before rendering
      const stripTags = (s: any) =>
        typeof s === "string"
          ? s.replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/\s{2,}/g, " ").trim()
          : s;
      const applyCase = (s: string): string => {
        if (textCase === "upper") return s.toUpperCase();
        if (textCase === "lower") return s.toLowerCase();
        if (textCase === "title")
          return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
        return s;
      };
      const sanitizeCopy = (v: any): any => {
        if (typeof v === "string") return applyCase(stripTags(v));
        if (Array.isArray(v)) return v.map(sanitizeCopy);
        if (v && typeof v === "object") {
          const out: any = {};
          for (const k of Object.keys(v)) out[k] = sanitizeCopy(v[k]);
          return out;
        }
        return v;
      };

      const styleOverrides = {
        headlineScale,
        bodyScale,
        textCase: textCase === "original" ? undefined : textCase,
      };

      if (isCarousel) {
        setProgress("Rendering carousel slides…");
        const slides = sanitizeCopy(editedSlides);
        const imgs = await callRender({
          ...templateField,
          brandKit,
          copy: { slides },
          photo,
          logoOverlay,
          style: styleOverrides,
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
          copy: collapseCopyForFallback(template, sanitizeCopy(editedSingle)),
          photo,
          ...(collagePhotos && collagePhotos.length >= 2 ? { photos: collagePhotos } : {}),
          logoOverlay,
          style: styleOverrides,
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

  const approveRender = async (img: RenderImage, idx: number) => {
    if (!itemId) {
      toast.error("Open this from a creative card to approve it.");
      return;
    }
    setApprovingIdx(idx);
    try {
      const isVertical = (img.placement || "").toLowerCase().includes("story") || (img.height > img.width);
      await new Promise<void>((resolve, reject) => {
        const reqId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const onDone = (e: Event) => {
          const d = (e as CustomEvent).detail as { reqId: string; ok: boolean; error?: string };
          if (d?.reqId !== reqId) return;
          window.removeEventListener("creative-render:approved", onDone as EventListener);
          if (d.ok) resolve();
          else reject(new Error(d.error || "Could not save"));
        };
        window.addEventListener("creative-render:approved", onDone as EventListener);
        window.dispatchEvent(
          new CustomEvent("creative-render:approve", {
            detail: {
              reqId,
              itemId,
              base64: img.base64,
              mime: "image/png",
              fileName: `ad-${img.label?.replace(/\s+/g, "-").toLowerCase() || img.placement}-${idx + 1}.png`,
              isVertical,
            },
          }),
        );
        setTimeout(() => {
          window.removeEventListener("creative-render:approved", onDone as EventListener);
          reject(new Error("Timed out saving the render"));
        }, 30000);
      });
      setApprovedIdxs((prev) => new Set(prev).add(idx));
      toast.success("Approved and saved to your creative ✅");
    } catch (err: any) {
      toast.error(err?.message || "Could not approve");
    } finally {
      setApprovingIdx(null);
    }
  };



  // Style options for Screen 1.
  type StyleCard = {
    key: string;          // unique selection key
    label: string;
    thumb?: string;
    isCustom: boolean;
    customId?: string;
    builtIn?: string;
  };
  const styleCards: StyleCard[] = [
    ...BUILT_IN_TEMPLATES.map((t) => ({
      key: `built:${t}`,
      label: BUILT_IN_LABELS[t] || t,
      thumb: BUILT_IN_THUMBS[t],
      isCustom: false,
      builtIn: t,
    })),
    ...customTemplates.map((ct) => ({
      key: `custom:${ct.id}`,
      label: ct.name,
      thumb: ct.preview_url,
      isCustom: true,
      customId: ct.id,
    })),
  ];
  const activeStyleKey = activeCustom ? `custom:${activeCustom.id}` : `built:${template}`;
  const pickStyle = (card: StyleCard) => {
    if (card.isCustom && card.customId) {
      setCustomTemplateId(card.customId);
    } else if (card.builtIn) {
      setCustomTemplateId("");
      setTemplate(card.builtIn);
      if (card.builtIn === "carousel") {
        setBrief((b) => (b ? { ...b, format: "carousel" } : b));
      } else if (brief?.format === "carousel") {
        setBrief((b) => (b ? { ...b, format: "single_graphic" } : b));
      }
    }
  };

  const copyReady = isCarousel
    ? editedSlides.some((s) => (s?.headline || "").trim().length > 0)
    : !!((editedSingle.headline || "").trim() || (editedSingle.headlineHL || "").trim());

  const canRender =
    !generating && !composing &&
    (!needsPhoto || !!selectedPhoto) &&
    (isImageOnly || copyReady);

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Generate this creative (beta)
          </DialogTitle>
          <DialogDescription>
            {brief?.concept || "Generate copy + render using your brand kit."}
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>Brand kit:</span>
            <span className="font-medium text-foreground">{activeBrand?.name || "—"}</span>
            <div className="flex items-center gap-1">
              {(Object.keys(colors) as Array<keyof Colors>).map((k) => (
                <span
                  key={k}
                  title={`${k}: ${colors[k]}`}
                  className="h-3 w-3 rounded border border-border"
                  style={{ backgroundColor: colors[k] }}
                />
              ))}
            </div>
            <span className="ml-1 opacity-70">If this isn't right, switch brands in the sidebar.</span>
          </div>
        </DialogHeader>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Beta feature</p>
            <p className="text-muted-foreground text-xs">
              This generator is in beta — bugs are expected. If you run into one, please send us screenshots and bug reports!
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className={`px-2 py-1 rounded ${step === "style" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => setStep("style")}
          >
            1. Style
          </button>
          <span className="text-muted-foreground">→</span>
          <span
            className={`px-2 py-1 rounded ${step === "image-copy" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            2. Image &amp; copy
          </span>
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {brief && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 my-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] uppercase">{brief.format}</Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {activeCustom ? activeCustom.name : (BUILT_IN_LABELS[template] || template)}
                </Badge>
                {brief.styleHint && <Badge variant="outline" className="text-[10px]">{brief.styleHint}</Badge>}
                {brief.angle && <Badge variant="outline" className="text-[10px]">{brief.angle}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground"><b>Key message:</b> {brief.keyMessage}</p>
              {brief.offer && <p className="text-xs text-muted-foreground"><b>Offer:</b> {brief.offer}</p>}
            </div>
          )}

          {step === "style" ? (
            /* ---------- SCREEN 1: Choose a style ---------- */
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm font-medium">Choose a style</Label>
                <p className="text-xs text-muted-foreground">
                  Pick the layout for this ad. You can change it later.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {styleCards.map((card) => {
                  const active = card.key === activeStyleKey;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => pickStyle(card)}
                      className={`group relative rounded-lg border-2 overflow-hidden text-left transition ${
                        active ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                        {card.thumb ? (
                          <img
                            src={card.thumb}
                            alt={card.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : card.builtIn ? (
                          <TemplatePreview kind={card.builtIn} />
                        ) : (
                          <span className="text-[10px] uppercase text-muted-foreground">No preview</span>
                        )}
                      </div>
                      <div className="px-2 py-1.5 text-xs flex items-center justify-between gap-2">
                        <span className="truncate">{card.label}</span>
                        {card.isCustom && (
                          <Badge variant="outline" className="text-[9px] uppercase shrink-0">Custom</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button
                  size="lg"
                  onClick={() => setStep("image-copy")}
                  disabled={!activeStyleKey}
                >
                  Next →
                </Button>
              </div>
            </div>
          ) : (
            /* ---------- SCREEN 2: Image & copy ---------- */
            <div className="space-y-4 py-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("style")} className="-ml-2">
                ← Back to styles
              </Button>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.1fr] gap-6">
                <div className="space-y-5">
                  {/* Image source */}
                  {needsPhoto && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Image source</Label>
                      <Tabs
                        value={imageSource}
                        onValueChange={(v) => setImageSource(v as "uploads" | "brand")}
                      >
                        <TabsList className="w-full">
                          <TabsTrigger value="uploads" className="flex-1">Your uploads</TabsTrigger>
                          <TabsTrigger value="brand" className="flex-1">Brand library</TabsTrigger>
                        </TabsList>
                      </Tabs>

                      {photosLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                        </div>
                      ) : pickerImages.length === 0 ? (
                        <div className="text-xs text-muted-foreground rounded border p-3 flex items-center gap-2">
                          <ImageOff className="h-4 w-4" />
                          {imageSource === "uploads"
                            ? "No uploads yet — add photos in My Photos."
                            : "No brand images yet — pull images from your website in Style."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2 pt-1">
                          {pickerImages.slice(0, 20).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedPhotoId(p.id)}
                              className={`relative aspect-square rounded border-2 overflow-hidden transition ${
                                selectedPhotoId === p.id ? "border-primary" : "border-border hover:border-muted-foreground"
                              }`}
                              title={p.source === "brand" ? `Brand · ${p.role}` : "Upload"}
                            >
                              <img src={p.url} alt="" className="w-full h-full object-cover" />
                              {p.source === "brand" && (
                                <span className="absolute bottom-0 left-0 right-0 text-[9px] uppercase text-white bg-black/55 py-0.5 text-center leading-none">
                                  {p.role}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}


                      {brandLogoAsset && (
                        <div className="rounded border bg-muted/30 p-2 space-y-2 mt-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={placeLogo}
                              onChange={(e) => setPlaceLogo(e.target.checked)}
                            />
                            <img src={brandLogoAsset.url} alt="" className="h-5 w-5 object-contain rounded bg-background" />
                            Place logo small in a corner
                          </label>
                          {placeLogo && (
                            <Select value={logoCorner} onValueChange={(v) => setLogoCorner(v as LogoCorner)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tl">Top left</SelectItem>
                                <SelectItem value="tr">Top right</SelectItem>
                                <SelectItem value="bl">Bottom left</SelectItem>
                                <SelectItem value="br">Bottom right</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Copy */}
                  {!isImageOnly && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Copy</Label>
                      {composing ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                          <Loader2 className="h-4 w-4 animate-spin" /> Writing copy in your brand voice…
                        </div>
                      ) : !activeCustom && !isCarousel && singleOptions.length === 0 ? (
                        <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
                          <p>We couldn't write copy for this concept. Want to try again?</p>
                          <Button size="sm" variant="outline" onClick={() => compose()}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry copy
                          </Button>
                        </div>
                      ) : !activeCustom && isCarousel && carouselOptions.length === 0 ? (
                        <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
                          <p>We couldn't write carousel copy for this concept. Want to try again?</p>
                          <Button size="sm" variant="outline" onClick={() => compose()}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry copy
                          </Button>
                        </div>

                      ) : isCarousel ? (
                        <CarouselEditor
                          options={carouselOptions}
                          selectedIdx={selectedOptionIdx}
                          setSelectedIdx={setSelectedOptionIdx}
                          slides={editedSlides}
                          setSlides={(s) => {
                            setEditedSlides(s);
                            setCarouselOptions((prev) => {
                              const next = [...prev];
                              if (next[selectedOptionIdx]) {
                                next[selectedOptionIdx] = { ...next[selectedOptionIdx], slides: s };
                              }
                              return next;
                            });
                          }}
                          editing={editingCopy}
                          setEditing={setEditingCopy}
                          onRegenerate={() => setFeedbackOpen(true)}
                        />
                      ) : (
                        <SingleEditor
                          options={singleOptions}
                          selectedIdx={selectedOptionIdx}
                          setSelectedIdx={setSelectedOptionIdx}
                          edited={editedSingle}
                          setEdited={(c) => {
                            setEditedSingle(c);
                            setSingleOptions((prev) => {
                              const next = [...prev];
                              next[selectedOptionIdx] = c;
                              return next;
                            });
                          }}
                          editing={editingCopy}
                          setEditing={setEditingCopy}
                          onRegenerate={() => setFeedbackOpen(true)}
                        />
                      )}
                    </div>
                  )}

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={generate}
                    disabled={!canRender}
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
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs uppercase text-muted-foreground">Results</Label>
                    {itemId && images.length > 0 && approvedIdxs.size < images.length && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={approvingIdx !== null}
                        onClick={async () => {
                          for (let i = 0; i < images.length; i++) {
                            if (approvedIdxs.has(i)) continue;
                            await approveRender(images[i], i);
                          }
                        }}
                      >
                        {approvingIdx !== null ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Approving all…</>
                        ) : (
                          <>Approve all ({images.length - approvedIdxs.size})</>
                        )}
                      </Button>
                    )}
                  </div>
                  {images.length > 0 && !generating && (
                    <div className="rounded border bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium">Tweak &amp; re-render</p>
                          <p className="text-[11px] text-muted-foreground">Drag colors, resize text, switch case, then re-render.</p>
                        </div>
                        <Button size="sm" onClick={generate} disabled={generating || !canRender}>
                          {generating ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Rendering…</> : <><Sparkles className="h-3 w-3 mr-1" /> Re-render</>}
                        </Button>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Colors</p>
                        <div className="grid grid-cols-6 gap-2">
                          {(Object.keys(colors) as Array<keyof Colors>).map((k) => (
                            <Popover key={k}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="group flex flex-col items-center gap-1"
                                  aria-label={`Edit ${k} color`}
                                >
                                  <span
                                    className="h-9 w-full rounded-md border border-border shadow-sm transition group-hover:scale-[1.03]"
                                    style={{ backgroundColor: colors[k] }}
                                  />
                                  <span className="text-[10px] text-muted-foreground capitalize">{k}</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-3" align="start">
                                <HexColorPicker
                                  color={colors[k]}
                                  onChange={(v) => setColors((prev) => ({ ...prev, [k]: v }))}
                                />
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-[10px] uppercase text-muted-foreground capitalize">{k}</span>
                                  <Input
                                    value={colors[k]}
                                    onChange={(e) => setColors((prev) => ({ ...prev, [k]: e.target.value }))}
                                    className="h-7 text-xs font-mono"
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Text case</p>
                        <ToggleGroup
                          type="single"
                          size="sm"
                          value={textCase}
                          onValueChange={(v) => v && setTextCase(v as typeof textCase)}
                          className="justify-start"
                        >
                          <ToggleGroupItem value="original" className="text-xs">Original</ToggleGroupItem>
                          <ToggleGroupItem value="upper" className="text-xs">UPPER</ToggleGroupItem>
                          <ToggleGroupItem value="lower" className="text-xs">lower</ToggleGroupItem>
                          <ToggleGroupItem value="title" className="text-xs">Title</ToggleGroupItem>
                        </ToggleGroup>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Headline size</p>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(headlineScale * 100)}%</span>
                          </div>
                          <Slider
                            min={0.6}
                            max={1.6}
                            step={0.05}
                            value={[headlineScale]}
                            onValueChange={(v) => setHeadlineScale(v[0])}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Body size</p>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(bodyScale * 100)}%</span>
                          </div>
                          <Slider
                            min={0.6}
                            max={1.6}
                            step={0.05}
                            value={[bodyScale]}
                            onValueChange={(v) => setBodyScale(v[0])}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">
                            {removeBackground ? "Background removed" : "Original background"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {removeBackground ? "We'll cut your subject out." : "Keep the photo as-is."}
                          </p>
                        </div>
                        <Switch checked={removeBackground} onCheckedChange={setRemoveBackground} />
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          onClick={() => {
                            setTextCase("original");
                            setHeadlineScale(1);
                            setBodyScale(1);
                          }}
                        >
                          Reset tweaks
                        </button>
                        <span className="text-[10px] text-muted-foreground">Changes apply on re-render</span>
                      </div>
                    </div>
                  )}

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
                    {images.map((img, i) => {
                      const isApproved = approvedIdxs.has(i);
                      const isApproving = approvingIdx === i;
                      return (
                        <div key={i} className="rounded border overflow-hidden bg-muted/20">
                          <img src={`data:image/png;base64,${img.base64}`} alt="" className="w-full h-auto block" />
                          <div className="flex items-center justify-between gap-2 p-2 text-xs">
                            <span className="text-muted-foreground truncate">
                              {img.label ? `${img.label} · ` : ""}{img.placement} {img.width}×{img.height}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => download(img, i)}>
                                <Download className="h-3 w-3 mr-1" /> PNG
                              </Button>
                              {itemId && (
                                <Button
                                  size="sm"
                                  variant={isApproved ? "secondary" : "default"}
                                  onClick={() => approveRender(img, i)}
                                  disabled={isApproving || isApproved}
                                >
                                  {isApproving ? (
                                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…</>
                                  ) : isApproved ? (
                                    "Approved ✓"
                                  ) : (
                                    "Approve & save"
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <CopyRegenerateDialog
      open={feedbackOpen}
      onOpenChange={setFeedbackOpen}
      isGenerating={composing}
      onRegenerate={(fb) => { setFeedbackOpen(false); compose(fb); }}
      onSkip={() => { setFeedbackOpen(false); compose(); }}
      title="Refine this copy"
      description="Tell Lumi what to change and we'll rewrite the options."
    />
    </>
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
                {Object.entries(i === selectedIdx ? { ...opt, ...edited } : opt).map(([k, v]) =>
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
