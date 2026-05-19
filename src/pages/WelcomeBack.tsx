import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WelcomeBack = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("t");
  const [busy, setBusy] = useState<"fresh" | "resume" | null>(null);

  const choose = async (choice: "fresh" | "resume") => {
    setBusy(choice);
    // Record the choice (best-effort) tied to the offer
    if (token) {
      try {
        await supabase.functions.invoke("winback-offer", {
          body: { action: "set_start_choice", token, choice },
        });
      } catch {
        // non-fatal
      }
    }
    // Route appropriately. Both require sign-in — auth page handles redirect.
    const dest = choice === "fresh" ? "/onboarding" : "/dashboard";
    navigate(`/auth?redirect=${encodeURIComponent(dest)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
            Welcome back 👋
          </h1>
          <p className="text-muted-foreground">
            Your trial is active. How would you like to start?
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <RotateCcw className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Pick up where I left off</CardTitle>
              <CardDescription>
                Keep your previous brand, campaigns, and creative library. Jump straight back into your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => choose("resume")}
                disabled={busy !== null}
              >
                {busy === "resume" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Resume my account
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardHeader>
              <Sparkles className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Start fresh</CardTitle>
              <CardDescription>
                Walk through onboarding again to set up a new brand from scratch. Your old data stays available in your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => choose("fresh")}
                disabled={busy !== null}
              >
                {busy === "fresh" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Start fresh
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBack;
