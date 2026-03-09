import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { portalId, accessCode } = await req.json();

    if (!portalId || !accessCode) {
      return new Response(JSON.stringify({ error: 'Portal ID and access code are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Use security definer function to fetch portal
    const { data: portalData, error: portalError } = await supabase.rpc('validate_portal_access', {
      p_portal_id: portalId,
    });

    if (portalError || !portalData) {
      console.error('Portal lookup error:', portalError);
      return new Response(JSON.stringify({ error: 'Portal not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const portal = portalData;

    if (portal.status !== 'active') {
      return new Response(JSON.stringify({ error: 'This portal is no longer active' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This portal has expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash and compare access code
    const codeHash = await hashCode(accessCode);
    if (codeHash !== portal.access_code_hash) {
      return new Response(JSON.stringify({ error: 'Invalid access code' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch production items from campaign_workspaces
    const { data: workspace, error: wsError } = await supabase
      .from('campaign_workspaces')
      .select('production_items, creative_json, name, offer_name')
      .eq('id', portal.workspace_id)
      .single();

    if (wsError) {
      console.error('Workspace fetch error:', wsError);
    }

    // Filter production items to only include items_included
    const allItems = workspace?.production_items || [];
    const includedIds = (portal.items_included || []) as string[];
    const filteredItems = includedIds.length > 0
      ? allItems.filter((item: any) => includedIds.includes(item.id))
      : allItems;

    return new Response(JSON.stringify({
      success: true,
      portal: {
        id: portal.id,
        portal_name: portal.portal_name,
        client_name: portal.client_name,
        agency_branding: portal.agency_branding,
        items_included: portal.items_included,
        workspace_id: portal.workspace_id,
      },
      productionItems: filteredItems,
      workspaceName: workspace?.name,
      offerName: workspace?.offer_name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Client portal auth error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
