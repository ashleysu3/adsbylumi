import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Home, Lightbulb, Palette, BarChart3, FolderKanban, Shield, LogOut, Settings, Clipboard, Sparkles, Loader2, ArrowRight, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { OnboardingWalkthrough } from "@/components/OnboardingWalkthrough";
import { GuidedTour } from "@/components/GuidedTour";
import logo from "@/assets/logo.png";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionNextAction, setSuggestionNextAction] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughSteps, setWalkthroughSteps] = useState<any[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [tourConfig, setTourConfig] = useState<{
    targetSelector: string;
    title: string;
    description: string;
  } | null>(null);
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
        // Fetch profile
        supabase.from("profiles").select("*").eq("id", user.id).single().then(({
          data
        }) => setProfile(data));

        // Check if user is admin
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
  const handleShowWalkthrough = () => {
    localStorage.removeItem('has-seen-walkthrough');
    handleGetSuggestion();
  };
  const handleGetSuggestion = async () => {
    setLoadingSuggestion(true);
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
      if (error) {
        console.error('Error getting suggestion:', error);

        // Provide specific error messages
        if (error.message?.includes('authenticated')) {
          toast.error("Authentication error. Please try logging out and back in.");
        } else {
          toast.error("Failed to get suggestion. Please try again.");
        }
        return;
      }
      if (data.error) {
        console.error('Error from function:', data.error);
        toast.error(data.error);
        return;
      }

      // Check if this is the first time clicking
      const hasSeenWalkthrough = localStorage.getItem('has-seen-walkthrough');
      if (!hasSeenWalkthrough && data.context) {
        // Build walkthrough steps from context
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
      } else {
        // Show regular suggestion dialog
        setSuggestion(data.suggestion);
        setSuggestionNextAction(data.nextAction || null);
        setSuggestionOpen(true);
      }
    } catch (error: any) {
      console.error('Error getting suggestion:', error);
      toast.error(error.message || 'Failed to get suggestion');
    } finally {
      setLoadingSuggestion(false);
    }
  };
  const handleWalkthroughAction = (route?: string, targetSelector?: string, tourTitle?: string, tourDescription?: string) => {
    setWalkthroughOpen(false);
    if (route) {
      // Navigate first
      if (route !== location.pathname) {
        navigate(route);
      }

      // Show guided tour if target element specified
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
  const handleNavigateToAction = () => {
    if (!suggestionNextAction) return;
    setSuggestionOpen(false);
    const {
      route,
      targetSelector
    } = suggestionNextAction;

    // Navigate if on different route
    if (route !== location.pathname) {
      navigate(route);
    }

    // If there's a target element, scroll to it and highlight
    if (targetSelector) {
      setTimeout(() => {
        const element = document.querySelector(targetSelector);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          // Add pulse animation
          element.classList.add('animate-pulse');
          setTimeout(() => element.classList.remove('animate-pulse'), 2000);
        }
      }, route !== location.pathname ? 500 : 100);
    }
  };
  const tabItems = [{
    path: "/planning",
    icon: Lightbulb,
    label: "AD PLANNER",
    lightColor: "tab-orange-light",
    darkColor: "tab-orange-dark"
  }, {
    path: "/creative",
    icon: Palette,
    label: "CREATIVE",
    lightColor: "tab-pink-light",
    darkColor: "tab-pink-dark"
  }, {
    path: "/data",
    icon: BarChart3,
    label: "PERFORMANCE",
    lightColor: "tab-cream-light",
    darkColor: "tab-cream-dark"
  }];
  if (!user) return null;
  return <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img alt="Your Ad Assistant" className="h-12 md:h-24 object-contain" src="/lovable-uploads/82f0195b-d6a7-443a-a86e-a18f8721ac42.png" />
            </div>

            <div className="flex items-center space-x-3">
              <Button onClick={() => navigate("/campaigns")} className="bg-tab-pink-dark hover:bg-tab-pink-dark/90 text-white font-semibold border border-tab-black">
                <FolderKanban className="mr-2 h-4 w-4" />
                My Campaigns
              </Button>
              <Button onClick={() => navigate("/production")} variant="outline" className="font-semibold border-2">
                <Clipboard className="mr-2 h-4 w-4" />
                Production
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

          {/* Folder Tab Navigation */}
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
            
            <Button variant="ghost" onClick={handleGetSuggestion} disabled={loadingSuggestion} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors group mb-2">
              {loadingSuggestion ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </> : <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse group-hover:text-primary" />
                  What's next?
                </>}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">{children}</main>

      {/* AI Suggestion Dialog */}
      <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your Next Best Action
            </DialogTitle>
            <DialogDescription className="pt-4 text-base text-foreground">
              {suggestion}
            </DialogDescription>
          </DialogHeader>
          {suggestionNextAction && <DialogFooter>
              <Button onClick={handleNavigateToAction} className="w-full">
                <ArrowRight className="mr-2 h-4 w-4" />
                {suggestionNextAction.buttonText}
              </Button>
            </DialogFooter>}
        </DialogContent>
      </Dialog>

      {/* Onboarding Walkthrough */}
      {walkthroughOpen && <OnboardingWalkthrough steps={walkthroughSteps} onClose={() => setWalkthroughOpen(false)} onActionClick={handleWalkthroughAction} />}

      {/* Guided Tour */}
      {tourActive && tourConfig && <GuidedTour targetSelector={tourConfig.targetSelector} title={tourConfig.title} description={tourConfig.description} onClose={() => {
      setTourActive(false);
      setTourConfig(null);
    }} />}
    </div>;
}