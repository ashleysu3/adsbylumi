import { useEffect, useState, FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Target,
  Palette,
  Tag,
  Plug,
  Building2,
  LifeBuoy,
  ChevronDown,
  Activity,
  Loader2,
  Plus,
  Lightbulb,
  Images,
  Wrench,
  Package,
  Mic,
  Users,
  Link2,
  BookOpen,
  Flag,
  LayoutGrid,
  Paintbrush,
  HelpCircle,
  Settings as SettingsIcon,
  PenLine,
  Sparkles,
  Heart,
  CheckSquare,
  Gift,
  CreditCard,
  Crown,
  Shield,
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

// NOTE: route mapping uses the EXISTING pages today.
// Items without a dedicated page link to a placeholder (// TODO).
const groups: NavGroup[] = [
  {
    key: "ads",
    label: "Ad Management",
    icon: Target,
    emoji: "🎯",
    items: [
      { label: "Strategy", to: "/strategy", icon: Sparkles },
      { label: "Live Ads", to: "/ad-performance", icon: Activity },
      { label: "In Progress", to: "/campaigns", icon: Loader2 },
      { label: "Create New", to: "/create", icon: Plus },
    ],
  },
  {
    key: "creative",
    label: "Creative Studio",
    icon: Palette,
    emoji: "🎨",
    items: [
      { label: "Inspiration", to: "/boards", icon: Lightbulb },
      { label: "My Creative", to: "/creative-studio", icon: Images },
      { label: "Tools & Resources", to: "/creative-toolkit", icon: Wrench },
    ],
  },
  {
    key: "brand",
    label: "My Brand",
    icon: Tag,
    emoji: "🏷️",
    items: [
      
      { label: "Design Guide", to: "/style", icon: Paintbrush },
      // TODO: dedicated voice page — currently routes to placeholder.
      { label: "Voice + Examples", to: "/voice", icon: Mic },
      // TODO: dedicated audience page.
      { label: "Audience", to: "/audience", icon: Users },
      { label: "Offers", to: "/offers", icon: Package },
    ],
  },
  {
    key: "tech",
    label: "Tech + Data",
    icon: Plug,
    emoji: "🔌",
    items: [
      { label: "Meta Connection", to: "/meta-settings", icon: Link2 },
      { label: "Tracking", to: "/tracking-setup", icon: Activity },
      { label: "Ad Glossary", to: "/glossary", icon: BookOpen },
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

const supportGroup: NavGroup = {
  key: "support",
  label: "Support",
  icon: LifeBuoy,
  emoji: "🆘",
  items: [
    { label: "Report a bug", action: "bug-report", icon: LadybugIcon },
    // TODO: dedicated troubleshooting page.
    { label: "Troubleshooting", to: "/troubleshooting", icon: HelpCircle },
    { label: "Human Help", to: "/office-hours", icon: Users },
    { label: "Initial Setup", to: "/initial-setup", icon: PenLine },
  ],
};

interface AppSidebarProps {
  isAdmin: boolean;
  brandId?: string;
}

export function AppSidebar({ isAdmin: _isAdmin, brandId: _brandId }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAgencyUser } = useBrand();

  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [intent, setIntent] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    const handler = () => setBugReportOpen(true);
    window.addEventListener("open-bug-report", handler);
    return () => window.removeEventListener("open-bug-report", handler);
  }, []);

  const allGroups: NavGroup[] = [
    ...groups,
    ...(isAgencyUser ? [agencyGroup] : []),
    supportGroup,
  ];

  // Auto-expand the group containing the active route.
  const isItemActive = (item: NavItem) =>
    "to" in item && location.pathname === item.to;
  const activeGroupKey =
    allGroups.find((g) => g.items.some(isItemActive))?.key ?? "ads";

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
            <div className="mt-3">
              <IntentBar size="sm" innerBgClassName="bg-sidebar" />
            </div>
          )}
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
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

        <SidebarFooter className="p-2">
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
