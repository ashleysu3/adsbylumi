import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatInvokeError } from "@/lib/formatInvokeError";
import { Button } from "@/components/ui/button";

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Hang tight—we've got this.");
  const [mode, setMode] = useState<"loading" | "needs-auth" | "error" | "success">("loading");

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const brandId = searchParams.get('state');

    // Must match the exact redirect URI that initiated the flow
    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    // Persist the callback payload early (so we can recover after a forced re-login)
    try {
      sessionStorage.setItem(
        "meta_oauth_pending",
        JSON.stringify({
          code,
          error,
          errorDescription,
          brandId,
          redirectUri,
          at: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }

    // Popup flow — complete the exchange here and send the full payload back to the opener.
    // This prevents the parent window from needing to re-invoke the callback (and eliminates race conditions).
    if (window.opener) {
      (async () => {
        try {
          if (error) {
            window.opener.postMessage(
              { type: 'META_OAUTH_ERROR', error: errorDescription || error },
              window.location.origin
            );
            window.close();
            return;
          }

          if (!code) {
            window.opener.postMessage(
              { type: 'META_OAUTH_ERROR', error: 'Missing authorization code.' },
              window.location.origin
            );
            window.close();
            return;
          }

          if (!brandId) {
            window.opener.postMessage(
              { type: 'META_OAUTH_ERROR', error: 'Missing brand context (state).' },
              window.location.origin
            );
            window.close();
            return;
          }

          // Ensure the popup has a session (same-site cookies sometimes fail depending on browser settings)
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            // Session lost in popup (common with strict cookie policies like Safari/Incognito)
            // Tell the opener to navigate to the callback URL directly (same-tab flow)
            // which has proper session recovery UI
            const callbackUrl = window.location.href;
            window.opener.postMessage(
              { 
                type: 'META_OAUTH_FALLBACK_TO_SAME_TAB', 
                callbackUrl 
              },
              window.location.origin
            );
            window.close();
            return;
          }

          const invokeWithTimeout = async () => {
            const invokePromise = supabase.functions.invoke('meta-oauth-callback', {
              body: { code, brandId, redirectUri },
            });

            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Request timed out. Please try again.')), 45000);
            });

            return Promise.race([invokePromise, timeoutPromise]);
          };

          const { data, error: invokeError } = await invokeWithTimeout();
          if (invokeError) throw invokeError;
          if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'OAuth callback failed');

          window.opener.postMessage(
            { type: 'META_OAUTH_SUCCESS', code, data },
            window.location.origin
          );
          window.close();
        } catch (e: any) {
          const msg = formatInvokeError(e);
          try {
            window.opener.postMessage(
              { type: 'META_OAUTH_ERROR', error: msg },
              window.location.origin
            );
          } catch {
            // ignore
          }
          window.close();
        }
      })();

      return;
    }

    // Same-tab flow (e.g. Meta Settings) — complete the exchange here.
    (async () => {
      try {
        if (error) {
          const msg = errorDescription || error;
          setMessage(msg || "Meta connection failed.");
          toast.error(msg || "Meta connection failed");
          setMode("error");
          return;
        }

        if (!code) {
          setMessage("Missing authorization code.");
          toast.error("Missing authorization code");
          setMode("error");
          return;
        }

        if (!brandId) {
          setMessage("Missing brand context (state).");
          toast.error("Missing brand context");
          setMode("error");
          return;
        }

        // If the user isn't authenticated (common after redirects), ask them to sign in,
        // then continue the token exchange on return.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          setMessage("Please sign in to finish connecting your Meta account.");
          setMode("needs-auth");
          return;
        }

        setMessage("Finishing your connection…");
        setMode("loading");

        const invokeWithTimeout = async () => {
          const invokePromise = supabase.functions.invoke("meta-oauth-callback", {
            body: { code, brandId, redirectUri },
          });

            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("Request timed out. Please try again.")), 45000);
            });

          return Promise.race([invokePromise, timeoutPromise]);
        };

        const { data, error: invokeError } = await invokeWithTimeout();

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "OAuth callback failed");

        // Keep response available for debugging/follow-up UI if needed.
        try {
          sessionStorage.setItem("meta_oauth_last_result", JSON.stringify(data));
        } catch {
          // ignore
        }

        toast.success("Meta connected — almost there");
        setMode("success");

        // Give the UI a moment to render the success state before redirecting.
        setTimeout(() => {
          navigate("/settings/meta", { replace: true });
        }, 600);
      } catch (e: any) {
        const msg = formatInvokeError(e);
        setMessage(msg);
        toast.error(msg);
        setMode(msg.toLowerCase().includes("authorization") ? "needs-auth" : "error");

        try {
          sessionStorage.setItem(
            "meta_oauth_last_error",
            JSON.stringify({ message: msg, at: new Date().toISOString() })
          );
        } catch {
          // ignore
        }
      }
    })();
  }, [searchParams, navigate]);

  const currentCallbackPath = `${window.location.pathname}${window.location.search}`;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 w-full max-w-sm px-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))] rounded-full animate-pulse w-3/4" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>

        {mode === "needs-auth" && (
          <div className="pt-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              Your session expired during the connection. Sign in to complete the setup—your Meta authorization is saved.
            </p>
            <Button
              variant="lumi"
              className="w-full"
              onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(currentCallbackPath)}`)}
            >
              Sign in to continue
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/meta-settings")}>
              Cancel
            </Button>
          </div>
        )}

        {mode === "error" && (
          <div className="pt-2">
            <Button variant="ghost" className="w-full" onClick={() => navigate("/settings/meta")}
            >
              Back to Meta settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
