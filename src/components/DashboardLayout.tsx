import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useBrand } from "@/contexts/BrandContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { OnboardingWalkthrough } from "@/components/OnboardingWalkthrough";
import { GuidedTour } from "@/components/GuidedTour";
import { CreateAdModal } from "@/components/CreateAdModal";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileOnboardingTour, useMobileOnboardingTour } from "@/components/MobileOnboardingTour";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { AppTopBar } from "@/components/AppTopBar";
import { ArrowRight, X, Sparkles, Shield, Briefcase, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionBanner } from "@/components/SubscriptionGate";
import { DashboardFooter } from "@/components/DashboardFooter";
import { PartnerPortalBanner } from "@/components/PartnerPortalBanner";
import { TasksTray } from "@/components/TasksTray";
import { ReturnToWorkButton } from "@/components/ReturnToWorkButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast as sonnerToast } from "sonner";



interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { getEffectiveUserId } = useImpersonation();
  const { setDesktopNavLayout } = useLumiAssistant();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inProgressWorkspace, setInProgressWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [progressBannerDismissed, setProgressBannerDismissed] = useState(false);
  const { activeBrand, isAgencyUser } = useBrand();
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughSteps, setWalkthroughSteps] = useState<any[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [tourConfig, setTourConfig] = useState<{
    targetSelector: string;
    title: string;
    description: string;
  } | null>(null);
  const [createAdModalOpen, setCreateAdModalOpen] = useState(false);
  const [isPartner, setIsPartner] = useState(false);

  // Mobile onboarding tour
  const { showTour, hasSeenTour, startTour, completeTour } = useMobileOnboardingTour();

  // Auto-show tour for new mobile users
  useEffect(() => {
    if (isMobile && !hasSeenTour && user) {
      const timer = setTimeout(() => startTour(), 1000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, hasSeenTour, user, startTour]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);

      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      supabase.from("profiles").select("*").eq("id", effectiveUserId).maybeSingle().then(({ data }) => setProfile(data));
      supabase.from("brands").select("*").eq("user_id", effectiveUserId).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setBrand(data));
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => setIsAdmin(!!data));
      supabase
        .from("partner_access_tokens")
        .select("id")
        .eq("partner_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => setIsPartner(!!data));
    };
    fetchData();
  }, [navigate, getEffectiveUserId]);

  // Check for in-progress campaigns
  useEffect(() => {
    if (!activeBrand?.id || location.pathname.startsWith('/creative-studio')) {
      setInProgressWorkspace(null);
      return;
    }
    supabase
      .from("campaign_workspaces")
      .select("id, name")
      .eq("brand_id", activeBrand.id)
      .in("progress_status", ["creative_in_progress", "waiting_for_assets"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setInProgressWorkspace(data || null));
  }, [activeBrand?.id, location.pathname]);

  // Fetch agency name for Manage All Accounts view
  useEffect(() => {
    if (!isAgencyUser || !activeBrand?.id) return;
    supabase.from('agency_branding').select('company_name').eq('brand_id', activeBrand.id).maybeSingle()
      .then(({ data }) => setAgencyName(data?.company_name || null));
  }, [isAgencyUser, activeBrand?.id]);


  useEffect(() => {
    if (!isMobile) {
      setDesktopNavLayout(true);
    }
    return () => setDesktopNavLayout(false);
  }, [isMobile, setDesktopNavLayout]);

  const handleWalkthroughAction = (route?: string, targetSelector?: string, tourTitle?: string, tourDescription?: string) => {
    setWalkthroughOpen(false);
    if (route) {
      if (route !== location.pathname) navigate(route);
      if (targetSelector && tourTitle && tourDescription) {
        setTimeout(() => {
          setTourConfig({ targetSelector, title: tourTitle, description: tourDescription });
          setTourActive(true);
        }, route !== location.pathname ? 500 : 100);
      }
    }
  };

  if (!user) return null;

  // Mobile layout — completely untouched
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader
          user={user}
          profile={profile}
          isAdmin={isAdmin}
          onShowWalkthrough={() => startTour()}
        />
        <SubscriptionBanner />
        <PartnerPortalBanner />
        <main className="px-4 py-4">{children}</main>
        <DashboardFooter />
        <MobileBottomNav />

        {walkthroughOpen && (
          <OnboardingWalkthrough
            steps={walkthroughSteps}
            onClose={() => setWalkthroughOpen(false)}
            onActionClick={handleWalkthroughAction}
          />
        )}
        {tourActive && tourConfig && (
          <GuidedTour
            steps={[{ targetSelector: tourConfig.targetSelector, title: tourConfig.title, description: tourConfig.description }]}
            onClose={() => { setTourActive(false); setTourConfig(null); }}
          />
        )}
        {showTour && (
          <MobileOnboardingTour onComplete={completeTour} onSkip={completeTour} />
        )}
        <CreateAdModal open={createAdModalOpen} onOpenChange={setCreateAdModalOpen} />
        <TasksTray />
        <ReturnToWorkButton />

      </div>
    );
  }

  // Desktop layout — top bar navigation (no sidebar)
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <AppTopBar isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col min-w-0">
          <SubscriptionBanner />
          <PartnerPortalBanner />
          
          
          <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6">
            {children}
          </main>
          <DashboardFooter />
      </div>

      {walkthroughOpen && (
        <OnboardingWalkthrough
          steps={walkthroughSteps}
          onClose={() => setWalkthroughOpen(false)}
          onActionClick={handleWalkthroughAction}
        />
      )}
      {tourActive && tourConfig && (
        <GuidedTour
          steps={[{ targetSelector: tourConfig.targetSelector, title: tourConfig.title, description: tourConfig.description }]}
          onClose={() => { setTourActive(false); setTourConfig(null); }}
        />
      )}
      <CreateAdModal open={createAdModalOpen} onOpenChange={setCreateAdModalOpen} />
      <TasksTray />
      <ReturnToWorkButton />
    </div>
  );
}
