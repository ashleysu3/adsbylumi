import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  BookOpen, LayoutTemplate, BarChart3, CreditCard, Bug, Users, Settings,
  Shield, Gift, DollarSign, Mail, XCircle, FileWarning, Star, Monitor, Wrench,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

interface AdminTab {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface AdminGroup {
  label: string;
  tabs: AdminTab[];
}

const adminGroups: AdminGroup[] = [
  {
    label: "Users & Access",
    tabs: [
      { path: "/admin/users", label: "Users", icon: Users },
      { path: "/admin/team", label: "Team", icon: Shield },
      { path: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
    ],
  },
  {
    label: "Billing",
    tabs: [
      { path: "/admin/stripe", label: "Stripe", icon: DollarSign },
      { path: "/admin/cancellations", label: "Cancellations", icon: XCircle },
      { path: "/admin/dispute-evidence", label: "Disputes", icon: FileWarning },
    ],
  },
  {
    label: "Content",
    tabs: [
      { path: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
      { path: "/admin/templates", label: "Templates", icon: LayoutTemplate },
      { path: "/admin/creative-toolkit", label: "Creative Toolkit", icon: Wrench },
    ],
  },
  {
    label: "Support",
    tabs: [
      { path: "/admin/bug-reports", label: "Bug Reports", icon: Bug },
      { path: "/admin/reviews", label: "Reviews", icon: Star },
      { path: "/admin/email-logs", label: "Email Logs", icon: Mail },
      { path: "/admin/affiliates", label: "Affiliates", icon: Gift },
    ],
  },
  {
    label: "System",
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

  // Find which group the current path belongs to
  const activeGroupIndex = adminGroups.findIndex(g =>
    g.tabs.some(t => location.pathname === t.path)
  );

  const [openGroup, setOpenGroup] = useState<number>(activeGroupIndex >= 0 ? activeGroupIndex : 0);

  return (
    <div className="mb-6 space-y-1">
      {adminGroups.map((group, gi) => {
        const isOpen = openGroup === gi;
        const hasActive = group.tabs.some(t => location.pathname === t.path);

        return (
          <div key={group.label}>
            <button
              onClick={() => setOpenGroup(isOpen ? -1 : gi)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors",
                hasActive
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {group.label}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
              <div className="flex flex-wrap gap-1 px-1 py-1.5">
                {group.tabs.map((tab) => {
                  const isActive = location.pathname === tab.path;
                  return (
                    <button
                      key={tab.path}
                      onClick={() => navigate(tab.path)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-background text-foreground shadow-sm border border-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
