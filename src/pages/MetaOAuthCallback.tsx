import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatInvokeError } from "@/lib/formatInvokeError";

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Hang tight—we've got this.");

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const brandId = searchParams.get('state');

    // Must match the exact redirect URI that initiated the flow
    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    if (window.opener) {
      if (error) {
        window.opener.postMessage(
          { 
            type: 'META_OAUTH_ERROR', 
            error: errorDescription || error 
          },
          window.location.origin
        );
      } else if (code) {
        window.opener.postMessage(
          { 
            type: 'META_OAUTH_SUCCESS', 
            code 
          },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    // Same-tab flow (e.g. Meta Settings) — complete the exchange here.
    (async () => {
      try {
        if (error) {
          const msg = errorDescription || error;
          setMessage(msg || "Meta connection failed.");
          toast.error(msg || "Meta connection failed");
          // Send them back to settings so they can retry.
          navigate("/settings/meta", { replace: true });
          return;
        }

        if (!code) {
          setMessage("Missing authorization code.");
          toast.error("Missing authorization code");
          navigate("/settings/meta", { replace: true });
          return;
        }

        if (!brandId) {
          setMessage("Missing brand context (state).");
          toast.error("Missing brand context");
          navigate("/settings/meta", { replace: true });
          return;
        }

        setMessage("Finishing your connection…");

        const { data, error: invokeError } = await supabase.functions.invoke(
          "meta-oauth-callback",
          {
            body: { code, brandId, redirectUri },
          }
        );

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "OAuth callback failed");

        // Keep response available for debugging/follow-up UI if needed.
        try {
          sessionStorage.setItem("meta_oauth_last_result", JSON.stringify(data));
        } catch {
          // ignore
        }

        toast.success("Meta connected — almost there");
        navigate("/settings/meta", { replace: true });
      } catch (e: any) {
        const msg = formatInvokeError(e);
        setMessage(msg);
        toast.error(msg);
        navigate("/settings/meta", { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 w-full max-w-sm px-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))] rounded-full animate-pulse w-3/4" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
