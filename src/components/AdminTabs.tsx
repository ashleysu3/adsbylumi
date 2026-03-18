import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, LayoutTemplate, Ticket, BarChart3, CreditCard, Bug, Users, Settings, Shield, Gift, DollarSign, Mail, XCircle, FileWarning } from "lucide-react";

const adminTabs = [
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/team", label: "Team", icon: Shield },
  { path: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { path: "/admin/stripe", label: "Stripe", icon: DollarSign },
  { path: "/admin/cancellations", label: "Cancellations", icon: XCircle },
  { path: "/admin/dispute-evidence", label: "Disputes", icon: FileWarning },
  { path: "/admin/bug-reports", label: "Bug Reports", icon: Bug },
  { path: "/admin/affiliates", label: "Affiliates", icon: Gift },
  { path: "/admin/email-logs", label: "Email Logs", icon: Mail },
  { path: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
  { path: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { path: "/admin/invite-codes", label: "Invite Codes", icon: Ticket },
  { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = adminTabs.find(tab => location.pathname === tab.path)?.path || adminTabs[0].path;

  return (
    <Tabs value={currentTab} onValueChange={(value) => navigate(value)} className="mb-6">
      <TabsList className="flex-wrap h-auto gap-1">
        {adminTabs.map((tab) => (
          <TabsTrigger key={tab.path} value={tab.path} className="gap-2">
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
