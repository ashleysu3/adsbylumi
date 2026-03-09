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
    const { portalId, accessCode, action, productionItemId, comment, clientName } = await req.json();

    if (!portalId || !accessCode || !action || !productionItemId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['viewed', 'approved', 'changes_requested'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Re-validate access code
    const { data: portalData, error: portalError } = await supabase.rpc('validate_portal_access', {
      p_portal_id: portalId,
    });

    if (portalError || !portalData) {
      return new Response(JSON.stringify({ error: 'Portal not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const portal = portalData;

    if (portal.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Portal is no longer active' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const codeHash = await hashCode(accessCode);
    if (codeHash !== portal.access_code_hash) {
      return new Response(JSON.stringify({ error: 'Invalid access code' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert activity record
    const { error: activityError } = await supabase
      .from('client_portal_activity')
      .insert({
        portal_id: portalId,
        production_item_id: productionItemId,
        action,
        comment: comment || null,
        client_name: clientName || null,
      });

    if (activityError) {
      console.error('Activity insert error:', activityError);
      throw new Error('Failed to record activity');
    }

    // Update production_items in campaign_workspaces if approved or changes_requested
    if (action === 'approved' || action === 'changes_requested') {
      const { data: workspace, error: wsError } = await supabase
        .from('campaign_workspaces')
        .select('production_items')
        .eq('id', portal.workspace_id)
        .single();

      if (!wsError && workspace) {
        const items = (workspace.production_items || []) as any[];
        const updatedItems = items.map((item: any) => {
          if (item.id === productionItemId) {
            return {
              ...item,
              approval_status: action,
              approval_comment: comment || null,
              approval_at: new Date().toISOString(),
            };
          }
          return item;
        });

        await supabase
          .from('campaign_workspaces')
          .update({
            production_items: updatedItems,
            updated_at: new Date().toISOString(),
          })
          .eq('id', portal.workspace_id);
      }

      // Fire-and-forget notification
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        fetch(`${supabaseUrl}/functions/v1/send-portal-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            portalId,
            action,
            productionItemId,
            comment,
            clientName,
          }),
        }).catch(() => {}); // fire and forget
      } catch {
        // silently ignore
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Client portal action error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
