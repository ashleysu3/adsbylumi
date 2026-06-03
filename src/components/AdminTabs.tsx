import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  BookOpen, LayoutTemplate, BarChart3, CreditCard, Bug, Users, Settings,
  Shield, Gift, DollarSign, Mail, XCircle, FileWarning, Star, Monitor, Wrench,
  ChevronDown, Palette, Tag, Inbox, Sparkles, Image as ImageIcon, CheckSquare,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";

interface AdminTab {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface AdminGroup {
  label: string;
  icon: React.ElementType;
  tabs: AdminTab[];
}

const adminGroups: AdminGroup[] = [
  {
    label: "Users & Access",
    icon: Users,
    tabs: [
      { path: "/admin/users", label: "Users", icon: Users },
      { path: "/admin/team", label: "Team", icon: Shield },
      { path: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
    ],
  },
  {
    label: "Billing",
    icon: DollarSign,
    tabs: [
      { path: "/admin/stripe", label: "Stripe", icon: DollarSign },
      { path: "/admin/payouts", label: "Partner Payouts", icon: DollarSign },
      { path: "/admin/coupons", label: "Coupons", icon: Tag },
      { path: "/admin/cancellations", label: "Cancellations", icon: XCircle },
      { path: "/admin/dispute-evidence", label: "Disputes", icon: FileWarning },
    ],
  },
  {
    label: "Content",
    icon: BookOpen,
    tabs: [
      { path: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
      { path: "/admin/inspiration", label: "Inspiration Library", icon: ImageIcon },
      { path: "/admin/approvals", label: "Approvals", icon: CheckSquare },
      { path: "/admin/templates", label: "Templates", icon: LayoutTemplate },
      { path: "/admin/magic-templates", label: "Magic Templates", icon: Sparkles },
      { path: "/admin/strategies", label: "Strategies", icon: LayoutTemplate },
      { path: "/admin/creative-toolkit", label: "Creative Toolkit", icon: Wrench },
      { path: "/admin/overlay-templates", label: "Overlay Templates", icon: Palette },
      { path: "/admin/emails", label: "Emails", icon: Mail },
      { path: "/admin/updates", label: "Updates & Newsletter", icon: Mail },
      { path: "/admin/features", label: "Features Catalog", icon: Sparkles },
    ],
  },
  {
    label: "Support",
    icon: Bug,
    tabs: [
      { path: "/admin/bug-reports", label: "Bug Reports", icon: Bug },
      { path: "/admin/reviews", label: "Reviews", icon: Star },
      { path: "/admin/email-logs", label: "Email Logs", icon: Mail },
      { path: "/admin/affiliates", label: "Affiliates", icon: Gift },
      { path: "/admin/partner-applications", label: "Partner Applications", icon: Inbox },
      { path: "/admin/partners", label: "Partners", icon: Gift },
    ],
  },
  {
    label: "System",
    icon: Settings,
    tabs: [
      { path: "/admin/meta-debug", label: "Meta Debug", icon: Monitor },
      { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { path: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AdminTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeGroupIndex = adminGroups.findIndex(g =>
    g.tabs.some(t => location.pathname === t.path)
  );

  const [openGroup, setOpenGroup] = useState<number>(activeGroupIndex >= 0 ? activeGroupIndex : -1);

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {adminGroups.map((group, gi) => {
          const isOpen = openGroup === gi;
          const hasActive = group.tabs.some(t => location.pathname === t.path);
          const activeTab = group.tabs.find(t => location.pathname === t.path);
          const GroupIcon = group.icon;

          return (
            <Card
              key={group.label}
              onClick={() => setOpenGroup(isOpen ? -1 : gi)}
              className={cn(
                "cursor-pointer select-none px-4 py-3 transition-all hover:shadow-md",
                hasActive
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "hover:border-border/80"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <GroupIcon className={cn("h-4 w-4 shrink-0", hasActive ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold truncate", hasActive ? "text-foreground" : "text-muted-foreground")}>
                      {group.label}
                    </p>
                    {activeTab && (
                      <p className="text-[11px] text-primary truncate">{activeTab.label}</p>
                    )}
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Expanded dropdown for the open group */}
      {openGroup >= 0 && (
        <Card className="px-2 py-2">
          <div className="flex flex-wrap gap-1">
            {adminGroups[openGroup].tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
