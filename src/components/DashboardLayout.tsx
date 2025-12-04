import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Home, Lightbulb, Palette, BarChart3, FolderKanban, Shield, LogOut, Settings, Clipboard, Sparkles, LayoutTemplate, Ticket } from "lucide-react";
import { toast } from "sonner";
import { OnboardingWalkthrough } from "@/components/OnboardingWalkthrough";
import { GuidedTour } from "@/components/GuidedTour";
import { LumiChat } from "@/components/LumiChat";
import { LumiCharacter } from "@/components/LumiCharacter";
import lumiLogo from "@/assets/lumi-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({
  children
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
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
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
        supabase.from("profiles").select("*").eq("id", user.id).single().then(({
          data
        }) => setProfile(data));

        supabase.from("brands").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single().then(({
          data
        }) => setBrand(data));

        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single().then(({
          data
        }) => setIsAdmin(!!data));
      }
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleShowWalkthrough = async () => {
    localStorage.removeItem('has-seen-walkthrough');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to continue");
        navigate("/auth");
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('suggest-next-action', {
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
          description: 'Use the Ad Planner to build a strategic campaign with AI-generated creative assets.',
          completed: data.context.campaignCount > 0,
          action: data.context.campaignCount === 0 ? 'Start Planning' : undefined,
          route: '/planning'
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
    path: "/planning",
    icon: Lightbulb,
    label: "STRATEGY",
    lightColor: "tab-orange-light",
    darkColor: "tab-orange-dark"
  }, {
    path: "/creative",
    icon: Palette,
    label: "CREATIVE",
    lightColor: "tab-yellow-light",
    darkColor: "tab-yellow-dark"
  }, {
    path: "/production",
    icon: Clipboard,
    label: "PRODUCTION",
    lightColor: "tab-cream-light",
    darkColor: "tab-cream-dark"
  }, {
    path: "/data",
    icon: BarChart3,
    label: "INSIGHTS",
    lightColor: "tab-orange-light",
    darkColor: "tab-orange-dark"
  }];

  if (!user) return null;

  // Custom trigger for Lumi in nav bar
  const lumiNavTrigger = (
    <button className="flex items-center gap-3 text-base font-medium transition-colors group mb-2 hover:opacity-80">
      <LumiCharacter size="sm" state="idle" glow className="group-hover:animate-none" />
      <span className="bg-gradient-to-r from-primary to-lumi-orange-3 bg-clip-text text-transparent font-bold text-lg">
        Ask Lumi
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img alt="Lumi" className="h-10 md:h-16 object-contain my-2 mx-4" src={lumiLogo} />
            </div>

            <div className="flex items-center space-x-3">
              <Button onClick={() => navigate("/campaigns")} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold lumi-button-glow">
                <FolderKanban className="mr-2 h-4 w-4" />
                My Campaigns
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card z-50">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <Home className="mr-2 h-4 w-4" />
                    My Brand
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
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
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

          <nav className="flex items-end justify-between mt-6 -mb-4 overflow-x-auto">
            <div className="flex space-x-1">
              {tabItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return <Link key={item.path} to={item.path}>
                    <div className={`
                        h-12 px-6 rounded-t-lg rounded-b-none relative
                        border border-tab-black border-b-0
                        flex items-center justify-center
                        transition-all duration-200 font-bold
                        ${isActive ? `bg-${item.darkColor} text-white` : `bg-${item.lightColor} text-tab-black hover:bg-${item.darkColor}/20`}
                      `} style={{
                  backgroundColor: isActive ? `hsl(var(--${item.darkColor}))` : `hsl(var(--${item.lightColor}))`,
                  color: isActive ? 'white' : 'hsl(var(--tab-black))',
                  fontWeight: isActive ? 'bold' : 'normal'
                }}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </div>
                  </Link>;
            })}
            </div>
            
            <LumiChat 
              context={getContextFromRoute()} 
              brand={brand}
              trigger={lumiNavTrigger}
            />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">{children}</main>

      {walkthroughOpen && <OnboardingWalkthrough steps={walkthroughSteps} onClose={() => setWalkthroughOpen(false)} onActionClick={handleWalkthroughAction} />}

      {tourActive && tourConfig && <GuidedTour targetSelector={tourConfig.targetSelector} title={tourConfig.title} description={tourConfig.description} onClose={() => {
      setTourActive(false);
      setTourConfig(null);
    }} />}
    </div>
  );
}
