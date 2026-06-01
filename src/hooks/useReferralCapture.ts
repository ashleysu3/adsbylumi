import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "lumi_ref_code";

export function useReferralCapture() {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem(STORAGE_KEY, ref.toUpperCase());
  }, [location.search]);

  // Attempt to claim referral once user is authenticated
  useEffect(() => {
    const claim = async () => {
      const code = localStorage.getItem(STORAGE_KEY);
      if (!code) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        await supabase.functions.invoke("capture-referral", { body: { code } });
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore — will retry
      }
    };
    claim();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setTimeout(claim, 500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}

export function getStoredReferralCode(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
