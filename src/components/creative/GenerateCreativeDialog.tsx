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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LiveAdPreview } from "./LiveAdPreview";
import { HexColorPicker } from "react-colorful";
import { Loader2, Sparkles, Pencil, Download, Wand2, RefreshCw, ImageOff, Info, ImagePlus, Star, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { QuickFixDialog } from "@/components/QuickFixDialog";
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
  // Inline "fix the missing brand kit" modal — we never navigate the user
  // away from a half-finished creative just to collect brand colors/fonts.
  const [quickFixOpen, setQuickFixOpen] = useState(false);
  const [kitReloadKey, setKitReloadKey] = useState(0);
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>("");

  // Quick inline upload: lets someone drop in their own image right here
  // instead of leaving the dialog to go to My Photos.
  const uploadOwnPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!activeBrand?.id) {
      toast.error("Choose a brand before uploading photos");
      return;
    }
    setUploadingPhoto(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("You must be signed in.");
      const added: Photo[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${userId}/${activeBrand.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("ad-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: row, error: insErr } = await supabase
          .from("user_assets" as any)
          .insert({ original_url: path, kind: "photo", brand_id: activeBrand.id })
          .select("id")
          .single();
        if (insErr) throw insErr;
        const { data: signed } = await supabase.storage
          .from("ad-photos")
          .createSignedUrl(path, 60 * 60);
        added.push({
          id: (row as any)?.id as string,
          path,
          url: signed?.signedUrl || "",
          source: "upload",
        });
      }
      setPhotos((prev) => [...added, ...prev]);
      setImageSource("uploads");
      if (added[0]) setSelectedPhotoId(added[0].id);
      toast.success(`Uploaded ${added.length} image${added.length > 1 ? "s" : ""}`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const [removeBackground, setRemoveBackground] = useState(true);
  // Background image chosen from the user's own uploaded/brand assets.
  const [bgSelectedUrl, setBgSelectedUrl] = useState<string>("");

  const [textCase, setTextCase] = useState<"original" | "upper" | "lower" | "title">("original");
  const [headlineScale, setHeadlineScale] = useState<number>(1);
  const [bodyScale, setBodyScale] = useState<number>(1);
  // Readability controls: a color box/scrim behind the copy + where the copy sits.
  const [textBoxStyle, setTextBoxStyle] = useState<"none" | "box" | "scrim">("none");
  const [textBoxColor, setTextBoxColor] = useState<string>("");
  const [textBoxOpacity, setTextBoxOpacity] = useState<number>(0.85);
  const [textPosition, setTextPosition] = useState<"top" | "middle" | "bottom">("bottom");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  // Readability controls for templates that put text directly on a photo
  // with no card behind it (currently just nativecaption) — the template's
  // own white text + shadow isn't always enough contrast against every photo.
  const [textColor, setTextColor] = useState<"auto" | "light" | "dark">("auto");
  const [textBackdrop, setTextBackdrop] = useState(false);

  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState<string>("bigtype");

  // Two-step UX: pick a style, then provide image + copy.
  const [step, setStep] = useState<"style" | "image-copy" | "render">("style");
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
    if (step === "style") {
      if (mode === "remix") {
        return [{
          targetSelector: '[data-help-target="remix-this-ad"]',
          title: "Remix a real ad",
          description: "Pick a board, then click an image to select it — the button at the bottom lights up once you have. Lumi matches the layout and rewrites the copy for your offer.",
        }];
      }
      return [{
        targetSelector: '[data-help-target="style-next"]',
        title: "Choose a style",
        description: "Click any template to select it — you can change it later. Once you've picked one, hit Next to move on to the photo and copy.",
      }];
    }
    if (step === "image-copy") {
      return [{
        targetSelector: '[data-help-target="render-creative"]',
        title: "Image & copy",
        description: "Pick a photo and tweak the copy — the preview on the right updates as you type. Then hit Render.",
      }];
    }
    if (images.length === 0) {
      return [{
        targetSelector: '[data-help-target="render-creative"]',
        title: "Render",
        description: "Hit Render to build your ad. Nothing saves until you approve it.",
      }];
    }
    return [{
      targetSelector: '[data-help-target="approve-creative"]',
      title: "Approve your renders",
      description: "Renders are ready. Approve them to save this creative — that closes this dialog for you.",
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

      // Seed the carousel slide count from the brief's plan so the studio
      // renders the intended number of slides instead of always defaulting to
      // 5. The user can still adjust it before rewriting.
      //
      // Floor at 3 for carousel format specifically: generate-creative-grid's
      // own prompt asks the model for "3 to 6 for carousel," but nothing
      // downstream enforces that — an LLM that returns slideCount:1 for a
      // carousel cell was silently honored end to end (compose-ad, the
      // client-side padding below) as a valid 1-slide "carousel." A single
      // slide is a legitimate result for a single_graphic cell, so the floor
      // only applies when the brief is actually asking for a carousel.
      const plannedSlides =
        (detail.brief as any).slideCount ?? (detail.brief as any).slidePlan?.length;
      const briefIsCarousel = detail.brief.format === "carousel";
      if (typeof plannedSlides === "number" && plannedSlides >= 1) {
        const floor = briefIsCarousel ? 3 : 1;
        setSlideCount(Math.max(floor, Math.min(10, plannedSlides)));
      } else if (briefIsCarousel) {
        setSlideCount(4);
      }

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
          setQuickFixOpen(true);
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
  }, [open, activeBrand?.id, brandsLoading, navigate, kitReloadKey]);

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




  const compose = useCallback(async (feedback?: CopyFeedback | null) => {
    const b = briefRef.current;
    if (!b) return;
    setComposing(true);
    setImages([]);
    try {
      const voicePayload = brandVoice && Object.keys(brandVoice).length > 0 ? brandVoice : {};

      // Custom (admin-authored) templates carry their own slot keys. We used to
      // just prefill blank slots here, which is why "Generate this creative"
      // never wrote any copy for them — now the slots go to compose-ad so the
      // AI fills them, and blanks are only the fallback.
      const customSlots: string[] | null = activeCustom
        ? (activeCustom.type === "carousel"
            ? (Array.isArray(activeCustom.slide_slots) ? activeCustom.slide_slots : [])
            : (Array.isArray(activeCustom.copy_slots) ? activeCustom.copy_slots : [])
          ).filter((k: any) => typeof k === "string" && k.trim())
        : null;
      const customIsCarousel = !!activeCustom && activeCustom.type === "carousel";

      const makeBlankFromSlots = (): Slide => {
        const s: Slide = {};
        (customSlots || []).forEach((k) => (s[k] = ""));
        return s;
      };

      if (activeCustom && (!customSlots || customSlots.length === 0)) {
        // Nothing to write into — fall back to the old blank behavior.
        if (customIsCarousel) {
          const n = Math.max(1, slideCount || 1);
          const blankSlides: Slide[] = Array.from({ length: n }, makeBlankFromSlots);
          setCarouselOptions([{ slides: blankSlides }]);
          setEditedSlides(blankSlides);
          setSingleOptions([]);
          setEditedSingle({});
        } else {
          const blank: SingleOption = makeBlankFromSlots();
          setSingleOptions([blank]);
          setEditedSingle(blank);
          setCarouselOptions([]);
          setEditedSlides([]);
        }
        setSelectedOptionIdx(0);
        setEditingCopy(true);
        return;
      }

      // A reference analysis can suggest a single-image visual template (for
      // example nativebubbles) even when the creative brief is a carousel.
      // compose-ad then returns flat options, while this editor correctly
      // looks for option.slides — producing five visually blank slides. Keep
      // the carousel data contract authoritative whenever the brief says it
      // is a carousel. Custom templates use their own explicit contract.
      const briefWithTemplate = {
        ...b,
        template: !activeCustom && b.format === "carousel" ? "carousel" : template,
      };


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
              .select("id, name, page_goal, target_outcome, price_point, url, description, messaging_guidelines, offer_audience_psychology, product_psychology, page_excerpt, created_at")
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
                offerAudiencePsychology: chosen.offer_audience_psychology,
                productPsychology: chosen.product_psychology,
                pageExcerpt: chosen.page_excerpt,
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
          count: activeCustom ? 1 : 3,
          slideCount,
          feedback: feedback || null,
          customSlots,
          customType: activeCustom ? activeCustom.type : null,
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
      if (!activeCustom) {
        const returnedTemplate: string =
          data?.template || mapStyleToTemplate(b.styleHint, b.format);
        setTemplate(returnedTemplate);
      }
      const options: any[] = data?.options || [];
      // Keep only the template's own slots, and guarantee every slot exists so
      // the editor renders a field for each one even if the model skipped it.
      const toSlots = (src: any): Record<string, string> => {
        const out: Record<string, string> = {};
        const keys = customSlots && customSlots.length ? customSlots : Object.keys(src || {});
        for (const k of keys) {
          const v = (src || {})[k];
          out[k] = typeof v === "string" ? v : "";
        }
        return out;
      };
      const treatAsCarousel = activeCustom
        ? customIsCarousel
        : (data?.template || template) === "carousel" || b.format === "carousel";
      if (treatAsCarousel) {
        // Ensure every option has exactly `slideCount` slides. The model
        // often ignores the requested count and returns just 1 — pad with
        // blank slides so the user can fill them in rather than shipping
        // a "carousel" that's only slide 0.
        // Hard minimum of 2 — Meta rejects a 1-card carousel, and a 1-slide
        // "carousel" is the exact bug users hit ("generated only 1 slide").
        const targetN = Math.max(2, slideCount || 4);
        const carOpts: CarouselOption[] = options.map((o) => {
          const raw = Array.isArray(o?.slides) ? o.slides : [];
          const cleaned: Slide[] = raw.map((sl: any) => toSlots(sl));
          if (cleaned.length > targetN) cleaned.length = targetN;
          while (cleaned.length < targetN) {
            const blank: Slide = cleaned[0]
              ? Object.fromEntries(Object.keys(cleaned[0]).map((k) => [k, ""]))
              : { headline: "", sub: "", cta: "" };
            cleaned.push(blank);
          }
          return { slides: cleaned };
        });
        setCarouselOptions(carOpts.length ? carOpts : [{ slides: Array.from({ length: Math.max(2, slideCount || 4) }, makeBlankFromSlots) }]);
        setSelectedOptionIdx(0);
        setEditedSlides((carOpts[0]?.slides) || Array.from({ length: Math.max(2, slideCount || 4) }, makeBlankFromSlots));
        setSingleOptions([]);
        setEditedSingle({});
      } else {
        const opts: SingleOption[] = options.map((o) => toSlots(o));
        setSingleOptions(opts.length ? opts : [makeBlankFromSlots()]);
        setSelectedOptionIdx(0);
        setEditedSingle(opts[0] || makeBlankFromSlots());
        setCarouselOptions([]);
        setEditedSlides([]);
      }
      if (activeCustom) setEditingCopy(true);

    } catch (err: any) {
      toast.error(err?.message || "Failed to write copy");
    } finally {
      setComposing(false);
    }
  }, [brandVoice, template, activeCustom, referenceAnalysis, slideCount]);

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
        textBackdrop: textBackdrop || textBoxStyle !== "none" || undefined,
        textBoxStyle: textBoxStyle === "none" ? undefined : textBoxStyle,
        textBoxColor: textBoxStyle === "none" ? undefined : (textBoxColor || colors.bg),
        textBoxOpacity: textBoxStyle === "none" ? undefined : textBoxOpacity,
        textPosition,
        textAlign,
      };

      if (isCarousel) {
        if (!Array.isArray(editedSlides) || editedSlides.length < 2) {
          toast.error("Carousels need at least 2 slides. Add another slide or switch this to a single image.");
          setProgress("");
          setGenerating(false);
          return;
        }
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
      // Carousel slides all belong to the same concept — tag each with its
      // index so saving slide 2 doesn't overwrite slide 1.
      const slide: any = isCarousel ? (editedSlides?.[idx] || {}) : null;
      const cardIndex = isCarousel ? idx : undefined;
      const cardMeta = isCarousel
        ? {
            index: idx,
            headline: slide?.headline || slide?.title || "",
            description: slide?.sub || slide?.body || slide?.description || "",
          }
        : undefined;
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
              cardIndex,
              cardMeta,
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

  // ---- Step rail helpers -------------------------------------------------
  const stepIndex = step === "style" ? 0 : step === "image-copy" ? 1 : 2;
  const stepLabels = ["Style", "Image & copy", "Render"];
  const goToStep = (i: number) => {
    if (i > stepIndex) return;
    setStep(i === 0 ? "style" : i === 1 ? "image-copy" : "render");
  };

  // The refine controls live collapsed next to the preview and pop open after
  // the first successful render, when tweaking is what you actually want.
  const [refineValue, setRefineValue] = useState<string[]>([]);
  useEffect(() => {
    if (images.length > 0) setRefineValue(["refine"]);
  }, [images.length]);

  const briefStrip = brief ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
      <Badge variant="outline" className="text-[10px] uppercase">{brief.format}</Badge>
      <Badge variant="secondary" className="text-[10px] uppercase">
        {activeCustom ? activeCustom.name : (BUILT_IN_LABELS[template] || template)}
      </Badge>
      {brief.styleHint && <Badge variant="outline" className="text-[10px]">{brief.styleHint}</Badge>}
      {brief.angle && <Badge variant="outline" className="text-[10px]">{brief.angle}</Badge>}
      <span className="text-muted-foreground truncate">{brief.keyMessage}</span>
    </div>
  ) : null;

  const refinePanel = (
    <Accordion type="multiple" value={refineValue} onValueChange={setRefineValue}>
      <AccordionItem value="refine" className="border rounded-lg bg-background px-3">
        <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
          Refine look &amp; feel
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Colors</p>
            <div className="grid grid-cols-6 gap-1.5">
              {(Object.keys(colors) as Array<keyof Colors>).map((k) => (
                <Popover key={k}>
                  <PopoverTrigger asChild>
                    <button type="button" className="group flex flex-col items-center gap-1" aria-label={`Edit ${k} color`}>
                      <span
                        className="h-8 w-full rounded-md border border-border shadow-sm transition group-hover:scale-[1.03]"
                        style={{ backgroundColor: colors[k] }}
                      />
                      <span className="text-[9px] text-muted-foreground capitalize">{k}</span>
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
            <div className="space-y-3 rounded border border-border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Text readability</p>
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium">Background behind the text</p>
                  <p className="text-[11px] text-muted-foreground">Helps text stand out over a busy photo.</p>
                </div>
                <Switch checked={textBackdrop} onCheckedChange={setTextBackdrop} />
              </div>
            </div>
          )}

          <div className="space-y-3 rounded border border-border bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Readability</p>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Box behind text</p>
              <ToggleGroup
                type="single"
                size="sm"
                value={textBoxStyle}
                onValueChange={(v) => v && setTextBoxStyle(v as typeof textBoxStyle)}
                className="justify-start"
              >
                <ToggleGroupItem value="none" className="text-xs">None</ToggleGroupItem>
                <ToggleGroupItem value="scrim" className="text-xs">Soft</ToggleGroupItem>
                <ToggleGroupItem value="box" className="text-xs">Solid box</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {textBoxStyle !== "none" && (
              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Box color</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Edit text box color"
                        className="h-8 w-full rounded-md border border-border shadow-sm"
                        style={{ backgroundColor: textBoxColor || colors.bg }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <HexColorPicker color={textBoxColor || colors.bg} onChange={setTextBoxColor} />
                      <Input
                        value={textBoxColor || colors.bg}
                        onChange={(e) => setTextBoxColor(e.target.value)}
                        className="mt-2 h-7 text-xs font-mono"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Box opacity</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(textBoxOpacity * 100)}%</span>
                  </div>
                  <Slider
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={[textBoxOpacity]}
                    onValueChange={(v) => setTextBoxOpacity(v[0])}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Text position</p>
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={textPosition}
                  onValueChange={(v) => v && setTextPosition(v as typeof textPosition)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="top" className="text-xs">Top</ToggleGroupItem>
                  <ToggleGroupItem value="middle" className="text-xs">Middle</ToggleGroupItem>
                  <ToggleGroupItem value="bottom" className="text-xs">Bottom</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Text align</p>
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={textAlign}
                  onValueChange={(v) => v && setTextAlign(v as typeof textAlign)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="left" className="text-xs">Left</ToggleGroupItem>
                  <ToggleGroupItem value="center" className="text-xs">Center</ToggleGroupItem>
                  <ToggleGroupItem value="right" className="text-xs">Right</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Headline size</p>
                <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(headlineScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.6} step={0.05} value={[headlineScale]} onValueChange={(v) => setHeadlineScale(v[0])} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Body size</p>
                <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(bodyScale * 100)}%</span>
              </div>
              <Slider min={0.6} max={1.6} step={0.05} value={[bodyScale]} onValueChange={(v) => setBodyScale(v[0])} />
            </div>
          </div>

          {needsPhoto && (
            <div className="flex items-center justify-between gap-2 rounded border border-border bg-muted/20 px-3 py-2">
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
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setTextCase("original"); setHeadlineScale(1); setBodyScale(1);
                setTextBoxStyle("none"); setTextBoxColor(""); setTextBoxOpacity(0.85);
                setTextPosition("bottom"); setTextAlign("left");
              }}
            >
              Reset tweaks
            </button>
            {images.length > 0 && (
              <Button size="sm" variant="outline" onClick={generate} disabled={generating || !canRender}>
                {generating ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Rendering…</> : <><Sparkles className="h-3 w-3 mr-1" /> Re-render</>}
              </Button>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const previewPane = (
    <aside className="hidden md:flex flex-col gap-3 overflow-y-auto border-l bg-muted/20 px-4 py-5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Preview</p>
      <LiveAdPreview
        copy={editedSingle}
        slides={editedSlides}
        isCarousel={isCarousel}
        template={template}
        templateLabel={activeCustom ? activeCustom.name : (BUILT_IN_LABELS[template] || template)}
        colors={colors}
        displayFamily={displayFamily}
        bodyFamily={bodyFamily}
        photoUrl={selectedPhoto?.url}
        backgroundUrl={bgSelectedUrl || undefined}
        textCase={textCase}
        headlineScale={headlineScale}
        bodyScale={bodyScale}
        textBoxStyle={textBoxStyle}
        textBoxColor={textBoxColor || colors.bg}
        textBoxOpacity={textBoxOpacity}
        textPosition={textPosition}
        textAlign={textAlign}
        logoUrl={brandLogoAsset?.url}
        showLogo={placeLogo}
        logoCorner={logoCorner}
      />
      {refinePanel}
    </aside>
  );

  return (
    <>
    <QuickFixDialog
      open={quickFixOpen}
      onOpenChange={setQuickFixOpen}
      kind="style"
      brandId={activeBrand?.id}
      onDone={() => setKitReloadKey((k) => k + 1)}
    />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="space-y-3 border-b px-6 pb-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Generate this creative
              </DialogTitle>
              <DialogDescription className="text-xs">
                {brief?.concept || "Write copy and render this ad in your brand kit."}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge
                variant="outline"
                className="text-[10px] uppercase"
                title="This generator is in beta — bugs are expected. If you hit one, send us a screenshot!"
              >
                Beta
              </Badge>
              <span
                className="flex items-center gap-1.5"
                title="Switch brands in the sidebar if this isn't the right brand kit."
              >
                Brand kit:
                <span className="font-medium text-foreground">{activeBrand?.name || "—"}</span>
                <span className="flex items-center gap-0.5">
                  {(Object.keys(colors) as Array<keyof Colors>).map((k) => (
                    <span
                      key={k}
                      title={`${k}: ${colors[k]}`}
                      className="h-3 w-3 rounded border border-border"
                      style={{ backgroundColor: colors[k] }}
                    />
                  ))}
                </span>
              </span>
              <button
                type="button"
                className="relative overflow-hidden flex items-center gap-1 text-[11px] font-medium text-white bg-gradient-lumi rounded-full px-2.5 py-1 shadow-lumi hover:shadow-glow transition-shadow disabled:opacity-50 disabled:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer"
                onClick={() => setTourOpen(true)}
                disabled={dialogTourSteps.length === 0}
              >
                <Compass className="h-3 w-3" />
                Show me what to do
              </button>
            </div>
          </div>

          {/* Step rail — identical in both modes */}
          <div className="flex items-center gap-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-border" />}
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  disabled={i > stepIndex}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                    i === stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i < stepIndex
                        ? "bg-muted text-foreground hover:bg-muted/70"
                        : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                      i === stepIndex ? "bg-primary-foreground/20" : "bg-border/60",
                    )}
                  >
                    {i + 1}
                  </span>
                  {label}
                </button>
              </div>
            ))}
          </div>
        </DialogHeader>

        {tourOpen && dialogTourSteps.length > 0 && (
          <GuidedTour steps={dialogTourSteps} onClose={() => setTourOpen(false)} />
        )}

        {/* ---------------- BODY ---------------- */}
        {step === "style" ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {briefStrip}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setMode("template"); setReferenceAnalysis(null); }}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition",
                  mode === "template" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground",
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" /> Use a template
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a layout we've already designed. Fastest way to a finished ad.
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setMode("remix"); setReferenceAnalysis(null); }}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition",
                  mode === "remix" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground",
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ImagePlus className="h-4 w-4 text-primary" /> Remix a real ad
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose an ad you saved to a board — Lumi matches its layout for your offer.
                </p>
              </button>
            </div>

            {mode === "remix" ? (
              /* ---------- Remix picker ---------- */
              <div className="space-y-4">
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
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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
                  </>
                )}
              </div>
            ) : (
              /* ---------- Template picker ---------- */
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Choose a style</Label>
                  <p className="text-xs text-muted-foreground">Pick the layout for this ad. You can change it later.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
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
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
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
              </div>
            )}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] overflow-hidden">
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {briefStrip}

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

              {step === "image-copy" ? (
                <>
                  {/* Image */}
                  {needsPhoto && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs uppercase text-muted-foreground">Your image</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          disabled={uploadingPhoto}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          {uploadingPhoto ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                          ) : (
                            <><ImagePlus className="h-3.5 w-3.5" /> Upload image</>
                          )}
                        </Button>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={uploadOwnPhotos}
                        />
                      </div>
                      <Tabs value={imageSource} onValueChange={(v) => setImageSource(v as "uploads" | "brand")}>
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
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="w-full text-xs text-muted-foreground rounded border border-dashed p-4 flex flex-col items-center gap-1.5 hover:border-primary hover:text-foreground transition"
                        >
                          <ImagePlus className="h-5 w-5" />
                          <span className="font-medium text-foreground">Upload your own image</span>
                          <span>
                            {imageSource === "uploads"
                              ? "Drop in a photo from your computer — it saves to My Photos too."
                              : "No brand images yet — pull images from your website in Style."}
                          </span>
                        </button>
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
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Your copy</Label>
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
                        slideCount={slideCount}
                        setSlideCount={(n) => setSlideCount(Math.max(1, Math.min(10, n)))}
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
                </>
              ) : (
                /* ---------- SCREEN 3: Render & results ---------- */
                <div className="space-y-4">
                  {generating && images.length === 0 && (
                    <div className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      {progress || "Rendering…"}
                    </div>
                  )}
                  {!generating && images.length === 0 && (
                    <div className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground space-y-3">
                      <p>Nothing rendered yet.</p>
                      <Button size="sm" onClick={generate} disabled={!canRender}>
                        <Sparkles className="h-3 w-3 mr-1" /> Render now
                      </Button>
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
                </div>
              )}
            </div>

            {previewPane}
          </div>
        )}

        {/* ---------------- FOOTER ---------------- */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
          <div className="min-w-0">
            {stepIndex > 0 && (
              <Button variant="ghost" size="sm" onClick={() => goToStep(stepIndex - 1)}>
                ← Back
              </Button>
            )}
          </div>

          {step === "style" ? (
            mode === "remix" ? (
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
            ) : (
              <Button
                data-help-target="style-next"
                size="lg"
                onClick={() => setStep("image-copy")}
                disabled={!activeStyleKey}
              >
                Next: image &amp; copy →
              </Button>
            )
          ) : step === "image-copy" ? (
            <Button
              data-help-target="render-creative"
              size="lg"
              onClick={() => { setStep("render"); generate(); }}
              disabled={!canRender}
            >
              {composing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Writing copy…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />
                  {isCarousel ? `Render ${editedSlides.length || ""} slides`.replace("  ", " ") : "Render feed + story"}
                </>
              )}
            </Button>
          ) : itemId && images.length > 0 && !generating ? (
            <Button
              data-help-target="approve-creative"
              size="lg"
              className={cn(
                approvedIdxs.size < images.length && "lumi-outline-gradient"
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
          ) : (
            <Button size="lg" onClick={generate} disabled={!canRender}>
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {progress || "Rendering…"}</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Render</>
              )}
            </Button>
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
  slideCount, setSlideCount,
}: {
  options: CarouselOption[];
  selectedIdx: number;
  setSelectedIdx: (i: number) => void;
  slides: Slide[];
  setSlides: (s: Slide[]) => void;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onRegenerate: () => void;
  slideCount: number;
  setSlideCount: (n: number) => void;
}) {
  const makeBlankFromExisting = (): Slide => {
    if (slides[0]) {
      return Object.fromEntries(Object.keys(slides[0]).map((k) => [k, ""])) as Slide;
    }
    return { headline: "", sub: "", cta: "" };
  };
  const addSlide = () => {
    const next = [...slides, makeBlankFromExisting()];
    setSlides(next);
    setSlideCount(next.length);
  };
  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx);
    setSlides(next);
    setSlideCount(next.length);
  };
  if (slides.length === 0) {
    return <p className="text-sm text-muted-foreground">No slides yet.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs uppercase text-muted-foreground">{slides.length} slides</Label>
        <div className="flex items-center gap-1">
          <Label className="text-[11px] text-muted-foreground mr-1">Slides</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={slideCount}
            onChange={(e) => {
              const n = Math.max(1, Math.min(10, Number(e.target.value) || 1));
              setSlideCount(n);
              // Live-resize the current option so the editor reflects it
              // immediately — user doesn't have to click Rewrite.
              const next = [...slides];
              if (n > next.length) {
                while (next.length < n) next.push(makeBlankFromExisting());
              } else if (n < next.length) {
                next.length = n;
              }
              setSlides(next);
            }}
            className="h-8 w-16 text-sm"
          />
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
                {slides.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                    onClick={() => removeSlide(i)}
                  >
                    Remove
                  </Button>
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
        {slides.length < 10 && (
          <Button size="sm" variant="outline" className="w-full" onClick={addSlide}>
            + Add slide
          </Button>
        )}
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
