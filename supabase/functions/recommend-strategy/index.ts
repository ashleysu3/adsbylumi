// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const brand_id: string | undefined = body?.brand_id;
    const user_goal: string | undefined = body?.user_goal;
    const offer_id: string | undefined = body?.offer_id;
    if (!brand_id) return json({ error: "brand_id required" }, 400);

    // Load brand + offers + audiences (scoped to user via RLS)
    const { data: brand, error: brandErr } = await userClient
      .from("brands")
      .select(
        "id,name,industry,website_url,target_audience,value_proposition,brand_voice",
      )
      .eq("id", brand_id)
      .maybeSingle();
    if (brandErr || !brand) {
      return json({ error: "Brand not found" }, 404);
    }

    // If an offer_id was provided, scope offers to just that one so the AI
    // builds a strategy for the specific thing the user wants to advertise
    // (a webinar, a smaller product, etc.) — not the brand's default offer.
    let offersQuery = userClient
      .from("offers")
      .select("id,name,description,price_point,target_outcome,url,page_goal")
      .eq("brand_id", brand_id);
    if (offer_id) {
      offersQuery = offersQuery.eq("id", offer_id);
    } else {
      offersQuery = offersQuery.limit(10);
    }

    const [{ data: offers }, { data: audiences }, { data: templates }] =
      await Promise.all([
        offersQuery,
        userClient
          .from("audiences")
          .select("name,demographics,psychographics,pain_points,desires")
          .eq("brand_id", brand_id)
          .limit(10),
        admin
          .from("recommended_strategies")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

    const brandSnapshot = {
      brand: brand,
      offers: offers ?? [],
      selected_offer: offer_id ? (offers ?? [])[0] ?? null : null,
      audiences: audiences ?? [],
      user_goal,
    };

    // If no templates exist OR no API key, log a request immediately
    if (!templates || templates.length === 0 || !LOVABLE_API_KEY) {
      const { data: req } = await admin
        .from("strategy_requests")
        .insert({
          user_id: user.id,
          brand_id,
          brand_snapshot: brandSnapshot,
          user_goal: user_goal ?? null,
          status: "pending",
        })
        .select("id")
        .single();
      return json({ pending: true, request_id: req?.id });
    }

    // Ask AI to pick the best match (structured output)
    const templateSummaries = templates.map((t: any) => ({
      slug: t.slug,
      name: t.name,
      industry: t.industry,
      business_model: t.business_model,
      primary_goals: t.primary_goals,
      keywords: t.keywords,
      description: t.description,
    }));

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are LUMI, an ad strategist. Pick the single best matching strategy template for this brand based on industry, business model, goal, and website signals. If none truly fit, return no_match. Respond ONLY with JSON.",
            },
            {
              role: "user",
              content: JSON.stringify({ brandSnapshot, templates: templateSummaries }),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "strategy_match",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  match_slug: { type: ["string", "null"] },
                  no_match: { type: "boolean" },
                  personalized_intro: { type: "string" },
                  reason: { type: "string" },
                },
                required: [
                  "match_slug",
                  "no_match",
                  "personalized_intro",
                  "reason",
                ],
              },
            },
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errTxt);
      // Fallback: log request rather than failing
      const { data: reqRow } = await admin
        .from("strategy_requests")
        .insert({
          user_id: user.id,
          brand_id,
          brand_snapshot: brandSnapshot,
          user_goal: user_goal ?? null,
          status: "pending",
          admin_notes: `AI matcher unavailable (${aiRes.status})`,
        })
        .select("id")
        .single();
      return json({ pending: true, request_id: reqRow?.id });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = {};
    }

    const matchSlug: string | null = parsed?.no_match ? null : parsed?.match_slug;
    const matched = matchSlug
      ? templates.find((t: any) => t.slug === matchSlug)
      : null;

    if (!matched) {
      const { data: reqRow } = await admin
        .from("strategy_requests")
        .insert({
          user_id: user.id,
          brand_id,
          brand_snapshot: brandSnapshot,
          user_goal: user_goal ?? null,
          status: "pending",
          admin_notes: parsed?.reason ?? null,
        })
        .select("id")
        .single();
      return json({ pending: true, request_id: reqRow?.id });
    }

    return json({
      matched: true,
      strategy: matched,
      personalized_intro:
        parsed?.personalized_intro ??
        `Based on what we see for ${brand.name}, this plan is the cleanest path forward.`,
    });
  } catch (err) {
    console.error("recommend-strategy error", err);
    return json({ error: (err as Error).message ?? "Unknown error" });
  }
});
