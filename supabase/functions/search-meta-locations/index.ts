import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, brandId } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Meta access token from brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("meta_access_token")
      .eq("id", brandId)
      .single();

    if (brandError || !brand?.meta_access_token) {
      return new Response(JSON.stringify({ error: "Meta not connected", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaAccessToken = brand.meta_access_token;

    // Search Meta's adgeolocation API for custom_location (returns lat/lng)
    const searchUrl = `https://graph.facebook.com/v21.0/search?type=adgeolocation&location_types=["custom_location"]&q=${encodeURIComponent(query)}&limit=5&access_token=${metaAccessToken}`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.error) {
      console.error("Meta location search error:", data.error);
      return new Response(JSON.stringify({ error: "Location search failed", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = (data.data || []).map((loc: any) => ({
      name: loc.name,
      region: loc.region || "",
      country_name: loc.country_name || "",
      latitude: loc.latitude,
      longitude: loc.longitude,
      key: loc.key,
      type: loc.type,
      display: [loc.name, loc.region, loc.country_name].filter(Boolean).join(", "),
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Location search error:", error);
    return new Response(JSON.stringify({ error: error.message, results: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
