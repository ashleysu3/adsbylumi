import { useEffect, useState, FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Palette,
  Tag,
  Plug,
  Building2,
  LifeBuoy,
  ChevronDown,
  Activity,
  Plus,
  Lightbulb,
  Images,
  Wrench,
  Package,
  Mic,
  Users,
  Link2,
  BookOpen,
  LayoutGrid,
  Paintbrush,
  HelpCircle,
  Settings as SettingsIcon,
  PenLine,
  Sparkles,
  Heart,
  Gift,
  CreditCard,
  Crown,
  Shield,
  Briefcase,
} from "lucide-react";
import { LadybugIcon } from "@/components/LadybugIcon";
import { IntentBar } from "@/components/IntentBar";
import { BugReportModal } from "@/components/BugReportModal";
import { NavLink } from "@/components/NavLink";
import { BrandSelector } from "@/components/BrandSelector";
import { RenderQueueBell } from "@/components/RenderQueueBell";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import lumiLogo from "@/assets/lumi-logo.png";
import { cn } from "@/lib/utils";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type NavItem =
  | { label: string; to: string; icon: any; tooltip?: string }
  | { label: string; action: "bug-report"; icon: any; tooltip?: string };

type NavGroup = {
  key: string;
  label: string;
  icon: any;
  emoji: string;
  items: NavItem[];
};

// The two primary actions. When the sidebar is expanded they render as the big
// buttons in the header; collapsed, they fall back to icon rows so they stay
// reachable in icon mode. Home lives on the LUMI logo.
const topActions: NavItem[] = [
  { label: "Create New", to: "/create", icon: Plus },
  { label: "My Ads", to: "/my-ads", icon: Activity },
];

// Two collapsible folders for the deeper work.
const groups: NavGroup[] = [
  {
    key: "brand",
    label: "My Brand",
    icon: Tag,
    emoji: "🏷️",
    items: [
      { label: "Initial Setup", to: "/initial-setup", icon: PenLine },
      { label: "Style", to: "/style", icon: Paintbrush },
      { label: "Voice + Examples", to: "/voice", icon: Mic },
      { label: "Audience", to: "/audience", icon: Users },
      { label: "Offers", to: "/offers", icon: Package },
    ],
  },
  {
    key: "creative",
    label: "Creative",
    icon: Palette,
    emoji: "🎨",
    items: [
      { label: "Inspiration", to: "/boards", icon: Lightbulb },
      { label: "The Lab", to: "/creative-studio?mode=lab", icon: Sparkles },
      { label: "My Creatives", to: "/my-creatives", icon: Images },
      { label: "Tools & Resources", to: "/creative-toolkit", icon: Wrench },
    ],
  },
];

const agencyGroup: NavGroup = {
  key: "agency",
  label: "Agency",
  icon: Building2,
  emoji: "🏢",
  items: [
    { label: "Manage All Accounts", to: "/ads-manager", icon: LayoutGrid },
    { label: "Agency Settings", to: "/agency-settings", icon: SettingsIcon },
  ],
};

// Everything technical / supportive lives in one quiet area at the bottom.
const helpGroup: NavGroup = {
  key: "help",
  label: "Help & Settings",
  icon: LifeBuoy,
  emoji: "🆘",
  items: [
    { label: "Meta Connection", to: "/meta-settings", icon: Link2 },
    { label: "Tracking", to: "/tracking-setup", icon: Activity },
    { label: "Settings", to: "/settings", icon: SettingsIcon },
    { label: "Ad Glossary", to: "/glossary", icon: BookOpen },
    { label: "Troubleshooting", to: "/troubleshooting", icon: HelpCircle },
    { label: "Human Help", to: "/office-hours", icon: Users },
    { label: "Report a bug", action: "bug-report", icon: LadybugIcon },
  ],
};


interface AppSidebarProps {
  isAdmin: boolean;
  brandId?: string;
}

export function AppSidebar({ isAdmin, brandId: _brandId }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAgencyUser } = useBrand();

  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [intent, setIntent] = useState("");
  const [hasVipBonuses, setHasVipBonuses] = useState(false);
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.email) setUserEmail(user.email);
      // VIP = has unused account credits (referral bonuses, comps, etc.)
      const { data: credits } = await supabase
        .from("account_credits")
        .select("id")
        .eq("user_id", user.id)
        .is("applied_at", null)
        .limit(1);
      setHasVipBonuses((credits?.length || 0) > 0);
      const { data: partner } = await supabase
        .from("partner_access_tokens")
        .select("id")
        .eq("partner_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      setIsPartner(!!partner);
    });
    const handler = () => setBugReportOpen(true);
    window.addEventListener("open-bug-report", handler);
    return () => window.removeEventListener("open-bug-report", handler);
  }, []);

  const allGroups: NavGroup[] = [
    ...groups,
    ...(isAgencyUser ? [agencyGroup] : []),
    helpGroup,
  ];

  // Auto-expand the group containing the active route.
  const isItemActive = (item: NavItem) =>
    "to" in item && location.pathname === item.to;
  const activeGroupKey =
    allGroups.find((g) => g.items.some(isItemActive))?.key ?? "";


  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    [activeGroupKey]: true,
  }));

  useEffect(() => {
    setOpenGroups((prev) =>
      prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }
    );
  }, [activeGroupKey]);

  const handleIntentSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: connect to AI intent router + task tray
    navigate("/create");
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    if ("action" in item && item.action === "bug-report") {
      return (
        <SidebarMenuItem key={item.label}>
          <SidebarMenuButton
            tooltip={item.label}
            onClick={() => setBugReportOpen(true)}
          >
            <Icon className="h-4 w-4" />
            {!collapsed && <span>{item.label}</span>}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }
    if ("to" in item) {
      return (
        <SidebarMenuItem key={item.label}>
          <SidebarMenuButton asChild tooltip={item.label}>
            <NavLink
              to={item.to}
              end
              className="transition-colors"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }
    return null;
  };

  return (
    <>
      <Sidebar collapsible="icon">
        {/* Header: Logo + Brand selector + bell */}
        <SidebarHeader className="p-3 pb-2">
          <div className="flex items-center gap-2 min-h-[40px]">
            <img
              alt="Lumi"
              className="h-8 w-auto object-contain flex-shrink-0 cursor-pointer"
              src={lumiLogo}
              title="Home"
              onClick={() => navigate("/home")}
            />
            {!collapsed && (
              <>
                <BrandSelector className="ml-auto" compact />
                <RenderQueueBell />
              </>
            )}
          </div>

          {/* "How can LUMI help today?" intent input */}
          {!collapsed && (
            <div className="mt-3 space-y-2">
              <IntentBar size="sm" innerBgClassName="bg-sidebar" />
              {/* The two things to do: make something, or check on it. */}
              <button
                type="button"
                onClick={() => navigate("/create")}
                className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring px-3 py-2.5 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-semibold tracking-tight">Create New</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/my-ads")}
                className="w-full rounded-lg border-2 border-lumi-purple-1/50 bg-lumi-purple-1/10 text-foreground hover:bg-lumi-purple-1/20 transition-colors px-3 py-2.5 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Activity className="h-4 w-4 text-lumi-purple-1" />
                <span className="text-sm font-semibold tracking-tight">My Ads</span>
              </button>
              {isPartner && (
                <button
                  type="button"
                  onClick={() => navigate("/partner-portal")}
                  className="w-full rounded-lg border border-border bg-card hover:bg-muted transition-colors px-3 py-2 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <Briefcase className="h-4 w-4" />
                  <span className="text-sm font-medium tracking-tight">Partner Dashboard</span>
                </button>
              )}
              {hasVipBonuses && (
                <button
                  type="button"
                  onClick={() => navigate("/refer")}
                  className="w-full rounded-lg border border-lumi-purple-1/40 bg-lumi-purple-1/10 text-foreground hover:bg-lumi-purple-1/20 transition-colors px-3 py-2 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <Crown className="h-4 w-4" />
                  <span className="text-sm font-medium tracking-tight">VIP Bonuses</span>
                </button>
              )}
            </div>
          )}
        </SidebarHeader>


        <SidebarSeparator />

        <SidebarContent>
          {/* Collapsed mode: the header buttons are hidden, so surface the two
              primary actions as icon rows instead. */}
          {collapsed && (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>{topActions.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </>
          )}

          {allGroups.map((group) => {

            const GroupIcon = group.icon;
            const isOpen = openGroups[group.key] ?? false;
            return (
              <SidebarGroup key={group.key}>
                <Collapsible
                  open={collapsed ? true : isOpen}
                  onOpenChange={(v) =>
                    setOpenGroups((p) => ({ ...p, [group.key]: v }))
                  }
                >
                  {!collapsed && (
                    <CollapsibleTrigger asChild>
                      <SidebarGroupLabel className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 my-1 h-auto bg-gradient-to-r from-lumi-orange-1/15 via-lumi-pink-1/15 to-lumi-purple-1/15 hover:from-lumi-orange-1/25 hover:via-lumi-pink-1/25 hover:to-lumi-purple-1/25 transition-colors font-display text-[13px] uppercase tracking-[0.12em] text-foreground">
                        <GroupIcon className="h-4 w-4" />
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            isOpen ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                  )}
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            );
          })}
        </SidebarContent>

        <SidebarFooter className="p-2 space-y-2">
          {!collapsed && (
            <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
              <button
                type="button"
                onClick={() => navigate("/refer")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Gift className="h-3 w-3" /> refer & earn
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings?tab=billing")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <CreditCard className="h-3 w-3" /> billing & plan
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate("/review")}
            className={cn(
              "group relative w-full overflow-hidden rounded-xl bg-[image:var(--gradient-lumi)] text-white shadow-md transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring",
              state === "collapsed" ? "p-2 flex items-center justify-center" : "px-3 py-2.5 flex items-center gap-2"
            )}
            aria-label="loving LUMI?!"
          >
            <Heart className="h-4 w-4 fill-white text-white animate-pulse" />
            {state !== "collapsed" && (
              <span className="text-sm font-medium tracking-tight">
                loving LUMI?!
              </span>
            )}
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/20 blur-md opacity-0 group-hover:opacity-100 group-hover:translate-x-[300%] transition-all duration-700" />
          </button>
          {isAdmin && !collapsed && (
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="w-full rounded-lg border border-amber-300/40 bg-amber-50/40 text-amber-700/80 dark:bg-amber-500/5 dark:text-amber-300/80 hover:bg-amber-100/60 dark:hover:bg-amber-500/15 transition-colors px-2.5 py-1.5 flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-ring text-[11px] font-medium tracking-tight"
            >
              <Shield className="h-3 w-3" />
              Admin Dashboard
            </button>
          )}
        </SidebarFooter>


      </Sidebar>
      <BugReportModal
        open={bugReportOpen}
        onOpenChange={setBugReportOpen}
        context={location.pathname}
        userEmail={userEmail}
      />
    </>
  );
}
