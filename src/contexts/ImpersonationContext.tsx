import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin on mount
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!roleData);
    };

    checkAdmin();

    // Restore impersonation from session storage
    const stored = sessionStorage.getItem("impersonatedUser");
    if (stored) {
      try {
        setImpersonatedUser(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem("impersonatedUser");
      }
    }
  }, []);

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
    if (impersonatedUser && isAdmin) {
      return impersonatedUser.id;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  const isImpersonating = !!impersonatedUser && isAdmin;

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
