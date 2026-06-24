import { useEffect, useState } from "react";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Download, Sparkles } from "lucide-react";
import { ImportCampaignsModal } from "./ImportCampaignsModal";

/**
 * Prominent bridge between live Meta campaigns and LUMI workspaces.
 *
 * Shows when the user has ACTIVE Meta campaigns that aren't yet linked to a
 * LUMI workspace. One-tap "Import from Meta" opens ImportCampaignsModal so they
 * can pull them in, add creative, and manage them inside LUMI.
 */
interface Props {
  /** Where the banner is being shown — used for the copy. */
  surface?: "live-ads" | "campaigns";
}

export function MetaImportBridgeBanner({ surface = "campaigns" }: Props) {
  const { activeBrand } = useBrand();
  const [unimportedCount, setUnimportedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [metaAccountId, setMetaAccountId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const brandId = activeBrand?.id;
  const dismissKey = brandId ? `lumi_import_bridge_dismissed_${brandId}` : null;

  useEffect(() => {
    if (dismissKey) {
      const d = localStorage.getItem(dismissKey);
      // Re-show after 7 days
      if (d) {
        const ts = parseInt(d);
        if (!isNaN(ts) && Date.now() - ts < 7 * 86400000) {
          setDismissed(true);
          return;
        }
      }
      setDismissed(false);
    }
  }, [dismissKey]);

  useEffect(() => {
    if (!brandId || dismissed) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Get brand's meta account id
        const { data: brand } = await supabase
          .from("brands")
          .select("meta_account_id")
          .eq("id", brandId)
          .maybeSingle();

        if (!brand?.meta_account_id) {
          setUnimportedCount(0);
          return;
        }
        if (cancelled) return;
        setMetaAccountId(brand.meta_account_id);

        // Existing workspace meta campaign IDs
        const { data: workspaces } = await supabase
          .from("campaign_workspaces")
          .select("meta_campaign_ids")
          .eq("brand_id", brandId);
        const existingCampaignIds = (workspaces || [])
          .map((w: any) => (w.meta_campaign_ids as any)?.campaignId)
          .filter(Boolean);

        // Get token + fetch list
        const { data: metaToken } = await supabase.rpc("get_meta_token", {
          p_brand_id: brandId,
        });
        if (!metaToken) return;

        const { data, error } = await supabase.functions.invoke(
          "fetch-meta-campaigns",
          {
            body: {
              metaAccountId: brand.meta_account_id,
              metaAccessToken: metaToken,
              existingCampaignIds,
            },
          }
        );
        if (cancelled) return;
        if (error || !data?.success) return;

        const unimported = (data.campaigns || []).filter(
          (c: any) =>
            !c.alreadyImported &&
            (c.status === "ACTIVE" || c.status === "PAUSED")
        );
        setUnimportedCount(unimported.length);
      } catch (e) {
        console.warn("[MetaImportBridgeBanner] check failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId, dismissed]);

  const handleDismiss = () => {
    if (dismissKey) localStorage.setItem(dismissKey, Date.now().toString());
    setDismissed(true);
  };

  if (dismissed || loading || unimportedCount === 0 || !brandId || !metaAccountId) {
    return null;
  }

  const headline =
    unimportedCount === 1
      ? "You have 1 campaign running in Meta that isn't in LUMI yet"
      : `You have ${unimportedCount} campaigns running in Meta that aren't in LUMI yet`;

  const sub =
    surface === "live-ads"
      ? "Import them to manage them here, add creative, and track results in one place."
      : "Import them here to manage them, add creative, and see them alongside your LUMI-built campaigns.";

  return (
    <>
      <Alert className="border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <AlertDescription className="text-sm font-semibold text-foreground">
              {headline}
            </AlertDescription>
            <p className="text-xs text-muted-foreground">{sub}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => setImportOpen(true)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Import from Meta
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-xs text-muted-foreground"
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </Alert>

      <ImportCampaignsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        brandId={brandId}
        metaAccountId={metaAccountId}
        onImportComplete={() => {
          setUnimportedCount(0);
          setImportOpen(false);
        }}
      />
    </>
  );
}
