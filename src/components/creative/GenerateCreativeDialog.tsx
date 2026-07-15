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
import { Loader2, Sparkles, Pencil, Download, Wand2, RefreshCw, ImageOff, Info, ImagePlus, Star, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CreativeBrief } from "./ProductionChecklistPanel";
import { TemplatePreview } from "./TemplatePreview";
import { CopyRegenerateDialog, type CopyFeedback } from "./CopyRegenerateDialog";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
// Real engine renders with clean sample copy — replaced the old AI-generated
// mockup images, which rendered garbled/unreadable placeholder text (a known
// limitation of image models asked to draw text) instead of a real preview.
import spotlightThumb from "@/assets/template-thumbs/spotlight.jpg";
import framedThumb from "@/assets/template-thumbs/framed.jpg";
import splitThumb from "@/assets/template-thumbs/split.jpg";
import overlayThumb from "@/assets/template-thumbs/overlay.jpg";
import devicemockupThumb from "@/assets/template-thumbs/devicemockup.jpg";
import testimonialThumb from "@/assets/template-thumbs/testimonial.jpg";
import carouselThumb from "@/assets/template-thumbs/carousel.jpg";
import statgridThumb from "@/assets/template-thumbs/statgrid.jpg";
import checklistThumb from "@/assets/template-thumbs/checklist.jpg";
import chatproofThumb from "@/assets/template-thumbs/chatproof.jpg";
import eventThumb from "@/assets/template-thumbs/event.jpg";
import offerThumb from "@/assets/template-thumbs/offer.jpg";
import bigtypeThumb from "@/assets/template-thumbs/bigtype.jpg";
import collageThumb from "@/assets/template-thumbs/collage.jpg";
import notesappThumb from "@/assets/template-thumbs/notesapp.jpg";
import textthreadThumb from "@/assets/template-thumbs/textthread.jpg";
import nativecaptionThumb from "@/assets/template-thumbs/nativecaption.jpg";

const BUILT_IN_THUMBS: Record<string, string> = {
  spotlight: spotlightThumb,
  framed: framedThumb,
  split: splitThumb,
  overlay: overlayThumb,
  devicemockup: devicemockupThumb,
  testimonial: testimonialThumb,
  carousel: carouselThumb,
  statgrid: statgridThumb,
  checklist: checklistThumb,
  chatproof: chatproofThumb,
  event: eventThumb,
  offer: offerThumb,
  bigtype: bigtypeThumb,
  collage: collageThumb,
  notesapp: notesappThumb,
  textthread: textthreadThumb,
  nativecaption: nativecaptionThumb,
};

type Colors = { bg: string; ink: string; accent: string; pop: string; highlight: string; cream: string };
const DEFAULT_COLORS: Colors = {
  bg: "#ffffff", ink: "#111111", accent: "#3b82f6",
  pop: "#22c55e", highlight: "#f59e0b", cream: "#f5f5f5",
};

type SingleOption = Record<string, string>;
type Slide = Record<string, string>;
type CarouselOption = { slides: Slide[] };
type Photo = { id: string; path: string; url: string; source?: "upload" | "brand"; role?: string; isDefault?: boolean };
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
  "spotlight", "framed", "split", "overlay", "devicemockup", "testimonial", "statgrid", "checklist", "chatproof", "event", "offer", "bigtype", "collage", "carousel",
  "notesapp", "textthread", "nativecaption", "nativestroke", "nativebubbles",
] as const;

const BUILT_IN_LABELS: Record<string, string> = {
  spotlight: "Spotlight card",
  framed: "Framed editorial",
  split: "Photo + headline",
  overlay: "Image + text",
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
  notesapp: "Notes app (native)",
  textthread: "Text thread (native)",
  nativecaption: "Photo caption (native)",
  nativestroke: "Bold caption (native)",
  nativebubbles: "Caption bubbles (native)",
};

const PHOTO_TREATMENT: Record<string, "cutout" | "with-background"> = {
  spotlight: "with-background", framed: "with-background", split: "with-background",
  overlay: "with-background",
  devicemockup: "with-background", testimonial: "with-background",
  nativecaption: "with-background", nativestroke: "with-background", nativebubbles: "with-background",
};

// Templates that never render a photo — the copy carries the whole design.
// Used to gate the "pick a photo" requirement per-template instead of forcing
// every built-in template through a photo picker it doesn't actually use.
const NO_PHOTO_TEMPLATES = new Set([
  "testimonial", "statgrid", "checklist", "chatproof", "event", "offer", "bigtype",
  "notesapp", "textthread",
]);

// The external rendering engine only ships with these built-in template names.
// New copy-only templates must fall back to a supported layout at render time
// (their richer slots collapse to eyebrow + headline + sub) so they don't error.
const ENGINE_SUPPORTED_TEMPLATES = new Set([
  "spotlight", "framed", "split", "overlay",
  "devicemockup", "testimonial", "carousel",
  // Rich text-led formats — now render natively (require the 16-template engine
  // build to be deployed). Adding them here stops the collapse: toEngineTemplate()
  // and collapseCopyForFallback() both pass a template through untouched when it's
  // in this set, so the real layout + full copy slots go straight to the engine.
  "statgrid", "checklist", "chatproof", "event", "offer", "bigtype", "collage",
  // Native phone-screenshot formats (require the lumi-engine native-templates
  // build to be deployed).
  "notesapp", "textthread", "nativecaption", "nativestroke", "nativebubbles",
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
  body: "Note text", contactName: "Contact name", contactLoc: "Contact location",
  line1: "Line 1", line2: "Line 2",
  bubble1: "Bubble 1", bubble2: "Bubble 2", bubble3: "Bubble 3",
};
const MULTILINE_KEYS = new Set(["sub", "accent", "msg1", "msg2", "msg3", "msg4", "meta", "body", "line1", "line2", "bubble1", "bubble2", "bubble3"]);

// Local fallback: mirror the compose-ad mapping so the UI can guess a template
function mapStyleToTemplate(styleHint?: string, format?: string): string {
  if (format === "carousel") return "carousel";
  const m: Record<string, string> = {
    "photo-forward": "spotlight", card: "spotlight", framed: "framed",
    "type-led": "split", testimonial: "testimonial",
    stats: "statgrid", data: "statgrid",
    checklist: "checklist", list: "checklist", steps: "checklist",
    chat: "chatproof", proof: "chatproof", testimonialchat: "chatproof",
    event: "event", webinar: "event",
    offer: "offer", sale: "offer", discount: "offer",
    bigtype: "bigtype", "type-hero": "bigtype",
    collage: "collage", grid: "collage",
    overlay: "overlay",
    device: "devicemockup", devicemockup: "devicemockup", mockup: "devicemockup",
    notesapp: "notesapp", notes: "notesapp",
    textthread: "textthread", texts: "textthread", imessage: "textthread",
    nativecaption: "nativecaption", caption: "nativecaption",
    nativestroke: "nativestroke", stroke: "nativestroke", strokecaption: "nativestroke",
    nativebubbles: "nativebubbles", bubbles: "nativebubbles", captionbubbles: "nativebubbles",
  };
  return (styleHint && m[styleHint]) || "bigtype";
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
  // Beta: AI-generated brand background composited behind the layout.
  const [bgBetaOpen, setBgBetaOpen] = useState(false);
  const [bgGenerating, setBgGenerating] = useState(false);
  const [bgOptions, setBgOptions] = useState<Array<{ aspect: string; url: string; path: string }>>([]);
  const [bgSelectedUrl, setBgSelectedUrl] = useState<string>("");
  const [textCase, setTextCase] = useState<"original" | "upper" | "lower" | "title">("original");
  const [headlineScale, setHeadlineScale] = useState<number>(1);
  const [bodyScale, setBodyScale] = useState<number>(1);
  // Readability controls for templates that put text directly on a photo
  // with no card behind it (currently just nativecaption) — the template's
  // own white text + shadow isn't always enough contrast against every photo.
  const [textColor, setTextColor] = useState<"auto" | "light" | "dark">("auto");
  const [textBackdrop, setTextBackdrop] = useState(false);

  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState<string>("bigtype");

  // Two-step UX: pick a style, then provide image + copy.
  const [step, setStep] = useState<"style" | "image-copy">("style");
  const [imageSource, setImageSource] = useState<"uploads" | "brand">("uploads");

  // Primary flow: remix a single real ad. Falls back to the template flow.
  const [mode, setMode] = useState<"remix" | "template">("remix");
  const [tourOpen, setTourOpen] = useState(false);

  type BoardRow = { id: string; name: string };
  type BoardImg = { id: string; url: string; rawSrc: string };
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [boardImages, setBoardImages] = useState<BoardImg[]>([]);
  const [boardImagesLoading, setBoardImagesLoading] = useState(false);
  const [selectedRemixImageId, setSelectedRemixImageId] = useState<string>("");
  const [analyzingReference, setAnalyzingReference] = useState(false);
  type ReferenceAnalysis = {
    template: string;
    needs_photo: boolean;
    font_personality: string;
    font_is_load_bearing: boolean;
    template_reason: string;
    structural_notes: string;
  };
  const [referenceAnalysis, setReferenceAnalysis] = useState<ReferenceAnalysis | null>(null);

  // single-template state
  const [singleOptions, setSingleOptions] = useState<SingleOption[]>([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0);
  const [editedSingle, setEditedSingle] = useState<SingleOption>({});
  const [editingCopy, setEditingCopy] = useState(false);

  // carousel state
  const [carouselOptions, setCarouselOptions] = useState<CarouselOption[]>([]);
  const [editedSlides, setEditedSlides] = useState<Slide[]>([]);
  // Number of slides the user wants in a carousel. Default 5, clamped 3-10.
  // Applied to both AI-generated carousels (sent to compose-ad) and blank
  // custom-template carousels. Also used to pad/trim AI responses so we
  // never render just slide 0.
  const [slideCount, setSlideCount] = useState<number>(5);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [images, setImages] = useState<RenderImage[]>([]);

  // "Show me what to do" tour steps for whichever internal screen is
  // currently showing.
  const dialogTourSteps: TourStep[] = (() => {
    if (mode === "remix") {
      return [{
        targetSelector: '[data-help-target="remix-this-ad"]',
        title: "Remix a real ad",
        description: "Pick a board, then click an image to select it — the button at the bottom lights up once you have. Lumi matches the layout and rewrites the copy for your offer.",
      }];
    }
    if (step === "style") {
      return [{
        targetSelector: '[data-help-target="style-next"]',
        title: "Choose a style",
        description: "Click any template to select it — you can change it later. Once you've picked one, hit Next to move on to the photo and copy.",
      }];
    }
    if (images.length === 0) {
      return [{
        targetSelector: '[data-help-target="render-creative"]',
        title: "Image & copy",
        description: "Pick a photo, tweak the copy if you want, then render — that's the button at the bottom.",
      }];
    }
    return [{
      targetSelector: '[data-help-target="approve-creative"]',
      title: "Image & copy",
      description: "Renders are ready. Approve them below to save this creative — that closes this dialog for you.",
    }];
  })();

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
  const needsPhoto = activeCustom ? activeCustom.needs_photo : !NO_PHOTO_TEMPLATES.has(template);

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
      setMode("remix");
      setSelectedRemixImageId("");
      setReferenceAnalysis(null);
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



  // Tie background removal to the chosen template's declared treatment.
  // No remaining built-in template uses "cutout" treatment (the two that
  // did — Photo cut-out and Bold highlighter — were removed for reliability),
  // so this now always resolves to false, which is correct: every remaining
  // photo template wants the full photo, not a background-removed cutout.
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
          .select("id, original_url, cutout_url, is_default")
          .eq("kind", "photo")
          .eq("brand_id", activeBrand.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data || []) as unknown as Array<{ id: string; original_url: string; cutout_url: string | null; is_default: boolean | null }>;
        // Prefer the background-removed cutout when available so headshots
        // composite cleanly inside the template's avatar/circle slot.
        const paths = rows.map((r) => r.cutout_url || r.original_url);
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
          path: r.cutout_url || r.original_url,
          url: signed[i]?.signedUrl || "",
          isDefault: !!r.is_default,
        }));
        setPhotos(next);
        const defaultPhoto = next.find((p) => p.isDefault);
        if (defaultPhoto) setSelectedPhotoId(defaultPhoto.id);
        else if (next[0]) setSelectedPhotoId(next[0].id);
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
    // Load the user's boards for the inspiration flow.
    (async () => {
      setBoardsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("boards")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        const list = (data || []) as BoardRow[];
        setBoards(list);
        setSelectedBoardId((prev) => prev || list[0]?.id || "");
      } catch (e: any) {
        if (!cancelled) console.warn("load boards failed", e);
      } finally {
        if (!cancelled) setBoardsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, activeBrand?.id, brandsLoading, navigate]);

  // Load images for the currently selected board.
  useEffect(() => {
    if (!open || !selectedBoardId) {
      setBoardImages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setBoardImagesLoading(true);
      try {
        const { data, error } = await supabase
          .from("board_items")
          .select("id, uploaded_image_url, inspiration_items(image_url)")
          .eq("board_id", selectedBoardId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const resolved: BoardImg[] = [];
        for (const it of (data || []) as any[]) {
          const raw = (it.uploaded_image_url as string | null) ||
            (it.inspiration_items?.image_url as string | null) || null;
          if (!raw) continue;
          let url = raw;
          if (!raw.startsWith("http")) {
            const { data: s } = await supabase.storage
              .from("inspiration")
              .createSignedUrl(raw, 60 * 60);
            url = s?.signedUrl || "";
          }
          if (url) resolved.push({ id: it.id as string, url, rawSrc: raw });
        }
        if (cancelled) return;
        setBoardImages(resolved);
        setSelectedRemixImageId("");
        setReferenceAnalysis(null);
      } catch (e: any) {
        if (!cancelled) {
          console.warn("load board images failed", e);
          setBoardImages([]);
        }
      } finally {
        if (!cancelled) setBoardImagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, selectedBoardId]);

  // Analyze the one chosen reference ad, then hand off into the normal
  // template flow with the matched template pre-selected. The existing
  // auto-compose effect (keyed on step + template) picks up from there.
  const runAnalyzeReference = async () => {
    const img = boardImages.find((b) => b.id === selectedRemixImageId);
    if (!img) {
      toast.error("Pick an ad to remix first.");
      return;
    }
    setAnalyzingReference(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-reference-ad", {
        body: { reference_image_url: img.url },
      });
      if (error) throw error;
      const analysis = data?.analysis as ReferenceAnalysis | undefined;
      if (!analysis?.template) throw new Error(data?.error || "Could not analyze this ad");
      setReferenceAnalysis(analysis);
      setTemplate(analysis.template);
      setCustomTemplateId("");
      setMode("template");
      setStep("image-copy");
      toast.success(`Matched to ${BUILT_IN_LABELS[analysis.template] || analysis.template} — writing copy…`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not analyze this ad");
    } finally {
      setAnalyzingReference(false);
    }
  };

  const runBrandBackground = async () => {
    if (!activeBrand?.id) {
      toast.error("Pick a brand first.");
      return;
    }
    setBgGenerating(true);
    setBgOptions([]);
    setBgSelectedUrl("");
    try {
      const headline = isCarousel ? editedSlides[0]?.headline : editedSingle.headline;
      const subhead = isCarousel ? editedSlides[0]?.sub : (editedSingle.sub || editedSingle.subhead);
      const { data, error } = await supabase.functions.invoke("generate-ad-from-style", {
        body: {
          mode: "brand_background",
          brandId: activeBrand.id,
          copy: { headline, subhead },
          count: 3,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Background generation failed");
      const imgs = (data.images || []) as Array<{ aspect: string; url: string; path: string }>;
      const usedBrandAssets = !!data.used_brand_assets;
      setBgOptions(imgs);
      if (imgs[0]) setBgSelectedUrl(imgs[0].url);
      if (!imgs.length) toast.error("No backgrounds available.");
      else if (usedBrandAssets) toast.success(`Using ${imgs.length} approved brand backgrounds (no AI generation — zero gibberish-text risk).`);
      else toast.success(`Generated ${imgs.length} brand backgrounds`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not generate background");
    } finally {
      setBgGenerating(false);
    }
  };

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
          const makeBlank = (): Slide => {
            const s: Slide = {};
            slots.forEach((k) => (s[k] = ""));
            return s;
          };
          const n = Math.max(1, slideCount || 1);
          const blankSlides: Slide[] = Array.from({ length: n }, makeBlank);
          setCarouselOptions([{ slides: blankSlides }]);
          setEditedSlides(blankSlides);
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
            // Prefer an exact id match (stamped server-side by
            // generate-creative-grid) over fuzzy name matching, which
            // silently picked the wrong offer whenever the brief's
            // free-text `offer` field didn't happen to overlap with a
            // saved offer's name.
            const byId = (b as any).offerId
              ? offers.find((o) => o.id === (b as any).offerId)
              : null;
            const briefOffer = String(b.offer || "").toLowerCase().trim();
            const byName = !byId && briefOffer
              ? offers.find((o) =>
                  briefOffer.includes(String(o.name || "").toLowerCase()) ||
                  String(o.name || "").toLowerCase().includes(briefOffer),
                )
              : null;
            // Only fall back to "the one offer" when it's genuinely
            // unambiguous (exactly one saved offer) — guessing among
            // several is how the wrong offer's price/description/messaging
            // ended up in someone else's ad copy.
            const chosen = byId || byName || (offers.length === 1 ? offers[0] : null);
            if (chosen) {
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
        }
      } catch (ctxErr) {
        console.warn("compose-ad context fetch failed:", ctxErr);
      }

      const { data, error } = await supabase.functions.invoke("compose-ad", {
        body: {
          brief: briefWithTemplate,
          brandVoice: voicePayload,
          count: 3,
          slideCount,
          feedback: feedback || null,
          offerContext,
          offerPsychology,
          audiencePsychology,
          brandContext,
          referenceAdContext: referenceAnalysis
            ? {
                structuralNotes: referenceAnalysis.structural_notes,
                fontPersonality: referenceAnalysis.font_personality,
              }
            : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const returnedTemplate: string =
        data?.template || mapStyleToTemplate(b.styleHint, b.format);
      setTemplate(returnedTemplate);
      const options: any[] = data?.options || [];
      if (returnedTemplate === "carousel" || b.format === "carousel") {
        // Ensure every option has exactly `slideCount` slides. The model
        // often ignores the requested count and returns just 1 — pad with
        // blank slides so the user can fill them in rather than shipping
        // a "carousel" that's only slide 0.
        const targetN = Math.max(1, slideCount || 1);
        const carOpts: CarouselOption[] = options.map((o) => {
          const raw = Array.isArray(o?.slides) ? o.slides : [];
          const cleaned: Slide[] = raw.map((sl: any) => ({ ...(sl || {}) }));
          if (cleaned.length > targetN) cleaned.length = targetN;
          while (cleaned.length < targetN) {
            const template: Slide = cleaned[0]
              ? Object.fromEntries(Object.keys(cleaned[0]).map((k) => [k, ""]))
              : { headline: "", sub: "", cta: "" };
            cleaned.push(template);
          }
          return { slides: cleaned };
        });
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
  }, [brandVoice, template, activeCustom, referenceAnalysis]);

  // Auto-compose when we hit Screen 2, AND whenever the template selection changes.
  // Skip while still on the style picker.
  useEffect(() => {
    if (!open || !brief || kitLoading || composing) return;
    if (step !== "image-copy") return;
    if (mode !== "template") return;
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
  // - "brand": brand_assets (photos always; backgrounds/textures for overlay)
  const pickerImages = useMemo<Photo[]>(() => {
    const allowsBackgrounds = template === "overlay";
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

  const setDefaultPhoto = async (photoId: string) => {
    const brandId = activeBrand?.id;
    if (!brandId) return;
    try {
      await supabase.from("user_assets" as any).update({ is_default: false }).eq("brand_id", brandId).eq("is_default", true);
      const { error } = await supabase.from("user_assets" as any).update({ is_default: true }).eq("id", photoId);
      if (error) throw error;
      setPhotos((prev) => prev.map((p) => ({ ...p, isDefault: p.id === photoId })));
      setSelectedPhotoId(photoId);
      toast.success("Set as your default photo");
    } catch (err: any) {
      toast.error(err?.message || "Could not set default photo");
    }
  };

  const callRender = async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("generate-ad", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data?.images || []) as RenderImage[];
  };

  const generate = async () => {
    if (needsPhoto && !selectedPhoto) {
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
      const photo = selectedPhoto ? { url: selectedPhoto.url, removeBackground } : undefined;
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
        textColor: textColor === "auto" ? undefined : textColor,
        textBackdrop: textBackdrop || undefined,
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
          ...(bgSelectedUrl ? { backgroundUrl: bgSelectedUrl } : {}),
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
          ...(bgSelectedUrl ? { backgroundUrl: bgSelectedUrl } : {}),
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

  const approveRender = async (img: RenderImage, idx: number): Promise<boolean> => {
    if (!itemId) {
      toast.error("Open this from a creative card to approve it.");
      return false;
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
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Could not approve");
      return false;
    } finally {
      setApprovingIdx(null);
    }
  };

  // Single combined approval for the whole feed+story set — replaces the old
  // pairing of a per-image "Approve & save" button plus a separate batch
  // button stranded above the results grid. Auto-closes the dialog only on
  // full success so a partial failure stays visible for the user to retry.
  const approveAllAndClose = async () => {
    const targets = images.map((_, i) => i).filter((i) => !approvedIdxs.has(i));
    let allSucceeded = true;
    for (const i of targets) {
      const ok = await approveRender(images[i], i);
      if (!ok) allSucceeded = false;
    }
    if (allSucceeded) {
      setTimeout(() => setOpen(false), 600);
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
      // textColor/textBackdrop only have a UI control on nativecaption (its
      // card can go light/dark or backdrop-on/off). Reset them when leaving
      // it so a stale "dark" choice doesn't silently follow onto a template
      // with a fixed design — e.g. nativestroke's black stroke outline would
      // read as near-invisible if it inherited dark-text on top of it.
      if (card.builtIn !== "nativecaption") {
        setTextColor("auto");
        setTextBackdrop(false);
      }
      if (card.builtIn === "carousel") {
        setBrief((b) => (b ? { ...b, format: "carousel" } : b));
      } else if (brief?.format === "carousel") {
        setBrief((b) => (b ? { ...b, format: "single_graphic" } : b));
      }
    }
  };

  // Template-agnostic: checks whether ANY slot has real content, rather than
  // hardcoding "headline"/"headlineHL" — those don't exist on every template
  // (e.g. notesapp uses "body", textthread uses "msg1", nativecaption uses
  // "line1"/"line2"), so the old hardcoded check silently kept the render
  // button disabled for any template without those exact two field names.
  const hasAnyText = (o: Record<string, unknown> | undefined | null) =>
    !!o && Object.values(o).some((v) => typeof v === "string" && v.trim().length > 0);
  const copyReady = isCarousel
    ? editedSlides.some((s) => hasAnyText(s))
    : hasAnyText(editedSingle);

  const canRender =
    !generating && !composing &&
    (!needsPhoto || !!selectedPhoto) &&
    copyReady;

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

        {/* Mode toggle + step indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-primary text-primary-foreground">
              {mode === "remix" ? "Remix a real ad" : (step === "style" ? "1. Style" : "2. Image & copy")}
            </span>
            {mode === "template" && (
              <>
                <span className="text-muted-foreground">→</span>
                <span
                  className={`px-2 py-1 rounded ${step === "image-copy" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  2. Image &amp; copy
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative overflow-hidden flex items-center gap-1 text-[11px] font-medium text-white bg-gradient-lumi rounded-full px-2.5 py-1 shadow-lumi hover:shadow-glow transition-shadow disabled:opacity-50 disabled:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer"
              onClick={() => setTourOpen(true)}
              disabled={dialogTourSteps.length === 0}
            >
              <Compass className="h-3 w-3" />
              Show me what to do
            </button>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              onClick={() => {
                if (mode === "remix") {
                  setMode("template");
                  setStep("style");
                } else {
                  setMode("remix");
                  setReferenceAnalysis(null);
                }
              }}
            >
              {mode === "remix" ? "Use a template instead" : "Remix a real ad instead"}
            </button>
          </div>
        </div>

        {tourOpen && dialogTourSteps.length > 0 && (
          <GuidedTour steps={dialogTourSteps} onClose={() => setTourOpen(false)} />
        )}

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

          {mode === "remix" ? (
            /* ---------- REMIX A REAL AD FLOW (default) ---------- */
            <div className="space-y-4 py-2 relative">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-primary" />
                  Pick one ad to remix
                </Label>
                <p className="text-xs text-muted-foreground">
                  Choose a real ad you like — LUMI matches its layout and typographic feel, then writes copy for your offer and renders it in your brand colors.
                </p>
              </div>

              {boardsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading your boards…
                </div>
              ) : boards.length === 0 ? (
                <div className="rounded border border-dashed p-6 text-sm text-muted-foreground space-y-2">
                  <p>You don't have any inspiration boards yet.</p>
                  <Button size="sm" variant="outline" onClick={() => { setOpen(false); navigate("/boards"); }}>
                    Go to Inspiration
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs uppercase text-muted-foreground">Board</Label>
                    <Select
                      value={selectedBoardId}
                      onValueChange={(v) => { setSelectedBoardId(v); setSelectedRemixImageId(""); setReferenceAnalysis(null); }}
                    >
                      <SelectTrigger className="h-8 text-sm w-72">
                        <SelectValue placeholder="Choose a board" />
                      </SelectTrigger>
                      <SelectContent>
                        {boards.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {boardImagesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading images…
                    </div>
                  ) : boardImages.length === 0 ? (
                    <div className="rounded border border-dashed p-6 text-sm text-muted-foreground space-y-2">
                      <p>This board has no images yet. Add at least 1 ad to this board first.</p>
                      <Button size="sm" variant="outline" onClick={() => { setOpen(false); navigate(`/boards/${selectedBoardId}`); }}>
                        Open board
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {boardImages.map((img) => {
                        const active = selectedRemixImageId === img.id;
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => { setSelectedRemixImageId(img.id); setReferenceAnalysis(null); }}
                            className={`relative aspect-square rounded border-2 overflow-hidden transition ${
                              active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground"
                            }`}
                          >
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                            {active && (
                              <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-2">
                    <Button
                      data-help-target="remix-this-ad"
                      size="lg"
                      onClick={runAnalyzeReference}
                      disabled={analyzingReference || !selectedRemixImageId}
                    >
                      {analyzingReference ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing this ad…</>
                      ) : (
                        <><Wand2 className="h-4 w-4 mr-2" /> Remix this ad</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : step === "style" ? (
            /* ---------- SCREEN 1: Choose a style ---------- */
            <div className="space-y-4 py-2 relative">
              <div>
                <Label className="text-sm font-medium">Choose a style</Label>
                <p className="text-xs text-muted-foreground">
                  Pick the layout for this ad. You can change it later.
                </p>
              </div>

              {brandBackgroundAssets.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                  ✨ Tip: add background or texture examples in <b>Brand Assets</b> for more on-brand AI backgrounds.
                </div>
              )}


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
                  data-help-target="style-next"
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
            <div className="space-y-4 py-2 relative">
              <Button variant="ghost" size="sm" onClick={() => setStep("style")} className="-ml-2">
                ← Back to styles
              </Button>

              {referenceAnalysis && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                  <p className="text-foreground">
                    <b>Matched to {BUILT_IN_LABELS[referenceAnalysis.template] || referenceAnalysis.template}:</b>{" "}
                    {referenceAnalysis.template_reason}
                  </p>
                  {referenceAnalysis.font_is_load_bearing && (
                    <p className="text-muted-foreground">
                      This ad's font is distinctive to its design — we matched the closest typographic personality instead of copying an exact font file.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.1fr] gap-6">
                <div className="space-y-5">
                  {/* Brand background generator (beta) */}
                  <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Label className="text-xs uppercase text-primary flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Brand background (beta)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Generate a clean on-brand background — no faces. Your headshot, copy &amp; logo layer on top.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={bgOptions.length ? "outline" : "default"}
                        onClick={runBrandBackground}
                        disabled={bgGenerating}
                      >
                        {bgGenerating ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</>
                        ) : bgOptions.length ? (
                          <><RefreshCw className="h-3 w-3 mr-1" /> Regenerate</>
                        ) : (
                          <>Generate</>
                        )}
                      </Button>
                    </div>
                    {brandBackgroundAssets.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Tip: add background or texture examples in <b>Brand Assets</b> for more on-brand results.
                      </p>
                    )}
                    {bgOptions.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {bgOptions.map((o) => (
                          <button
                            key={o.path}
                            type="button"
                            onClick={() => setBgSelectedUrl(o.url === bgSelectedUrl ? "" : o.url)}
                            className={`relative aspect-square rounded border-2 overflow-hidden transition ${
                              bgSelectedUrl === o.url ? "border-primary" : "border-border hover:border-muted-foreground"
                            }`}
                            title={`Background ${o.aspect}`}
                          >
                            <img src={o.url} alt="" className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 left-0 right-0 text-[9px] uppercase text-white bg-black/55 py-0.5 text-center leading-none">
                              {o.aspect}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {bgSelectedUrl && (
                      <p className="text-[11px] text-primary">✓ Will be sent as <code>backgroundUrl</code> to the renderer.</p>
                    )}
                  </div>

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
                            <div key={p.id} className="relative aspect-square">
                              <button
                                type="button"
                                onClick={() => setSelectedPhotoId(p.id)}
                                className={`w-full h-full rounded border-2 overflow-hidden transition ${
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
                              {p.source !== "brand" && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDefaultPhoto(p.id); }}
                                  className={`absolute top-0.5 right-0.5 rounded-full p-0.5 transition ${
                                    p.isDefault ? "bg-primary text-primary-foreground" : "bg-black/40 text-white/80 hover:bg-black/60"
                                  }`}
                                  title={p.isDefault ? "Your default photo" : "Set as default photo"}
                                >
                                  <Star className="h-3 w-3" fill={p.isDefault ? "currentColor" : "none"} />
                                </button>
                              )}
                            </div>
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
                  {(

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
                    data-help-target="render-creative"
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

                      {template === "nativecaption" && (
                        <div className="space-y-3 rounded border border-border bg-background p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Text readability
                          </p>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Text color</p>
                            <ToggleGroup
                              type="single"
                              size="sm"
                              value={textColor}
                              onValueChange={(v) => v && setTextColor(v as typeof textColor)}
                              className="justify-start"
                            >
                              <ToggleGroupItem value="auto" className="text-xs">Auto</ToggleGroupItem>
                              <ToggleGroupItem value="light" className="text-xs">Light</ToggleGroupItem>
                              <ToggleGroupItem value="dark" className="text-xs">Dark</ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium">Add a background behind the text</p>
                              <p className="text-[11px] text-muted-foreground">
                                Helps text stand out over a busy photo.
                              </p>
                            </div>
                            <Switch checked={textBackdrop} onCheckedChange={setTextBackdrop} />
                          </div>
                        </div>
                      )}

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
                      return (
                        <div key={i} className="rounded border overflow-hidden bg-muted/20">
                          <img src={`data:image/png;base64,${img.base64}`} alt="" className="w-full h-auto block" />
                          <div className="flex items-center justify-between gap-2 p-2 text-xs">
                            <span className="text-muted-foreground truncate">
                              {img.label ? `${img.label} · ` : ""}{img.placement} {img.width}×{img.height}
                              {isApproved && <span className="text-primary"> · Approved ✓</span>}
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => download(img, i)}>
                              <Download className="h-3 w-3 mr-1" /> PNG
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {itemId && images.length > 0 && !generating && (
                    <Button
                      data-help-target="approve-creative"
                      size="lg"
                      className={cn(
                        "w-full",
                        approvedIdxs.size < images.length && "animate-pulse",
                      )}
                      variant={approvedIdxs.size >= images.length ? "secondary" : "default"}
                      disabled={approvingIdx !== null || approvedIdxs.size >= images.length}
                      onClick={approveAllAndClose}
                    >
                      {approvingIdx !== null ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Approving…</>
                      ) : approvedIdxs.size >= images.length ? (
                        "Approved ✓"
                      ) : (
                        `Approve ${images.length > 1 ? `all ${images.length}` : ""}`.trim()
                      )}
                    </Button>
                  )}
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
