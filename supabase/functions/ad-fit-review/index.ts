import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePaidUser } from "../_shared/check-subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ok = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const gate = await requirePaidUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;
    const userId = gate.userId!;

    const { workspace_id, brand_id, feedback_id, creative_id } = await req.json();
    if (!workspace_id || !brand_id || !feedback_id) {
      return ok({ error: "Missing workspace_id, brand_id, or feedback_id" }, 200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ownership check
    const { data: brand } = await supabase
      .from("brands")
      .select("id, user_id, name, brand_voice, target_audience, audience_psychology, value_proposition")
      .eq("id", brand_id)
      .maybeSingle();
    if (!brand) return ok({ error: "Not authorized" }, 200);
    if (brand.user_id !== userId) {
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
      if (!roleRow) return ok({ error: "Not authorized" }, 200);
    }

    const { data: workspace } = await supabase
      .from("campaign_workspaces")
      .select("id, name, campaign_builder_answers, generated_copy, offer_id")
      .eq("id", workspace_id)
      .maybeSingle();
    if (!workspace) return ok({ error: "Workspace not found" }, 200);

    const { data: feedback } = await supabase
      .from("lead_quality_feedback")
      .select("fit_rating, reasons, note, created_at")
      .eq("id", feedback_id)
      .maybeSingle();
    if (!feedback) return ok({ error: "Feedback not found" }, 200);

    // Offer (optional)
    let offer: any = null;
    if ((workspace as any).offer_id) {
      const { data } = await supabase
        .from("offers")
        .select("name, type, price, offer_psychology, auto_summary")
        .eq("id", (workspace as any).offer_id)
        .maybeSingle();
      offer = data;
    }

    // KB doc — audience fit
    const { data: kb } = await supabase
      .from("knowledge_documents")
      .select("title, content")
      .eq("active", true)
      .eq("subcategory", "audience_fit")
      .limit(1)
      .maybeSingle();

    // Extract current ad copy from workspace
    const answers = (workspace as any).campaign_builder_answers || {};
    const gen = (workspace as any).generated_copy || {};
    const headline =
      gen.headline || answers.headline || (Array.isArray(gen.headlines) ? gen.headlines[0] : "") || "";
    const primary =
      gen.primary_text || gen.primary || answers.primary_text || answers.primary || "";
    const description = gen.description || answers.description || "";

    const idealBuyer = brand.audience_psychology || brand.target_audience || null;
    const idealThin =
      !idealBuyer ||
      (typeof idealBuyer === "string" && idealBuyer.length < 40) ||
      (typeof idealBuyer === "object" && Object.keys(idealBuyer || {}).length < 2);

    const systemPrompt = `You are LUMI's ad-fit reviewer. You apply the attractor-signals taxonomy: every phrase in an ad is a casting call.

You ALWAYS judge copy against who the brand WANTS (their ideal buyer + offer price/level). Beginner/cheap framing is only "wrong" for premium offers. A real low-ticket / beginner offer should keep that framing.

You will be given the current live ad copy, the brand's audience profile, the offer, and the user's feedback that the leads coming in feel off.

Diagnose using the taxonomy:
- Quote the EXACT leaking phrases (verbatim from the copy)
- Name who the ad currently attracts
- Note any creative mismatch (mood, vibe, beginner vs premium aesthetic)
- Assign a Fit Score A–F (A best, F worst)

Then rewrite the copy to re-aim at the ideal buyer in the SAME voice, SAME offer, similar length. Gently repel wrong-fit leads (a "not for you if" line is ok when appropriate). Don't invent claims.

If the ideal buyer profile is thin (set ideal_buyer_thin=true), confirm what you assumed in ideal_buyer_summary and keep rewrites conservative.

${kb ? `\n## Reference: ${kb.title}\n${kb.content}` : ""}`;

    const userPayload = {
      brand: {
        name: brand.name,
        voice: brand.brand_voice,
        ideal_buyer: idealBuyer,
        value_proposition: brand.value_proposition,
      },
      offer,
      current_ad: { headline, primary_text: primary, description },
      user_feedback: feedback,
      ideal_buyer_thin: idealThin,
    };

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return ok({ error: "AI not configured" }, 200);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_fit_review",
              parameters: {
                type: "object",
                properties: {
                  fit_score: { type: "string", enum: ["A", "B", "C", "D", "F"] },
                  attracts: { type: "string" },
                  leaking_phrases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        quote: { type: "string" },
                        magnet: { type: "string" },
                        why: { type: "string" },
                      },
                      required: ["quote", "why"],
                      additionalProperties: false,
                    },
                  },
                  creative_mismatch: { type: "string" },
                  ideal_buyer_summary: { type: "string" },
                  ideal_buyer_thin: { type: "boolean" },
                  rewritten: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      primary: { type: "string" },
                      description: { type: "string" },
                      repels_note: { type: "string" },
                    },
                    required: ["headline", "primary", "description"],
                    additionalProperties: false,
                  },
                  creative_changes: { type: "string" },
                },
                required: [
                  "fit_score",
                  "attracts",
                  "leaking_phrases",
                  "ideal_buyer_summary",
                  "ideal_buyer_thin",
                  "rewritten",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_fit_review" } },
      }),
    });

    // Helper: mark the working creative as failed (if the client created one)
    const markFailed = async (msg: string) => {
      if (!creative_id) return;
      await supabase
        .from("creatives")
        .update({ status: "failed", error_message: msg.slice(0, 500) })
        .eq("id", creative_id);
    };

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("ad-fit-review AI error", aiRes.status, txt);
      let msg = "AI gateway error";
      if (aiRes.status === 429) msg = "Rate limited. Try again shortly.";
      else if (aiRes.status === 402) msg = "AI credits exhausted.";
      await markFailed(msg);
      return ok({ error: msg }, 200);
    }
    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      await markFailed("Empty AI response");
      return ok({ error: "Empty AI response" }, 200);
    }
    const review = JSON.parse(toolCall.function.arguments);

    // Persist as a task on Live Ads
    const fitLabel = feedback.fit_rating === "wrong" ? "wrong-fit leads" : "mixed-fit leads";
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        brand_id,
        title: `You flagged ${fitLabel} on "${workspace.name || "this campaign"}" — re-aimed draft ready to review in My Creatives`,
        description:
          `Fit Score: ${review.fit_score}. Re-aimed copy is ready in My Creatives — nothing changes in your live ad until you add it there.`.slice(
            0,
            500,
          ),
        source: "ad_fit_review",
        action_type: "ad_fit_review",
        link_to: `/my-creatives`,
        action_payload: { workspace_id, brand_id, feedback_id, review },
        status: "open",
      })
      .select()
      .single();

    if (taskErr) console.error("task insert failed", taskErr);

    // Persist the rewrite to creatives.
    // The AI returns `rewritten` as an object {headline, primary, description, repels_note}.
    try {
      const rw = review.rewritten || {};
      const primary = typeof rw.primary === "string" ? rw.primary : "";
      const headline = typeof rw.headline === "string" ? rw.headline : "";
      const description = typeof rw.description === "string" ? rw.description : "";
      const meta = {
        fit_score: review.fit_score,
        attracts: review.attracts,
        repels_note: rw.repels_note || null,
      };

      // 1) Complete the working placeholder with the primary text.
      if (creative_id && primary) {
        await supabase
          .from("creatives")
          .update({
            status: "ready",
            type: "primary_copy",
            title: primary.slice(0, 80),
            content: { text: primary, ...meta },
            task_label: null,
            error_message: null,
          })
          .eq("id", creative_id);
      } else if (creative_id) {
        // No primary text — mark failed so user isn't left staring at a stuck card.
        await markFailed("No re-aimed copy returned");
      }

      // 2) Save headline + description as additional ready drafts.
      const extra: any[] = [];
      if (headline)
        extra.push({
          brand_id,
          user_id: userId,
          type: "headline",
          title: headline.slice(0, 80),
          content: { text: headline, ...meta },
          source: "lead_fit_feedback",
          source_ref: { workspace_id, feedback_id },
          tags: ["re-aimed"],
          status: "ready",
        });
      if (description)
        extra.push({
          brand_id,
          user_id: userId,
          type: "description",
          title: description.slice(0, 80),
          content: { text: description, ...meta },
          source: "lead_fit_feedback",
          source_ref: { workspace_id, feedback_id },
          tags: ["re-aimed"],
          status: "ready",
        });
      // Fallback: no working placeholder + no primary → still save primary as a fresh draft
      if (!creative_id && primary) {
        extra.push({
          brand_id,
          user_id: userId,
          type: "primary_copy",
          title: primary.slice(0, 80),
          content: { text: primary, ...meta },
          source: "lead_fit_feedback",
          source_ref: { workspace_id, feedback_id },
          tags: ["re-aimed"],
          status: "ready",
        });
      }
      if (extra.length > 0) {
        const { error: cErr } = await supabase.from("creatives").insert(extra as any);
        if (cErr) console.error("creatives insert failed", cErr);
      }
    } catch (e) {
      console.error("save re-aimed creatives failed", e);
      await markFailed("Couldn't save re-aimed copy");
    }

    return ok({ review, task });
  } catch (e: any) {
    console.error("ad-fit-review error", e);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.creative_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("creatives")
          .update({ status: "failed", error_message: (e?.message || "Unknown error").slice(0, 500) })
          .eq("id", body.creative_id);
      }
    } catch {}
    return ok({ error: e?.message || "Unknown error" }, 200);
  }
});
