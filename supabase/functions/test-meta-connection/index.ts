import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  success: boolean;
  message: string;
  details?: {
    adAccountName?: string;
    adAccountId?: string;
    pageName?: string;
    tokenValid?: boolean;
    permissionsValid?: boolean;
    permissions?: string[];
  };
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId } = await req.json();

    if (!brandId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Brand ID is required',
          error: 'Missing brandId parameter'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Testing Meta connection for brand:', brandId);

    // Get the Meta token from vault
    const { data: token, error: tokenError } = await supabase.rpc('get_meta_token', {
      p_brand_id: brandId
    });

    if (tokenError || !token) {
      console.error('Token retrieval error:', tokenError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No Meta access token found',
          error: 'Token not found in vault. Please reconnect your Meta account.',
          details: { tokenValid: false }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get brand info for account ID
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('meta_account_id, page_id, page_name')
      .eq('id', brandId)
      .single();

    if (brandError || !brand?.meta_account_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No Meta ad account configured',
          error: 'Please connect a Meta ad account first.',
          details: { tokenValid: true }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Test 1: Validate token with /me endpoint
    console.log('Testing token validity...');
    const meResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${token}`
    );
    const meData = await meResponse.json();

    if (meData.error) {
      console.error('Token validation failed:', meData.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Meta token is invalid or expired',
          error: meData.error.message || 'Token validation failed',
          details: { 
            tokenValid: false,
            errorCode: meData.error.code,
            errorType: meData.error.type
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Test 2: Check token permissions
    console.log('Checking token permissions...');
    const permissionsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`
    );
    const permissionsData = await permissionsResponse.json();
    
    const grantedPermissions = permissionsData.data
      ?.filter((p: any) => p.status === 'granted')
      ?.map((p: any) => p.permission) || [];

    const requiredPermissions = ['ads_management', 'ads_read', 'business_management'];
    const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));

    // Test 3: Validate ad account access
    console.log('Testing ad account access...');
    const accountId = brand.meta_account_id.startsWith('act_') 
      ? brand.meta_account_id 
      : `act_${brand.meta_account_id}`;
    
    const accountResponse = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}?fields=name,account_status,currency&access_token=${token}`
    );
    const accountData = await accountResponse.json();

    if (accountData.error) {
      console.error('Ad account access failed:', accountData.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Cannot access Meta ad account',
          error: accountData.error.message || 'Ad account access denied',
          details: {
            tokenValid: true,
            permissionsValid: missingPermissions.length === 0,
            permissions: grantedPermissions,
            adAccountId: accountId
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // All tests passed
    console.log('All connection tests passed');
    const result: TestResult = {
      success: true,
      message: 'Meta connection is working correctly',
      details: {
        tokenValid: true,
        permissionsValid: missingPermissions.length === 0,
        permissions: grantedPermissions,
        adAccountId: accountId,
        adAccountName: accountData.name,
        pageName: brand.page_name || undefined
      }
    };

    if (missingPermissions.length > 0) {
      result.message = 'Connection works but some permissions are missing';
      result.details!.permissionsValid = false;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Connection test failed',
        error: error.message || 'An unexpected error occurred'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
