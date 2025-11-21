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
      <div className="text-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
