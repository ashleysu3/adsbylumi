import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ImportCampaignsModal } from "./ImportCampaignsModal";

/**
 * Always-available entry point for pulling existing Meta campaigns into LUMI.
 *
 * The bridge banner only appears when LUMI notices unimported ACTIVE campaigns;
 * this button is permanent so someone can import paused/older campaigns at any
 * time without hunting for the prompt.
 */
interface Props {
  brandId: string;
  onImported?: () => void;
  className?: string;
}

export function ImportFromMetaButton({ brandId, onImported, className }: Props) {
  const [metaAccountId, setMetaAccountId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("meta_account_id")
        .eq("id", brandId)
        .maybeSingle();
      if (!cancelled) setMetaAccountId(data?.meta_account_id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={() => {
          if (!metaAccountId) {
            toast.error("Connect your Meta ad account first", {
              description: "Account settings → My brand → Connect Meta.",
            });
            return;
          }
          setOpen(true);
        }}
      >
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Import ads from Meta
      </Button>

      {metaAccountId && (
        <ImportCampaignsModal
          open={open}
          onOpenChange={setOpen}
          brandId={brandId}
          metaAccountId={metaAccountId}
          onImportComplete={() => onImported?.()}
        />
      )}
    </>
  );
}
