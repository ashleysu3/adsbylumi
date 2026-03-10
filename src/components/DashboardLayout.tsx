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
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ArrowRight, X } from "lucide-react";
import { SubscriptionBanner } from "@/components/SubscriptionGate";

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
  const { activeBrand } = useBrand();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughSteps, setWalkthroughSteps] = useState<any[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [tourConfig, setTourConfig] = useState<{
    targetSelector: string;
    title: string;
    description: string;
  } | null>(null);
  const [createAdModalOpen, setCreateAdModalOpen] = useState(false);

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

      supabase.from("profiles").select("*").eq("id", effectiveUserId).single().then(({ data }) => setProfile(data));
      supabase.from("brands").select("*").eq("user_id", effectiveUserId).order("created_at", { ascending: false }).limit(1).single().then(({ data }) => setBrand(data));
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single().then(({ data }) => setIsAdmin(!!data));
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

  // Register desktop layout with LumiAssistant context
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
        <main className="px-4 py-4">{children}</main>
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
            targetSelector={tourConfig.targetSelector}
            title={tourConfig.title}
            description={tourConfig.description}
            onClose={() => { setTourActive(false); setTourConfig(null); }}
          />
        )}
        {showTour && (
          <MobileOnboardingTour onComplete={completeTour} onSkip={completeTour} />
        )}
        <CreateAdModal open={createAdModalOpen} onOpenChange={setCreateAdModalOpen} />
      </div>
    );
  }

  // Desktop layout — sidebar + slim top bar
  return (
    <SidebarProvider defaultOpen={localStorage.getItem("sidebar:state") !== "false"}>
      <div className="min-h-screen flex w-full">
        <AppSidebar isAdmin={isAdmin} brandId={brand?.id} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Slim top bar */}
          <header className="h-12 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40 px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[200px]">
                {isAgencyUser && activeBrand ? activeBrand.name : (profile?.full_name || user?.email)}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {isAgencyUser && activeBrand ? activeBrand.name.charAt(0).toUpperCase() : (profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase())}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>


          <SubscriptionBanner />
          <main className="flex-1 container mx-auto px-4 md:px-6 py-4 md:py-6">
            {children}
          </main>
        </div>
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
          targetSelector={tourConfig.targetSelector}
          title={tourConfig.title}
          description={tourConfig.description}
          onClose={() => { setTourActive(false); setTourConfig(null); }}
        />
      )}
      <CreateAdModal open={createAdModalOpen} onOpenChange={setCreateAdModalOpen} />
    </SidebarProvider>
  );
}
