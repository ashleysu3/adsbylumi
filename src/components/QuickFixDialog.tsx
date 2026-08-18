import { OfferDialog } from "@/components/OfferDialog";

export type QuickFixKind = "offer";

interface QuickFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: QuickFixKind;
  brandId?: string | null;
  /** Called when the dialog closes so the caller can re-check / reload. */
  onDone?: () => void;
}

/**
 * Inline "go fix this one thing" modal.
 *
 * Whenever a screen is blocked because an offer is missing, open this
 * instead of navigating the user away — they fill it in, close it, and
 * stay exactly where they were.
 */
export function QuickFixDialog({
  open,
  onOpenChange,
  brandId,
  onDone,
}: QuickFixDialogProps) {
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

export default QuickFixDialog;
