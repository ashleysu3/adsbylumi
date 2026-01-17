import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

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
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 w-full max-w-sm px-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))] rounded-full animate-pulse w-3/4" />
        </div>
        <p className="text-sm text-muted-foreground">Hang tight—we've got this.</p>
      </div>
    </div>
  );
}
