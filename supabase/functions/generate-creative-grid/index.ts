import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      angles, 
       brandName, 
       strategyData, 
       audiencePsychology, 
       offerData,
       brandVoice,
       messagingGuidelines,
       productPsychology,
        nicheContext,
        brandId,
        offerId,
        offerAudiencePsychology,
        creativeIntelligence,
        perspectiveRole
     } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch ALL relevant knowledge base categories
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("title, content")
      .eq("active", true)
      .in("category", [
        "creative_angles", 
        "hooks", 
        "visual_hooks", 
        "copy_frameworks", 
        "scripts",
        "psychology",
      ])
      .order("priority", { ascending: false })
      .limit(8);

    // Cap KB context to prevent prompt bloat
    const kbContext = (kbDocs || []).map(doc => {
      const truncated = doc.content.length > 1200 ? doc.content.slice(0, 1200) + "..." : doc.content;
      return `## ${doc.title}\n${truncated}`;
    }).join("\n\n");

     // Fetch content assets for this brand
     let contentAssetsContext = "";
     if (brandId) {
       const { data: contentAssets } = await supabase
         .from("brand_content_assets")
         .select("*")
         .eq("brand_id", brandId);
       
       const hasTestimonials = contentAssets?.some(
         (a: any) => a.asset_type === 'testimonials' && a.content?.trim()
       );

       if (contentAssets?.length) {
         contentAssetsContext = "\n\n=== USER-PROVIDED CONTENT ASSETS ===\n";
         contentAssetsContext += "REAL content from the user. Use these testimonials, scripts, and pain points to make hooks and scripts authentic:\n\n";
         
         contentAssets.forEach((asset: any) => {
           // Filter by offer if specified
           if (offerId && asset.offer_ids?.length > 0 && !asset.offer_ids.includes(offerId)) {
             return;
           }
           
           const typeLabels: Record<string, string> = {
             testimonials: 'CLIENT TESTIMONIALS (use these exact quotes/phrases)',
             webinar_scripts: 'WEBINAR/CHALLENGE SCRIPTS (borrow delivery style)',
             survey_answers: 'SURVEY RESPONSES (real pain points in client words)',
             client_objections: 'CLIENT OBJECTIONS (address these directly)',
             client_questions: 'CLIENT QUESTIONS (answer these in hooks)',
             other: 'OTHER CONTENT'
           };
           
           contentAssetsContext += `## ${typeLabels[asset.asset_type] || asset.asset_type.toUpperCase()}\n${asset.content}\n\n`;
         });
         
         contentAssetsContext += "CRITICAL: Pull specific phrases, numbers, and pain points from the above content. These are REAL words from REAL clients - use them to make hooks irresistible.\n";
         
         if (hasTestimonials) {
           contentAssetsContext += `
=== TESTIMONIAL SCREENSHOT ADS (HIGH-CONVERTING FORMAT) ===
The user has uploaded real client testimonials. For EACH angle, include at least ONE 
"graphic" format cell in the "trust" row that uses a TESTIMONIAL SCREENSHOT concept:

- Use the EXACT client quote from the testimonials above — do NOT rewrite or paraphrase
- Present it as a screenshot of a text message, DM, or comment
- Overlay on a solid brand color background, subtle linen/paper texture, or lifestyle photo
- Add a small label: "Real DM from a client" or "Actual text from [first name]"
- The hook for this cell should be the most impactful line from the testimonial
- guidance should describe the screenshot aesthetic: rounded message bubbles, 
  phone-screen crop, or clean quote card layout
- This format converts extremely well because it looks organic and trustworthy

Also for the "action" row, consider a concept where multiple short testimonial 
snippets are shown in quick succession (carousel or montage style).
`;
         }
       }
     }
 
    // Extract specific pain points and desires for targeted prompting
    // Ensure all are arrays - data might be stored in various formats
    const ensureArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      if (val && typeof val === 'object') return Object.values(val).filter(v => typeof v === 'string') as string[];
      return [];
    };
    
    const painPoints = ensureArray(audiencePsychology?.painPoints || audiencePsychology?.pain_points);
    const desires = ensureArray(audiencePsychology?.desires);
    const objections = ensureArray(audiencePsychology?.objections);
    const buyingTriggers = ensureArray(productPsychology?.buying_triggers || productPsychology?.buyingTriggers);
    
    // Also extract offer-audience psychology insights
    const offerHesitations = ensureArray(offerAudiencePsychology?.specific_hesitations);

    const systemPrompt = `You are an elite Meta Ads creative strategist who creates scroll-stopping, psychology-driven ad concepts. Your creative MUST be specific, emotionally resonant, and impossible to ignore.

=== CRITICAL PERSPECTIVE RULE ===
${perspectiveRole === 'buyer' 
  ? 'The person recording/posting these ads personally experienced the transformation. Frame hooks and scripts in first person: "I went from..." or "When I discovered..." — this is their own story and journey.'
  : perspectiveRole === 'both'
  ? 'The person recording/posting these ads is a BUSINESS OWNER who ALSO personally experienced the transformation. Mix BOTH framings: personal story ("I went from...") AND client results ("My clients also..."). Use their founder story as credibility, then reference client transformations as proof of scale.'
  : 'The person recording/posting these ads is the BUSINESS OWNER — a coach, course creator, or service provider. They are NOT the person who experienced the transformation. Their CUSTOMERS/CLIENTS are the ones who got results. Frame scripts accordingly: "My client went from..." or "One of my students..." — NOT "I went from..." unless it\'s clearly the founder\'s own origin story. When referencing testimonials, attribute them to clients. The user sells the solution; their customers experienced the results.'
}
${creativeIntelligence?.hasData ? `
=== DATA-INFORMED STRATEGY ===
Based on the user's ad account performance over the last 90 days:
${creativeIntelligence.summary}
${creativeIntelligence.topFormats?.length ? `Top performing formats: ${creativeIntelligence.topFormats.join(', ')}` : ''}
${creativeIntelligence.keyPatterns?.length ? `Patterns: ${creativeIntelligence.keyPatterns.join('; ')}` : ''}
${creativeIntelligence.recommendations?.length ? `Recommendations: ${creativeIntelligence.recommendations.join('; ')}` : ''}

IMPORTANT: Weight format distribution toward proven formats. Generate MORE concepts in the top-performing format while still including other formats for testing.
` : `
=== FIRST CAMPAIGN TEST MODE ===
No historical performance data available. Generate a balanced mix across all formats (talking head, b-roll, graphic) to test what works best for this audience.
`}

KNOWLEDGE BASE:
${kbContext}
 ${contentAssetsContext}

=== CRITICAL RULES: SPECIFICITY IS EVERYTHING ===

❌ BANNED PHRASES (NEVER USE):
- "Take your X to the next level"
- "Ready to transform your Y?"
- "Struggling with X?"
- "Want to achieve X?"
- "Tired of X?"
- "What if you could X?"
- "Imagine if X"
- "The secret to X"
- "Finally, a solution for X"
- "Stop doing X the hard way"
- "Unlock your potential"
- Any hook that could apply to ANY business

✅ WHAT MAKES A HOOK SCROLL-STOPPING:
- Names a SPECIFIC moment the audience has experienced
- Uses unexpected specificity (numbers, details, micro-moments)
- Creates pattern interruption
- Feels like reading their diary or text messages
- Is emotionally charged without being salesy

=== EXAMPLE OUTPUT COMPARISON ===

**GENERIC (DO NOT DO THIS):**
Hook: "Struggling with your business? Watch this."
Guidance: "Speak confidently to camera about the problem."

**EXCELLENT (DO THIS):**
Hook: "I used to rehearse my pitch 47 times before a webinar... then bomb anyway."
Guidance: "Film on phone, looking slightly tired. Quick cuts between 3 frustrated moments. Text overlay: 'You too?' at 2-second mark."

**GENERIC (DO NOT DO THIS):**
Hook: "Want more clients? Here's how."
Guidance: "Show testimonials and results."

**EXCELLENT (DO THIS):**
Hook: "My 3rd discovery call this week. Same objection. 'I need to think about it.' Again."
Guidance: "POV shot of you hanging up phone, slump in chair. B-roll of empty calendar. Text: 'Sound familiar?'"

**GENERIC (DO NOT DO THIS):**
Hook: "The key to success is consistency."
Guidance: "Create motivational graphic."

**EXCELLENT (DO THIS):**  
Hook: "Day 47. Still 0 sales. Everyone's asking when I'm going back to my 9-5."
Guidance: "Handwritten note aesthetic, slightly crumpled paper texture. Raw vulnerability. Text appears like it's being typed."

=== GRID STRUCTURE ===
For each angle, create 9 creative cells organized as:

ROWS (Audience Moment):
- Row 1: "attention" - Gets attention, stops the scroll with pattern interruption
- Row 2: "trust" - Builds trust through relatability and proof
- Row 3: "action" - Drives toward action with urgency or clarity

COLUMNS (Format Diversity):
- Column 1: "talking_head" - Person speaking to camera (vulnerable, real, unpolished)
- Column 2: "broll" - Text-overlay ad on top of B-roll footage. The footage comes from the user's B-Roll Library in the Creative Toolkit — DO NOT write a shot list. Your only deliverable here is (a) one tiny vibe pointer so they know which clip to grab and (b) a killer sequence of text overlays. The overlays ARE the ad.
- Column 3: graphic OR carousel — choose whichever fits the concept better.
  - Use format "graphic" for a single thumb-stopping image/static ad (bold, unexpected).
  - Use format "carousel" when the idea is naturally multi-beat (problem → framework → proof → CTA, swipeable lists, before/after sequences, mini-frameworks). Aim for at least ONE carousel per angle across the 3 angles.

=== TALKING HEAD FORMAT - DESIGNED FOR NON-ACTORS ===
Your users are coaches, course creators, and service providers - NOT actors or professional content creators.
They want to record a simple video on their phone and get back to work. No elaborate productions.

SCRIPT PHILOSOPHY:
- Write like they're texting a friend, not performing on stage
- Each line = one breath, one thought (easy to read on teleprompter)
- Include natural speech patterns ("Look...", "Here's the thing...", "So...", "Honestly?")
- Suggest delivery cues sparingly: "(pause)" or "(lean in)" only when essential
- Structure: Hook → "Here's the thing" transition → Problem → Pivot → Soft CTA

LOW-PRODUCTION VISUAL HOOK OPTIONS (always provide 2-3 alternatives):
Based on the user's niche, suggest EVERYDAY activities they might actually do:
- Coaches/consultants: "at your desk", "walking to car", "morning coffee", "post-meeting in hallway"
- Health/fitness: "post-workout", "in kitchen", "getting ready", "at the gym"
- Creatives: "at workspace", "with your tools", "mid-project", "studio background"
- Service providers: "between client calls", "checking emails", "end of day", "walking outside"
- General (always appropriate): "sitting in parked car", "petting your dog", "walking down stairs", "making coffee"

MID-SENTENCE START TECHNIQUE (use for at least 1 of 3 talking head cells per angle):
This is extremely effective because it creates instant curiosity - viewers feel like they walked into a private conversation.
Examples:
- "—anyway, that's when I knew I had to change something."
- "—and she looked at me like I was crazy, but..."
- "—so I tried it, and honestly? I didn't expect this."
- "—but here's what nobody tells you about that."
- "—and that's exactly why I stopped doing it."

HOOK TECHNIQUE TYPES (label each talking_head with one):
- "mid_sentence" - Starting mid-thought (most powerful, feels like eavesdropping)
- "confession" - Vulnerable admission ("I used to...", "I'll be honest...")
- "controversial" - Bold/contrarian take ("Funnels are dead.", "Don't hire a VA.")
- "specific_number" - Using exact numbers for credibility ("47 calls", "$12,000")
- "pattern_interrupt" - Unexpected statement that stops the scroll

For ALL talking_head format cells, include these REQUIRED fields:

1. **verbal_hook**: The opening spoken line (pattern interrupt, controversial take, or vulnerable confession)
2. **written_hook**: The text overlay that appears on screen at the start (complements but differs from verbal - creates curiosity gap)
3. **visual_hook**: What the viewer SEES in the first 1-3 seconds (setting, expression, action, prop, or unexpected visual) - make it EVERYDAY and SIMPLE
4. **visual_hook_options**: Array of 2-3 ALTERNATIVE simple visual hooks so user can pick what works for their space
5. **hook_technique**: One of "mid_sentence", "confession", "controversial", "specific_number", "pattern_interrupt"
6. **delivery_style**: Brief note on how to deliver ("conversational, like telling a friend" NOT "act excited")
7. **script_lines**: Array of 4-8 short spoken lines (3-5 seconds each). Structure: Hook → Problem → Agitation → Solution tease → CTA
8. **text_overlays**: Array of 3-5 text overlays with timing. Each should ADD context, not just repeat what's spoken.
9. **caption_reminder**: Always true (85% watch without sound)

=== HOOK TYPES THAT WORK ===
VERBAL HOOKS (what they say):
- Confession: "I lost $12,000 on my first launch..."
- Controversial: "Funnels are dead. Here's what's replacing them."
- Pattern interrupt: "Don't hire a VA. Seriously."
- Specific number: "I made 47 cold calls. 3 answered. 1 changed everything."
- Mid-sentence: "—anyway, that's when I realized..."

WRITTEN HOOKS (text on screen):
- Curiosity gap: "What I wish I knew before..." 
- Bold claim: "This simple shift = 3x conversions"
- Social proof: "How I went from $0 → $50k/mo"
- Direct challenge: "Still doing THIS in 2024?"

VISUAL HOOKS (what they see) - KEEP THESE SIMPLE:
- Everyday moments: "sitting at desk with messy coffee cup", "in car after a meeting", "petting dog on couch"
- Subtle emotion: "slightly tired face", "knowing smile", "contemplative look"
- Low-effort actions: "walking while talking", "looking at phone then up", "closing laptop"
- NO elaborate staging: Don't suggest burning paper, empty wallets, or anything that requires props they don't have

Example talking_head output:

{
  "format": "talking_head",
  "hook": "—anyway, that's when I knew something had to change.",
  "verbal_hook": "—anyway, that's when I knew something had to change.",
  "written_hook": "The moment everything shifted",
  "visual_hook": "Sitting in car after a meeting, slightly tired expression",
  "visual_hook_options": [
    "Sitting in parked car, slightly tired expression",
    "Walking into your home office, coffee in hand",
    "At desk with natural lighting, end of day vibe"
  ],
  "hook_technique": "mid_sentence",
  "delivery_style": "Conversational, like debriefing with a friend after a long day. No acting required - just be real.",
  "script_lines": [
    "—anyway, that's when I knew something had to change.",
    "I'd been doing the same thing for months...",
    "Working harder, not smarter. Sound familiar?",
    "(pause) Here's what I realized...",
    "The problem wasn't my effort. It was my approach.",
    "Once I switched to [method], everything clicked."
  ],
  "text_overlays": [
    { "text": "The moment everything shifted", "timing": "0-3s", "type": "hook" },
    { "text": "Sound familiar? 👀", "timing": "6-9s", "type": "transition" },
    { "text": "The ONE thing I changed →", "timing": "15-18s", "type": "cta" }
  ],
  "caption_reminder": true,
  "guidance": "Record in your car or at your desk. Natural lighting. You're just telling a friend about a realization you had. No performance needed."
}

=== B-ROLL FORMAT — TEXT-OVERLAY ADS (FOOTAGE COMES FROM THE TOOLKIT) ===
The user already has a B-Roll Library in the Creative Toolkit full of lofi, action-based clips tailored to their brand. They will pick the actual clip there. You are NOT directing the shoot, writing a shot list, or describing scenes in detail.

Your job for broll cells is exactly two things:
1. A one-line **broll_vibe** (≤ 8 words) — the mood / setting only, so they know which clip to grab. Examples: "warm morning desk, natural light" · "walking outside, golden hour" · "kitchen, hands only, cozy".
2. A killer **text_overlays** sequence — this is THE deliverable. The overlays sell the ad. The footage is just warmth behind them.

Do NOT output broll_shots. Do NOT write production / camera direction. Do NOT describe what the creator should film.

=== TEXT OVERLAY EXCELLENCE (applies to broll AND talking_head) ===
Text overlays are the highest-leverage copy in the whole ad. Treat them like billboards: one breath, one idea, brand voice intact.

VOICE
- Mirror the brand voice samples and tone in the brand context. Sharp, human, like one friend texting another — never marketer-speak.
- Use the brand's signature phrases, recurring metaphors, or signature CTA when they appear in context.

LENGTH
- Hook overlay: ≤ 27 characters (hard cap — it doubles as a headline).
- Other overlays: ≤ 14 words each. Punchy, one breath.

SEQUENCE (4–6 overlays, in this order, with timing)
1. **hook** (0–3s) — pattern-interrupt or a specific micro-moment. Names a real scenario.
2. **pain** (3–7s) — one concrete pain pulled straight from audience psychology.
3. **insight** (7–12s) — the reframe / pivot. "It's not X. It's Y."
4. **proof** (12–18s) — a number, a name, a real result tied to the offer.
5. **cta** (last 3s) — matches the actual offer ("Save my seat", "Get the guide", "Book a call"). When natural, pair with the brand name or signature line.

A 4-overlay sequence (hook → insight → proof → cta) is acceptable when pain is already implied. Never fewer than 4. Never more than 6.

BANNED PHRASES (instant fail — rewrite)
"learn more", "click here", "unlock", "transform", "next level", "secret", "game-changer", "ready to", "are you tired of", "supercharge", "level up", "overnight", "10x", "era".

SPECIFICITY RULE
Every overlay names a real number, name, moment, feeling, or object. No generic claims. No "imagine if…", "what if…".

OVERLAY OBJECT SHAPE
{ "text": string, "timing": "0-3s", "type": "hook" | "pain" | "insight" | "proof" | "cta" }

REQUIRED OUTPUT FIELDS FOR broll FORMAT CELLS:
- broll_vibe: ONE short string (≤ 8 words) — the mood / setting only.
- text_overlays: 4–6 overlays following the sequence + rules above. THIS is what sells.
- mood: One of "Calm", "Productive", "Relatable", "Warm", "Authentic", "Energetic"

EXAMPLE broll OUTPUT:
{
  "format": "broll",
  "hook": "I used to rehearse my pitch 47 times before a webinar... then bomb anyway.",
  "guidance": "Pull a calm desk clip from your B-Roll Library and layer these overlays on top. The words do the selling.",
  "broll_vibe": "warm desk, hands + notebook, soft light",
  "text_overlays": [
    { "text": "Rehearsed 47 times.", "timing": "0-3s", "type": "hook" },
    { "text": "Still bombed the webinar. Again.", "timing": "3-7s", "type": "pain" },
    { "text": "It wasn't the offer. It was the script.", "timing": "7-12s", "type": "insight" },
    { "text": "Swapped 3 lines → 11 sales next launch.", "timing": "12-18s", "type": "proof" },
    { "text": "Grab the script →", "timing": "18-22s", "type": "cta" }
  ],
  "mood": "Relatable",
  "psychology_trigger": "identification",
  "pain_point_addressed": "performance anxiety on launch",
  "why_this_works": "Pairs a specific shameful moment with a concrete reframe and a tiny, believable result — feels personal, not pitched."
}


=== PSYCHOLOGY INTEGRATION REQUIREMENTS — THIS IS THE MOST IMPORTANT SECTION ===

You have access to rich, specific psychological data about this exact audience and offer.
Your job is to translate this data directly into hooks, scripts, and concepts — not summarize it.

DIRECT TRANSLATION RULES:

1. THE MOMENT THEY REALIZE → Use as a talking head mid-sentence hook
   If moment_they_realize is: "When they've spent hours on a campaign and gotten 3 clicks"
   Hook becomes: "—I remember staring at $200 spent and 3 clicks. That was the last time I did it alone."
   
2. ALTERNATIVE THEY TRIED → Use as the conflict in the hook
   If alternative_they_tried is: "YouTube tutorials and ChatGPT"
   Hook becomes: "I spent 14 hours on YouTube learning Meta ads. ChatGPT wrote my copy. I spent $400. Zero leads."
   
3. EMOTIONAL BEFORE STATE → Open scripts here, without mentioning the solution
   If before state is: "Feels like a fraud promoting herself when the ads don't work"
   Script opens: "You know that feeling when you've worked so hard on your offer and you genuinely believe in it — but the ads just stare back at you with zero results? And then the thought creeps in: maybe it's me."
   
4. EMOTIONAL AFTER STATE → Use only in the final 5 seconds of convert-stage scripts
   Never reveal in grow-stage content — save it as the earned reward
   
5. WHAT FINALLY CONVINCES → Use as the logic bridge in nurture content
   This is what makes them say yes — build the middle of trust-stage scripts around this
   
6. SPECIFIC HESITATIONS → Each major hesitation gets its own cell
   Don't bury objections. Address them head-on as the hook:
   If hesitation is: "I've tried ads before and wasted money"
   Hook: "Every person who tells me ads don't work — I ask them the same thing."
   
7. BUYING TRIGGERS → Use as the action-stage CTA logic
   If buying trigger is: "Seeing someone exactly like them get results"
   Action cell should: Lead with a proof story from someone in their exact situation

BANNED APPROACH:
Do NOT dump psychology data into the script as a list of features.
Do NOT write "Our audience struggles with X so we should address X."
DO write scripts where the audience thinks "how did they know that's exactly what happened to me."

${painPoints.length > 0 ? `
AUDIENCE PAIN POINTS TO REFERENCE (use these SPECIFIC phrases):
${painPoints.map((p: string, i: number) => `${i + 1}. "${p}"`).join('\n')}
` : ''}

${desires.length > 0 ? `
AUDIENCE DESIRES TO PROMISE (these are what they WANT):
${desires.map((d: string, i: number) => `${i + 1}. "${d}"`).join('\n')}
` : ''}

${objections.length > 0 ? `
OBJECTIONS TO PREEMPTIVELY ADDRESS:
${objections.map((o: string, i: number) => `${i + 1}. "${o}"`).join('\n')}
` : ''}

${buyingTriggers.length > 0 ? `
BUYING TRIGGERS TO ACTIVATE:
${buyingTriggers.map((t: string, i: number) => `${i + 1}. "${t}"`).join('\n')}
` : ''}

${offerAudiencePsychology ? `
=== OFFER-SPECIFIC AUDIENCE INSIGHTS — TRANSLATE THESE DIRECTLY INTO CREATIVE ===

${offerAudiencePsychology.moment_they_realize ? `
THE EXACT MOMENT THEY REALIZE THEY NEED THIS:
"${offerAudiencePsychology.moment_they_realize}"
→ THIS MUST BECOME A HOOK. Write it as a first-person confession or mid-sentence start.
→ At least 1 talking_head cell per angle must open in this exact moment.
` : ''}

${offerAudiencePsychology.alternative_they_tried ? `
WHAT THEY TRIED BEFORE THAT DIDN'T WORK:
"${offerAudiencePsychology.alternative_they_tried}"
→ THIS IS YOUR CONFLICT. Use it to create contrast — "I tried X. Here's what actually happened."
→ At least 1 cell per angle must reference this failed alternative directly.
` : ''}

${offerAudiencePsychology.emotional_before_after ? `
EMOTIONAL JOURNEY:
BEFORE: "${offerAudiencePsychology.emotional_before_after.before}"
AFTER: "${offerAudiencePsychology.emotional_before_after.after}"
→ BEFORE state: Open grow-stage scripts here. No solution mentioned. Pure empathy.
→ AFTER state: Reserve for convert-stage scripts only. This is the reward.
` : ''}

${offerAudiencePsychology.what_finally_convinces ? `
WHAT FINALLY MAKES THEM SAY YES:
"${offerAudiencePsychology.what_finally_convinces}"
→ Build trust-stage scripts TOWARD this. They should feel like they've arrived at this realization themselves.
` : ''}

${offerAudiencePsychology.specific_hesitations?.length ? `
HESITATIONS THAT WILL KILL THE SALE IF NOT ADDRESSED:
${offerAudiencePsychology.specific_hesitations.map((h: string, i: number) => `${i + 1}. "${h}"`).join('\n')}
→ Each hesitation = 1 dedicated cell. Address it as the HOOK, not buried in the body.
→ Don't defend. Validate first, then reframe.
` : ''}

${offerAudiencePsychology.why_they_need_this ? `
WHY THEY NEED THIS SPECIFIC OFFER (not just any solution):
"${offerAudiencePsychology.why_they_need_this}"
→ This is your differentiation. Weave into action-stage content.
` : ''}
` : ''}

=== OUTPUT REQUIREMENTS ===
Each cell MUST include:
- id: unique string (e.g., "angle_attention_talking_head")
- angleId: the angle's id this belongs to
- row: "attention" | "trust" | "action"
- format: "talking_head" | "broll" | "graphic" | "carousel"
- hook: One compelling, SPECIFIC sentence that names a micro-moment or specific scenario
- guidance: Detailed production notes (camera angles, text overlays, timing, mood)
- psychology_trigger: Which psychological lever this pulls (curiosity, fear, desire, social proof, etc.)
- pain_point_addressed: Which specific pain point from the list above this targets (or "general" if broad)
- why_this_works: One sentence explaining the psychology (for the user's education)

ADDITIONAL FIELDS FOR broll FORMAT ONLY:
- broll_vibe: ONE short string (≤ 8 words) — mood / setting only. The user picks the actual clip from their B-Roll Library. Do NOT output broll_shots.
- text_overlays: 4–6 overlays following the TEXT OVERLAY EXCELLENCE sequence + rules above. Types: "hook" | "pain" | "insight" | "proof" | "cta". THIS is what sells.
- mood: One of "Calm", "Productive", "Relatable", "Warm", "Authentic", "Energetic"

ADDITIONAL FIELDS FOR talking_head FORMAT ONLY:
- verbal_hook: The opening spoken line (pattern interrupt, confession, or controversial take)
- written_hook: The text overlay that appears first (creates curiosity gap, differs from verbal)
- visual_hook: What viewers SEE in first 1-3 seconds - MUST be simple/everyday (no elaborate staging)
- visual_hook_options: Array of 2-3 alternative simple visual hook ideas
- hook_technique: One of "mid_sentence", "confession", "controversial", "specific_number", "pattern_interrupt"
- delivery_style: Brief note on how to deliver (emphasize authenticity, not acting)
- script_lines: Array of 4-8 short script lines (one sentence/phrase each, 3-5 seconds to speak)
- text_overlays: Array of objects with "text", "timing", and "type" (hook/transition/insight/cta) properties
- caption_reminder: boolean (always true for talking_head)

ADDITIONAL FIELDS FOR graphic AND carousel FORMATS (REQUIRED — this is the structured handoff to the render engine):
- brief: an object with EXACTLY these fields:
  - format: "single_graphic" (when cell format = "graphic") or "carousel" (when cell format = "carousel")
  - placements: array, e.g. ["feed"] or ["feed","story"]
  - angle: one of "mistake" | "curiosity" | "outcome" | "contrarian" | "question" | "story" (map from the angle theme)
  - concept: ONE sentence describing the specific idea for this ad
  - keyMessage: the single core thing the viewer must take away
  - offer: what they're being driven to (e.g. "free live class", "lead magnet PDF", "discovery call")
  - cta: the action (e.g. "Save your seat", "Watch free training", "Book a call")
  - audience: who this is for, in a phrase
  - proofPoint: optional result/testimonial/stat string, or null
  - styleHint: one of "photo-forward" | "type-led" | "highlighter" | "testimonial" | "card" | "framed" | "stats" | "checklist"
  - photoTreatment: one of "cutout" | "with-background" | "none"
  - slideCount: 1 for single_graphic; 3 to 6 for carousel
  - slidePlan: for carousel ONLY, an array of slideCount objects each with a "role" — choose from "hook" | "problem" | "framework" | "proof" | "cta" — in narrative order. Omit for single_graphic.
  - imageSource: one of "user-photo" | "none".
    • Choose "user-photo" when a real photo of the creator (from their uploads or scraped brand assets) fits the concept.
    • Choose "none" for a pure typographic graphic where words are the design.
    IMPORTANT: There is NO AI image generation. If the concept does not have a real photo behind it, set imageSource to "none" and styleHint to "type-led" with photoTreatment "none" — let the template carry the idea through type.
  - Use styleHint "stats" for results/proof concepts built around 2–4 numeric metrics, and "checklist" for "what's included" / "how it works" concepts built around 3–6 short list items. For BOTH, set imageSource to "none" and photoTreatment to "none" — the template is pure type + data.


== AD COPY FORMATTING CONVENTIONS (STRICT) ===
- ALWAYS use digits for numbers: "7 days" not "seven days", "$997" not "$nine hundred ninety-seven", "3 clients" not "three clients"
- Keep sentences punchy and scannable — no filler words
- Double-check spelling of every word before output
- Short paragraphs only — one thought per line

Return a JSON object with a "grid" array containing all cells.`;

    // Filter out any legacy "direct_from_page" angles
    const aiAngles = angles.filter((a: any) => a.id !== "direct_from_page");

    const anglesDescription = aiAngles.map((a: any) => `- ID: "${a.id}" | Name: ${a.name}: ${a.description}`).join("\n");

    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const allAnglesDescription = anglesDescription;

    // Helper to truncate JSON payloads to prevent prompt bloat
    const truncateJson = (obj: unknown, maxLen = 800): string => {
      if (!obj) return "";
      const str = JSON.stringify(obj, null, 1);
      return str.length > maxLen ? str.slice(0, maxLen) + "... (truncated)" : str;
    };

    const userPrompt = `Today's date is ${currentDate}. Ensure all content is seasonally appropriate and relevant to this time period. Do NOT reference holidays, seasons, or events that are not upcoming or current.

Generate a 3×3 creative grid for each of these angles:

${allAnglesDescription}

IMPORTANT: Use the exact angle ID (not the name) for the angleId field.

=== BRAND CONTEXT ===
Brand: ${brandName}
${brandVoice ? `Brand Voice: ${brandVoice}` : ''}
${nicheContext ? `Industry/Niche: ${nicheContext}` : ''}

=== OFFER CONTEXT ===
Offer: ${offerData?.name || "Not specified"}
${offerData?.description ? `Description: ${offerData.description.slice(0, 500)}` : ""}
${offerData?.price ? `Price: ${offerData.price}` : ""}
${offerData?.url ? `URL: ${offerData.url}` : ""}

${messagingGuidelines ? `=== MESSAGING GUIDELINES ===
${truncateJson(messagingGuidelines)}` : ''}

${productPsychology ? `=== PRODUCT PSYCHOLOGY ===
${truncateJson(productPsychology)}` : ''}

=== STRATEGY CONTEXT ===
${truncateJson(strategyData, 600)}

${audiencePsychology ? `=== FULL AUDIENCE PSYCHOLOGY ===
${truncateJson(audiencePsychology, 1000)}` : ""}

${offerAudiencePsychology ? `=== OFFER-AUDIENCE PSYCHOLOGY ===
${truncateJson(offerAudiencePsychology, 600)}` : ""}

=== YOUR TASK ===
Generate 9 creative cells (3 rows × 3 formats) for EACH angle listed above.

Remember:
1. Each hook must be SPECIFIC - name a micro-moment, use numbers, reference real scenarios
2. Each guidance must include production details (camera, timing, overlays)
3. Draw directly from the pain points and desires listed above
4. NO GENERIC HOOKS - if it could apply to any business, rewrite it
5. Make it feel like you've read their journal
6. Use the offer-audience psychology to make creative that addresses THIS specific offer's hesitations and transformation`;

    // --- BATCHED GENERATION: 1 angle per batch to prevent truncation ---
    const BATCH_SIZE = 1;
    const angleBatches: typeof angles[] = [];
    for (let i = 0; i < angles.length; i += BATCH_SIZE) {
      angleBatches.push(angles.slice(i, i + BATCH_SIZE));
    }

    console.log(`Generating creative grid in ${angleBatches.length} batch(es) for ${angles.length} angles. System prompt length: ${systemPrompt.length}`);

    // Robust JSON extraction with error recovery
    const extractJson = async (text: string): Promise<unknown> => {
      let cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON object found in response");
      }

      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.log("Initial JSON parse failed, attempting repair...");
        
        cleaned = cleaned
          .replace(/,\s*}/g, "}") 
          .replace(/,\s*]/g, "]") 
          .replace(/[\x00-\x1F\x7F]/g, " ") 
          .replace(/\n\s*\n/g, "\n") 
          .replace(/"\s*\n\s*"/g, '", "') 
          .replace(/:\s*,/g, ': "",') 
          .replace(/:\s*}/g, ': ""}')
        // Fix unescaped quotes inside string values (common LLM issue)
        // Walk through and escape quotes that appear mid-value
        cleaned = cleaned.replace(/:\s*"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
          // If inner content has unescaped newlines, replace them
          const fixed = inner.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
          return match.replace(inner, fixed);
        });

        try {
          return JSON.parse(cleaned);
        } catch (e2) {
          console.log("Second parse attempt failed, trying brace balancing...");
          
          let braces = 0, brackets = 0;
          for (const char of cleaned) {
            if (char === '{') braces++;
            if (char === '}') braces--;
            if (char === '[') brackets++;
            if (char === ']') brackets--;
          }
          
          while (brackets > 0) { cleaned += ']'; brackets--; }
          while (braces > 0) { cleaned += '}'; braces--; }
          
          // Also strip trailing commas before closing
          cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
          
          try {
            return JSON.parse(cleaned);
          } catch (e3) {
            // Try to salvage partial grid array from truncated response
            const gridMatch = cleaned.match(/"grid"\s*:\s*\[/);
            if (gridMatch) {
              const gridStart = cleaned.indexOf("[", gridMatch.index!);
              let partial = cleaned.substring(gridStart);
              
              // Find the last complete object by looking for the last "},"
              const lastCompleteObj = partial.lastIndexOf("},");
              if (lastCompleteObj > 0) {
                partial = partial.substring(0, lastCompleteObj + 1) + "]";
              } else {
                // Close any open structures
                let b = 0, s = 0;
                for (const c of partial) { if (c === '[') s++; if (c === ']') s--; if (c === '{') b++; if (c === '}') b--; }
                while (b > 0) { partial += '}'; b--; }
                while (s > 0) { partial += ']'; s--; }
              }
              
              try {
                const arr = JSON.parse(partial);
                if (Array.isArray(arr) && arr.length > 0) {
                  console.log(`Salvaged ${arr.length} cells from truncated response`);
                  return { grid: arr };
                }
              } catch { /* fall through */ }
            }
            
            // AI-based JSON repair as last resort
            console.log("All local repair failed, attempting AI repair...");
            try {
              const repairResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: "You repair malformed JSON. Return ONLY valid JSON with a \"grid\" array. No markdown, no commentary." },
                    { role: "user", content: `Repair this malformed JSON and return only valid JSON:\n\n${cleaned.slice(0, 12000)}` },
                  ],
                }),
              });
              if (repairResp.ok) {
                const repairPayload = await repairResp.json();
                const repairedText = repairPayload?.choices?.[0]?.message?.content ?? "";
                if (repairedText) {
                  const repStart = repairedText.indexOf("{");
                  const repEnd = repairedText.lastIndexOf("}");
                  if (repStart !== -1 && repEnd !== -1) {
                    const repaired = JSON.parse(repairedText.substring(repStart, repEnd + 1));
                    const repairedGrid = repaired.grid || [];
                    if (repairedGrid.length > 0) {
                      console.log(`AI repair salvaged ${repairedGrid.length} cells`);
                      return { grid: repairedGrid };
                    }
                  }
                }
              }
            } catch (repairErr) {
              console.error("AI repair also failed:", repairErr);
            }
            
            console.error("Response length:", cleaned.length, "- could not salvage partial results");
            throw new Error(`Failed to parse AI response: ${(e3 as Error).message}`);
          }
        }
      }
    };

    // Helper: call AI for a batch of angles
    const generateBatch = async (batchAngles: typeof angles, batchIndex: number): Promise<any[]> => {
      const batchAnglesDesc = batchAngles.map((a: any) => `- ID: "${a.id}" | Name: ${a.name}: ${a.description}`).join("\n");
      
      // Include direct angle instructions only if this batch contains it
      const batchHasDirect = batchAngles.some((a: any) => a.id === "direct_from_page");
      
      const batchUserPrompt = `Today's date is ${currentDate}. Ensure all content is seasonally appropriate.

Generate a 3×3 creative grid for each of these ${batchAngles.length} angle(s):

${batchAnglesDesc}
${batchHasDirect ? directAngleInstructions : ''}

IMPORTANT: Use the exact angle ID (not the name) for the angleId field.

=== BRAND CONTEXT ===
Brand: ${brandName}
${brandVoice ? `Brand Voice: ${brandVoice}` : ''}
${nicheContext ? `Industry/Niche: ${nicheContext}` : ''}

=== OFFER CONTEXT ===
Offer: ${offerData?.name || "Not specified"}
${offerData?.description ? `Description: ${offerData.description.slice(0, 500)}` : ""}
${offerData?.price ? `Price: ${offerData.price}` : ""}

${messagingGuidelines ? `=== MESSAGING GUIDELINES ===\n${truncateJson(messagingGuidelines)}` : ''}
${productPsychology ? `=== PRODUCT PSYCHOLOGY ===\n${truncateJson(productPsychology)}` : ''}

=== STRATEGY CONTEXT ===
${truncateJson(strategyData, 600)}

${audiencePsychology ? `=== FULL AUDIENCE PSYCHOLOGY ===\n${truncateJson(audiencePsychology, 1000)}` : ""}

=== YOUR TASK ===
Generate exactly ${batchAngles.length * 9} creative cells (${batchAngles.length} angles × 9 cells each).`;

      console.log(`Batch ${batchIndex + 1}: generating for ${batchAngles.length} angles (${batchAngles.map((a: any) => a.name).join(', ')})`);

      const MAX_RETRIES = 2;
      let response: Response | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`Batch ${batchIndex + 1} retry ${attempt}/${MAX_RETRIES}...`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
          response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              max_tokens: 32000,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemPrompt + "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no commentary, no code fences." },
                { role: "user", content: batchUserPrompt },
              ],
            }),
          });
          break;
        } catch (fetchError) {
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          console.error(`Batch ${batchIndex + 1} fetch attempt ${attempt + 1} failed:`, lastError.message);
          if (attempt === MAX_RETRIES) {
            throw new Error(`Connection failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
          }
        }
      }

      if (!response) {
        throw lastError || new Error("No response from AI gateway");
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Batch ${batchIndex + 1} AI API error:`, response.status, errorText);
        if (response.status === 429) throw new Error("429: Rate limit exceeded");
        if (response.status === 402) throw new Error("402: AI credits depleted");
        throw new Error(`AI API error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const rawContent =
        aiResponse?.choices?.[0]?.message?.content ??
        aiResponse?.choices?.[0]?.text ??
        aiResponse?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
        "";

      if (!rawContent) {
        console.error(`Batch ${batchIndex + 1} unexpected AI response shape:`, aiResponse);
        throw new Error("AI response was empty");
      }

      const parsed = await extractJson(rawContent) as { grid?: any[] };
      return parsed.grid || [];
    };

    // Run batches sequentially to respect rate limits
    let allCells: any[] = [];
    for (let i = 0; i < angleBatches.length; i++) {
      // Small delay between batches to avoid rate limits
      if (i > 0) {
        await new Promise(r => setTimeout(r, 500));
      }
      const batchCells = await generateBatch(angleBatches[i], i);
      allCells = allCells.concat(batchCells);
    }

    // Post-process to ensure angleId matches actual angle IDs
    const angleIdMap = new Map<string, string>();
    for (const angle of angles) {
      angleIdMap.set(angle.name.toLowerCase(), angle.id);
      angleIdMap.set(angle.id.toLowerCase(), angle.id);
    }

    allCells = allCells.map((cell: any) => {
      const lookupKey = (cell.angleId || "").toLowerCase();
      const correctedId = angleIdMap.get(lookupKey);
      if (correctedId) {
        cell.angleId = correctedId;
      }
      cell.psychology_trigger = cell.psychology_trigger || "curiosity";
      cell.pain_point_addressed = cell.pain_point_addressed || "general";
      cell.why_this_works = cell.why_this_works || "";

      // Enforce: no AI image generation. Coerce any legacy "generated" to a type-led graphic.
      if (cell.brief && typeof cell.brief === "object") {
        if (cell.brief.imageSource === "generated") {
          cell.brief.imageSource = "none";
          cell.brief.styleHint = "type-led";
          cell.brief.photoTreatment = "none";
        }
        delete cell.brief.imagePrompt;
      }
      if (cell.imageSource === "generated") {
        cell.imageSource = "none";
        cell.styleHint = "type-led";
        cell.photoTreatment = "none";
      }
      delete cell.imagePrompt;
      
      if (cell.format === "talking_head") {
        cell.verbal_hook = cell.verbal_hook || cell.hook || "";
        cell.written_hook = cell.written_hook || "";
        cell.visual_hook = cell.visual_hook || "";
        cell.visual_hook_options = cell.visual_hook_options || [];
        cell.hook_technique = cell.hook_technique || "pattern_interrupt";
        cell.delivery_style = cell.delivery_style || "Conversational and authentic - no acting required.";
        cell.script_lines = cell.script_lines || [];
        cell.text_overlays = cell.text_overlays || [];
        cell.caption_reminder = true;
      }
      if (cell.format === "broll") {
        cell.broll_vibe = cell.broll_vibe || "";
        cell.text_overlays = cell.text_overlays || [];
        cell.mood = cell.mood || "Relatable";
      }
      return cell;
    });

    console.log("Successfully generated", allCells.length, "creative cells across", angleBatches.length, "batch(es)");

    return new Response(JSON.stringify({ grid: allCells }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in generate-creative-grid:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate grid";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: errorMessage.includes("429") ? 429 : errorMessage.includes("402") ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
