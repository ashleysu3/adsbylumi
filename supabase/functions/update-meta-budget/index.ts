import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-META-BUDGET] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, newBudget } = await req.json();

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

    logStep("Attempting budget update", { campaignId, newBudget, budgetCents });

    // Step 1: Try updating the campaign-level daily budget (CBO campaigns)
    const campaignUrl = `https://graph.facebook.com/v21.0/${campaignId}`;
    const campaignUpdateResp = await fetch(campaignUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: accessToken,
        daily_budget: budgetCents,
      }),
    });
    const campaignResult = await campaignUpdateResp.json();

    if (campaignResult.success) {
      logStep("Campaign-level budget updated successfully (CBO)", { campaignId });

      // Log the action
      await supabase.from("ad_action_log").insert({
        brand_id: brand.id,
        workspace_id: workspaceId,
        action_type: "budget_update",
        action_detail: {
          level: "campaign",
          campaign_id: campaignId,
          old_budget: null,
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

    // Step 2: If campaign-level fails (likely ABO), update ad set budgets
    logStep("Campaign-level update failed, trying ad set level (ABO)", {
      error: campaignResult.error?.message,
    });

    const adSetsUrl = `https://graph.facebook.com/v21.0/${campaignId}/adsets?fields=id,name,daily_budget,status&limit=100&access_token=${accessToken}`;
    const adSetsResp = await fetch(adSetsUrl);
    const adSetsData = await adSetsResp.json();

    if (!adSetsData.data || adSetsData.data.length === 0) {
      throw new Error("No ad sets found for this campaign");
    }

    const activeAdSets = adSetsData.data.filter(
      (as: any) => as.status === "ACTIVE" || as.status === "PAUSED"
    );

    if (activeAdSets.length === 0) {
      throw new Error("No active ad sets found to update");
    }

    // Distribute budget equally across active ad sets
    const perAdSetBudget = Math.round((newBudget / activeAdSets.length) * 100).toString();
    const results: any[] = [];
    let allSuccess = true;

    for (const adSet of activeAdSets) {
      const adSetUrl = `https://graph.facebook.com/v21.0/${adSet.id}`;
      const resp = await fetch(adSetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          access_token: accessToken,
          daily_budget: perAdSetBudget,
        }),
      });
      const result = await resp.json();
      results.push({ adSetId: adSet.id, name: adSet.name, success: !!result.success, error: result.error });
      if (!result.success) allSuccess = false;
    }

    logStep("Ad set budget updates completed", { results, allSuccess });

    if (!allSuccess) {
      const failedSets = results.filter((r) => !r.success);
      throw new Error(
        `Budget update failed for ${failedSets.length} ad set(s): ${failedSets
          .map((f) => f.error?.message || "unknown error")
          .join("; ")}`
      );
    }

    // Log the action
    await supabase.from("ad_action_log").insert({
      brand_id: brand.id,
      workspace_id: workspaceId,
      action_type: "budget_update",
      action_detail: {
        level: "adset",
        campaign_id: campaignId,
        ad_sets_updated: activeAdSets.length,
        per_adset_budget: parseFloat(perAdSetBudget) / 100,
        total_budget: newBudget,
      },
      source: "user",
    });

    return new Response(
      JSON.stringify({
        success: true,
        level: "adset",
        ad_sets_updated: activeAdSets.length,
        new_budget: newBudget,
        message: `Budget updated to $${newBudget}/day across ${activeAdSets.length} ad set(s) on Meta`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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
