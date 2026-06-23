// Shared task-execution logic used by both the TasksTray "LUMI can do this"
// button and the /performance hero "Do it" button. One execution path.
import { supabase } from "@/integrations/supabase/client";

export type TaskActionType = "pause" | "budget" | "rotate";

export interface PausePayload {
  workspaceId: string;
  brandId: string;
  entityId: string;
  entityLevel: "campaign" | "adset" | "ad";
  reason?: string;
}

export interface BudgetPayload {
  workspaceId: string;
  brandId: string;
  entityId: string; // adset id or campaign id (for matching tasks)
  level: "adset" | "campaign";
  kind: "increase_budget" | "reduce_budget";
  currentBudget?: number | null;
  proposedBudget?: number | null;
  adSetId?: string | null;
}

export interface RotatePayload {
  workspaceId: string;
  brandId: string;
  fatigueAdId: string;   // also used as entityId for dedupe
  fatigueAdName?: string;
  reason?: string;
}

export async function executePause(p: PausePayload) {
  const { data, error } = await supabase.functions.invoke("pause-meta-entity", {
    body: {
      workspaceId: p.workspaceId,
      brandId: p.brandId,
      entityId: p.entityId,
      entityLevel: p.entityLevel,
      reason: p.reason || "Approved Lumi recommendation",
    },
  });
  if (error) return { ok: false as const, error: error.message };
  if (!data?.success) return { ok: false as const, error: data?.error || "Unknown error" };
  return { ok: true as const };
}

export async function previewBudget(opts: { workspaceId: string; adSetId?: string }) {
  const { data, error } = await supabase.functions.invoke("update-meta-budget", {
    body: { workspaceId: opts.workspaceId, adSetId: opts.adSetId, preview: true },
  });
  if (error) return { ok: false as const, error: error.message };
  if (!data?.success) return { ok: false as const, error: data?.error || "Unknown error" };
  return {
    ok: true as const,
    isCBO: !!data.isCBO,
    level: data.level as string,
    current: (data.current_daily_budget ?? null) as number | null,
    adSetId: (data.ad_set_id ?? null) as string | null,
  };
}

export async function executeBudget(opts: { workspaceId: string; newBudget: number; adSetId?: string }) {
  const call = (adSetId?: string) =>
    supabase.functions.invoke("update-meta-budget", {
      body: { workspaceId: opts.workspaceId, newBudget: opts.newBudget, adSetId },
    });
  let { data, error } = await call(opts.adSetId);
  const cboRefusal =
    data?.error && typeof data.error === "string" && /Campaign Budget Optimization \(CBO\)/i.test(data.error);
  if (cboRefusal && opts.adSetId) {
    ({ data, error } = await call(undefined));
  }
  if (error) return { ok: false as const, error: error.message };
  if (!data?.success) return { ok: false as const, error: data?.error || "Unknown error" };
  return { ok: true as const };
}

export async function executeRotate(p: RotatePayload & { benchAdId: string }) {
  const { data, error } = await supabase.functions.invoke("rotate-creative", {
    body: {
      workspaceId: p.workspaceId,
      brandId: p.brandId,
      fatigueAdId: p.fatigueAdId,
      benchAdId: p.benchAdId,
      reason: p.reason || "Approved Lumi recommendation",
      isAutoRotation: false,
    },
  });
  if (error) return { ok: false as const, error: error.message };
  if (!data?.success) return { ok: false as const, error: data?.error || "Unknown error" };
  return { ok: true as const };
}

/**
 * Mark any OPEN task that targets this entity+action as done. Used so
 * completing an action from the Performance hero also closes the matching
 * tray task (and vice-versa).
 */
export async function closeMatchingTasks(opts: {
  actionType: TaskActionType;
  entityId: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // Match on action_payload->>entityId — postgrest JSON filter.
  const { error } = await supabase
    .from("tasks" as any)
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("action_type", opts.actionType)
    .filter("action_payload->>entityId", "eq", opts.entityId);
  if (error) console.warn("[closeMatchingTasks] failed", error);
}

// ---------------------------------------------------------------------------
// Recommendation → Task upsert
// ---------------------------------------------------------------------------

export interface RecForTask {
  entityId: string;            // ad/adset/campaign id from evaluate engine
  entityName: string;
  entityLevel: "campaign" | "adset" | "ad";
  workspaceId: string;
  brandId: string;
  action: string;              // turn_off | refresh_creative | increase_budget | ...
  reasoning: string;
  /** When refresh_creative: does the brand have a bench candidate ready? */
  hasBench?: boolean;
  /** Current budget (when budget action). */
  currentBudget?: number | null;
  /** Specific ad set to update when a campaign-level ABO budget rec needs a safe target. */
  adSetId?: string | null;
}

export interface UpsertedTask {
  recId: string;       // entityId+action
  taskAction: TaskActionType | null;
}

const VERB_PREFIX: Record<string, string> = {
  turn_off: "Turn off",
  refresh_creative: "Refresh creative for",
  increase_budget: "Increase budget on",
  reduce_budget: "Reduce budget on",
  promote_to_scaling: "Promote to scaling",
  add_similar_variants: "Add more like",
  push_delivery: "Push delivery on",
  broaden_audience: "Broaden audience on",
  hold: "Hold steady on",
  wait: "Give more time to",
};

function buildTitle(action: string, name: string) {
  const verb = VERB_PREFIX[action] || action;
  return `${verb} "${name}"`;
}

function mapAction(rec: RecForTask): {
  actionType: TaskActionType | null;
  linkTo: string | null;
} {
  switch (rec.action) {
    case "turn_off":
      return { actionType: "pause", linkTo: null };
    case "increase_budget":
    case "reduce_budget":
      return { actionType: "budget", linkTo: null };
    case "refresh_creative":
      return rec.hasBench
        ? { actionType: "rotate", linkTo: null }
        : { actionType: null, linkTo: `/creative-studio?workspace=${rec.workspaceId}&refreshCreative=true` };
    case "promote_to_scaling":
      return { actionType: null, linkTo: "/launch" };
    case "add_similar_variants":
      return { actionType: null, linkTo: `/creative-studio?workspace=${rec.workspaceId}` };
    case "push_delivery":
    case "broaden_audience":
      return { actionType: null, linkTo: "/ad-performance" };
    default:
      return { actionType: null, linkTo: null };
  }
}

/**
 * For each actionable recommendation, insert an open task — unless an open
 * task for the same entity+action already exists. Returns nothing; safe to
 * call repeatedly on every Performance page load.
 */
export async function upsertRecommendationTasks(recs: RecForTask[]) {
  if (!recs.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Load existing open tasks for this user that came from a recommendation
  // so we can dedupe in-memory (cheaper than per-rec round trips).
  const { data: existing } = await supabase
    .from("tasks" as any)
    .select("id, action_type, action_payload")
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("source", "recommendation");

  const seen = new Set<string>();
  (existing || []).forEach((t: any) => {
    const eid = t?.action_payload?.entityId;
    const at = t?.action_type ?? "none";
    if (eid) seen.add(`${at}:${eid}`);
  });

  const inserts: any[] = [];
  for (const rec of recs) {
    const { actionType, linkTo } = mapAction(rec);
    // Skip purely-info recs (hold, wait, default) with no link.
    if (!actionType && !linkTo) continue;
    const key = `${actionType ?? "none"}:${rec.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const payload: any = {
      entityId: rec.entityId,
      entityLevel: rec.entityLevel,
      workspaceId: rec.workspaceId,
      brandId: rec.brandId,
      action: rec.action,
    };
    if (actionType === "budget") {
      payload.kind = rec.action; // increase_budget | reduce_budget
      payload.currentBudget = rec.currentBudget ?? null;
      payload.adSetId = rec.adSetId ?? null;
    }
    if (actionType === "rotate") {
      payload.fatigueAdId = rec.entityId;
      payload.fatigueAdName = rec.entityName;
    }
    inserts.push({
      user_id: user.id,
      brand_id: rec.brandId,
      title: buildTitle(rec.action, rec.entityName),
      description: rec.reasoning,
      source: "recommendation",
      link_to: linkTo,
      action_type: actionType,
      action_payload: payload,
      status: "open",
    });
  }

  if (!inserts.length) return;
  const { error } = await supabase.from("tasks" as any).insert(inserts);
  if (error) console.warn("[upsertRecommendationTasks] insert failed", error);
}
