import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, campaignObjective } = await req.json();

    if (!brandId) throw new Error("brandId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get brand's Meta account info
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("meta_account_id, meta_access_token, name")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      console.log("[analyze-past-creatives] Brand not found or error:", brandError);
      return new Response(JSON.stringify({ hasData: false, summary: "No brand data available." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!brand.meta_account_id || !brand.meta_access_token) {
      console.log("[analyze-past-creatives] No Meta account connected");
      return new Response(JSON.stringify({ hasData: false, summary: "No Meta account connected." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ad-level insights for the last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceStr = since.toISOString().split("T")[0];
    const untilStr = new Date().toISOString().split("T")[0];

    const fields = "ad_name,spend,impressions,clicks,ctr,actions,cost_per_action_type,purchase_roas,reach";
    const actId = brand.meta_account_id.startsWith("act_") ? brand.meta_account_id : `act_${brand.meta_account_id}`;
    const metaUrl = `https://graph.facebook.com/v21.0/${actId}/insights?fields=${fields}&time_range={"since":"${sinceStr}","until":"${untilStr}"}&level=ad&limit=100&filtering=[{"field":"spend","operator":"GREATER_THAN","value":"10"}]&access_token=${brand.meta_access_token}`;

    // Also fetch adcreatives to get destination URLs
    const adCreativesUrl = `https://graph.facebook.com/v21.0/${actId}/ads?fields=creative{object_story_spec,asset_feed_spec,effective_object_story_spec}&limit=100&access_token=${brand.meta_access_token}`;

    console.log("[analyze-past-creatives] Fetching Meta insights and adcreatives...");
    const [metaRes, creativesRes] = await Promise.all([
      fetch(metaUrl),
      fetch(adCreativesUrl),
    ]);

    // Extract destination URLs from adcreatives
    let detectedUrls: string[] = [];
    if (creativesRes.ok) {
      try {
        const creativesData = await creativesRes.json();
        const creatives = creativesData.data || [];
        const urlSet = new Set<string>();
        for (const ad of creatives) {
          const creative = ad.creative;
          if (!creative) continue;
          // Check effective_object_story_spec for link URLs
          const spec = creative.effective_object_story_spec || creative.object_story_spec;
          const linkData = spec?.link_data;
          if (linkData?.link) urlSet.add(linkData.link);
          if (linkData?.call_to_action?.value?.link) urlSet.add(linkData.call_to_action.value.link);
          // Check asset_feed_spec for multiple URLs
          const assetFeed = creative.asset_feed_spec;
          if (assetFeed?.link_urls) {
            for (const lu of assetFeed.link_urls) {
              if (lu?.website_url) urlSet.add(lu.website_url);
            }
          }
        }
        // Filter out Meta/Facebook URLs
        detectedUrls = Array.from(urlSet).filter(u => {
          try {
            const host = new URL(u).hostname.toLowerCase();
            return !host.includes("facebook.com") && !host.includes("instagram.com") && !host.includes("fb.com");
          } catch { return false; }
        });
        console.log(`[analyze-past-creatives] Found ${detectedUrls.length} destination URLs`);
      } catch (e) {
        console.error("[analyze-past-creatives] Error parsing creatives:", e);
      }
    }

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("[analyze-past-creatives] Meta API error:", metaRes.status, errText);
      return new Response(JSON.stringify({ hasData: false, summary: "Could not fetch ad data from Meta.", detectedUrls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaData = await metaRes.json();
    const ads = metaData.data || [];

    if (ads.length === 0) {
      console.log("[analyze-past-creatives] No ads found with sufficient spend");
      return new Response(JSON.stringify({ hasData: detectedUrls.length > 0, summary: "No ads with sufficient data in the last 90 days.", detectedUrls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to ads with meaningful reach
    const significantAds = ads.filter((ad: any) => parseInt(ad.reach || "0") >= 1000);

    if (significantAds.length === 0) {
      return new Response(JSON.stringify({ hasData: detectedUrls.length > 0, summary: "No ads with sufficient reach to analyze.", detectedUrls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine the primary metric based on objective
    const objectiveMetricMap: Record<string, string> = {
      sales: "offsite_conversion.fb_pixel_purchase",
      leads: "offsite_conversion.fb_pixel_lead",
      traffic: "link_click",
      engagement: "post_engagement",
      video_views: "video_view",
    };
    const primaryAction = objectiveMetricMap[campaignObjective || "sales"] || "offsite_conversion.fb_pixel_purchase";

    // Enrich ads with computed metrics
    const enrichedAds = significantAds.map((ad: any) => {
      const spend = parseFloat(ad.spend || "0");
      const clicks = parseInt(ad.clicks || "0");
      const ctr = parseFloat(ad.ctr || "0");
      const reach = parseInt(ad.reach || "0");

      // Find the primary action count
      const actionObj = ad.actions?.find((a: any) => a.action_type === primaryAction);
      const actionCount = actionObj ? parseInt(actionObj.value || "0") : 0;

      // Find CPA for primary action
      const cpaObj = ad.cost_per_action_type?.find((a: any) => a.action_type === primaryAction);
      const cpa = cpaObj ? parseFloat(cpaObj.value || "0") : 0;

      // ROAS
      const roasObj = ad.purchase_roas?.[0];
      const roas = roasObj ? parseFloat(roasObj.value || "0") : 0;

      return {
        ad_name: ad.ad_name,
        spend,
        clicks,
        ctr,
        reach,
        actions: actionCount,
        cpa: cpa > 0 ? cpa : (actionCount > 0 ? spend / actionCount : 0),
        roas,
      };
    });

    // Sort by primary metric performance
    enrichedAds.sort((a: any, b: any) => {
      if (campaignObjective === "sales") return b.roas - a.roas;
      return a.cpa - b.cpa || b.ctr - a.ctr;
    });

    // Use AI to analyze patterns
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const topAds = enrichedAds.slice(0, 15);
    const bottomAds = enrichedAds.slice(-5);

    const aiPrompt = `Analyze these Meta ad performance results and identify creative patterns.

OBJECTIVE: ${campaignObjective || "sales"}
DATE RANGE: Last 90 days
ADS ANALYZED: ${enrichedAds.length}

TOP PERFORMERS:
${JSON.stringify(topAds, null, 2)}

WORST PERFORMERS:
${JSON.stringify(bottomAds, null, 2)}

Based on the ad names and performance data, identify:
1. What creative formats seem to work best? (look at naming patterns - "TH" = talking head, "GFX" = graphic, "UGC" = user-generated, etc.)
2. What messaging patterns or hooks appear in top performers?
3. Any patterns in what DOESN'T work?
4. Specific recommendations for the next round of creative.

Return a JSON object:
{
  "summary": "One-sentence summary of key insight",
  "topFormats": ["array of format names that work best"],
  "keyPatterns": ["array of 2-4 specific patterns found"],
  "recommendations": ["array of 2-3 actionable suggestions for new creative"]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert Meta Ads analyst. Analyze ad performance data and identify creative patterns. Return only valid JSON." },
          { role: "user", content: aiPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      console.error("[analyze-past-creatives] AI error:", aiRes.status);
      // Return raw data summary without AI analysis
      return new Response(JSON.stringify({
        hasData: true,
        summary: `Analyzed ${enrichedAds.length} ads from the last 90 days. Top performer: "${topAds[0]?.ad_name}".`,
        detectedUrls,
        adsAnalyzed: enrichedAds.length,
        dateRange: `${sinceStr} to ${untilStr}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const rawContent = aiData?.choices?.[0]?.message?.content ?? "";

    let analysis: any = {};
    try {
      const codeBlock = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? rawContent).trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      analysis = JSON.parse(first !== -1 && last !== -1 ? raw.slice(first, last + 1) : raw);
    } catch {
      console.error("[analyze-past-creatives] Failed to parse AI response");
      analysis = { summary: `Analyzed ${enrichedAds.length} ads.` };
    }

    const result = {
      hasData: true,
      summary: analysis.summary || `Analyzed ${enrichedAds.length} ads from the last 90 days.`,
      topFormats: analysis.topFormats || [],
      keyPatterns: analysis.keyPatterns || [],
      recommendations: analysis.recommendations || [],
      detectedUrls,
      adsAnalyzed: enrichedAds.length,
      dateRange: `${sinceStr} to ${untilStr}`,
    };

    console.log("[analyze-past-creatives] Success:", result.summary);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[analyze-past-creatives] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
