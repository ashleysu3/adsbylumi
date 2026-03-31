import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Instagram, ExternalLink, CheckCircle2, AlertTriangle, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import lumiLogo from "@/assets/lumi-logo.png";

const SESSION_KEY = "ig_perm_check_done";

export function InstagramPermissionFixModal() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [step, setStep] = useState<"checking" | "issue" | "instructions">("checking");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (!activeBrand?.id || !activeBrand?.meta_account_id) return;

    const checkPermissions = async () => {
      setChecking(true);
      try {
        // First check if brand has Instagram connected
        const { data: brandData } = await supabase
          .from("brands")
          .select("meta_access_token, instagram_account_id")
          .eq("id", activeBrand.id)
          .single();

        if (!brandData?.meta_access_token || !brandData?.instagram_account_id) return;

        const { data, error } = await supabase.functions.invoke("test-meta-connection", {
          body: { brandId: activeBrand.id },
        });

        sessionStorage.setItem(SESSION_KEY, "1");

        if (error) return;

        if (data?.details?.hasInstagramMediaAccess === false) {
          setStep("issue");
          setOpen(true);
        }
      } catch {
        // Silent fail
      } finally {
        setChecking(false);
      }
    };

    const timer = setTimeout(checkPermissions, 2000);
    return () => clearTimeout(timer);
  }, [activeBrand?.id, activeBrand?.meta_account_id]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <img src={lumiLogo} alt="Lumi" className="h-8 w-8 rounded-full" />
            <DialogTitle className="text-lg">Quick fix needed for Instagram 🔧</DialogTitle>
          </div>
          <DialogDescription>
            Your Meta connection is missing Instagram post permissions. This takes about 60 seconds to fix.
          </DialogDescription>
        </DialogHeader>

        {step === "issue" && (
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">What's happening</p>
                <p className="text-muted-foreground mt-1">
                  When you first connected, some Instagram permissions may not have been granted. 
                  This prevents us from pulling your existing posts for ads.
                </p>
              </div>
            </div>

            <Button className="w-full" onClick={() => setStep("instructions")}>
              Show me how to fix it
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setOpen(false)}>
              I'll fix this later
            </Button>
          </div>
        )}

        {step === "instructions" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <StepItem
                number={1}
                title="Remove our app from Facebook"
                description="This resets your permissions so you can grant them fresh."
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open("https://www.facebook.com/settings/?tab=business_tools", "_blank")}
                >
                  Open Facebook Settings
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </StepItem>

              <StepItem
                number={2}
                title='Find "Ads by Lumi" and click Remove'
                description="Look for our app in the list and remove it. This won't affect your ads or data."
              />

              <StepItem
                number={3}
                title="Reconnect your Meta account here"
                description="When Meta asks for permissions, make sure ALL checkboxes are checked."
              >
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setOpen(false);
                    navigate("/settings/meta");
                  }}
                >
                  <Instagram className="h-4 w-4 mr-2" />
                  Go to Meta Settings
                </Button>
              </StepItem>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                This won't affect your running ads, data, or brand settings. It only refreshes your connection permissions.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepItem({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {children}
      </div>
    </div>
  );
}
