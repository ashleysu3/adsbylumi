import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuthedUser } from '../_shared/check-subscription.ts';

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

    // Authenticate user + paywall
    const gate = await requireAuthedUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;
    const userId = gate.userId!;


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

    // Scrape the brand's website so the AI has real source material, not just
    // a one-line value prop. This is the biggest lever against generic output.
    let websiteText = "";
    const websiteUrl = (brand as any).website_url as string | null;
    if (websiteUrl && /^https?:\/\//i.test(websiteUrl)) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 9000);
        const res = await fetch(websiteUrl, {
          signal: ctrl.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        clearTimeout(t);
        if (res.ok) {
          const html = await res.text();
          websiteText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 8000);
        }
      } catch (e) {
        console.warn('audience: website scrape failed', (e as any)?.message || e);
      }
    }

    // If the site couldn't be read (bot-blocked / empty), we have NO real source
    // to ground on. Without this guard the model invents a specific niche (e.g.
    // "wedding pros") out of thin air. Force it generic instead of wrong.
    const hasRealSource = websiteText.trim().length > 200;
    const noSourceWarning = hasRealSource ? "" : `

IMPORTANT — LIMITED SOURCE DATA: The brand's website could not be read (it likely blocks automated access) and there is little real copy to work from. Do NOT invent or guess a specific industry, niche, or ideal-client type — for example, do NOT assume "wedding planners", "real estate agents", "fitness coaches", or any other vertical. Base the profile strictly on the brand name and value proposition, keep it deliberately GENERIC, and clearly mark every item as a tentative inference ("likely…"). Being generic and correct is far better than specific and wrong.`;

    // Also pull voice profile for tone/vocabulary clues if it exists
    const voiceProfile = (brand as any).voice_profile;
    const voiceContext = voiceProfile && typeof voiceProfile === 'object'
      ? `\nBRAND'S VOICE PROFILE (use the same vocabulary the brand uses):\n${JSON.stringify(voiceProfile).slice(0, 2000)}`
      : '';

    const systemPrompt = `You are an expert in audience psychology and conversion copywriting, trained in the "After Organic" methodology.

Your job: produce a SPECIFIC, GROUNDED audience profile based on the brand's own website copy. NOT a generic "busy entrepreneur" sketch.
${noSourceWarning}
${contentAssetsContext ? `\n${contentAssetsContext}` : ''}

GROUNDING RULES (most important):
- Every pain point, desire, and objection MUST reference something from the website copy, the brand's voice profile, or the testimonials/content assets above. If a category has nothing real to draw from, return 1-2 items and mark them as inferences using language like "likely…" — do NOT pad with filler.
- Use the audience's OWN words wherever possible. Quote phrases from the source. Never use marketing clichés ("take their business to the next level", "achieve their goals", "live their dream life").
- Be uncomfortably specific. Name the situation, the time of day, the tool they're stuck in, the dollar figure they're losing, the person they're hiding it from. Vague = wrong.
- Avoid: "freedom", "scale", "growth mindset", "limiting beliefs", "next level", "dream life", "passion", "purpose-driven" unless quoted directly from the source.

FORMATTING:
- Use short paragraphs with line breaks.
- Use bullets (•) inside text fields.
- No dense walls of text.

Generate:

1. Demographics — Age / Income / Occupation / Location, then 1-2 sentences of grounded context (who they are, what stage of business/life).

2. Psychographics — Values / Lifestyle / Aspirations / Identity, each as one specific sentence.

3. Pain Points (5-8) — Each is a complete sentence written as the audience would say it to a friend. Reference the actual scenario (e.g. "Refreshing Stripe at 11pm hoping a sale came in") not abstractions ("financial stress").

4. Desires (5-8) — Concrete outcomes with sensory or situational detail. Not "more freedom" → "Closing the laptop at 3pm to pick up the kids without checking ad spend on the way."

5. Objections (5-8) — Real internal thoughts including price, time, trust, "I've tried this before", "my niche is different". Frame as inner monologue.

6. Motivations — Core Driver / What Moves Them (bullets) / Decision Triggers — all tied to evidence from the source.

7. Summary — One paragraph (3-4 sentences) describing this person as if briefing a copywriter. End with the single most important emotional truth.

Return ONLY a valid JSON object with these exact fields:
{
  "demographics": "string",
  "psychographics": "string",
  "pain_points": ["string"],
  "desires": ["string"],
  "objections": ["string"],
  "motivations": "string",
  "summary": "string"
}

Tone: warm, clever, strategic — After Organic. Never robotic, never hype.`;

    const userPrompt = `Build a grounded psychological profile for this brand's audience.

BRAND: ${brand.name}
WEBSITE: ${websiteUrl || 'Not provided'}
WHAT THEY OFFER: ${brand.value_proposition || 'Not specified'}
WHO THEY SAY THEY SERVE: ${brand.target_audience || 'Not specified'}
INDUSTRY: ${brand.industry || 'Not specified'}
${voiceContext}

=== WEBSITE COPY (primary source — quote from this) ===
${websiteText || '(could not fetch — infer carefully and flag inferences)'}

${contentAssets?.length ? `Use the ${contentAssets.length} real content asset(s) above as the highest-priority source.` : ''}

Reminder: ground every claim in the source. Be specific. Skip the clichés.`;

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
        response_format: { type: 'json_object' },
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

    // Extract JSON robustly — model sometimes returns prose like "I need more info..."
    const extractJsonObject = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? text).trim();
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('AI did not return JSON. Raw start: ' + raw.slice(0, 120));
      }
      let candidate = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        candidate = candidate.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, ' ');
        return JSON.parse(candidate);
      }
    };

    let psychology;
    try {
      psychology = extractJsonObject(content);
    } catch (parseErr: any) {
      console.error('JSON parse failed:', parseErr?.message, 'content:', content.slice(0, 500));
      throw new Error('AI returned non-JSON response. Try again or add more brand details.');
    }

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
