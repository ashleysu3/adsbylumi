import { useEffect, useState } from "react";
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
  LogOut,
  Search,
  X,
} from "lucide-react";
import { LadybugIcon } from "@/components/LadybugIcon";
import { IntentBar } from "@/components/IntentBar";
import { BugReportModal } from "@/components/BugReportModal";
import { BrandSelector } from "@/components/BrandSelector";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// AppTopBar — the desktop shell navigation.
//
// Replaces the old left sidebar. The app really only has one home (the Ad
// Dashboard) plus a small creative toolkit, so a full-height sidebar was
// spending 260px to show three links. Everything named stays visible; only
// account + support hides behind the cog.
//
//   [LUMI]  Ad Dashboard  Creative ▾  My Tasks   [ ask LUMI ]  [+ Create]  🔔 ⚙
// ============================================================================

type MenuItem =
  | { label: string; to: string; icon: any }
  | { label: string; action: "bug-report"; icon: any };

const creativeItems: MenuItem[] = [
  { label: "The Lab", to: "/creative-studio?mode=lab", icon: Sparkles },
  { label: "My Creatives", to: "/my-creatives", icon: Images },
  { label: "Tools & Resources", to: "/creative-toolkit", icon: Wrench },
];

const brandItems: MenuItem[] = [
  { label: "Initial Setup", to: "/initial-setup", icon: PenLine },
  { label: "Style", to: "/style", icon: Paintbrush },
  { label: "Voice + Examples", to: "/voice", icon: Mic },
  { label: "Audience", to: "/audience", icon: Users },
  { label: "Offers", to: "/offers", icon: Package },
];

const agencyItems: MenuItem[] = [
  { label: "Manage All Accounts", to: "/ads-manager", icon: LayoutGrid },
  { label: "Agency Settings", to: "/agency-settings", icon: SettingsIcon },
];

const helpItems: MenuItem[] = [
  { label: "Meta Connection", to: "/meta-settings", icon: Link2 },
  { label: "Tracking", to: "/tracking-setup", icon: Activity },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
  { label: "Ad Glossary", to: "/glossary", icon: BookOpen },
  { label: "Troubleshooting", to: "/troubleshooting", icon: HelpCircle },
  { label: "Human Help", to: "/office-hours", icon: Users },
  { label: "Report a bug", action: "bug-report", icon: LadybugIcon },
];

interface AppTopBarProps {
  isAdmin: boolean;
}

export function AppTopBar({ isAdmin }: AppTopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAgencyUser } = useBrand();

  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [hasVipBonuses, setHasVipBonuses] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.email) setUserEmail(user.email);
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

  const isCreativeRoute = creativeItems.some(
    (i) => "to" in i && location.pathname === i.to.split("?")[0],
  );
  const isDashboard = location.pathname === "/studio";

  const go = (item: MenuItem) => {
    if ("action" in item) setBugReportOpen(true);
    else navigate(item.to);
  };

  const renderMenuGroup = (label: string, items: MenuItem[]) => (
    <div key={label}>
      <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </DropdownMenuLabel>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <DropdownMenuItem
            key={`${label}-${item.label}`}
            className="gap-2"
            onSelect={() => go(item)}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
    </div>
  );

  const tabClass = (active: boolean) =>
    cn(
      "h-9 px-3.5 rounded-full text-sm font-semibold tracking-tight inline-flex items-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-card text-foreground shadow-sm ring-1 ring-border"
        : "text-muted-foreground hover:text-foreground hover:bg-card/70",
    );

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 h-14 flex items-center gap-2">
          {/* Logo → dashboard */}
          <button
            type="button"
            onClick={() => navigate("/studio")}
            className="shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ad Dashboard"
            title="Ad Dashboard"
          >
            <img src={lumiLogo} alt="LUMI" className="h-8 w-auto object-contain" />
          </button>

          {/* Named destinations — one soft segmented group */}
          <nav className="ml-2 flex items-center gap-1 shrink-0 rounded-full bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => navigate("/studio")}
              className={tabClass(isDashboard)}
            >
              <LayoutGrid className={cn("h-4 w-4", isDashboard && "text-lumi-purple-1")} />
              <span className="hidden sm:inline">Ad Dashboard</span>
            </button>

            {/* Creative Studio folds into the cog on narrow screens */}
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={tabClass(isCreativeRoute)}>
                    <Palette
                      className={cn("h-4 w-4", isCreativeRoute && "text-lumi-pink-1")}
                    />
                    <span>Creative Studio</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {creativeItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        className="gap-2"
                        onSelect={() => go(item)}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>

          <div className="flex-1 min-w-0" />

          {/* The one dopamine action */}
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="shrink-0 rounded-full bg-[image:var(--gradient-lumi)] text-white shadow-md px-4 h-9 inline-flex items-center gap-2 text-sm font-semibold tracking-tight transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create a new ad</span>
          </button>

          {/* Ask LUMI — collapsed to a magnifying glass until opened */}
          <div className="shrink-0 hidden md:flex items-center justify-end">
            {searchOpen ? (
              <div className="flex items-center gap-1 w-[min(28rem,40vw)]">
                <div className="flex-1 min-w-0">
                  <IntentBar size="sm" innerBgClassName="bg-card" />
                </div>
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setSearchOpen(false)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Ask LUMI"
                title="Ask LUMI"
                onClick={() => setSearchOpen(true)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-1">


            {/* Quiet: account, brand, agency, support, admin */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account settings"
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 max-h-[80vh] overflow-y-auto">
                {isAdmin && (
                  <>
                    <DropdownMenuItem className="gap-2" onSelect={() => navigate("/admin/users")}>
                      <Shield className="h-4 w-4" />
                      <span>Admin Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isPartner && (
                  <>
                    <DropdownMenuItem className="gap-2" onSelect={() => navigate("/partner-portal")}>
                      <Briefcase className="h-4 w-4" />
                      <span>Partner Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {hasVipBonuses && (
                  <>
                    <DropdownMenuItem className="gap-2" onSelect={() => navigate("/refer")}>
                      <Crown className="h-4 w-4" />
                      <span>VIP Bonuses</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Shown here only when the Creative tab is hidden by width */}
                <div className="xl:hidden">{renderMenuGroup("Creative", creativeItems)}</div>

                {renderMenuGroup("My Brand", brandItems)}
                {isAgencyUser && renderMenuGroup("Agency", agencyItems)}
                {renderMenuGroup("Help & Settings", helpItems)}

                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => navigate("/settings?tab=billing")}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Billing &amp; plan</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => navigate("/refer")}>
                  <Gift className="h-4 w-4" />
                  <span>Refer &amp; earn</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => navigate("/review")}>
                  <Heart className="h-4 w-4 text-lumi-pink-1" />
                  <span>loving LUMI?!</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={async () => {
                    await supabase.auth.signOut();
                    toast.success("Signed out");
                    navigate("/auth");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <BrandSelector className="shrink-0 hidden lg:flex" compact showName />
          </div>
        </div>
      </header>

      <BugReportModal
        open={bugReportOpen}
        onOpenChange={setBugReportOpen}
        context={location.pathname}
        userEmail={userEmail}
      />
    </>
  );
}
