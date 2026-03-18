import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CancellationPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <Button
          variant="ghost"
          size="sm"
          className="mb-8 text-muted-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Cancellation Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: March 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. How to Cancel</h2>
            <p>
              You can cancel your LUMI subscription at any time directly from your <strong>Account Settings</strong> page.
              Simply navigate to <em>Settings → Subscription</em> and click "Cancel Subscription." No phone calls, no
              hoops to jump through.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. What Happens When You Cancel</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Your subscription remains active until the end of your current billing period. You will not be charged
                again after cancellation.
              </li>
              <li>
                Any active Meta ad campaigns managed through LUMI will be <strong>automatically paused</strong> (not deleted)
                at the end of your billing period to prevent unwanted ad spend.
              </li>
              <li>
                You'll receive a confirmation email with details about your access-until date and a link to verify your
                campaign status in Meta Ads Manager.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Your Data</h2>
            <p>
              After cancellation, your brand data, creative assets, and campaign history are retained for <strong>90 days</strong>.
              If you resubscribe within that window, everything will be right where you left it. After 90 days, your data
              may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Refunds</h2>
            <p>
              LUMI subscriptions are billed monthly. We do not offer prorated refunds for partial months. If you cancel
              mid-cycle, you retain full access until the end of that billing period.
            </p>
            <p>
              If you believe you were charged in error or have extenuating circumstances, please reach out to{" "}
              <a href="mailto:support@adsbylumi.com" className="text-primary underline underline-offset-2">
                support@adsbylumi.com
              </a>{" "}
              and we'll do our best to make it right.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Reactivation</h2>
            <p>
              Changed your mind? You can reactivate your subscription at any time from your Account Settings. If you're
              within the 90-day data retention window, all your previous data will be restored automatically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Questions?</h2>
            <p>
              We're here to help. Email us at{" "}
              <a href="mailto:support@adsbylumi.com" className="text-primary underline underline-offset-2">
                support@adsbylumi.com
              </a>{" "}
              with any questions about your subscription or cancellation.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
