import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function CancellationPolicyBanner() {
  const [visible, setVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("policy_acknowledged_at")
        .eq("id", user.id)
        .single();

      if (profile && !profile.policy_acknowledged_at) {
        setVisible(true);
      }
    };
    check();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    if (userId) {
      await supabase
        .from("profiles")
        .update({ policy_acknowledged_at: new Date().toISOString() })
        .eq("id", userId);
    }
  };

  if (!visible) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          You can cancel anytime in{" "}
          <a href="/settings" className="font-medium underline underline-offset-2">
            Account Settings
          </a>
          . Questions? Email{" "}
          <a
            href="mailto:support@adsbylumi.com"
            className="font-medium underline underline-offset-2"
          >
            support@adsbylumi.com
          </a>
        </p>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
