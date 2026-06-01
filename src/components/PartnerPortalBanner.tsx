import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

export function PartnerPortalBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPartner, setIsPartner] = useState(false);
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem("partner_banner_dismissed") === "1"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("partner_access_tokens")
          .select("id")
          .eq("partner_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (!cancelled) setIsPartner(!!data);
      } catch {
        /* noop */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!isPartner || dismissed) return null;
  if (location.pathname.startsWith("/partner-portal")) return null;

  return (
    <div className="w-full bg-gradient-to-r from-primary/90 via-fuchsia-500/80 to-orange-400/80 text-primary-foreground text-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">
            You're a Lumi Partner — your Partner Portal has your link, resources, and updates.
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            onClick={() => navigate("/partner-portal")}
          >
            Open Portal
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-white/20"
            onClick={() => {
              sessionStorage.setItem("partner_banner_dismissed", "1");
              setDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
