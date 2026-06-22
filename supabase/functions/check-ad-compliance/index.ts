import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requirePaidUser } from "../_shared/check-subscription.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const gate = await requirePaidUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;

    const body = await req.json().catch(() => ({}));
    const { copy = {}, niche, platforms } = body || {};
    const headline = (copy?.headline ?? "").toString();
    const primary_text = (copy?.primary_text ?? "").toString();
    const description = (copy?.description ?? "").toString();

    if (!headline && !primary_text && !description) {
      return new Response(
        JSON.stringify({ error: "Provide at least one of headline, primary_text, or description in `copy`." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const platformList: string[] = Array.isArray(platforms) && platforms.length
      ? platforms.filter((p: unknown) => typeof p === "string")
      : ["meta"];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Pull the policy KB doc(s) so the model grounds its critique in our own guide.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let policyKb = "";
    try {
      const { data: docs } = await supabase
        .from("knowledge_documents")
        .select("title, content")
        .eq("category", "meta_best_practices")
        .eq("active", true)
        .ilike("title", "%Ad Policy%Traps%Safe Rewrites%")
        .limit(2);

      if (docs && docs.length) {
        policyKb = docs.map((d: any) => `# ${d.title}\n\n${d.content}`).join("\n\n---\n\n");
      } else {
        // Fallback: any meta_best_practices doc that mentions policy
        const { data: fallback } = await supabase
          .from("knowledge_documents")
          .select("title, content")
          .eq("category", "meta_best_practices")
          .eq("active", true)
          .or("title.ilike.%policy%,content.ilike.%policy%")
          .limit(2);
        if (fallback?.length) {
          policyKb = fallback.map((d: any) => `# ${d.title}\n\n${d.content}`).join("\n\n---\n\n");
        }
      }
    } catch (e) {
      console.warn("check-ad-compliance: failed to load policy KB", e);
    }

    const systemPrompt = `You are an ad-policy compliance reviewer for paid social ads on ${platformList.join(" and ")}.

Ground your review in this internal policy reference (our canonical "Meta & Google Ad Policy — Traps and Safe Rewrites" knowledge base). Quote nothing verbatim — apply it to the copy you are given:

<policy_kb>
${policyKb || "(Policy KB document not yet loaded. Fall back to your general knowledge of Meta and Google ad policy: personal attributes, before/after, health/financial/weight claims, sensational language, prohibited content, restricted content rules, misleading or absolute claims, and targeting implications.)"}
</policy_kb>

Your job:
1. Identify the niche if one is implied (weight loss, finance, dating, health, alcohol, supplements, crypto, gambling, etc.). If it's a restricted/sensitive niche, set niche_flag.
2. Scan the headline, primary text, and description for policy traps. For each problem phrase return:
   - phrase: the exact problem text
   - category: short label (e.g. "personal_attributes", "health_claim", "before_after", "sensational_language", "misleading_claim", "prohibited_targeting", "absolute_claim", "financial_promise", "restricted_niche_language")
   - severity: "likely_rejection" (will almost certainly be rejected), "possible_flag" (gray area, may be flagged), or "low_risk" (worth softening, unlikely to be rejected)
   - rewrite: a compliant rewrite that PRESERVES the persuasive intent — do not water it down
3. Produce revised_copy with ALL THREE fields rewritten to be policy-safe while keeping the hook, urgency, and persuasive intent. Always return all three fields even if a field was empty (echo it back as "").
4. overall = "needs_review" if any finding has severity "likely_rejection", otherwise "cleared".

Be honest. Do not invent findings to look thorough — if the copy is clean, return an empty findings array and overall = "cleared". Do not flatten the copy into bland marketing — punchy is fine, policy violations are not.

RESPOND WITH STRICT JSON ONLY in this exact shape:
{
  "niche_flag": string | null,
  "findings": [{ "phrase": string, "category": string, "severity": "likely_rejection" | "possible_flag" | "low_risk", "rewrite": string }],
  "revised_copy": { "headline": string, "primary_text": string, "description": string },
  "overall": "cleared" | "needs_review"
}`;

    const userMessage = `Platforms: ${platformList.join(", ")}
Niche (user-declared, may be empty): ${niche || "(not provided)"}

Ad copy to review:
HEADLINE: ${headline || "(empty)"}
PRIMARY TEXT: ${primary_text || "(empty)"}
DESCRIPTION: ${description || "(empty)"}

Review and return the JSON.`;

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
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
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
      const errText = await response.text().catch(() => "");
      throw new Error(`AI gateway error: ${status} ${errText}`);
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response (no JSON object)");

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize the shape so the client always gets the contract.
    const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    const result = {
      niche_flag: parsed.niche_flag ?? null,
      findings: findings.map((f: any) => ({
        phrase: String(f.phrase ?? ""),
        category: String(f.category ?? "other"),
        severity: ["likely_rejection", "possible_flag", "low_risk"].includes(f.severity)
          ? f.severity
          : "possible_flag",
        rewrite: String(f.rewrite ?? ""),
      })),
      revised_copy: {
        headline: String(parsed.revised_copy?.headline ?? headline ?? ""),
        primary_text: String(parsed.revised_copy?.primary_text ?? primary_text ?? ""),
        description: String(parsed.revised_copy?.description ?? description ?? ""),
      },
      overall:
        findings.some((f: any) => f.severity === "likely_rejection")
          ? "needs_review"
          : (parsed.overall === "needs_review" ? "needs_review" : "cleared"),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-ad-compliance error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
