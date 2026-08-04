import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Backend smoke suite. Hits the deployed edge functions that sit on the critical
// publish path and asserts they respond correctly to unauthenticated and
// malformed input. These are contract checks — they must never create or spend.
//
// Run: supabase--test_edge_functions with { "functions": ["qa-harness"] }

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

async function callFn(name: string, body: unknown, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text(); // always consume
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body is itself a finding
  }
  return { status: res.status, json, text };
}

const CRITICAL_FUNCTIONS = [
  "build-meta-campaign",
  "qa-preflight-check",
  "compose-ad",
  "qa-harness",
];

Deno.test("critical functions reject requests with no Authorization header", async () => {
  for (const fn of CRITICAL_FUNCTIONS) {
    const { status, json, text } = await callFn(fn, {});
    assert(
      status === 401 || json?.success === false || json?.error,
      `${fn} did not reject an unauthenticated call (status ${status}: ${text.slice(0, 200)})`,
    );
  }
});

Deno.test("critical functions reject a garbage bearer token", async () => {
  for (const fn of CRITICAL_FUNCTIONS) {
    const { status, json } = await callFn(fn, {}, "not-a-real-jwt");
    assert(
      status === 401 || json?.success === false || json?.error,
      `${fn} accepted an invalid token (status ${status})`,
    );
  }
});

Deno.test("critical functions answer CORS preflight", async () => {
  for (const fn of CRITICAL_FUNCTIONS) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "OPTIONS",
      headers: { Origin: "https://adsbylumi.com" },
    });
    await res.text();
    assert(res.status < 400, `${fn} failed CORS preflight with ${res.status}`);
    assert(
      res.headers.get("access-control-allow-origin"),
      `${fn} preflight is missing Access-Control-Allow-Origin`,
    );
  }
});

Deno.test("qa-harness refuses an unknown action", async () => {
  const { json } = await callFn("qa-harness", { action: "nuke-everything" });
  assertEquals(json?.success, false);
});

Deno.test("build-meta-campaign never 500s on a malformed body", async () => {
  // A 5xx here surfaces to the user as the opaque "non-2xx status code" toast.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/build-meta-campaign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: "{not json",
  });
  await res.text();
  assert(res.status < 500, `expected a handled response, got ${res.status}`);
});
