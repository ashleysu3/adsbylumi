import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTierFromProductId, getTierFromPriceId, isAnnualPrice, TierKey, SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';

interface TierLimits {
  brands: number;
  adAccounts: number;
  campaigns: number;
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
}

interface SubscriptionContextType extends SubscriptionState {
  refreshSubscription: () => Promise<void>;
  getTierLimits: () => TierLimits | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    isSubscribed: false,
    tier: null,
    isAnnual: false,
    subscriptionEnd: null,
    cancelAtPeriodEnd: false,
    productId: null,
    priceId: null,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState(prev => ({ ...prev, isLoading: false, isSubscribed: false, tier: null }));
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const tier = getTierFromProductId(data.product_id) || getTierFromPriceId(data.price_id);
      
      setState({
        isLoading: false,
        isSubscribed: data.subscribed,
        tier,
        isAnnual: isAnnualPrice(data.price_id),
        subscriptionEnd: data.subscription_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        productId: data.product_id,
        priceId: data.price_id,
      });
    } catch (err) {
      console.error('Error in checkSubscription:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

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
      campaigns: limits.campaigns,
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
