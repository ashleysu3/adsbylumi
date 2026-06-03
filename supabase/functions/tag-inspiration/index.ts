import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const KEY = Deno.env.get("OPENAI_API_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You tag advertising creative for a library. Return ONLY JSON: {"format":"single|carousel|video-still","style":"photo-forward|type-led|highlighter|testimonial|device-mockup","hook":"curiosity|mistake|outcome|contrarian|question","energy":"bold|minimal|warm|playful","hasFace":true|false,"palette":["#hex","#hex"]}. Pick the closest single value for each field.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { imageUrl } = await req.json();
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Tag this ad." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    const d = await r.json();
    return new Response(d?.choices?.[0]?.message?.content || "{}", {
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
