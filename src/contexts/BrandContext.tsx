import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useLumi } from '@/contexts/LumiContext';

interface Brand {
  id: string;
  name: string;
  website_url: string | null;
  industry: string | null;
  meta_account_id: string | null;
  created_at: string | null;
}

interface BrandContextType {
  brands: Brand[];
  activeBrand: Brand | null;
  setActiveBrand: (brand: Brand) => void;
  isAgencyUser: boolean;
  loading: boolean;
  refreshBrands: () => Promise<void>;
  addBrand: (brand: Brand) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrandState] = useState<Brand | null>(null);
  const [isAgencyUser, setIsAgencyUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const { getEffectiveUserId } = useImpersonation();
  const { setBrandId } = useLumi();

  const [authReady, setAuthReady] = useState(false);

  const fetchBrands = useCallback(async () => {
    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) {
        setLoading(false);
        return;
      }

      // Check if user is an agency user
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_agency_user')
        .eq('id', effectiveUserId)
        .single();

      const isAgency = profileData?.is_agency_user ?? false;
      setIsAgencyUser(isAgency);

      // Fetch brands
      const { data: brandsData, error } = await supabase
        .from('brands')
        .select('id, name, website_url, industry, meta_account_id, created_at')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedBrands = brandsData || [];
      setBrands(fetchedBrands);

      // Set active brand from localStorage or first brand
      if (fetchedBrands.length > 0) {
        const savedBrandId = localStorage.getItem('activeBrandId');
        const savedBrand = savedBrandId 
          ? fetchedBrands.find(b => b.id === savedBrandId) 
          : null;
        
        const brandToSet = savedBrand || fetchedBrands[0];
        setActiveBrandState(brandToSet);
        setBrandId(brandToSet.id);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setLoading(false);
    }
  }, [getEffectiveUserId, setBrandId]);

  // Listen for auth state changes to re-fetch brands when user logs in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setAuthReady(true);
        fetchBrands();
      } else if (event === 'SIGNED_OUT') {
        setBrands([]);
        setActiveBrandState(null);
        setLoading(false);
        setAuthReady(true);
      }
    });

    // Also try initial fetch
    fetchBrands().then(() => setAuthReady(true));

    return () => subscription.unsubscribe();
  }, [fetchBrands]);

  const setActiveBrand = useCallback((brand: Brand) => {
    setActiveBrandState(brand);
    setBrandId(brand.id);
    localStorage.setItem('activeBrandId', brand.id);
  }, [setBrandId]);

  const addBrand = useCallback((brand: Brand) => {
    setBrands(prev => [brand, ...prev]);
  }, []);

  const refreshBrands = useCallback(async () => {
    await fetchBrands();
  }, [fetchBrands]);

  return (
    <BrandContext.Provider value={{
      brands,
      activeBrand,
      setActiveBrand,
      isAgencyUser,
      loading,
      refreshBrands,
      addBrand,
    }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
