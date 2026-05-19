import { supabase } from "@/integrations/supabase/client";

interface AutoBugReportOptions {
  context: string; // short label, e.g. "Campaign publish failed"
  errorMessage: string;
  extra?: Record<string, any>;
}

// Best-effort: silently submits a bug report so users don't have to.
// Dedupes within a 60s window per context+message to avoid spamming.
const recentSubmissions = new Map<string, number>();

export async function autoSubmitBugReport({ context, errorMessage, extra }: AutoBugReportOptions) {
  try {
    const key = `${context}::${errorMessage}`;
    const now = Date.now();
    const last = recentSubmissions.get(key) || 0;
    if (now - last < 60_000) return;
    recentSubmissions.set(key, now);

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "auto-report@adsbylumi.com";

    const details =
      `[AUTO-SUBMITTED]\n\n` +
      `Context: ${context}\n` +
      `Error: ${errorMessage}\n` +
      (extra ? `\nDetails:\n${JSON.stringify(extra, null, 2)}\n` : "");

    await supabase.functions.invoke("send-bug-report", {
      body: {
        userEmail,
        details,
        context: `[AUTO] ${context}`,
        currentPage: window.location.pathname,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        conversationContext: "",
        autoSubmitted: true,
      },
    });
  } catch (err) {
    // Never let the auto-reporter throw
    console.warn("autoSubmitBugReport failed (non-fatal):", err);
  }
}
