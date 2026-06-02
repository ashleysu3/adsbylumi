// GitHub push webhook → AI-summarized draft changelog entry.
// Configure in GitHub repo → Settings → Webhooks:
//   Payload URL:  https://<project>.supabase.co/functions/v1/github-changelog-webhook
//   Content type: application/json
//   Secret:       value stored as GITHUB_WEBHOOK_SECRET
//   Events:       Just the push event
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifySignature(secret: string, body: string, signature: string | null): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `sha256=${hex}`;
  // constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

interface Commit {
  id: string;
  message: string;
  author?: { name?: string; username?: string };
  url?: string;
}

async function summarizeWithAI(commits: Commit[], repo: string, branch: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const fallback = {
    title: `${commits.length} update${commits.length === 1 ? "" : "s"} from ${repo}`,
    body: commits.map((c) => `• ${c.message.split("\n")[0]}`).join("\n"),
    category: "improvement",
  };
  if (!apiKey) return fallback;

  const commitText = commits
    .map((c) => `- ${c.message.replace(/\n+/g, " ").slice(0, 280)}`)
    .join("\n");

  const prompt = `You are drafting a changelog entry for non-technical users of the LUMI ads app.
Below are raw git commit messages from a push to ${repo} (${branch}).
Summarize them into ONE warm, clear entry users would actually care about.

=== OUTCOME-FIRST WRITING (most important rule) ===
Lead with the BENEFIT to the creator — the problem solved, time saved, stress removed, result achieved. Never lead with the feature/fix/tool itself.
- Title: a benefit or relief in plain English. NOT "New X" / "Added Y" / "Fixed Z bug".
- Body: 1 sentence on what changes in their day or business, then 1 short sentence pointing to where it lives in Lumi.
- ✅ "Know your budget before you spend a dollar" — body: "Tell Lumi your goal and it shows you the budget needed to hit 50 conversions a week. In the campaign builder."
- ❌ "New budget calculator added"

=== LUMI REALITY — HARD GUARDRAILS ===
Lumi uses Advantage+ "Broad+" audiences ONLY. We do NOT do interest targeting, lookalikes, custom-interest audiences, retargeting funnels, landing page optimization, manual bidding, or audience A/B tests.
NEVER write changelog copy that implies any of those exist. If a commit clearly maps to one of those, treat the push as "internal".
Anchor every entry in real Lumi surfaces: brand wizard, campaign builder, creative generator (9:16 video scripts, 27-char headlines), budget calculator, weekly optimization report, pixel verification + fallback, partner portal, features catalog, founder pricing.
Never say "beta" — use "Founder Pricing" if pricing is involved.

Rules:
- Title: max 70 chars, plain English, no emojis, no commit hashes, outcome-led (not feature-led)
- Body: 1–3 short sentences. Focus on the user's win, not the code.
- Skip pure refactors, formatting, dependency bumps, and merge commits — if EVERY commit is internal or maps to a banned topic above, return category "internal" and a brief note.
- Category must be one of: feature, improvement, fix, announcement, internal
- Return ONLY JSON: {"title":"","body":"","category":""}

Commits:
${commitText}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content);
    return {
      title: String(parsed.title || fallback.title).slice(0, 120),
      body: String(parsed.body || ""),
      category: ["feature", "improvement", "fix", "announcement", "internal"].includes(parsed.category)
        ? parsed.category
        : "improvement",
    };
  } catch (_e) {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    if (!secret) return json({ error: "GITHUB_WEBHOOK_SECRET not configured" }, 200);

    const raw = await req.text();
    const sig = req.headers.get("x-hub-signature-256");
    const ok = await verifySignature(secret, raw, sig);
    if (!ok) return json({ error: "invalid signature" }, 200);

    const event = req.headers.get("x-github-event");
    if (event === "ping") return json({ ok: true, pong: true });
    if (event !== "push") return json({ ok: true, skipped: event });

    const payload = JSON.parse(raw);
    const branch = (payload.ref || "").replace("refs/heads/", "");
    const repo = payload.repository?.full_name || "repo";
    const defaultBranch = payload.repository?.default_branch || "main";
    if (branch !== defaultBranch) return json({ ok: true, skipped: `branch ${branch}` });

    const commits: Commit[] = (payload.commits || []).filter(
      (c: Commit) => !/^Merge (pull request|branch)/i.test(c.message || ""),
    );
    if (commits.length === 0) return json({ ok: true, skipped: "no relevant commits" });

    const summary = await summarizeWithAI(commits, repo, branch);
    if (summary.category === "internal") return json({ ok: true, skipped: "internal-only push" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const commit_refs = commits.map((c) => ({
      sha: c.id?.slice(0, 7),
      message: (c.message || "").split("\n")[0].slice(0, 200),
      author: c.author?.username || c.author?.name || null,
      url: c.url || null,
    }));

    const { data, error } = await supabase
      .from("changelog_entries")
      .insert({
        title: summary.title,
        body: summary.body,
        category: summary.category,
        approval_status: "draft",
        source: "github",
        is_user_visible: true,
        commit_refs,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 200);
    return json({ ok: true, entry_id: data.id });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 200);
  }
});
