// QA Harness — admin-only fixture management for end-to-end testing.
//
// Actions:
//   seed    — create/reset a deterministic "LUMI QA" brand + offer + publish-ready
//             campaign workspace, wired to the caller's real Meta ad account.
//   status  — report the current state of the QA fixture.
//   cleanup — delete QA workspaces/offers/brand and pause+delete any [QA] campaigns
//             left on the connected Meta ad account.
//
// Nothing here can spend money: campaigns published in QA mode are forced to
// PAUSED by build-meta-campaign (see qaTestMode) and prefixed with [QA].

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const QA_BRAND_NAME = 'LUMI QA';
const QA_PREFIX = '[QA]';
const GRAPH = 'https://graph.facebook.com/v25.0';

interface Body {
  action?: 'seed' | 'status' | 'cleanup';
  /** Brand to copy Meta credentials from. Defaults to the caller's first connected brand. */
  sourceBrandId?: string;
}

function json(body: unknown, cors: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Mirrors src/lib/copy-signature.ts so the seeded workspace is pre-approved. */
async function computeCopySignature(
  variations: { headline?: string; primary_text?: string; description?: string }[],
): Promise<string> {
  const normalized = variations
    .map((v) => ({
      h: (v?.headline || '').trim(),
      p: (v?.primary_text || '').trim(),
      d: (v?.description || '').trim(),
    }))
    .filter((v) => v.h || v.p || v.d)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return sha256Hex(JSON.stringify(normalized));
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Deterministic copy fixture — stable so signature comparisons are reproducible. */
const QA_COPY = [
  {
    headline: 'Plan your next launch',
    primary_text:
      'Running ads should not feel like guesswork. Map the offer, the audience and the message in one place, then launch with a plan you can actually explain.',
    description: 'A calmer way to run Meta ads.',
  },
  {
    headline: 'Ads without the guesswork',
    primary_text:
      'You already know your people. This is the part that turns what you know into a campaign that runs while you work on everything else.',
    description: 'Built for creators, not media buyers.',
  },
];

const QA_PRODUCTION_ITEMS = [
  {
    id: 'qa_prod_1',
    hook: 'Running ads should not feel like guesswork.',
    format: 'graphic',
    angleName: 'QA Angle A',
    approval_status: 'approved',
    approved_at: '2026-01-01T00:00:00.000Z',
    completed: true,
    psychology_trigger: 'clarity',
    why_this_works: 'QA fixture — deterministic copy for automated publish tests.',
    guidance: 'QA fixture item. Not for production use.',
    finalCopy: {
      headline: QA_COPY[0].headline,
      primaryText: QA_COPY[0].primary_text,
      description: QA_COPY[0].description,
      cta: 'LEARN_MORE',
    },
  },
  {
    id: 'qa_prod_2',
    hook: 'You already know your people.',
    format: 'graphic',
    angleName: 'QA Angle B',
    approval_status: 'approved',
    approved_at: '2026-01-01T00:00:00.000Z',
    completed: true,
    psychology_trigger: 'confidence',
    why_this_works: 'QA fixture — deterministic copy for automated publish tests.',
    guidance: 'QA fixture item. Not for production use.',
    finalCopy: {
      headline: QA_COPY[1].headline,
      primaryText: QA_COPY[1].primary_text,
      description: QA_COPY[1].description,
      cta: 'LEARN_MORE',
    },
  },
];

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Authentication required' }, cors, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(url, anon);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ success: false, error: 'Invalid authentication' }, cors, 401);

    const db = createClient(url, service);

    // Admin-only. The harness writes fixtures and deletes Meta objects.
    const { data: adminRole } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!adminRole) return json({ success: false, error: 'Admin role required' }, cors, 403);

    const body: Body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    // ---------------------------------------------------------------- status
    const readStatus = async () => {
      const { data: brand } = await db
        .from('brands')
        .select('id, name, meta_account_id, page_id, meta_pixel_id, instagram_account_id, website_url')
        .eq('user_id', user.id)
        .eq('name', QA_BRAND_NAME)
        .maybeSingle();

      if (!brand) return { seeded: false, brand: null, workspaces: [] };

      const { data: workspaces } = await db
        .from('campaign_workspaces')
        .select('id, name, progress_status, meta_campaign_status, meta_campaign_ids, published_at')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false });

      return {
        seeded: true,
        brand: {
          id: brand.id,
          name: brand.name,
          metaAccountId: brand.meta_account_id,
          pageId: brand.page_id,
          pixelId: brand.meta_pixel_id,
          instagramAccountId: brand.instagram_account_id,
          websiteUrl: brand.website_url,
        },
        workspaces: workspaces || [],
      };
    };

    if (action === 'status') {
      return json({ success: true, ...(await readStatus()) }, cors);
    }

    // --------------------------------------------------------------- cleanup
    if (action === 'cleanup') {
      const st = await readStatus();
      const removed = { campaigns: [] as string[], failures: [] as string[], workspaces: 0 };

      if (st.brand) {
        const { data: full } = await db
          .from('brands')
          .select('meta_access_token, meta_account_id')
          .eq('id', st.brand.id)
          .maybeSingle();

        const token = full?.meta_access_token;
        const acct = full?.meta_account_id?.replace('act_', '');

        // Delete every [QA]-prefixed campaign on the connected ad account.
        if (token && acct) {
          try {
            const res = await fetch(
              `${GRAPH}/act_${acct}/campaigns?fields=id,name,status&limit=200&access_token=${token}`,
            );
            const data = await res.json();
            for (const c of data?.data || []) {
              if (typeof c?.name === 'string' && c.name.startsWith(QA_PREFIX)) {
                const del = await fetch(`${GRAPH}/${c.id}?access_token=${token}`, { method: 'DELETE' });
                const delData = await del.json().catch(() => ({}));
                if (delData?.error) removed.failures.push(`${c.name}: ${delData.error.message}`);
                else removed.campaigns.push(`${c.name} (${c.id})`);
              }
            }
          } catch (e) {
            removed.failures.push(`Meta cleanup failed: ${(e as Error).message}`);
          }
        }

        const { count } = await db
          .from('campaign_workspaces')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', st.brand.id);
        removed.workspaces = count || 0;

        await db.from('campaign_workspaces').delete().eq('brand_id', st.brand.id);
        await db.from('offers').delete().eq('brand_id', st.brand.id);
        await db.from('brands').delete().eq('id', st.brand.id);
      }

      return json({ success: true, action: 'cleanup', removed }, cors);
    }

    // ------------------------------------------------------------------ seed
    if (action === 'seed') {
      // Find a real connected brand to borrow Meta credentials from.
      let query = db
        .from('brands')
        .select(
          'id, name, meta_account_id, meta_access_token, meta_token_expires_at, page_id, page_name, instagram_account_id, instagram_account_name, meta_pixel_id, meta_pixel_name',
        )
        .eq('user_id', user.id)
        .neq('name', QA_BRAND_NAME)
        .not('meta_account_id', 'is', null)
        .not('meta_access_token', 'is', null);

      if (body.sourceBrandId) query = query.eq('id', body.sourceBrandId);

      const { data: sources } = await query.limit(1);
      const source = sources?.[0];

      if (!source) {
        return json(
          {
            success: false,
            error:
              'No connected Meta brand found on your account. Connect Meta on a real brand first, then re-run seed.',
          },
          cors,
        );
      }

      // Reset any previous fixture (DB only — Meta cleanup is a separate action).
      const { data: existing } = await db
        .from('brands')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', QA_BRAND_NAME)
        .maybeSingle();

      if (existing) {
        await db.from('campaign_workspaces').delete().eq('brand_id', existing.id);
        await db.from('offers').delete().eq('brand_id', existing.id);
        await db.from('brands').delete().eq('id', existing.id);
      }

      const { data: brand, error: brandErr } = await db
        .from('brands')
        .insert({
          user_id: user.id,
          name: QA_BRAND_NAME,
          website_url: 'https://adsbylumi.com',
          industry: 'Software',
          brand_voice: 'Warm, clear, strategy-first. Plain language, no hype.',
          target_audience: 'Coaches and course creators who run their own ads.',
          value_proposition: 'Plan, build and launch Meta ads without an agency.',
          business_model: 'low_ticket_direct',
          business_model_confirmed_at: new Date().toISOString(),
          meta_account_id: source.meta_account_id,
          meta_access_token: source.meta_access_token,
          meta_token_expires_at: source.meta_token_expires_at,
          page_id: source.page_id,
          page_name: source.page_name,
          instagram_account_id: source.instagram_account_id,
          instagram_account_name: source.instagram_account_name,
          meta_pixel_id: source.meta_pixel_id,
          meta_pixel_name: source.meta_pixel_name,
          meta_pixel_verified_at: source.meta_pixel_id ? new Date().toISOString() : null,
          // meta_connected is a generated column — derived from the token/account fields above.
          onboarding_step: 99,
          onboarding_completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (brandErr) return json({ success: false, error: `Brand seed failed: ${brandErr.message}` }, cors);

      const { data: offer, error: offerErr } = await db
        .from('offers')
        .insert({
          brand_id: brand.id,
          name: 'QA Workshop',
          description: 'A deterministic fixture offer used by the automated publish tests.',
          price_point: '$97',
          url: 'https://adsbylumi.com/pricing',
          target_outcome: 'Registrations for a live workshop.',
          page_goal: 'lead',
        })
        .select('id')
        .single();

      if (offerErr) return json({ success: false, error: `Offer seed failed: ${offerErr.message}` }, cors);

      const signature = await computeCopySignature(QA_COPY);

      // Every publishable creative needs a real uploaded asset, so the fixture
      // ships its own: a generated 1080x1080 PNG written to creative-assets.
      const fixturePng = makeSolidPng(1080, 1080, [249, 115, 22]);
      const assetPath = `${brand.id}/qa-fixture.png`;
      const { error: uploadErr } = await db.storage
        .from('creative-assets')
        .upload(assetPath, fixturePng, { contentType: 'image/png', upsert: true });
      if (uploadErr) {
        return json({ success: false, error: `Fixture asset upload failed: ${uploadErr.message}` }, cors);
      }
      const { data: signed } = await db.storage
        .from('creative-assets')
        .createSignedUrl(assetPath, 60 * 60 * 24 * 7);

      const uploadedAssets = QA_PRODUCTION_ITEMS.map((item, i) => ({
        id: `qa_asset_${i + 1}`,
        linked_concept_id: item.id,
        file_url: signed?.signedUrl ?? null,
        storage_path: assetPath,
        file_type: 'image',
        file_name: 'qa-fixture.png',
      }));

      const productionItems = QA_PRODUCTION_ITEMS.map((item, i) => ({
        ...item,
        uploaded_asset_id: uploadedAssets[i].id,
        linkedAsset: {
          id: uploadedAssets[i].id,
          url: uploadedAssets[i].file_url,
          storagePath: assetPath,
          type: 'image',
          fileName: 'qa-fixture.png',
        },
      }));


      const { data: workspace, error: wsErr } = await db
        .from('campaign_workspaces')
        .insert({
          brand_id: brand.id,
          offer_id: offer.id,
          name: `${QA_PREFIX} Publish Flow Fixture`,
          offer_name: 'QA Workshop',
          offer_url: 'https://adsbylumi.com/pricing',
          offer_price: '$97',
          offer_description: 'Deterministic fixture offer for automated publish tests.',
          progress_status: 'ready_to_publish',
          objective: 'Leads',
          production_items: productionItems,
          user_uploaded_assets: uploadedAssets,
          selected_copy: { variations: QA_COPY },
          approved_copy_signature: signature,
          approved_copy_at: new Date().toISOString(),
          tracking_verified: true,
          campaign_builder_answers: {
            budget: 5,
            budgetType: 'daily',
            startDate: isoDate(1),
            endDate: isoDate(8),
            audience: 'broad',
            objective: 'Leads',
            optimizationEvent: 'Lead',
            placements: 'Advantage+',
            metaAdvantage: true,
            creativeType: 'graphic',
            launchActive: false,
            launchStatus: 'paused',
            additionalPosts: [],
            locationTargeting: { countries: ['United States'] },
          },
        })
        .select('id, name')
        .single();

      if (wsErr) return json({ success: false, error: `Workspace seed failed: ${wsErr.message}` }, cors);

      return json(
        {
          success: true,
          action: 'seed',
          brandId: brand.id,
          offerId: offer.id,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          copySignature: signature,
          borrowedFrom: { brandId: source.id, brandName: source.name },
          note: 'Publish this workspace with qaTestMode: true — campaigns are forced PAUSED and named with a [QA] prefix.',
        },
        cors,
      );
    }

    return json({ success: false, error: `Unknown action: ${action}` }, cors, 400);
  } catch (e) {
    console.error('[qa-harness] error:', e);
    return json({ success: false, error: (e as Error).message || 'Unexpected error' }, cors);
  }
});

/**
 * Minimal PNG encoder — produces a solid-colour RGB image with no external
 * dependency. Uses stored (uncompressed) deflate blocks, which every PNG
 * decoder including Meta's accepts.
 */
function makeSolidPng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  const crc32 = (buf: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const be32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

  const concat = (parts: Uint8Array[]) => {
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  const chunk = (type: string, data: Uint8Array) => {
    const typeBytes = new TextEncoder().encode(type);
    const body = concat([typeBytes, data]);
    return concat([be32(data.length), body, be32(crc32(body))]);
  };

  // Raw scanlines: filter byte 0 + RGB triples.
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = rgb[0];
      raw[o + 1] = rgb[1];
      raw[o + 2] = rgb[2];
    }
  }

  // zlib container around stored deflate blocks.
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 65535;
  for (let off = 0; off < raw.length; off += MAX) {
    const len = Math.min(MAX, raw.length - off);
    const last = off + len >= raw.length ? 1 : 0;
    blocks.push(new Uint8Array([last, len & 255, (len >>> 8) & 255, ~len & 255, (~len >>> 8) & 255]));
    blocks.push(raw.subarray(off, off + len));
  }
  // Adler-32 of the raw data.
  let a = 1, b = 0;
  for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
  blocks.push(be32(((b << 16) | a) >>> 0));

  const ihdr = concat([be32(width), be32(height), new Uint8Array([8, 2, 0, 0, 0])]);
  return concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', concat(blocks)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
