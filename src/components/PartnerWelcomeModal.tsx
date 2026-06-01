import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "lumi_partner_welcome_code";

interface Perk {
  title: string;
  description: string;
}

interface PartnerWelcome {
  partner_display_name: string | null;
  partner_trial_code: string | null;
  perks: Perk[];
}

export function setPartnerWelcomeCode(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code.toUpperCase().trim());
  } catch { /* ignore */ }
}

export function PartnerWelcomeModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PartnerWelcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = (() => {
      try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    })();
    if (!code) return;

    (async () => {
      try {
        const { data: result, error } = await supabase.rpc("get_partner_welcome", { p_code: code });
        if (cancelled) return;
        if (error || !result) return;
        const payload = result as unknown as PartnerWelcome;
        if (!payload?.partner_display_name && (!payload?.perks || payload.perks.length === 0)) return;
        setData(payload);
        setOpen(true);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClose = () => {
    setOpen(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  if (!data) return null;
  const name = data.partner_display_name || "your referral partner";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-lumi-orange-1 to-lumi-pink-1 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Congrats — you're in!
          </DialogTitle>
          <DialogDescription className="text-center">
            You signed up through <span className="font-semibold text-foreground">{name}</span>,
            which means you've unlocked some bonus perks 🎁
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Gift className="h-4 w-4 text-primary" />
            Your bonus perks
          </div>
          <ul className="space-y-3">
            {data.perks.map((perk, i) => (
              <li key={i} className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{perk.title}</p>
                  {perk.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{perk.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground text-center pt-2">
            Plus your full 14-day free trial. We'll be in touch about your perks shortly.
          </p>
        </div>

        <Button onClick={handleClose} className="w-full mt-2">
          Let's go
        </Button>
      </DialogContent>
    </Dialog>
  );
}
