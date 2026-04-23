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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, newBudget, adSetId } = await req.json();

    if (!workspaceId) throw new Error("workspaceId is required");
    if (!newBudget || typeof newBudget !== "number" || newBudget < 1) {
      throw new Error("newBudget must be a positive number (dollars/day)");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
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
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
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
    const budgetCents = Math.round(newBudget * 100).toString(); // Meta uses cents

    // ------------------------------------------------------------
    // Step 0: Detect current budget level (CBO vs ABO) from Meta.
    // We fetch campaign fields + its ad sets once and reason from there.
    // ------------------------------------------------------------
    const campFieldsUrl =
      `https://graph.facebook.com/v21.0/${campaignId}` +
      `?fields=id,daily_budget,lifetime_budget&access_token=${encodeURIComponent(accessToken)}`;
    const campFetch = await fetch(campFieldsUrl);
    const campData = await campFetch.json();
    if (campData.error) {
      throw new Error(`Failed to read campaign: ${campData.error.message}`);
    }

    const adSetsListUrl =
      `https://graph.facebook.com/v21.0/${campaignId}/adsets` +
      `?fields=id,name,daily_budget,lifetime_budget,status&limit=100&access_token=${encodeURIComponent(accessToken)}`;
    const adSetsResp = await fetch(adSetsListUrl);
    const adSetsData = await adSetsResp.json();
    if (adSetsData.error) {
      throw new Error(`Failed to read ad sets: ${adSetsData.error.message}`);
    }
    const allAdSets: any[] = Array.isArray(adSetsData.data) ? adSetsData.data : [];
    const activeAdSets = allAdSets.filter(
      (as: any) => as.status === "ACTIVE" || as.status === "PAUSED",
    );

    // A campaign is CBO when it has a campaign-level budget. Meta ensures
    // that CBO campaigns cannot also have ad-set-level budgets, and vice
    // versa — so this flag is authoritative.
    const isCBO = !!(campData.daily_budget || campData.lifetime_budget);

    logStep("Detected budget level", {
      campaignId,
      isCBO,
      adSetCount: allAdSets.length,
      activeAdSetCount: activeAdSets.length,
      adSetIdRequested: adSetId || null,
    });

    // ------------------------------------------------------------
    // Case A — caller specified an ad set to target.
    // ------------------------------------------------------------
    if (adSetId) {
      // Guard: if the campaign is CBO, updating a single ad set's budget
      // would either fail or (worse) flip the campaign to ABO. Refuse.
      if (isCBO) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              `This campaign uses Campaign Budget Optimization (CBO), so individual ad sets don't have their own budgets. ` +
              `To change the budget, either (a) update the campaign budget without specifying an ad set, or (b) switch the campaign to Ad Set Budgets in Meta Ads Manager first.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Verify the ad set actually belongs to this campaign.
      if (!allAdSets.some((as) => as.id === adSetId)) {
        throw new Error(`Ad set ${adSetId} not found under campaign ${campaignId}`);
      }

      const targetUrl = `https://graph.facebook.com/v21.0/${adSetId}`;
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

      return new Response(
        JSON.stringify({
          success: true,
          level: "adset_targeted",
          ad_set_id: adSetId,
          new_budget: newBudget,
          message: `Budget updated to $${newBudget}/day on the target ad set`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ------------------------------------------------------------
    // Case B — no ad set specified, campaign is CBO.
    // Safe to update campaign-level daily_budget.
    // ------------------------------------------------------------
    if (isCBO) {
      const campaignUrl = `https://graph.facebook.com/v21.0/${campaignId}`;
      const resp = await fetch(campaignUrl, {
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
          `Failed to update campaign budget: ${result.error?.message || "unknown error"}`,
        );
      }

      await supabase.from("ad_action_log").insert({
        brand_id: brand.id,
        workspace_id: workspaceId,
        action_type: "budget_update",
        action_detail: {
          level: "campaign",
          campaign_id: campaignId,
          new_budget: newBudget,
        },
        source: "user",
      });

      return new Response(
        JSON.stringify({
          success: true,
          level: "campaign",
          new_budget: newBudget,
          message: `Budget updated to $${newBudget}/day on Meta`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ------------------------------------------------------------
    // Case C — no ad set specified, campaign is ABO.
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
      const resp = await fetch(`https://graph.facebook.com/v21.0/${only.id}`, {
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

      return new Response(
        JSON.stringify({
          success: true,
          level: "adset_single",
          ad_set_id: only.id,
          new_budget: newBudget,
          message: `Budget updated to $${newBudget}/day on the only active ad set`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Multiple active ad sets — ambiguous. Refuse to act. This is the
    // case that caused the damage to Lindsay's Masterclass on 2026-04-23.
    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
