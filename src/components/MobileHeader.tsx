import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
 import { Shield, LogOut, Library, Settings, Building2, BookOpen, Home } from "lucide-react";
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

        <div className="flex items-center gap-2">
          {/* Admin Button - Only visible to admins */}
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/admin/users")}
              className="h-10 w-10 rounded-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
            >
              <Shield className="h-5 w-5" />
            </Button>
          )}

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
            <DropdownMenuItem onClick={() => navigate("/start")} className="min-h-[44px]">
              <Home className="mr-3 h-4 w-4" />
              Home
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/dashboard")} className="min-h-[44px]">
              <Building2 className="mr-3 h-4 w-4" />
              My Brand
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/content-library")} className="min-h-[44px]">
              <Library className="mr-3 h-4 w-4" />
              Concept Library
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} className="min-h-[44px]">
              <Settings className="mr-3 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/glossary")} className="min-h-[44px]">
              <BookOpen className="mr-3 h-4 w-4" />
              Ads Glossary
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="min-h-[44px] text-destructive">
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
