import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, LayoutTemplate, Ticket, BarChart3 } from "lucide-react";

const adminTabs = [
  { path: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
  { path: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { path: "/admin/invite-codes", label: "Invite Codes", icon: Ticket },
  { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = adminTabs.find(tab => location.pathname === tab.path)?.path || adminTabs[0].path;

  return (
    <Tabs value={currentTab} onValueChange={(value) => navigate(value)} className="mb-6">
      <TabsList>
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
