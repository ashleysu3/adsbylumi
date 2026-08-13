import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BrandColorsAndFonts from "@/components/BrandColorsAndFonts";
import { BRollLibrary, type BRollClip } from "@/components/BRollLibrary";
import { OfferDialog } from "@/components/OfferDialog";

export type QuickFixKind = "style" | "broll" | "offer";

interface QuickFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: QuickFixKind;
  brandId?: string | null;
  /** Called when the dialog closes so the caller can re-check / reload. */
  onDone?: () => void;
}

const COPY: Record<QuickFixKind, { title: string; description: string }> = {
  style: {
    title: "Add your brand colors & fonts",
    description:
      "Fill these in here and close this window — you'll pick up right where you left off.",
  },
  broll: {
    title: "Upload b-roll clips",
    description:
      "Drop a few clips in here and close this window — you'll be right back where you were.",
  },
  offer: {
    title: "Add an offer",
    description: "Add your offer here without leaving this screen.",
  },
};

/**
 * Inline "go fix this one thing" modal.
 *
 * Whenever a screen is blocked because something is missing elsewhere
 * (brand colors, b-roll, an offer), open this instead of navigating the
 * user away — they fill it in, close it, and stay exactly where they were.
 */
export function QuickFixDialog({
  open,
  onOpenChange,
  kind,
  brandId,
  onDone,
}: QuickFixDialogProps) {
  const [loading, setLoading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [clips, setClips] = useState<BRollClip[]>([]);

  useEffect(() => {
    if (!open || !brandId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("brands")
          .select("website_url, broll_library")
          .eq("id", brandId)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setWebsiteUrl((data as any)?.website_url ?? null);
        setClips((((data as any)?.broll_library || []) as BRollClip[]) ?? []);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message || "Couldn't load your brand");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, brandId, kind]);

  const close = () => {
    onOpenChange(false);
    onDone?.();
  };

  const persistClips = async (next: BRollClip[]) => {
    if (!brandId) return;
    const { error } = await supabase
      .from("brands")
      .update({ broll_library: next as any })
      .eq("id", brandId)
      .select("id")
      .single();
    if (error) throw error;
  };

  // Offers already have their own full dialog — reuse it as-is.
  if (kind === "offer") {
    return (
      <OfferDialog
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v);
          if (!v) onDone?.();
        }}
        brandId={brandId || ""}
        onSuccess={() => onDone?.()}
      />
    );
  }

  const copy = COPY[kind];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {!brandId ? (
          <p className="text-sm text-muted-foreground py-6">
            Pick a brand first, then try again.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : kind === "style" ? (
          <BrandColorsAndFonts brandId={brandId} websiteUrl={websiteUrl} />
        ) : (
          <BRollLibrary
            brandId={brandId}
            clips={clips}
            onUpdate={setClips}
            persist={persistClips}
            embedded
            libraryKey={`quickfix:${brandId}`}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={close}>Done — back to what I was doing</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QuickFixDialog;
