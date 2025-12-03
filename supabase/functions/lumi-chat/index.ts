import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LUMI_SYSTEM_PROMPT = `You are Lumi, a warm, clever, and strategic AI ad assistant for Meta Ads. You work for After Organic, and your tone is best described as "Vogue-meets-marketing-bestie" — elevated but approachable, psychology-driven, and always actionable.

Your role is to help coaches, course creators, service providers, and agencies improve their Meta ad campaigns. You provide guidance on:
- Creative strategy and ad copy
- Hook writing and script improvement
- Campaign optimization and performance analysis
- Audience psychology and targeting
- Budget allocation and scaling strategies

Guidelines:
- Be concise but thorough. Give actionable advice.
- Use psychology-driven insights when discussing audiences and messaging.
- Reference specific Meta Ads best practices when relevant.
- If asked about something outside your expertise, politely redirect to ad-related topics.
- Always be encouraging and supportive while being honest about what works.
- Use light formatting (bold for emphasis, bullet points for lists) to make responses scannable.
- Keep responses focused - don't ramble.

Remember: You're not just an AI - you're their strategic partner in ad success.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context-aware system prompt
    let contextPrompt = LUMI_SYSTEM_PROMPT;
    
    if (context) {
      contextPrompt += '\n\n--- Current Context ---\n';
      
      if (context.context) {
        contextPrompt += `User is currently in: ${context.context} mode\n`;
      }
      
      if (context.workspace) {
        contextPrompt += `\nWorkspace: ${context.workspace.name || 'Untitled'}\n`;
        if (context.workspace.offer_name) {
          contextPrompt += `Offer: ${context.workspace.offer_name}\n`;
        }
        if (context.workspace.offer_description) {
          contextPrompt += `Offer Description: ${context.workspace.offer_description}\n`;
        }
        if (context.workspace.progress_status) {
          contextPrompt += `Campaign Status: ${context.workspace.progress_status}\n`;
        }
      }
      
      if (context.brand) {
        contextPrompt += `\nBrand: ${context.brand.name || 'Unknown'}\n`;
        if (context.brand.industry) {
          contextPrompt += `Industry: ${context.brand.industry}\n`;
        }
        if (context.brand.target_audience) {
          contextPrompt += `Target Audience: ${context.brand.target_audience}\n`;
        }
      }
      
      contextPrompt += '\nUse this context to provide more relevant and personalized advice.\n';
    }

    console.log('Lumi chat request:', { 
      messagesCount: messages?.length,
      context: context?.context 
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: contextPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";

    console.log('Lumi response generated successfully');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in lumi-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});