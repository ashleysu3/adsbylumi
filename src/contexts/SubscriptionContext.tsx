import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTierFromProductId, getTierFromPriceId, isAnnualPrice, TierKey, SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface TierLimits {
  brands: number;
  adAccounts: number;
  adSpendCap: number;
}

interface DiscountInfo {
  coupon_name: string;
  percent_off: number | null;
  amount_off: number | null;
  duration: string;
  duration_in_months: number | null;
}

interface SubscriptionState {
  isLoading: boolean;
  isSubscribed: boolean;
  tier: TierKey | null;
  isAnnual: boolean;
  subscriptionEnd: string | null;
  cancelAtPeriodEnd: boolean;
  productId: string | null;
  priceId: string | null;
  isCodeBased: boolean;
  isTrial: boolean;
  status: string | null;
  discount: DiscountInfo | null;
  amountPaid: number | null;
  billingInterval: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  refreshSubscription: () => Promise<void>;
  getTierLimits: () => TierLimits | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

function normalizeTierKey(tier: unknown): TierKey | null {
  if (!tier || typeof tier !== 'string') return null;

  // Back-compat for DB enum tiers used by code-based subscriptions
  if (tier === 'starter') return 'solo';
  if (tier === 'growth') return 'creator';
  if (tier === 'agency_pro') return 'agency';

  // Stripe-derived tiers already match our UI keys
  if (tier in SUBSCRIPTION_TIERS) return tier as TierKey;

  return null;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    isSubscribed: false,
    tier: null,
    isAnnual: false,
    subscriptionEnd: null,
    cancelAtPeriodEnd: false,
    productId: null,
    priceId: null,
    isCodeBased: false,
    isTrial: false,
    status: null,
    discount: null,
    amountPaid: null,
    billingInterval: null,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState(prev => ({ ...prev, isLoading: false, isSubscribed: false, tier: null }));
        return;
      }

      // When impersonating, query subscription table directly for the target user
      if (isImpersonating && impersonatedUser) {
        const { data: subData } = await supabase
          .from('subscriptions' as any)
          .select('*')
          .eq('user_id', impersonatedUser.id)
          .maybeSingle();

        if (subData) {
          const tier = normalizeTierKey((subData as any).tier);
          setState({
            isLoading: false,
            isSubscribed: (subData as any).status === 'active' || (subData as any).status === 'trialing',
            tier,
            isAnnual: false,
            subscriptionEnd: (subData as any).current_period_end || null,
            cancelAtPeriodEnd: (subData as any).cancel_at_period_end || false,
            productId: null,
            priceId: null,
            isCodeBased: true,
            isTrial: (subData as any).status === 'trialing',
            status: (subData as any).status || null,
            discount: null,
            amountPaid: null,
            billingInterval: null,
          });
        } else {
          // Check if impersonated user has a Stripe subscription via edge function with actAsUserId
          let data: any = null;
          const res = await supabase.functions.invoke('check-subscription', {
            body: { actAsUserId: impersonatedUser.id }
          });
          if (!res.error) data = res.data;

          if (data) {
            let tier =
              normalizeTierKey(data.tier) ??
              getTierFromProductId(data.product_id) ??
              getTierFromPriceId(data.price_id);

            setState({
              isLoading: false,
              isSubscribed: data.subscribed,
              tier: tier as TierKey | null,
              isAnnual: isAnnualPrice(data.price_id),
              subscriptionEnd: data.subscription_end,
              cancelAtPeriodEnd: data.cancel_at_period_end,
              productId: data.product_id,
              priceId: data.price_id,
              isCodeBased: data.is_code_based || false,
              isTrial: data.is_trial || false,
              status: data.status || null,
              discount: data.discount || null,
              amountPaid: data.amount_paid ?? null,
              billingInterval: data.billing_interval || null,
            });
          } else {
            setState(prev => ({ ...prev, isLoading: false, isSubscribed: false, tier: null }));
          }
        }
        return;
      }

      // Normal (non-impersonation) flow
      // Check if user is an agency user — auto-grant agency tier
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_agency_user')
        .eq('id', session.user.id)
        .single();

      const isAgencyUser = profileData?.is_agency_user ?? false;

      let data: any = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase.functions.invoke('check-subscription');
        if (!res.error) { data = res.data; break; }
        lastError = res.error;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
      if (!data) {
        console.error('Error checking subscription after retries:', lastError);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Prefer explicit tier (code-based subscriptions), otherwise derive from Stripe ids
      let tier =
        normalizeTierKey(data.tier) ??
        getTierFromProductId(data.product_id) ??
        getTierFromPriceId(data.price_id);

      // Auto-grant agency tier for agency users
      if (isAgencyUser && tier !== 'agency') {
        tier = 'agency';
      }
      
      setState({
        isLoading: false,
        isSubscribed: isAgencyUser ? true : data.subscribed,
        tier: tier as TierKey | null,
        isAnnual: isAnnualPrice(data.price_id),
        subscriptionEnd: data.subscription_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        productId: data.product_id,
        priceId: data.price_id,
        isCodeBased: data.is_code_based || false,
        isTrial: data.is_trial || false,
        status: data.status || null,
        discount: data.discount || null,
        amountPaid: data.amount_paid ?? null,
        billingInterval: data.billing_interval || null,
      });
    } catch (err) {
      console.error('Error in checkSubscription:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isImpersonating, impersonatedUser]);

  useEffect(() => {
    checkSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkSubscription();
      } else if (event === 'SIGNED_OUT') {
        setState({
          isLoading: false,
          isSubscribed: false,
          tier: null,
          isAnnual: false,
          subscriptionEnd: null,
          cancelAtPeriodEnd: false,
          productId: null,
          priceId: null,
          isCodeBased: false,
          isTrial: false,
          status: null,
          discount: null,
          amountPaid: null,
          billingInterval: null,
        });
      }
    });

    // Refresh subscription status every minute
    const interval = setInterval(checkSubscription, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [checkSubscription]);

  const getTierLimits = useCallback((): TierLimits | null => {
    if (!state.tier) return null;
    const limits = SUBSCRIPTION_TIERS[state.tier].limits;
    return {
      brands: limits.brands,
      adAccounts: limits.adAccounts,
      adSpendCap: limits.adSpendCap,
    };
  }, [state.tier]);

  return (
    <SubscriptionContext.Provider value={{ ...state, refreshSubscription: checkSubscription, getTierLimits }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
