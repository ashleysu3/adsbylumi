// Classifies brand assets using vision AI and updates brand_assets.role.
// POST { brandId, assetIds?: string[] }  → { updated: number, results: [{id, role}] }
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["logo", "headshot", "lifestyle", "full_body", "product", "texture", "graphic", "background", "other"] as const;

function pathFromUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/brand-assets\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function classifyOne(imageUrl: string): Promise<string | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You classify brand image assets for an ad-creation tool. Reply with exactly ONE word from this list: logo, headshot, background, texture, graphic, product. logo=brand mark or wordmark. headshot=photo of a person's face. background=lifestyle/scene photo usable as a backdrop. texture=abstract surface/pattern. graphic=icon/illustration/UI element. product=physical product shot.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this image. One word only." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const txt = String(j?.choices?.[0]?.message?.content || "").toLowerCase().trim();
    const match = ROLES.find((r) => txt.includes(r));
    return match || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }
    const { brandId, assetIds } = await req.json();
    if (!brandId) {
      return new Response(JSON.stringify({ error: "missing brandId" }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: brand } = await admin.from("brands").select("user_id").eq("id", brandId).maybeSingle();
    if (!brand || brand.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "access denied" }), {
        status: 200, headers: { ...cors, "content-type": "application/json" },
      });
    }

    let q = admin.from("brand_assets").select("id,url,role").eq("brand_id", brandId);
    if (Array.isArray(assetIds) && assetIds.length) q = q.in("id", assetIds);
    const { data: rows } = await q;
    const assets = (rows || []) as { id: string; url: string; role: string | null }[];

    // Sign URLs for vision model access (brand-assets bucket is private)
    const paths = assets.map((a) => pathFromUrl(a.url));
    const validPaths = paths.filter(Boolean) as string[];
    let signedMap = new Map<string, string>();
    if (validPaths.length) {
      const { data: s } = await admin.storage.from("brand-assets").createSignedUrls(validPaths, 60 * 30);
      (s || []).forEach((entry: any, i) => {
        if (entry?.signedUrl) signedMap.set(validPaths[i], entry.signedUrl);
      });
    }

    const results: { id: string; role: string | null }[] = [];
    // Run in small parallel batches to keep latency low.
    const batchSize = 4;
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      const out = await Promise.all(batch.map(async (a) => {
        const p = pathFromUrl(a.url);
        const url = (p && signedMap.get(p)) || a.url;
        const role = await classifyOne(url);
        if (role && role !== a.role) {
          await admin.from("brand_assets").update({ role }).eq("id", a.id);
        }
        return { id: a.id, role };
      }));
      results.push(...out);
    }

    return new Response(JSON.stringify({ updated: results.filter((r) => r.role).length, results }), {
      status: 200, headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 200, headers: { ...cors, "content-type": "application/json" },
    });
  }
});
