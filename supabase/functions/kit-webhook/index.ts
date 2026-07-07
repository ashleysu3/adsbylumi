// Kit integration is not in use. This endpoint is disabled to prevent
// unauthenticated callers from injecting fake Lead events into Meta.
// To re-enable, restore an HMAC-verified handler and set KIT_WEBHOOK_SECRET.

Deno.serve(() => {
  return new Response(JSON.stringify({ error: 'Endpoint disabled' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  });
});
