// Stripe price and product IDs for subscription tiers
export const SUBSCRIPTION_TIERS = {
  solo: {
    name: "Solo",
    monthlyPriceId: "price_1Sa2ZYACcLoSGSlno4cOSbxP",
    annualPriceId: "price_1Sa2ZlACcLoSGSlnrEd19gDv",
    monthlyProductId: "prod_TX6nzW8rB20cHj",
    annualProductId: "prod_TX6nO1Y9or83uv",
    monthlyPrice: 147,
    annualPrice: 1470,
    limits: {
      brands: 1,
      adAccounts: 1,
      campaigns: 5,
    },
    features: [
      "1 Brand",
      "1 Ad Account",
      "Up to 5 campaigns",
      "AI-powered ad creation",
      "Psychology-driven copy",
      "Performance tracking",
      "Weekly reports",
    ],
  },
  creator: {
    name: "Creator",
    monthlyPriceId: "price_1Sa2ZtACcLoSGSlnyuVLrBwM",
    annualPriceId: "price_1Sa2ZuACcLoSGSlnlDZcf6eV",
    monthlyProductId: "prod_TX6nfUrLTW77rr",
    annualProductId: "prod_TX6nzTq2jWSMfp",
    monthlyPrice: 299,
    annualPrice: 2990,
    limits: {
      brands: 3,
      adAccounts: 3,
      campaigns: 15,
    },
    features: [
      "Up to 3 Brands",
      "Up to 3 Ad Accounts",
      "Up to 15 campaigns",
      "Everything in Solo",
      "Priority support",
      "Advanced analytics",
      "Custom audiences",
    ],
  },
  agency: {
    name: "Agency",
    monthlyPriceId: null,
    annualPriceId: null,
    monthlyProductId: null,
    annualProductId: null,
    monthlyPrice: null,
    annualPrice: null,
    limits: {
      brands: -1, // unlimited
      adAccounts: -1,
      campaigns: -1,
    },
    features: [
      "Unlimited Brands",
      "Unlimited Ad Accounts",
      "Unlimited campaigns",
      "Everything in Creator",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
    ],
  },
} as const;

export type TierKey = keyof typeof SUBSCRIPTION_TIERS;

// Get tier from product ID
export function getTierFromProductId(productId: string | null): TierKey | null {
  if (!productId) return null;
  
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.monthlyProductId === productId || tier.annualProductId === productId) {
      return key as TierKey;
    }
  }
  return null;
}

// Get tier from price ID
export function getTierFromPriceId(priceId: string | null): TierKey | null {
  if (!priceId) return null;
  
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.monthlyPriceId === priceId || tier.annualPriceId === priceId) {
      return key as TierKey;
    }
  }
  return null;
}

// Check if price is annual
export function isAnnualPrice(priceId: string | null): boolean {
  if (!priceId) return false;
  
  for (const tier of Object.values(SUBSCRIPTION_TIERS)) {
    if (tier.annualPriceId === priceId) return true;
  }
  return false;
}
