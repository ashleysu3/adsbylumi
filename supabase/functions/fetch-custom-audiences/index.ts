import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface CustomAudience {
  id: string;
  name: string;
  description?: string;
  approximate_count?: number;
  subtype?: string;
  time_created?: string;
  delivery_status?: {
    code: number;
    description: string;
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId } = await req.json();

    if (!brandId) {
      throw new Error('Brand ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch brand with Meta credentials
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();

    if (brandError) throw brandError;

    if (!brand.meta_account_id) {
      throw new Error('Meta account not connected');
    }

    // Read token directly (service-role context lacks auth.uid() for vault RPC)
    const accessToken = brand.meta_access_token;

    if (!accessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    const accountId = brand.meta_account_id.replace('act_', '');

    console.log(`Fetching custom audiences for account: ${accountId}`);

    // Fetch custom audiences from Meta API
    const response = await fetch(
      `https://graph.facebook.com/v25.0/act_${accountId}/customaudiences?fields=id,name,description,approximate_count,subtype,time_created,delivery_status&limit=100&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      throw new Error(data.error.message || 'Failed to fetch audiences');
    }

    // Filter and format audiences
    const audiences: CustomAudience[] = (data.data || [])
      .filter((audience: any) => {
        // Filter out audiences that can't be used for targeting
        const deliveryCode = audience.delivery_status?.code;
        // Code 200 = ready, some other codes may still work
        return !deliveryCode || deliveryCode < 400;
      })
      .map((audience: any) => ({
        id: audience.id,
        name: audience.name,
        description: audience.description,
        approximate_count: audience.approximate_count,
        subtype: audience.subtype,
        time_created: audience.time_created,
        delivery_status: audience.delivery_status,
      }));

    // Group audiences by type for better UX
    const groupedAudiences = {
      website: audiences.filter(a => a.subtype === 'WEBSITE'),
      engagement: audiences.filter(a => ['ENGAGEMENT', 'IG_BUSINESS', 'FB_PAGE'].includes(a.subtype || '')),
      custom: audiences.filter(a => a.subtype === 'CUSTOM'),
      lookalike: audiences.filter(a => a.subtype === 'LOOKALIKE'),
      other: audiences.filter(a => !['WEBSITE', 'ENGAGEMENT', 'IG_BUSINESS', 'FB_PAGE', 'CUSTOM', 'LOOKALIKE'].includes(a.subtype || '')),
    };

    console.log(`Found ${audiences.length} usable audiences`);

    return new Response(
      JSON.stringify({
        success: true,
        audiences,
        groupedAudiences,
        total: audiences.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error fetching custom audiences:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        audiences: [],
        total: 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with error in body for easier handling
      }
    );
  }
});
