import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ImpersonatedUser {
  id: string;
  email: string;
  fullName: string | null;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  isImpersonating: boolean;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
  getEffectiveUserId: () => Promise<string | null>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const getStoredImpersonatedUser = (): ImpersonatedUser | null => {
  try {
    const stored = sessionStorage.getItem("impersonatedUser");
    return stored ? JSON.parse(stored) : null;
  } catch {
    sessionStorage.removeItem("impersonatedUser");
    return null;
  }
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
};

interface ImpersonationProviderProps {
  children: ReactNode;
}

export const ImpersonationProvider = ({ children }: ImpersonationProviderProps) => {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(getStoredImpersonatedUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const checkCurrentUserIsAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      setAdminChecked(true);
      return false;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const allowed = !!roleData;
    setIsAdmin(allowed);
    setAdminChecked(true);
    return allowed;
  }, []);

  // Check if current user is admin on mount
  useEffect(() => {
    checkCurrentUserIsAdmin();
  }, [checkCurrentUserIsAdmin]);

  const startImpersonation = (user: ImpersonatedUser) => {
    if (!isAdmin) {
      console.error("Only admins can impersonate users");
      return;
    }
    setImpersonatedUser(user);
    sessionStorage.setItem("impersonatedUser", JSON.stringify(user));
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
    sessionStorage.removeItem("impersonatedUser");
  };

  const getEffectiveUserId = async (): Promise<string | null> => {
    if (impersonatedUser && (isAdmin || !adminChecked)) {
      if (!isAdmin && !(await checkCurrentUserIsAdmin())) {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id || null;
      }
      return impersonatedUser.id;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  const isImpersonating = !!impersonatedUser && (isAdmin || !adminChecked);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
        getEffectiveUserId,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};
