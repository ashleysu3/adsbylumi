import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FolderKanban, Sparkles, BarChart3, Library, Building2, BookOpen, Settings, Shield, LogOut, Package, Link2, LifeBuoy, Plus, CheckCircle2, AlertTriangle, Gift, Wrench, TrendingUp, Lock, Palette } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { BrandSelector } from "@/components/BrandSelector";
import { SparkleIcon } from "@/components/SparkleIcon";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { useBrand } from "@/contexts/BrandContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const createNav = [
  { path: "/campaigns", icon: FolderKanban, label: "My Campaigns", tooltip: "See and manage all your ads" },
  { path: "/creative-studio", icon: Sparkles, label: "Creative Studio", tooltip: "Build your ad angles, copy, and creative briefs" },
  { path: "/content-library", icon: Library, label: "Concept Library", tooltip: "Browse your saved ad concepts" },
  { path: "/creative-toolkit", icon: Wrench, label: "Creative Toolkit", tooltip: "Templates, B-roll ideas, music, and production tools" },
  
];

const brandNav = [
  { path: "/dashboard", icon: Building2, label: "Brand Details", tooltip: "Your brand info and settings" },
  { path: "/offers", icon: Package, label: "What I'm Promoting", tooltip: "Add and manage your offers and services" },
];

interface AppSidebarProps {
  isAdmin: boolean;
  brandId?: string;
}

export function AppSidebar({ isAdmin, brandId }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { openChat, unreadCount } = useLumiAssistant();
  const { activeBrand } = useBrand();
  const { isSubscribed, isLoading: subLoading } = useSubscription();
  const [hasCampaigns, setHasCampaigns] = useState(false);
  const [metaStatus, setMetaStatus] = useState<'connected' | 'expired' | 'disconnected'>('disconnected');
  const [hasRedAlert, setHasRedAlert] = useState(false);

  // Lightweight check for campaign count
  useEffect(() => {
    if (!brandId) return;
    supabase
      .from("campaign_workspaces")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .then(({ count }) => {
        setHasCampaigns((count ?? 0) > 0);
      });
  }, [brandId]);

  // Check Meta connection status
  useEffect(() => {
    const effectiveBrandId = activeBrand?.id || brandId;
    if (!effectiveBrandId) {
      setMetaStatus('disconnected');
      return;
    }
    supabase
      .from("brands")
      .select("meta_account_id, meta_token_expires_at")
      .eq("id", effectiveBrandId)
      .single()
      .then(({ data }) => {
        if (!data?.meta_account_id) {
          setMetaStatus('disconnected');
        } else if (data.meta_token_expires_at && new Date(data.meta_token_expires_at) < new Date()) {
          setMetaStatus('expired');
        } else {
          setMetaStatus('connected');
        }
      });
  }, [brandId, activeBrand]);

  // Check for red-status campaigns in latest report
  useEffect(() => {
    const effectiveBrandId = activeBrand?.id || brandId;
    if (!effectiveBrandId) return;

    supabase
      .from("optimization_reports")
      .select("id, report_data")
      .eq("brand_id", effectiveBrandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) { setHasRedAlert(false); return; }
        const reportData = (data.report_data || []) as any[];
        const hasRed = reportData.some((c: any) => c.status === 'red');
        if (!hasRed) { setHasRedAlert(false); return; }
        const reviewedKey = `lumi_last_reviewed_report_${effectiveBrandId}`;
        const lastReviewed = localStorage.getItem(reviewedKey);
        setHasRedAlert(lastReviewed !== data.id);
      });
  }, [brandId, activeBrand]);

  // Mark as reviewed when visiting ad-performance
  useEffect(() => {
    const effectiveBrandId = activeBrand?.id || brandId;
    if (location.pathname === '/ad-performance' && effectiveBrandId && hasRedAlert) {
      supabase
        .from("optimization_reports")
        .select("id")
        .eq("brand_id", effectiveBrandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data) {
            localStorage.setItem(`lumi_last_reviewed_report_${effectiveBrandId}`, data.id);
            setHasRedAlert(false);
          }
        });
    }
  }, [location.pathname, activeBrand, brandId, hasRedAlert]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const MetaStatusIcon = () => {
    if (metaStatus === 'connected') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    }
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  };

  const metaTooltip = metaStatus === 'disconnected' || metaStatus === 'expired'
    ? "Action needed: Connect your Meta account to publish ads"
    : "Meta Connection";

  return (
    <Sidebar collapsible="icon">
      {/* Header: Logo + Brand Selector */}
      <SidebarHeader className="p-3 pb-2">
        <div className="flex items-center gap-2 min-h-[40px]">
          <img
            alt="Lumi"
            className="h-8 w-auto object-contain flex-shrink-0 cursor-pointer"
            src={lumiLogo}
            onClick={() => navigate("/start")}
          />
          {!collapsed && (
            <BrandSelector className="ml-auto" compact />
          )}
        </div>

        {/* Action Button */}
        <div className="mt-3 space-y-2">
          <button
            onClick={() => !subLoading && isSubscribed ? navigate("/create") : navigate("/auth")}
            className="w-full relative group overflow-hidden rounded-xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 opacity-90 group-hover:opacity-100 transition-opacity" />
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative flex items-center justify-center gap-2 py-2.5 px-3 text-white font-semibold text-sm">
              {!subLoading && !isSubscribed ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {!collapsed && <span>{!subLoading && !isSubscribed ? "Upgrade to Create" : "Create a New Ad"}</span>}
            </span>
          </button>

          <button
            onClick={() => navigate("/ad-performance")}
            className="w-full relative group overflow-hidden rounded-xl"
          >
            <div className={`absolute inset-0 transition-opacity ${
              isActive("/ad-performance")
                ? "bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 opacity-100"
                : "bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 opacity-70 group-hover:opacity-90"
            }`} />
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative flex items-center justify-center gap-2 py-2.5 px-3 text-white font-semibold text-sm">
              <span className="relative">
                <BarChart3 className="h-4 w-4" />
                {hasRedAlert && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                )}
              </span>
              {!collapsed && <span>Ad Performance</span>}
            </span>
          </button>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Main Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Create</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {createNav.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild tooltip={item.tooltip}>
                    <NavLink
                      to={item.path}
                      end
                      className="transition-all duration-200"
                      activeClassName="bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-md shadow-lumi-pink-1/20 font-semibold [&>svg]:text-white"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel>My Brand</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {brandNav.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild tooltip={item.tooltip}>
                    <NavLink
                      to={item.path}
                      end
                      className="transition-all duration-200"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {/* Meta Connection with status indicator */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={metaTooltip}>
                  <NavLink
                    to="/meta-settings"
                    end
                    className="transition-all duration-200"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <div className="relative">
                      <Link2 className="h-4 w-4" />
                      {(metaStatus === 'disconnected' || metaStatus === 'expired') && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[hsl(var(--lumi-orange-1))] animate-pulse" />
                      )}
                    </div>
                    {!collapsed && (
                      <span className="flex items-center gap-2 flex-1">
                        Meta Connection
                        <MetaStatusIcon />
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Account */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink
                    to="/settings"
                    end
                    className="transition-all duration-200"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Learn advertising terms and concepts">
                  <NavLink
                    to="/glossary"
                    end
                    className="transition-all duration-200"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <BookOpen className="h-4 w-4" />
                    {!collapsed && <span>Ad Glossary</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Share LUMI and earn $40 per referral">
                  <NavLink
                    to="/refer"
                    end
                    className="transition-all duration-200"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <Gift className="h-4 w-4" />
                    {!collapsed && <span>Refer & Earn</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Admin">
                    <NavLink
                      to="/admin/users"
                      className="transition-all duration-200 text-amber-600 dark:text-amber-400"
                      activeClassName="bg-amber-500/10 font-medium"
                    >
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Ask Lumi + Sign Out */}
      <SidebarFooter className="p-3 pt-2 space-y-2">
        <button
          onClick={openChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                     bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1
                     text-white font-medium text-sm
                     shadow-md shadow-lumi-pink-1/20 hover:shadow-lg hover:shadow-lumi-pink-1/30
                     transition-all relative group"
        >
          <SparkleIcon size="xs" state="idle" className="group-hover:animate-pulse flex-shrink-0" />
          {!collapsed && <span>Ask Lumi</span>}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-white text-lumi-pink-1 rounded-full flex items-center justify-center text-[10px] font-bold shadow">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
