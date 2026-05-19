import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Gift } from "lucide-react";
import { toast } from "sonner";

interface OfferData {
  id: string;
  email: string;
  status: string;
  trial_days: number;
  offered_price_cents: number;
  currency: string;
  interval: string;
  expires_at: string;
  accepted_at: string | null;
}

const Reactivate = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [card, setCard] = useState<{ last4: string; brand: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing offer token");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("winback-offer", {
          body: { action: "get", token },
        });
        if (invokeErr) throw invokeErr;
        if (data?.error) {
          setError(data.error);
        } else {
          setOffer(data.offer);
          setCard(data.card);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load offer");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    if (!consent || !token) return;
    setSubmitting(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("winback-offer", {
        body: { action: "accept", token, consent: true },
      });
      if (invokeErr) throw invokeErr;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Welcome back! Your trial is now active.");
      // Pass the token along to the welcome-back page for tracking the choice
      navigate(`/welcome-back?t=${token}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not activate trial");
    } finally {
      setSubmitting(false);
    }
  };

  const priceDisplay = offer
    ? `$${(offer.offered_price_cents / 100).toFixed(2)}/${offer.interval}`
    : "";
  const trialEndDate = offer
    ? new Date(Date.now() + offer.trial_days * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-destructive" />
              <CardTitle>Offer unavailable</CardTitle>
            </div>
            <CardDescription>{error || "We couldn't find this offer."}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If you think this is a mistake, reply to your offer email and we'll sort it out.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (offer.status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <CardTitle>Already reactivated</CardTitle>
            </div>
            <CardDescription>This offer was already accepted. Welcome back!</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (offer.status === "expired" || offer.status === "revoked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>This offer has expired</CardTitle>
            <CardDescription>
              Reach out to support and we'll send you a fresh one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-6 h-6 text-emerald-600" />
            <CardTitle>Welcome back to Lumi</CardTitle>
          </div>
          <CardDescription>
            Your {offer.trial_days}-day free trial starts the moment you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium">{offer.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Free trial</span>
              <span className="font-medium">{offer.trial_days} days, on us</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trial ends</span>
              <span className="font-medium">{trialEndDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Then billed</span>
              <span className="font-medium">{priceDisplay}</span>
            </div>
            {card && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card on file</span>
                <span className="font-medium capitalize">
                  {card.brand} •••• {card.last4}
                </span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            Cancel anytime before {trialEndDate} and you won't be charged. After that date, your card on file
            will be charged {priceDisplay} automatically and renew each {offer.interval} until you cancel.
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              I understand and agree to reactivate my subscription. I authorize Lumi to charge my card on file{" "}
              <strong>{priceDisplay}</strong> starting {trialEndDate} unless I cancel before then.
            </span>
          </label>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!consent || submitting}
            onClick={handleConfirm}
            size="lg"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Confirm & Reactivate
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reactivate;
