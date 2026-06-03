import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ENGINE_URL = Deno.env.get("ENGINE_URL")!;
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";

const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "content-type": "application/json",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const body = await req.json();
    const r = await fetch(`${ENGINE_URL}/validate-template`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ENGINE_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return json(data, r.status);
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : String(e), errors: [], missingSlots: [], previewBase64: null },
      500
    );
  }
});
