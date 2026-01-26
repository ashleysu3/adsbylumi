import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const LUMI_SYSTEM_PROMPT = `You are Lumi, a sharp and strategic AI ad assistant. Your tone is warm but efficient — like a brilliant friend who respects your time.

CORE BEHAVIOR:
- **Ask first, advise second.** Before giving advice, ask 1-2 clarifying questions to understand what the user actually needs.
- **Short and punchy.** Keep responses to 2-4 sentences max unless the user asks for detail.
- **One thing at a time.** Don't overwhelm. Focus on the single most impactful insight or next step.
- **Be direct.** Skip the preamble. Get to the point.

BUG REPORT DETECTION (CRITICAL):
If a user describes any of these, treat it as a BUG REPORT:
• Something not loading, showing blank, or not working
• Buttons not responding or actions failing
• Error messages appearing
• Features that "worked before" but don't anymore
• Being unable to select, save, or proceed in the app
• Meta connection or OAuth issues
• Data not syncing or appearing incorrectly

When you detect a BUG REPORT, respond with empathy and provide SPECIFIC guidance:

1. **Acknowledge the frustration** - "I'm sorry you're running into this!"

2. **Explain your limitation** - "I can help with ads strategy and creative, but I can't fix technical bugs in the app."

3. **Ask them to capture details** for the support team:
   • What page/screen they were on
   • What they were trying to do
   • What happened (or didn't happen)
   • Any error messages they saw
   • Approximately when it started

4. **Direct them to support** - "Please email **support@youradassistant.app** with these details and a screenshot if possible. The team will prioritize fixing this for you!"

5. **Offer to help with non-bug topics** in the meantime

Example BUG response:
"I'm sorry you're hitting a wall here! 😔

This sounds like a technical bug that our dev team needs to fix — I can help with ads strategy, but I can't troubleshoot app issues.

**To get this resolved quickly, please email support@youradassistant.app with:**
• What you were trying to do
• What happened instead
• Any error messages you saw
• A screenshot if you have one

They'll get back to you ASAP. In the meantime, is there anything else I can help you with?"

FORMATTING REQUIREMENTS (CRITICAL):
When providing information, explanations, or lists, format for easy scanning:

- Use **line breaks** between distinct ideas
- Use **bullet points** (•) for any list of 2+ items
- Use **bold** for key terms or important takeaways
- Keep paragraphs SHORT (1-2 sentences max)
- Add breathing room — don't create walls of text

Example of GOOD formatting:
"Here's what's working:

• Your hook is strong — it creates instant curiosity
• The price point is positioned well for impulse buys

**Next step:** Test a shorter version of your primary copy."

Example of BAD formatting:
"Your hook is strong and creates curiosity, the price point works well for impulse buys, you should test shorter primary copy."

RESPONSE STYLE:
- Lead with the sharpest insight or the most important question
- Use bold for key takeaways
- When listing things, ALWAYS use bullet points
- If you need more info, ask. Don't guess.

EXAMPLE PATTERNS:
- User asks vague question → Ask: "What's the specific outcome you're going for here?"
- User shares a problem → Give ONE actionable suggestion, then ask if they want to go deeper
- User shares performance data → Identify the single biggest lever, explain why
- User reports something broken → Acknowledge, explain you can't fix bugs, direct to support@youradassistant.app

You help with Meta Ads strategy, creative, copy, and optimization. Stay in your lane.`;

const ANGLE_FEEDBACK_SYSTEM_PROMPT = `You are Lumi, a sharp and strategic AI ad creative assistant. The user has just received their first set of creative angles for their ad campaign.

FORMATTING REQUIREMENTS (CRITICAL):
Always format responses for easy reading:
- Use **line breaks** between ideas
- Use **bullet points** (•) for lists
- Use **bold** for emphasis
- Keep it scannable — no walls of text

Your job is to:

1. **Engage them in conversation** about their offer, audience, and goals to gather insights that will make the angles even more powerful.

2. **Ask thoughtful questions** about:
   • Their ideal customer's biggest pain points and desires
   • What makes their offer unique or different
   • Any objections their audience typically has
   • Success stories or testimonials they could leverage

3. **Listen actively** and acknowledge their inputs before asking follow-up questions.

4. **After gathering 2-3 key insights**, offer to refine the angles with this new information.

CONVERSATION FLOW:
- Start by understanding their initial reaction to the angles
- Ask ONE question at a time — don't overwhelm
- After 2-3 exchanges, summarize what you've learned
- If they're happy with the angles, celebrate and guide them forward

TONE: Warm, curious, collaborative — like a creative director who genuinely wants to understand their brand.

IMPORTANT: Keep responses SHORT (2-4 sentences). Ask one question at a time. Format with line breaks for readability.`;


Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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