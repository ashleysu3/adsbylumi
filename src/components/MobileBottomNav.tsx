import { Link, useLocation } from "react-router-dom";
import { Home, FolderKanban, BarChart3, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/start", icon: Home, label: "Home", tourId: "start" },
  { path: "/campaigns", icon: FolderKanban, label: "My Ads", tourId: "campaigns" },
  { path: "/creative-studio", icon: Palette, label: "Creative Studio", tourId: "creative" },
  { path: "/data", icon: BarChart3, label: "Results", tourId: "results" },
];

export function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/start") {
      return location.pathname === "/start" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-stretch justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              data-tour={item.tourId}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[64px] touch-target transition-colors",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground active:text-primary"
              )}
            >
              <div className={cn(
                "relative p-1.5 rounded-xl transition-all",
                active && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "h-5 w-5 transition-transform",
                  active && "scale-110"
                )} />
                {active && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-none",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
