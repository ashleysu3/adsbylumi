import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Shield, LogOut, LayoutTemplate, Ticket, BarChart3, Sparkles, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import lumiLogo from "@/assets/lumi-logo.png";

interface MobileHeaderProps {
  user: any;
  profile: any;
  isAdmin?: boolean;
  onShowWalkthrough?: () => void;
}

export function MobileHeader({ user, profile, isAdmin, onShowWalkthrough }: MobileHeaderProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <img 
          alt="Lumi" 
          className="h-8 object-contain cursor-pointer" 
          src={lumiLogo}
          onClick={() => navigate("/start")}
        />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 touch-target">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-card z-50">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {isAdmin && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/admin/knowledge")} className="min-h-[44px]">
                  <Shield className="mr-3 h-4 w-4" />
                  Knowledge Base
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/templates")} className="min-h-[44px]">
                  <LayoutTemplate className="mr-3 h-4 w-4" />
                  Campaign Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/invite-codes")} className="min-h-[44px]">
                  <Ticket className="mr-3 h-4 w-4" />
                  Invite Codes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/subscriptions")} className="min-h-[44px]">
                  <CreditCard className="mr-3 h-4 w-4" />
                  Subscriptions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/analytics")} className="min-h-[44px]">
                  <BarChart3 className="mr-3 h-4 w-4" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            {onShowWalkthrough && (
              <DropdownMenuItem onClick={onShowWalkthrough} className="min-h-[44px]">
                <Sparkles className="mr-3 h-4 w-4" />
                Show Walkthrough
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="min-h-[44px] text-destructive">
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
