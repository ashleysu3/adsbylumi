import { supabase } from "@/integrations/supabase/client";

export type MetaCheckType =
  | "auto_test"
  | "manual_test"
  | "refresh"
  | "diagnostic"
  | "disconnect";

export type MetaCheckOutcome = "success" | "warning" | "error";

export interface MetaCheckItem {
  /** Short label, e.g. "Token valid", "Permissions", "Pixel" */
  label: string;
  /** "pass" | "fail" | "warn" | "skip" */
  status: "pass" | "fail" | "warn" | "skip";
  /** Optional detail for this individual check */
  note?: string;
}

interface LogMetaCheckArgs {
  brandId: string;
  userId: string;
  checkType: MetaCheckType;
  outcome: MetaCheckOutcome;
  summary: string;
  checksPerformed?: MetaCheckItem[];
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget logger for Meta connection checks.
 * Failures are swallowed so debugging logs never break the user's flow.
 */
export async function logMetaConnectionCheck(args: LogMetaCheckArgs): Promise<void> {
  try {
    await supabase.from("meta_connection_checks" as any).insert({
      brand_id: args.brandId,
      user_id: args.userId,
      check_type: args.checkType,
      outcome: args.outcome,
      summary: args.summary,
      checks_performed: args.checksPerformed ?? [],
      details: args.details ?? {},
    });
  } catch (err) {
    // Never throw — this is just a debug log
    // eslint-disable-next-line no-console
    console.warn("Failed to log Meta connection check:", err);
  }
}
