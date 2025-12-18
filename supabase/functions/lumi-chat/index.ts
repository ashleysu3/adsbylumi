import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LUMI_SYSTEM_PROMPT = `You are Lumi, a sharp and strategic AI ad assistant. Your tone is warm but efficient — like a brilliant friend who respects your time.

CORE BEHAVIOR:
- **Ask first, advise second.** Before giving advice, ask 1-2 clarifying questions to understand what the user actually needs.
- **Short and punchy.** Keep responses to 2-4 sentences max unless the user asks for detail.
- **One thing at a time.** Don't overwhelm. Focus on the single most impactful insight or next step.
- **Be direct.** Skip the preamble. Get to the point.

RESPONSE STYLE:
- Lead with the sharpest insight or the most important question
- Use bold sparingly for key takeaways
- Avoid bullet-point dumps — pick the ONE thing that matters most
- If you need more info, ask. Don't guess.

EXAMPLE PATTERNS:
- User asks vague question → Ask: "What's the specific outcome you're going for here?"
- User shares a problem → Give ONE actionable suggestion, then ask if they want to go deeper
- User shares performance data → Identify the single biggest lever, explain why

You help with Meta Ads strategy, creative, copy, and optimization. Stay in your lane.`;

const ANGLE_FEEDBACK_SYSTEM_PROMPT = `You are Lumi, a sharp and strategic AI ad creative assistant. The user has just received their first set of creative angles for their ad campaign. Your job is to:

1. **Engage them in conversation** about their offer, audience, and goals to gather insights that will make the angles even more powerful.
2. **Ask thoughtful questions** about:
   - Their ideal customer's biggest pain points and desires
   - What makes their offer unique or different
   - Any objections their audience typically has
   - Success stories or testimonials they could leverage
   - Their brand voice and personality
3. **Listen actively** and acknowledge their inputs before asking follow-up questions.
4. **After gathering 2-3 key insights**, offer to refine the angles with this new information.

CONVERSATION FLOW:
- Start by understanding their initial reaction to the angles
- Ask ONE question at a time — don't overwhelm
- After 2-3 exchanges, summarize what you've learned and ask if they'd like to regenerate angles with these insights
- If they're happy with the angles, celebrate and guide them to select their favorites

TONE: Warm, curious, collaborative — like a creative director who genuinely wants to understand their brand.

IMPORTANT: Keep responses SHORT (2-4 sentences). Ask one question at a time. Don't give long explanations unless asked.`;


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

    // Choose system prompt based on context
    const isAngleFeedback = context?.context === 'angle-feedback';
    let contextPrompt = isAngleFeedback ? ANGLE_FEEDBACK_SYSTEM_PROMPT : LUMI_SYSTEM_PROMPT;
    
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
      
      // Include generated angles in context for angle-feedback mode
      if (isAngleFeedback && context.generatedAngles && context.generatedAngles.length > 0) {
        contextPrompt += '\n--- Generated Creative Angles ---\n';
        context.generatedAngles.forEach((angle: any, idx: number) => {
          contextPrompt += `\n${idx + 1}. "${angle.name}"\n`;
          contextPrompt += `   Description: ${angle.description}\n`;
          if (angle.psychologyTrigger) {
            contextPrompt += `   Psychology: ${angle.psychologyTrigger}\n`;
          }
        });
        contextPrompt += '\nReference these angles when discussing with the user. Help them understand why each angle was chosen and how they can be improved.\n';
      }
      
      contextPrompt += '\nUse this context to provide more relevant and personalized advice.\n';
    }

    console.log('Lumi chat request:', { 
      messagesCount: messages?.length,
      context: context?.context,
      hasAngles: !!context?.generatedAngles?.length
    });

    // Use tool calling to get structured response with follow-ups
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
        tools: [
          {
            type: 'function',
            function: {
              name: 'respond_with_followups',
              description: 'Respond to the user and suggest 2-3 follow-up questions they might want to ask next.',
              parameters: {
                type: 'object',
                properties: {
                  response: {
                    type: 'string',
                    description: 'Your response to the user. Keep it short and actionable (2-4 sentences max).'
                  },
                  followups: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: {
                          type: 'string',
                          description: 'Short button label (2-4 words)'
                        },
                        message: {
                          type: 'string',
                          description: 'The full question or request to send'
                        }
                      },
                      required: ['label', 'message'],
                      additionalProperties: false
                    },
                    description: 'Suggest 2-3 natural follow-up questions based on the conversation. Make them specific to what was just discussed.'
                  }
                },
                required: ['response', 'followups'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'respond_with_followups' } },
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
    
    // Parse the tool call response
    let aiResponse = "I'm sorry, I couldn't process that. Please try again.";
    let followups: { label: string; message: string }[] = [];
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        aiResponse = parsed.response || aiResponse;
        followups = parsed.followups || [];
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
        // Fallback to plain content if available
        aiResponse = data.choices?.[0]?.message?.content || aiResponse;
      }
    } else if (data.choices?.[0]?.message?.content) {
      // Fallback if no tool call
      aiResponse = data.choices[0].message.content;
    }

    console.log('Lumi response generated successfully');

    return new Response(
      JSON.stringify({ response: aiResponse, followups }),
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