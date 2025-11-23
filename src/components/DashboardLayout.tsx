import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Home, Lightbulb, Palette, BarChart3, FolderKanban, Shield, LogOut, Settings, Clipboard, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
              <img alt="Your Ad Assistant" className="h-16" src="/lovable-uploads/a7a24c2a-2692-4a35-b5ea-17ffd8f9dd0a.png" />
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
            
            <Button 
              variant="ghost" 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors group mb-2"
            >
              <Sparkles className="mr-2 h-4 w-4 animate-pulse group-hover:text-primary" />
              Tell me what to do next
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">{children}</main>
    </div>;
}