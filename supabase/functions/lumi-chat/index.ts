import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const LUMI_NAVIGATOR_PROMPT = `You are Lumi, a friendly app navigation assistant for Your Ad Assistant - an app that helps people create Meta ads.

YOUR ROLE: Help users navigate the app and accomplish their goals. You are NOT a creative generator - you guide users to the right place in the app.

APP STRUCTURE:
• Home (/start) - Overview, quick actions, see what to do next
• My Brand (/dashboard) - Brand info, offers, audience psychology, Meta connection
 • Meta Connection (/meta-settings) - Connect and manage your Meta (Facebook/Instagram) ad account
• My Ads (/campaigns) - View/manage ad campaigns and workspaces
• New Ad (/create) - 3-step wizard to create a new campaign
• Creative Studio (/creative-studio) - Generate angles, concepts, and ad copy
• Results (/data) - Performance metrics and optimization insights
• Concept Library (/content-library) - Saved creative concepts
• Settings (/settings) - Account and preferences
• Glossary (/glossary) - Ads terminology definitions

RESPONSE RULES:
1. Keep responses SHORT (2-3 sentences max)
2. ALWAYS provide at least one action button for navigation
3. Give simple directions on what to do when they arrive
4. If user describes a bug/problem, direct them to the bug report button

DETECTING BUGS:
If user mentions: not loading, broken, error, doesn't work, can't click, stuck, frozen, blank, glitch
→ Acknowledge frustration briefly
→ Say you can't fix bugs but the team can
→ Provide a "Report Bug" action button (type: bug_report)

ESCALATION RULE:
If the conversation has 3+ back-and-forth messages on the same topic and the user still seems confused or unsatisfied, OR if the user says something like "this isn't helping", "I still don't get it", "can I talk to someone":
→ Include a "contact_support" action button with label "Talk to a Person"
→ Say something like "Would you like to speak with a real person? I can connect you with our support team."

COMMON USER INTENTS (map to actions):
• "create an ad" / "new campaign" / "start advertising" → /create
 • "connect Meta" / "link Facebook" / "ad account" → /meta-settings
• "add my offer" / "add product" / "my service" → /dashboard (offers section)
• "see results" / "performance" / "metrics" / "how am I doing" → /data
• "edit my brand" / "update brand" → /dashboard
• "my campaigns" / "existing ads" / "manage ads" → /campaigns
• "creative ideas" / "angles" / "hooks" / "copy" → /creative-studio
• "settings" / "account" / "billing" → /settings
• "what is [term]" / "define [term]" → /glossary
• "what should I do" / "next step" / "help" → Analyze their context and suggest

TONE: Warm, helpful, concise. Like a friendly concierge. Use emojis sparingly (1-2 max).`;

const ANGLE_FEEDBACK_PROMPT = `You are Lumi, helping the user refine their creative angles. Keep responses SHORT (2-3 sentences). Ask one question at a time about their offer, audience, or goals to improve the angles. When they're satisfied, guide them to continue in the Creative Studio.`;


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
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    let contextPrompt = isAngleFeedback ? ANGLE_FEEDBACK_PROMPT : LUMI_NAVIGATOR_PROMPT;
    contextPrompt += `\n\nToday's date is ${currentDate}. Ensure any content suggestions are seasonally appropriate.`;
    
    if (context) {
      contextPrompt += '\n\n--- Current Context ---\n';
      
      if (context.context) {
        contextPrompt += `User is currently on: ${context.context} page\n`;
        if (context.currentPath) {
          contextPrompt += `Current route: ${context.currentPath}\n`;
        }
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

    // Use tool calling to get structured response with navigation actions
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
              name: 'navigate_and_guide',
              description: 'Help the user navigate the app by providing a brief response and action buttons.',
              parameters: {
                type: 'object',
                properties: {
                  response: {
                    type: 'string',
                    description: 'Brief explanation of what to do (1-3 sentences max). Be helpful and concise.'
                  },
                  actions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['navigate', 'bug_report', 'contact_support'],
                          description: 'navigate = go to a page, bug_report = open bug report form, contact_support = open help ticket form'
                        },
                        label: {
                          type: 'string',
                          description: 'Button label (2-4 words, action-oriented)'
                        },
                        route: {
                          type: 'string',
                          description: 'App route to navigate to (e.g., /create, /dashboard). Required for navigate type.'
                        }
                      },
                      required: ['type', 'label'],
                      additionalProperties: false
                    },
                    description: 'Action buttons for the user. Always include at least one. Max 3.'
                  },
                  followups: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: {
                          type: 'string',
                          description: 'Short question label (2-4 words)'
                        },
                        message: {
                          type: 'string',
                          description: 'The follow-up question to ask'
                        }
                      },
                      required: ['label', 'message'],
                      additionalProperties: false
                    },
                    description: 'Optional follow-up questions (max 2)'
                  }
                },
                required: ['response', 'actions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'navigate_and_guide' } },
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
    let actions: { type: string; label: string; route?: string }[] = [];
    let followups: { label: string; message: string }[] = [];
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        aiResponse = parsed.response || aiResponse;
        actions = parsed.actions || [];
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
      JSON.stringify({ response: aiResponse, actions, followups }),
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