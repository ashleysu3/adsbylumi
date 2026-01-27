// Ads Glossary - Plain English explanations for Meta Ads terminology

export interface GlossaryTerm {
  term: string;
  acronym?: string;
  definition: string;
  example?: string;
}

export const adsGlossary: Record<string, GlossaryTerm> = {
  // Core Metrics
  ctr: {
    term: "Click-Through Rate",
    acronym: "CTR",
    definition: "The percentage of people who click your ad after seeing it. Higher is better!",
    example: "If 100 people see your ad and 3 click, your CTR is 3%.",
  },
  cpc: {
    term: "Cost Per Click",
    acronym: "CPC",
    definition: "How much you pay each time someone clicks your ad.",
    example: "If you spend $10 and get 20 clicks, your CPC is $0.50.",
  },
  cpm: {
    term: "Cost Per Mille",
    acronym: "CPM",
    definition: "How much you pay for every 1,000 times your ad is shown (impressions).",
    example: "A $5 CPM means you pay $5 for every 1,000 views of your ad.",
  },
  cpl: {
    term: "Cost Per Lead",
    acronym: "CPL",
    definition: "How much you pay for each person who signs up, registers, or gives you their contact info.",
    example: "If you spend $50 and get 10 sign-ups, your CPL is $5.",
  },
  cpp: {
    term: "Cost Per Purchase",
    acronym: "CPP",
    definition: "How much you pay for each sale or purchase from your ads.",
    example: "If you spend $100 and get 5 purchases, your CPP is $20.",
  },
  roas: {
    term: "Return on Ad Spend",
    acronym: "ROAS",
    definition: "How much revenue you earn for every dollar spent on ads. Higher is better!",
    example: "A 3x ROAS means you earn $3 for every $1 you spend on ads.",
  },
  frequency: {
    term: "Frequency",
    definition: "The average number of times each person has seen your ad. Too high can cause ad fatigue.",
    example: "A frequency of 4 means people have seen your ad an average of 4 times.",
  },
  reach: {
    term: "Reach",
    definition: "The total number of unique people who have seen your ad.",
    example: "A reach of 10,000 means 10,000 different people saw your ad.",
  },
  impressions: {
    term: "Impressions",
    definition: "The total number of times your ad was shown (same person can count multiple times).",
    example: "1,000 impressions could be 500 people seeing your ad twice each.",
  },
  thruplay: {
    term: "ThruPlay",
    definition: "A video view where someone watched at least 15 seconds (or the whole video if it's shorter).",
    example: "100 ThruPlays means 100 people watched at least 15 seconds of your video.",
  },

  // Campaign Structure
  campaign: {
    term: "Campaign",
    definition: "The top level of your ad structure. It's where you set your main goal (like leads, sales, or traffic).",
    example: "You might have a 'Webinar Sign-ups' campaign with the goal of getting registrations.",
  },
  adSet: {
    term: "Ad Set",
    definition: "A group of ads within a campaign. This is where you set your audience, budget, and schedule.",
    example: "Within one campaign, you might have one ad set targeting women 25-34 and another targeting men 35-44.",
  },
  ad: {
    term: "Ad",
    definition: "The actual creative content people see — your image/video, headline, and text.",
    example: "You might test 3 different video ads in the same ad set to see which performs best.",
  },

  // Audience Types
  broadAudience: {
    term: "Broad Audience",
    definition: "Letting Meta's algorithm find the best people for your ads without detailed targeting restrictions.",
    example: "Instead of picking specific interests, you let Meta's AI find people most likely to convert.",
  },
  lookalike: {
    term: "Lookalike Audience",
    definition: "People who are similar to your existing customers or leads.",
    example: "A 1% lookalike of your email list finds people most similar to your subscribers.",
  },
  retargeting: {
    term: "Retargeting",
    definition: "Showing ads to people who already know you — like website visitors or video viewers.",
    example: "Showing a special offer to people who visited your sales page but didn't buy.",
  },
  warmAudience: {
    term: "Warm Audience",
    definition: "People who have already interacted with your brand but haven't purchased yet.",
    example: "People who watched 50% of your videos or engaged with your Instagram posts.",
  },
  coldAudience: {
    term: "Cold Audience",
    definition: "People who haven't heard of you before. These are new potential customers.",
    example: "Anyone who hasn't visited your website or engaged with your content.",
  },

  // Campaign Settings
  advantagePlus: {
    term: "Advantage+ Placements",
    definition: "Letting Meta automatically place your ads wherever they'll perform best.",
    example: "Your ad might show on Instagram Reels, Facebook Feed, and Stories based on where it gets best results.",
  },
  optimization: {
    term: "Optimization Event",
    definition: "What you're telling Meta to optimize for — like leads, purchases, or link clicks.",
    example: "If you optimize for 'Leads', Meta will show your ads to people most likely to sign up.",
  },
  learningPhase: {
    term: "Learning Phase",
    definition: "The first ~7 days when Meta is figuring out who responds best to your ads. Performance may vary during this time.",
    example: "Don't make major changes during learning phase — let Meta gather enough data first.",
  },
  creativeFatigue: {
    term: "Creative Fatigue",
    definition: "When people have seen your ad so many times they stop responding to it.",
    example: "If your frequency is above 4 and CTR is dropping, your creative might be fatigued.",
  },

  // Budget & Bidding
  dailyBudget: {
    term: "Daily Budget",
    definition: "The average amount you're willing to spend per day on an ad set or campaign.",
    example: "A $20 daily budget means you'll spend roughly $600/month.",
  },
  lifetimeBudget: {
    term: "Lifetime Budget",
    definition: "The total amount you want to spend over the entire duration of your campaign.",
    example: "A $500 lifetime budget over 30 days averages about $16.67/day.",
  },
};

// Helper function to get a tooltip-friendly definition
export function getTermTooltip(key: string): string {
  const term = adsGlossary[key];
  if (!term) return "";
  return term.definition;
}

// Helper function to get full term info
export function getTermInfo(key: string): GlossaryTerm | null {
  return adsGlossary[key] || null;
}

// Get all terms for glossary display
export function getAllTerms(): GlossaryTerm[] {
  return Object.values(adsGlossary);
}

// Get terms by category
export function getTermsByCategory(category: 'metrics' | 'structure' | 'audience' | 'settings' | 'budget'): GlossaryTerm[] {
  const categoryMap: Record<string, string[]> = {
    metrics: ['ctr', 'cpc', 'cpm', 'cpl', 'cpp', 'roas', 'frequency', 'reach', 'impressions', 'thruplay'],
    structure: ['campaign', 'adSet', 'ad'],
    audience: ['broadAudience', 'lookalike', 'retargeting', 'warmAudience', 'coldAudience'],
    settings: ['advantagePlus', 'optimization', 'learningPhase', 'creativeFatigue'],
    budget: ['dailyBudget', 'lifetimeBudget'],
  };
  
  const keys = categoryMap[category] || [];
  return keys.map(k => adsGlossary[k]).filter(Boolean);
}