import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// Authenticate user and return user ID
async function authenticateUser(req: Request, supabase: any): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { userId: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { userId: null, error: 'Invalid or expired token' };
  }
  
  return { userId: user.id, error: null };
}

// Build content assets context for AI prompt
function buildContentAssetsContext(contentAssets: any[] | null): string {
  if (!contentAssets?.length) return "";
  
  let context = "\n\nREAL USER-PROVIDED CONTENT:\n";
  context += "IMPORTANT: Use the EXACT language, phrases, and specific pain points from the content below. These are REAL words from REAL clients.\n\n";
  
  const typeLabels: Record<string, string> = {
    testimonials: "CLIENT TESTIMONIALS (real words from clients)",
    survey_answers: "SURVEY RESPONSES (actual pain points in client language)",
    client_objections: "COMMON OBJECTIONS & QUESTIONS",
    webinar_scripts: "WEBINAR/CHALLENGE SCRIPTS",
    other: "OTHER CONTENT"
  };
  
  contentAssets.forEach((asset: any) => {
    context += `## ${typeLabels[asset.asset_type] || asset.asset_type.toUpperCase()}\n${asset.content}\n\n`;
  });
  
  return context;
}

// Generate hash of content asset IDs for tracking
function generateContentHash(contentAssets: any[] | null): string | null {
  if (!contentAssets?.length) return null;
  return contentAssets.map(a => a.id).sort().join(',');
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let parsedBrandId: string | null = null;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Required environment variables are not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user
    const { userId, error: authError } = await authenticateUser(req, supabase);
    if (authError || !userId) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { brandId } = body;

    // Input validation
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUUID(brandId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid brandId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    parsedBrandId = brandId;

    // Verify brand exists AND user owns it
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ownership check - ensure the authenticated user owns this brand
    if (brand.user_id !== userId) {
      console.log('Ownership check failed:', { brandUserId: brand.user_id, requestUserId: userId });
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating audience psychology for brand:', brandId, 'by user:', userId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Update status to generating
    await supabase
      .from('brands')
      .update({ psychology_status: 'generating' })
      .eq('id', brandId);

    // Fetch content assets for this brand
    const { data: contentAssets } = await supabase
      .from('brand_content_assets')
      .select('id, asset_type, content')
      .eq('brand_id', brandId);

    const contentAssetsContext = buildContentAssetsContext(contentAssets);
    const contentHash = generateContentHash(contentAssets);

    const systemPrompt = `You are an expert in audience psychology and advertising strategy, trained in the "After Organic" methodology.
Your task is to create a comprehensive psychological profile of the target audience based on brand information.
${contentAssetsContext ? `\n${contentAssetsContext}` : ''}

CRITICAL FORMATTING REQUIREMENTS:
All text must be formatted for easy reading and scanning:
- Use line breaks between distinct ideas
- Use bullet points (•) within text fields to break up information
- Keep paragraphs short (2-3 sentences max)
- Never write dense walls of text
- Make every section scannable

Analyze the brand's value proposition, target audience, and industry to generate:

1. Demographics - Format as a scannable profile:
   
   Age: [range]
   Income: [level]
   Occupation: [types]
   Location: [patterns]
   
   [1-2 sentences of additional context]

2. Psychographics - Format with clear sections:
   
   Values: [what they believe in]
   
   Lifestyle: [how they live]
   
   Aspirations: [what they want to become]
   
   Identity: [how they see themselves]

3. Pain Points - Specific problems, frustrations, struggles (array of 5-8 items)
   Each item should be a complete, relatable statement that resonates emotionally.
   Example: "Spending hours on ads that get zero engagement, wondering if anyone even sees them"

4. Desires - Deep wants, outcomes they're seeking (array of 5-8 items)
   Each item should paint a vivid picture of the desired outcome.
   Example: "Wake up to sales notifications while actually enjoying life instead of hustling 24/7"

5. Objections - Reasons they might not buy, hesitations, doubts (array of 5-8 items)
   Frame as actual thoughts they'd have.
   Example: "I've tried other programs before and they didn't work for my specific situation"

6. Motivations - Format as a clear breakdown:
   
   Core Driver: [their deepest motivation]
   
   What Moves Them:
   • [motivation 1]
   • [motivation 2]
   • [motivation 3]
   
   Decision Triggers: [what finally makes them act]

Return ONLY a valid JSON object with these exact fields:
{
  "demographics": "string (formatted with line breaks and structure)",
  "psychographics": "string (formatted with sections and spacing)",
  "pain_points": ["string"],
  "desires": ["string"],
  "objections": ["string"],
  "motivations": "string (formatted with structure)"
}

Be specific and psychology-driven. Use language that resonates with the After Organic tone: warm, clever, strategic.`;

    const userPrompt = `Create a psychological profile for this audience:

Brand: ${brand.name}
What they offer: ${brand.value_proposition || 'Not specified'}
Who they serve: ${brand.target_audience || 'Not specified'}
Industry: ${brand.industry || 'Not specified'}

Generate a deep, actionable psychological profile.${contentAssets?.length ? ` Use the specific language and insights from the ${contentAssets.length} content asset(s) provided above.` : ''}`;

    console.log('Calling Lovable AI for psychology generation...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      await supabase
        .from('brands')
        .update({ psychology_status: 'error' })
        .eq('id', brandId);
      
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    const content =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.choices?.[0]?.text ??
      aiData?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      "";

    if (!content) {
      console.error('Unexpected AI response shape:', aiData);
      throw new Error('AI response was empty or in an unexpected format');
    }

    console.log('Raw AI content:', content);

    // Extract JSON robustly
    const extractJsonObject = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? text).trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      const candidate = firstBrace !== -1 && lastBrace !== -1 ? raw.slice(firstBrace, lastBrace + 1) : raw;
      return JSON.parse(candidate);
    };

    const psychology = extractJsonObject(content);

    // Update brand with psychology data
    const { error: updateError } = await supabase
      .from('brands')
      .update({
        audience_psychology: psychology,
        psychology_status: 'completed',
        psychology_content_hash: contentHash,
        psychology_generated_at: new Date().toISOString()
      })
      .eq('id', brandId);

    if (updateError) throw updateError;

    console.log('Audience psychology generated and saved successfully with content hash:', contentHash);

    return new Response(JSON.stringify({ success: true, psychology }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-audience-psychology:', error);
    
    // Try to update status to error if we have brandId
    if (parsedBrandId) {
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from('brands')
            .update({ psychology_status: 'error' })
            .eq('id', parsedBrandId);
        }
      } catch (e) {
        console.error('Failed to update error status:', e);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate psychology' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
