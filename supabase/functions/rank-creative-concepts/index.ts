import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductionItem {
  id: string;
  format: "talking_head" | "broll" | "graphic";
  hook: string;
  guidance: string;
  angleName: string;
  completed: boolean;
}

interface RankedItem extends ProductionItem {
  rank: number;
  rationale: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { items, brandId, performanceContext: clientPerformanceContext } = await req.json();

    if (!items || items.length < 6) {
      return new Response(
        JSON.stringify({ error: "Need at least 6 items to rank" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Ranking ${items.length} creative concepts for brand ${brandId}`);

    // Fetch brand data with Meta connection info
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("name, meta_account_id, audience_psychology, brand_voice")
      .eq("id", brandId)
      .single();

    if (brandError) {
      console.error("Error fetching brand:", brandError);
    }

    // Check if Meta is connected and fetch performance data
    let performanceContext = "";
    let hasPerformanceData = false;

    if (brand?.meta_account_id) {
      try {
        // Fetch recent campaign performance from workspaces
        const { data: workspaces } = await supabase
          .from("campaign_workspaces")
          .select("performance_report_latest, meta_campaign_ids")
          .eq("brand_id", brandId)
          .not("performance_report_latest", "is", null)
          .limit(5);

        if (workspaces && workspaces.length > 0) {
          hasPerformanceData = true;
          
          // Analyze format performance patterns
          const formatPerformance: Record<string, { count: number; avgCtr: number; avgRoas: number }> = {};
          
          for (const ws of workspaces) {
            const report = ws.performance_report_latest as Record<string, any>;
            if (report?.campaigns) {
              for (const campaign of report.campaigns) {
                const format = campaign.format || "unknown";
                if (!formatPerformance[format]) {
                  formatPerformance[format] = { count: 0, avgCtr: 0, avgRoas: 0 };
                }
                formatPerformance[format].count++;
                formatPerformance[format].avgCtr += campaign.ctr || 0;
                formatPerformance[format].avgRoas += campaign.roas || 0;
              }
            }
          }

          // Normalize averages
          for (const format of Object.keys(formatPerformance)) {
            if (formatPerformance[format].count > 0) {
              formatPerformance[format].avgCtr /= formatPerformance[format].count;
              formatPerformance[format].avgRoas /= formatPerformance[format].count;
            }
          }

          performanceContext = `
Based on this account's historical performance:
${Object.entries(formatPerformance).map(([f, p]) => `- ${f}: ${p.count} campaigns, avg CTR: ${(p.avgCtr * 100).toFixed(2)}%, avg ROAS: ${p.avgRoas.toFixed(2)}x`).join("\n")}

Prioritize formats that have historically performed well for this account.
`;
        }
      } catch (e) {
        console.log("Could not fetch performance data:", e);
      }
    }

    // If client provided performance context from the refresh dialog, use it
    if (clientPerformanceContext && typeof clientPerformanceContext === 'object') {
      hasPerformanceData = true;
      if (clientPerformanceContext.summary) {
        performanceContext += `\nRefresh analysis: ${clientPerformanceContext.summary}`;
      }
      if (clientPerformanceContext.topFormats?.length) {
        performanceContext += `\nTop performing formats: ${clientPerformanceContext.topFormats.join(", ")}`;
      }
      if (clientPerformanceContext.topCopyAngles?.length) {
        performanceContext += `\nTop copy angles: ${clientPerformanceContext.topCopyAngles.join(", ")}`;
      }
      if (clientPerformanceContext.keyPatterns?.length) {
        performanceContext += `\nKey patterns: ${clientPerformanceContext.keyPatterns.join("; ")}`;
      }
    }
        }
      } catch (e) {
        console.log("Could not fetch performance data:", e);
      }
    }

    // Fetch knowledge base for best practices
    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("content")
      .eq("active", true)
      .or("category.eq.creative_best_practices,category.eq.creative_angles,category.eq.ad_formats")
      .limit(3);

    const kbContext = kbDocs?.map(d => d.content).join("\n\n") || "";

    // Build the ranking prompt
    const systemPrompt = `You are Lumi, a Meta Ads creative strategist. You help users prioritize which ad concepts to produce first.

Your task is to rank creative concepts and select the TOP 5 that are most likely to perform well.

${hasPerformanceData ? performanceContext : `
This account doesn't have historical performance data yet, so use these best practices:
- Prioritize format variety (mix of talking head, b-roll, and graphics)
- Weight toward attention-focused hooks (these get tested first in campaigns)
- Recommend angles that address core pain points
- Consider production feasibility (talking heads are often fastest to produce)
`}

${kbContext ? `\nKnowledge base context:\n${kbContext}` : ""}

IMPORTANT RANKING CRITERIA:
1. Hook strength - Will it stop the scroll?
2. Format effectiveness - Based on account data or best practices
3. Angle variety - Don't recommend 5 of the same angle
4. Production priority - Consider what should be tested first
5. Psychology alignment - Does it hit emotional triggers?

Return a JSON object with this structure:
{
  "rankedItems": [
    {
      "id": "item_id",
      "rank": 1,
      "rationale": "2-3 sentence explanation of why this made the top 5"
    }
  ],
  "overallStrategy": "1-2 sentence summary of why these 5 were chosen over others"
}

Only include the top 5 items. The rationale should be specific and actionable.`;

    const userPrompt = `Here are the creative concepts to rank:

${items.map((item: ProductionItem, i: number) => `
${i + 1}. ID: ${item.id}
   Format: ${item.format}
   Angle: ${item.angleName}
   Hook: ${item.hook}
   Guidance: ${item.guidance}
`).join("\n")}

Brand: ${brand?.name || "Unknown"}
${brand?.audience_psychology ? `Audience: ${JSON.stringify(brand.audience_psychology)}` : ""}

Select and rank the TOP 5 concepts that should be produced first.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Map rankings back to full items
    const rankedItems: RankedItem[] = parsed.rankedItems.map((r: any) => {
      const item = items.find((i: ProductionItem) => i.id === r.id);
      if (!item) return null;
      return {
        ...item,
        rank: r.rank,
        rationale: r.rationale,
      };
    }).filter(Boolean);

    console.log(`Ranked ${rankedItems.length} items successfully`);

    return new Response(
      JSON.stringify({
        rankedItems,
        overallStrategy: parsed.overallStrategy,
        hasPerformanceData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error ranking concepts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
