import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Home, BarChart3, FolderKanban, Shield, LogOut, Settings, Sparkles, LayoutTemplate, Ticket, Library, Building2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { OnboardingWalkthrough } from "@/components/OnboardingWalkthrough";
import { GuidedTour } from "@/components/GuidedTour";
import { CreateAdModal } from "@/components/CreateAdModal";
import { MobileBottomNav } from "@/components/MobileBottomNav";
// MobileFloatingAction removed - duplicate of Lumi chat button
import { MobileHeader } from "@/components/MobileHeader";
import { MobileOnboardingTour, useMobileOnboardingTour } from "@/components/MobileOnboardingTour";
import { useIsMobile } from "@/hooks/use-mobile";
import { BrandSelector } from "@/components/BrandSelector";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { SparkleIcon } from "@/components/SparkleIcon";
import lumiLogo from "@/assets/lumi-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
}
export default function DashboardLayout({
  children
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { getEffectiveUserId } = useImpersonation();
  const { openChat, setDesktopNavLayout, unreadCount } = useLumiAssistant();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
      const timer = setTimeout(() => {
        startTour();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, hasSeenTour, user, startTour]);

  // Determine context based on current route
  const getContextFromRoute = (): 'creative' | 'planning' | 'data' | 'campaign' | 'dashboard' | 'settings' | 'campaigns' | 'production' => {
    if (location.pathname.includes('/creative')) return 'creative';
    if (location.pathname.includes('/planning')) return 'planning';
    if (location.pathname.includes('/data')) return 'data';
    if (location.pathname.includes('/production')) return 'production';
    if (location.pathname.includes('/campaigns')) return 'campaigns';
    if (location.pathname.includes('/settings')) return 'settings';
    if (location.pathname.includes('/workspace')) return 'campaign';
    return 'dashboard';
  };
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
      
      // Use effective user ID for impersonation support
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      // Fetch profile and brand with effective user ID
      supabase.from("profiles").select("*").eq("id", effectiveUserId).single().then(({
        data
      }) => setProfile(data));
      supabase.from("brands").select("*").eq("user_id", effectiveUserId).order("created_at", {
        ascending: false
      }).limit(1).single().then(({
        data
      }) => setBrand(data));
      // Admin check uses actual user ID (not impersonated)
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single().then(({
        data
      }) => setIsAdmin(!!data));
    };
    fetchData();
  }, [navigate, getEffectiveUserId]);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };
  const handleShowWalkthrough = async () => {
    localStorage.removeItem('has-seen-walkthrough');
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to continue");
        navigate("/auth");
        return;
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('suggest-next-action', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error || data.error) {
        console.error('Error getting walkthrough:', error || data.error);
        return;
      }
      if (data.context) {
        const steps = [{
          id: 'profile',
          title: 'Complete Your Brand Profile',
          description: 'Add your brand details, website, and target audience to help create better campaigns.',
          completed: data.context.profileCompletion === 100,
          action: data.context.profileCompletion < 100 ? 'Complete Profile' : undefined,
          route: '/dashboard',
          targetSelector: '[data-section="brand-details"]',
          tourTitle: 'Edit Your Brand Details',
          tourDescription: 'Click the "Edit Details" button to add your website, industry, and other brand information.'
        }, {
          id: 'psychology',
          title: 'Generate Audience Psychology',
          description: 'Let AI analyze your audience\'s pain points, desires, and motivations for targeted messaging.',
          completed: data.context.hasPsychology,
          action: !data.context.hasPsychology ? 'Generate Psychology' : undefined,
          route: '/dashboard',
          targetSelector: '[data-section="audience-psychology"]',
          tourTitle: 'Generate Audience Insights',
          tourDescription: 'Click "Generate Psychology" to let AI analyze your target audience and create detailed psychological profiles.'
        }, {
          id: 'offers',
          title: 'Add Your Offers',
          description: 'List your products or services to get AI-powered campaign recommendations.',
          completed: data.context.hasOffers,
          action: !data.context.hasOffers ? 'Add First Offer' : undefined,
          route: '/dashboard',
          targetSelector: '[data-section="offers"]',
          tourTitle: 'Create Your First Offer',
          tourDescription: 'Click "Add Offer" to list your product or service. The AI will analyze it and recommend the best campaign strategy.'
        }, {
          id: 'meta',
          title: 'Connect Meta Ad Account',
          description: 'Link your Meta Business account to publish campaigns directly to Facebook and Instagram.',
          completed: data.context.hasMetaAccount,
          action: !data.context.hasMetaAccount ? 'Connect Account' : undefined,
          route: '/dashboard',
          targetSelector: '[data-section="meta-account"]',
          tourTitle: 'Link Your Meta Account',
          tourDescription: 'Click "Connect Meta Account" to authorize access to your Facebook/Instagram ad account for campaign publishing.'
        }, {
          id: 'campaign',
          title: 'Create Your First Campaign',
          description: 'Use the Ad Wizard to build a strategic campaign with AI-generated creative assets.',
          completed: data.context.campaignCount > 0,
          action: data.context.campaignCount === 0 ? 'Create Ad' : undefined,
          route: '/create'
        }];
        setWalkthroughSteps(steps);
        setWalkthroughOpen(true);
        localStorage.setItem('has-seen-walkthrough', 'true');
      }
    } catch (error: any) {
      console.error('Error showing walkthrough:', error);
    }
  };
  const handleWalkthroughAction = (route?: string, targetSelector?: string, tourTitle?: string, tourDescription?: string) => {
    setWalkthroughOpen(false);
    if (route) {
      if (route !== location.pathname) {
        navigate(route);
      }
      if (targetSelector && tourTitle && tourDescription) {
        setTimeout(() => {
          setTourConfig({
            targetSelector,
            title: tourTitle,
            description: tourDescription
          });
          setTourActive(true);
        }, route !== location.pathname ? 500 : 100);
      }
    }
  };
  const tabItems = [{
    path: "/start",
    icon: Home,
    label: "HOME",
    lightColor: "tab-orange-light",
    darkColor: "tab-orange-dark"
  }, {
    path: "/campaigns",
    icon: FolderKanban,
    label: "MY ADS",
    lightColor: "tab-pink-light",
    darkColor: "tab-pink-dark"
  }, {
    path: "/creative-studio",
    icon: Sparkles,
    label: "CREATIVE STUDIO",
    lightColor: "tab-purple-light",
    darkColor: "tab-purple-dark"
  }, {
    path: "/data",
    icon: BarChart3,
    label: "RESULTS",
    lightColor: "tab-blue-light",
    darkColor: "tab-blue-dark"
  }];

  // Register desktop layout with LumiAssistant context
  useEffect(() => {
    if (!isMobile) {
      setDesktopNavLayout(true);
    }
    return () => setDesktopNavLayout(false);
  }, [isMobile, setDesktopNavLayout]);

  if (!user) return null;

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader 
          user={user} 
          profile={profile} 
          isAdmin={isAdmin}
          onShowWalkthrough={() => startTour()}
        />

        <main className="px-4 py-4">{children}</main>

        {/* Removed MobileFloatingAction - users can access "New Ad" from dashboard cards and header */}
        {/* LumiAssistant provides the floating chat button */}
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
            onClose={() => {
              setTourActive(false);
              setTourConfig(null);
            }} 
          />
        )}

        {/* Mobile Onboarding Tour */}
        {showTour && (
          <MobileOnboardingTour 
            onComplete={completeTour}
            onSkip={completeTour}
          />
        )}

        <CreateAdModal open={createAdModalOpen} onOpenChange={setCreateAdModalOpen} />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img alt="Lumi" className="h-8 md:h-16 object-contain my-1 md:my-2 mx-2 md:mx-4" src={lumiLogo} />
              <BrandSelector className="ml-2 hidden md:flex" />
            </div>

            <div className="flex items-center space-x-2 md:space-x-3">
              <Link to="/content-library">
                <button className="relative group p-[2px] md:p-[3px] rounded-lg bg-muted hover:bg-muted/80 border border-border/50 transition-all overflow-hidden">
                  <span className="relative flex items-center py-1.5 md:py-2 rounded-md bg-card group-hover:bg-card/95 transition-colors font-medium px-2 md:px-3 text-foreground text-xs md:text-sm">
                    <Library className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                    <span className="hidden sm:inline">Library</span>
                    <span className="sm:hidden">Lib</span>
                  </span>
                </button>
              </Link>
              <button onClick={() => setCreateAdModalOpen(true)} className="relative group p-[2px] md:p-[3px] rounded-lg bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 hover:shadow-lg hover:shadow-lumi-pink-1/30 transition-all overflow-hidden">
                {/* Shimmer overlay on hover */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                <span className="relative flex items-center py-1.5 md:py-2 rounded-md bg-white group-hover:bg-white/95 transition-colors font-medium px-2 md:px-3 text-lumi-charcoal text-xs md:text-sm">
                  <Sparkles className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-lumi-pink-1 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="hidden sm:inline">​New Ad</span>
                  <span className="sm:hidden">​New</span>
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 md:h-10 md:w-10 rounded-full p-0">
                    <Avatar className="h-8 w-8 md:h-10 md:w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs md:text-sm">
                        {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card z-50">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/start")}>
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </DropdownMenuItem>
                  {isAdmin && <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Admin</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate("/admin/knowledge")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Knowledge Base
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/templates")}>
                        <LayoutTemplate className="mr-2 h-4 w-4" />
                        Campaign Templates
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/invite-codes")}>
                        <Ticket className="mr-2 h-4 w-4" />
                        Invite Codes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/analytics")}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Analytics
                      </DropdownMenuItem>
                    </>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <Building2 className="mr-2 h-4 w-4" />
                    My Brand
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/content-library")}>
                    <Library className="mr-2 h-4 w-4" />
                    Concept Library
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/glossary")}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Ads Glossary
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShowWalkthrough}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Show Walkthrough Again
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Desktop navigation tabs */}
          <nav className="flex items-end justify-between mt-4 md:mt-6 -mb-3 md:-mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex space-x-1 pb-px flex-1">
              {tabItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <div className={`
                        h-10 md:h-12 px-3 md:px-6 rounded-t-xl rounded-b-none relative
                        flex items-center justify-center
                        transition-all duration-300 font-semibold text-xs md:text-sm whitespace-nowrap
                        ${isActive ? 'bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-lg shadow-lumi-pink-1/30' : 'bg-card/80 text-muted-foreground hover:text-foreground hover:bg-card border border-border/50'}
                      `}>
                      <Icon className={`mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4 ${isActive ? 'animate-sparkle-pulse' : ''}`} />
                      <span className="hidden sm:inline">{item.label}</span>
                      <span className="sm:hidden">{item.label.split(' ')[0]}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Lumi Chat Button - Desktop Only */}
            <button
              onClick={openChat}
              className="flex items-center gap-2 px-4 py-2 rounded-full 
                         bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 
                         text-white font-medium text-sm
                         shadow-lg shadow-lumi-pink-1/20 hover:shadow-xl hover:shadow-lumi-pink-1/30
                         transition-all mb-1 ml-4 relative group"
            >
              <SparkleIcon size="xs" state="idle" className="group-hover:animate-pulse" />
              <span>Ask Lumi</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-white text-lumi-pink-1 rounded-full flex items-center justify-center text-[10px] font-bold shadow">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-4 md:py-6">{children}</main>

      {walkthroughOpen && <OnboardingWalkthrough steps={walkthroughSteps} onClose={() => setWalkthroughOpen(false)} onActionClick={handleWalkthroughAction} />}

      {tourActive && tourConfig && <GuidedTour targetSelector={tourConfig.targetSelector} title={tourConfig.title} description={tourConfig.description} onClose={() => {
        setTourActive(false);
        setTourConfig(null);
      }} />}

      <CreateAdModal open={createAdModalOpen} onOpenChange={setCreateAdModalOpen} />
    </div>
  );
}