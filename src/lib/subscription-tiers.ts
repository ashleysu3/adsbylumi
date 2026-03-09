// Stripe price and product IDs for subscription tiers
export const SUBSCRIPTION_TIERS = {
  solo: {
    name: "Solo",
    monthlyPriceId: "price_1SqhzNACcLoSGSlnGp86B5RM",
    annualPriceId: "price_1Smg0LACcLoSGSln5d9ORSwW",
    monthlyProductId: "prod_TX6nzW8rB20cHj",
    annualProductId: "prod_TX6nzW8rB20cHj",
    monthlyPrice: 97,
    annualPrice: 970,
    limits: {
      brands: 1,
      adAccounts: 1,
      adSpendCap: -1, // unlimited
    },
    features: [
      "Smart campaign strategy",
      "Psychology-driven ad copy",
      "Smart audience targeting",
      "Performance tracking & insights",
      "Weekly optimization reports",
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
      adSpendCap: 10000, // $10,000/month
    },
    features: [
      "Up to $10,000/mo in managed ad spend",
      "Up to 3 Brands",
      "Up to 3 Ad Accounts",
      "Everything in Solo",
      "Priority support",
      "Advanced analytics",
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
      adSpendCap: -1, // unlimited
    },
    features: [
      "Unlimited ad spend management",
      "Unlimited Brands",
      "Unlimited Ad Accounts",
      "Everything in Creator",
      "White-label options",
      "Dedicated account manager",
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
