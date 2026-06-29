import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-META-BUDGET] ${step}${detailsStr}`);
};

// ============================================================================
// update-meta-budget (hardened)
//
// The previous version of this function had a bug where, given an ABO
// campaign and no specific `adSetId`, it would POST a campaign-level
// `daily_budget` — which Meta silently accepts and uses to flip the
// campaign to CBO, wiping out per-ad-set budgets. That happened to a live
// client campaign (Lindsay's Masterclass, 2026-04-23) and needs to not
// be possible anymore.
//
// New rule: we query Meta for the campaign's CURRENT budget level and
// refuse to change it. Specifically:
//
//   - If campaign is CBO and caller passes adSetId  → ERROR (Meta would
//     silently flip to ABO on ad-set POST).
//   - If campaign is CBO and no adSetId             → update campaign-level
//     daily_budget. Safe — no flip.
//   - If campaign is ABO and caller passes adSetId  → update that ad set
//     only. Existing targeted path.
//   - If campaign is ABO with 1 active ad set, no adSetId → update that
//     one. Safe — preserves ABO.
//   - If campaign is ABO with ≥2 active ad sets, no adSetId → ERROR with
//     actionable guidance. Do not silently distribute or flip.
//
// Callers that want the old "distribute evenly across ad sets" behavior
// must explicitly call per-ad-set (or do it in Meta Ads Manager).
// ============================================================================

// ---------------------------------------------------------------
// Helpers shared across branches.
// ---------------------------------------------------------------
// Meta's POST /{entity_id} endpoints are inconsistent: some return
// {"success": true}, others return {"id": "..."}, and the budget
// endpoints have been observed returning both. Checking `result.success`
// alone made us throw "Failed to update ... unknown error" even when
// Meta accepted the change. The correct signal is: HTTP non-2xx OR a
// populated `error` object.
const metaPostFailed = (resp: Response, body: any): { failed: boolean; reason?: string } => {
  if (!resp.ok) {
    const err = body?.error;
    const parts = [
      err?.message || `HTTP ${resp.status}`,
      err?.code ? `code ${err.code}` : null,
      err?.error_subcode ? `subcode ${err.error_subcode}` : null,
      err?.error_user_msg ? `(${err.error_user_msg})` : null,
      err?.fbtrace_id ? `trace ${err.fbtrace_id}` : null,
    ].filter(Boolean);
    return { failed: true, reason: parts.join(" · ") };
  }
  if (body?.error) {
    const err = body.error;
    const parts = [
      err.message || "Meta returned an error",
      err.code ? `code ${err.code}` : null,
      err.error_subcode ? `subcode ${err.error_subcode}` : null,
      err.error_user_msg ? `(${err.error_user_msg})` : null,
      err.fbtrace_id ? `trace ${err.fbtrace_id}` : null,
    ].filter(Boolean);
    return { failed: true, reason: parts.join(" · ") };
  }
  return { failed: false };
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, newBudget, adSetId, preview } = await req.json();

    if (!workspaceId) throw new Error("workspaceId is required");
    if (!preview) {
      if (!newBudget || typeof newBudget !== "number" || newBudget < 1) {
        throw new Error("newBudget must be a positive number (dollars/day)");
      }
    }


    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authorization required" });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !userData.user) {
      return jsonResponse({ success: false, error: "Invalid or expired token" });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch workspace with brand
    const { data: workspace, error: wsError } = await supabase
      .from("campaign_workspaces")
      .select("*, brands!inner(id, meta_account_id, meta_access_token, user_id)")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) throw new Error("Workspace not found");

    const brand = workspace.brands as any;
    if (brand.user_id !== user.id) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return jsonResponse({ success: false, error: "Access denied" });
      }
    }

    if (!brand.meta_access_token) {
      throw new Error("Meta access token not found. Please reconnect your Meta account.");
    }

    const metaCampaignIds = workspace.meta_campaign_ids as any;
    if (!metaCampaignIds?.campaignId) {
      throw new Error("Campaign not published to Meta yet");
    }

    const campaignId = metaCampaignIds.campaignId;
    const accessToken = brand.meta_access_token;
    const budgetCents = preview ? "0" : Math.round(newBudget * 100).toString(); // Meta uses cents

    // ------------------------------------------------------------
    // Step 0: Detect current budget level (CBO vs ABO) from Meta.
    // We fetch campaign fields + its ad sets once and reason from there.
    // ------------------------------------------------------------
    // Retry helper for Meta rate-limit / transient errors. Meta surfaces
    // throttling as `error.code === 17` ("User request limit reached") or
    // 32 (page-level rate limit) — both clear after a short wait.
    const fetchMetaJson = async (url: string, label: string): Promise<any> => {
      const delays = [0, 800, 2000]; // up to 3 attempts
      let lastErr: any = null;
      for (const wait of delays) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        const resp = await fetch(url);
        const json = await resp.json();
        if (!json.error) return json;
        lastErr = json.error;
        const code = json.error?.code;
        const subcode = json.error?.error_subcode;
        logStep("Meta read failed", { label, code, subcode, message: json.error?.message });
        const transient = code === 17 || code === 32 || code === 4 || code === 613;
        if (!transient) break;
      }
      const msg = lastErr?.code === 17 || lastErr?.code === 32
        ? `Meta is rate-limiting requests right now. Please wait a minute and try again.`
        : `Failed to read ${label}: ${lastErr?.message || "unknown error"}`;
      throw new Error(msg);
    };

    // Update an ad set's daily budget, then read it back from Meta to
    // confirm the change actually landed. Returns either { ok: true,
    // verifiedCents } or { ok: false, error }.
    const updateAndVerifyAdSet = async (
      targetAdSetId: string,
    ): Promise<{ ok: true; verifiedCents: number } | { ok: false; error: string }> => {
      const url = `https://graph.facebook.com/v25.0/${targetAdSetId}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken, daily_budget: budgetCents }),
      });
      const body = await resp.json().catch(() => ({}));
      const fail = metaPostFailed(resp, body);
      if (fail.failed) {
        logStep("Ad-set budget update rejected by Meta", { adSetId: targetAdSetId, reason: fail.reason });
        return { ok: false, error: `Meta rejected the ad set budget update: ${fail.reason}` };
      }
      const verifyUrl =
        `https://graph.facebook.com/v25.0/${targetAdSetId}` +
        `?fields=id,daily_budget,lifetime_budget&access_token=${encodeURIComponent(accessToken)}`;
      const verify = await fetchMetaJson(verifyUrl, "ad set (verify)").catch((e) => ({ _err: e?.message }));
      const verifiedCents = (verify as any)?.daily_budget
        ? parseInt((verify as any).daily_budget, 10)
        : null;
      if (verifiedCents == null || Math.abs(verifiedCents - parseInt(budgetCents, 10)) > 1) {
        logStep("Ad-set budget verification mismatch", {
          adSetId: targetAdSetId,
          expected: budgetCents,
          got: verifiedCents,
        });
        return {
          ok: false,
          error:
            `Meta accepted the request but the budget didn't change. ` +
            `Expected $${newBudget}/day; Meta still reports ${
              verifiedCents == null ? "no daily budget" : `$${(verifiedCents / 100).toFixed(2)}/day`
            }. Try again in a moment, or update it directly in Ads Manager.`,
        };
      }
      return { ok: true, verifiedCents };
    };

    const campFieldsUrl =
      `https://graph.facebook.com/v25.0/${campaignId}` +
      `?fields=id,daily_budget,lifetime_budget&access_token=${encodeURIComponent(accessToken)}`;
    const campData = await fetchMetaJson(campFieldsUrl, "campaign");

    // A campaign is CBO when it has a campaign-level budget. Meta ensures
    // that CBO campaigns cannot also have ad-set-level budgets, and vice
    // versa — so this flag is authoritative.
    const isCBO = !!(campData.daily_budget || campData.lifetime_budget);

    // Fast path for CBO campaigns. Reading ad sets is unnecessary here and is
    // the call most likely to hit Meta's user-level rate limit. This keeps the
    // approve flow safe while cutting one Marketing API read from the hot path.
    if (isCBO) {
      logStep("Detected budget level", {
        campaignId,
        isCBO,
        adSetCount: null,
        activeAdSetCount: null,
        adSetIdRequested: adSetId || null,
      });

      if (preview) {
        return jsonResponse({
          success: true,
          preview: true,
          isCBO,
          level: "campaign",
          current_daily_budget: campData.daily_budget ? parseFloat(campData.daily_budget) / 100 : null,
          ad_set_id: null,
          active_ad_sets: [],
        });
      }

      if (adSetId) {
        return jsonResponse({
          success: false,
          error:
            `This campaign uses Campaign Budget Optimization (CBO), so individual ad sets don't have their own budgets. ` +
            `To change the budget, update the campaign budget without specifying an ad set.`,
        });
      }

      const campaignUrl = `https://graph.facebook.com/v25.0/${campaignId}`;
      const resp = await fetch(campaignUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          access_token: accessToken,
          daily_budget: budgetCents,
        }),
      });
      const result = await resp.json().catch(() => ({}));
      const fail = metaPostFailed(resp, result);
      if (fail.failed) {
        logStep("Campaign budget update rejected by Meta", { reason: fail.reason });
        return jsonResponse({
          success: false,
          error: `Meta rejected the campaign budget update: ${fail.reason}`,
        });
      }

      // Read-back: confirm Meta actually persisted the new value.
      const verifyUrl =
        `https://graph.facebook.com/v25.0/${campaignId}` +
        `?fields=id,daily_budget,lifetime_budget&access_token=${encodeURIComponent(accessToken)}`;
      const verify = await fetchMetaJson(verifyUrl, "campaign (verify)").catch((e) => ({ _err: e?.message }));
      const verifiedCents = (verify as any)?.daily_budget ? parseInt((verify as any).daily_budget, 10) : null;
      if (verifiedCents == null || Math.abs(verifiedCents - parseInt(budgetCents, 10)) > 1) {
        logStep("Campaign budget verification mismatch", { expected: budgetCents, got: verifiedCents });
        return jsonResponse({
          success: false,
          error:
            `Meta accepted the request but the budget didn't change. ` +
            `Expected $${newBudget}/day; Meta still reports ${verifiedCents == null ? "no daily budget" : `$${(verifiedCents / 100).toFixed(2)}/day`}. ` +
            `Try again in a moment, or update it directly in Ads Manager.`,
        });
      }

      await supabase.from("ad_action_log").insert({
        brand_id: brand.id,
        workspace_id: workspaceId,
        action_type: "budget_update",
        action_detail: {
          level: "campaign",
          campaign_id: campaignId,
          new_budget: newBudget,
          verified_daily_budget: verifiedCents / 100,
        },
        source: "user",
      });

      return jsonResponse({
        success: true,
        level: "campaign",
        new_budget: newBudget,
        verified_daily_budget: verifiedCents / 100,
        message: `Budget updated to $${newBudget}/day on Meta`,
      });
    }

    // Fast path for explicit ABO ad-set targets. The UI often already knows
    // which ad set should be scaled from evaluate-campaign-status, so don't
    // burn another expensive `/{campaign}/adsets` list call just to preview or
    // update one target. That list call is what was surfacing as a misleading
    // Meta "User request limit reached" toast.
    if (adSetId) {
      const adSetUrl =
        `https://graph.facebook.com/v25.0/${adSetId}` +
        `?fields=id,name,daily_budget,lifetime_budget,status,campaign_id&access_token=${encodeURIComponent(accessToken)}`;
      const adSetData = await fetchMetaJson(adSetUrl, "ad set");
      if (adSetData?.campaign_id && String(adSetData.campaign_id) !== String(campaignId)) {
        throw new Error(`Ad set ${adSetId} does not belong to campaign ${campaignId}`);
      }

      if (preview) {
        return jsonResponse({
          success: true,
          preview: true,
          isCBO,
          level: "adset",
          current_daily_budget: adSetData.daily_budget ? parseFloat(adSetData.daily_budget) / 100 : null,
          ad_set_id: adSetId,
          active_ad_sets: [{
            id: adSetId,
            name: adSetData.name,
            status: adSetData.status,
            dailyBudget: adSetData.daily_budget ? parseFloat(adSetData.daily_budget) / 100 : null,
          }],
        });
      }

      const r = await updateAndVerifyAdSet(adSetId);
      if (!r.ok) return jsonResponse({ success: false, error: r.error });

      await supabase.from("ad_action_log").insert({
        brand_id: brand.id,
        workspace_id: workspaceId,
        action_type: "budget_update",
        action_detail: {
          level: "adset_targeted",
          campaign_id: campaignId,
          ad_set_id: adSetId,
          new_budget: newBudget,
          verified_daily_budget: r.verifiedCents / 100,
        },
        source: "user",
        meta_entity_id: adSetId,
      });

      return jsonResponse({
        success: true,
        level: "adset_targeted",
        ad_set_id: adSetId,
        new_budget: newBudget,
        verified_daily_budget: r.verifiedCents / 100,
        message: `Budget updated to $${newBudget}/day on the target ad set`,
      });
    }

    const adSetsListUrl =
      `https://graph.facebook.com/v25.0/${campaignId}/adsets` +
      `?fields=id,name,daily_budget,lifetime_budget,status&limit=100&access_token=${encodeURIComponent(accessToken)}`;
    const adSetsData = await fetchMetaJson(adSetsListUrl, "ad sets");
    const allAdSets: any[] = Array.isArray(adSetsData.data) ? adSetsData.data : [];
    const activeAdSets = allAdSets.filter(
      (as: any) => as.status === "ACTIVE" || as.status === "PAUSED",
    );

    logStep("Detected budget level", {
      campaignId,
      isCBO,
      adSetCount: allAdSets.length,
      activeAdSetCount: activeAdSets.length,
      adSetIdRequested: adSetId || null,
    });

    // ------------------------------------------------------------
    // Preview branch — read-only. Returns the current daily budget
    // (in dollars) for the requested level + whether the campaign is CBO.
    // No POST / mutation happens here.
    // ------------------------------------------------------------
    if (preview) {
      let currentDaily: number | null = null;
      let level: "campaign" | "adset" | "adset_single" | "ambiguous" = "campaign";
      if (isCBO) {
        level = "campaign";
        currentDaily = campData.daily_budget ? parseFloat(campData.daily_budget) / 100 : null;
      } else if (adSetId) {
        const match = allAdSets.find((as) => as.id === adSetId);
        level = "adset";
        currentDaily = match?.daily_budget ? parseFloat(match.daily_budget) / 100 : null;
      } else if (activeAdSets.length === 1) {
        level = "adset_single";
        currentDaily = activeAdSets[0].daily_budget
          ? parseFloat(activeAdSets[0].daily_budget) / 100
          : null;
      } else {
        level = "ambiguous";
      }
      return jsonResponse(
        {
          success: true,
          preview: true,
          isCBO,
          level,
          current_daily_budget: currentDaily,
          ad_set_id: level === "adset" ? adSetId : level === "adset_single" ? activeAdSets[0].id : null,
          active_ad_sets: activeAdSets.map((as: any) => ({
            id: as.id,
            name: as.name,
            status: as.status,
            dailyBudget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
          })),
        }
      );
    }

    // ------------------------------------------------------------
    // Case A — caller specified an ad set to target.
    // ------------------------------------------------------------
    if (adSetId) {

      // Guard: if the campaign is CBO, updating a single ad set's budget
      // would either fail or (worse) flip the campaign to ABO. Refuse.
      if (isCBO) {
        return jsonResponse(
          {
            success: false,
            error:
              `This campaign uses Campaign Budget Optimization (CBO), so individual ad sets don't have their own budgets. ` +
              `To change the budget, either (a) update the campaign budget without specifying an ad set, or (b) switch the campaign to Ad Set Budgets in Meta Ads Manager first.`,
          }
        );
      }

      // Verify the ad set actually belongs to this campaign.
      if (!allAdSets.some((as) => as.id === adSetId)) {
        throw new Error(`Ad set ${adSetId} not found under campaign ${campaignId}`);
      }

      const targetUrl = `https://graph.facebook.com/v25.0/${adSetId}`;
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          access_token: accessToken,
          daily_budget: budgetCents,
        }),
      });
      const result = await resp.json();
      if (!result.success) {
        throw new Error(
          `Failed to update ad set budget: ${result.error?.message || "unknown error"}`,
        );
      }

      await supabase.from("ad_action_log").insert({
        brand_id: brand.id,
        workspace_id: workspaceId,
        action_type: "budget_update",
        action_detail: {
          level: "adset_targeted",
          campaign_id: campaignId,
          ad_set_id: adSetId,
          new_budget: newBudget,
        },
        source: "user",
        meta_entity_id: adSetId,
      });

      return jsonResponse(
        {
          success: true,
          level: "adset_targeted",
          ad_set_id: adSetId,
          new_budget: newBudget,
          message: `Budget updated to $${newBudget}/day on the target ad set`,
        }
      );
    }

    // ------------------------------------------------------------
    // Case B — no ad set specified, campaign is ABO.
    // Never distribute + never flip. If there's exactly one ad set we
    // can safely target it; otherwise we error out and ask the caller
    // to pick. This replaces the old "divide evenly across all sets"
    // behavior which rewrote user-configured per-set budgets.
    // ------------------------------------------------------------
    if (activeAdSets.length === 0) {
      throw new Error("No active or paused ad sets found on this campaign to update");
    }

    if (activeAdSets.length === 1) {
      const only = activeAdSets[0];
      const resp = await fetch(`https://graph.facebook.com/v25.0/${only.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          access_token: accessToken,
          daily_budget: budgetCents,
        }),
      });
      const result = await resp.json();
      if (!result.success) {
        throw new Error(
          `Failed to update ad set budget: ${result.error?.message || "unknown error"}`,
        );
      }

      await supabase.from("ad_action_log").insert({
        brand_id: brand.id,
        workspace_id: workspaceId,
        action_type: "budget_update",
        action_detail: {
          level: "adset_single",
          campaign_id: campaignId,
          ad_set_id: only.id,
          new_budget: newBudget,
        },
        source: "user",
        meta_entity_id: only.id,
      });

      return jsonResponse(
        {
          success: true,
          level: "adset_single",
          ad_set_id: only.id,
          new_budget: newBudget,
          message: `Budget updated to $${newBudget}/day on the only active ad set`,
        }
      );
    }

    // Multiple active ad sets — ambiguous. Refuse to act. This is the
    // case that caused the damage to Lindsay's Masterclass on 2026-04-23.
    return jsonResponse(
      {
        success: false,
        error:
          `This campaign uses Ad Set Budgets (ABO) with ${activeAdSets.length} active ad sets. ` +
          `To change budget, specify which ad set to update (e.g. the "Scaling" set from a Testing + Scaling structure). ` +
          `If you want to change all of them, edit each ad set's budget in Meta Ads Manager directly.`,
        adSets: activeAdSets.map((as: any) => ({
          id: as.id,
          name: as.name,
          status: as.status,
          dailyBudget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
        })),
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return jsonResponse({ success: false, error: message });
  }
});
