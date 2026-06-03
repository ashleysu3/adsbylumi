import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ENGINE_URL = Deno.env.get("ENGINE_URL")!;
const ENGINE_KEY = Deno.env.get("LUMI_ENGINE_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const { url } = await req.json();
    const r = await fetch(`${ENGINE_URL}/extract-brand`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ENGINE_KEY,
      },
      body: JSON.stringify({ url }),
    });

    return new Response(await r.text(), {
      status: r.status,
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
