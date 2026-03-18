import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatInvokeError } from "@/lib/formatInvokeError";

const CANCEL_REASONS = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using it" },
  { value: "missing_features", label: "Missing features" },
  { value: "switching_tools", label: "Switching tools" },
  { value: "other", label: "Other" },
];

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionEnd: string | null;
  isCodeBased: boolean;
  isTrial: boolean;
  tierName: string;
  onCancelled: () => void;
}

export function CancelSubscriptionModal({
  open,
  onOpenChange,
  subscriptionEnd,
  isCodeBased,
  isTrial,
  tierName,
  onCancelled,
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const endDateFormatted = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "the end of your billing period";

  const handleConfirmCancel = async () => {
    if (!reason) {
      toast.error("Please select a reason for cancelling.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get profile info
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      // Get subscription info
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, tier, current_period_end")
        .eq("user_id", user.id)
        .in("status", ["active", "trial"])
        .single();

      if (isCodeBased) {
        // Code-based: cancel directly in DB
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancel_at_period_end: true,
          })
          .eq("user_id", user.id)
          .in("status", ["active", "trial"]);

        if (error) throw error;

        // Pause ads + send email
        try {
          await supabase.functions.invoke("handle-cancellation", {
            body: {
              userId: user.id,
              userEmail: profile?.email || user.email,
              fullName: profile?.full_name || "",
              tierName: sub?.tier || tierName,
              periodEnd: sub?.current_period_end || subscriptionEnd,
            },
          });
        } catch (e) {
          console.error("handle-cancellation error:", e);
        }
      } else {
        // Stripe-based: cancel via stripe-admin
        const { data, error } = await supabase.functions.invoke("customer-portal");
        // Instead of opening portal, cancel directly via stripe-admin with the user's email
        const { data: cancelData, error: cancelError } = await supabase.functions.invoke("stripe-admin", {
          headers: {
            "x-admin-secret": "self-serve-cancel",
          },
          body: {
            action: "cancel_subscription",
            email: profile?.email || user.email,
            params: { at_period_end: true },
          },
        });

        // If stripe-admin fails due to auth (expected — it requires admin secret), fall back to customer-portal
        if (cancelError || cancelData?.error) {
          // Open customer portal for cancellation as fallback
          const { data: portalData } = await supabase.functions.invoke("customer-portal");
          if (portalData?.url) {
            window.open(portalData.url, "_blank");
            toast.info("Please complete your cancellation in the billing portal.");
          }
        }

        // Also pause ads + send email
        try {
          await supabase.functions.invoke("handle-cancellation", {
            body: {
              userId: user.id,
              userEmail: profile?.email || user.email,
              fullName: profile?.full_name || "",
              tierName: sub?.tier || tierName,
              periodEnd: sub?.current_period_end || subscriptionEnd,
            },
          });
        } catch (e) {
          console.error("handle-cancellation error:", e);
        }
      }

      // Log cancellation request to DB
      await supabase.from("cancellation_requests" as any).insert({
        user_id: user.id,
        reason,
        stripe_subscription_id: sub?.stripe_subscription_id || null,
        user_email: profile?.email || user.email,
        user_name: profile?.full_name || null,
        tier_at_cancellation: sub?.tier || tierName,
        period_end: sub?.current_period_end || subscriptionEnd,
      } as any);

      toast.success("Your subscription has been cancelled. You'll retain access until " + endDateFormatted + ".");
      onCancelled();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Cancellation error:", error);
      toast.error(formatInvokeError(error) || "Failed to cancel subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {isTrial ? "Cancel Trial" : "Cancel Subscription"}
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>
              Your access will continue through{" "}
              <strong className="text-foreground">{endDateFormatted}</strong>. After that, your
              account will be deactivated and active ads will be paused.
            </p>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                ⚠️ Founding member pricing is locked in for life — if you cancel now, you may not
                be able to get this rate again.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="cancel-reason">Why are you cancelling? *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="cancel-reason">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {CANCEL_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            onClick={handleConfirmCancel}
            disabled={loading || !reason}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Yes, cancel my subscription
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Never mind, keep my plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
