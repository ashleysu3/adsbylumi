import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requirePaidUser } from "../_shared/check-subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userInput, clarificationAnswer, brandName, offerData, existingAngles } = await req.json();

    if (!userInput || typeof userInput !== "string" || userInput.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Please describe your angle idea" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const existingAngleNames = (existingAngles || []).map((a: any) => a.name).join(", ");

    const systemPrompt = `You are a creative strategist for Meta ads. The user wants to add a custom creative angle for their ad campaign.

Your job:
1. If the user's input is clear and specific enough to create a creative angle, return a formatted angle.
2. If the input is too vague or ambiguous, ask ONE clarifying question.

A good angle has:
- A short, punchy name (2-5 words)
- A clear description explaining the messaging approach (1-2 sentences)
- It should be distinct from existing angles: ${existingAngleNames || "none yet"}

Brand: ${brandName || "Unknown"}
Offer: ${offerData?.name || "Unknown"} — ${offerData?.description || "No description"}

RESPOND WITH EXACTLY ONE OF THESE JSON FORMATS:

If clear enough:
{"angle": {"name": "Short Angle Name", "description": "One sentence describing the messaging approach and why it works."}}

If too vague:
{"needsClarification": true, "question": "Your single clarifying question here"}`;

    const userMessage = clarificationAnswer
      ? `Original idea: "${userInput}"\n\nClarification: "${clarificationAnswer}"\n\nNow create the angle.`
      : `Create a creative angle from this idea: "${userInput}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-custom-angle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
