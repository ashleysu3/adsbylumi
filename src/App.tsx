import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { LumiProvider } from "@/contexts/LumiContext";
import { LumiAssistantProvider } from "@/components/LumiAssistant";
import SplashScreen from "@/components/SplashScreen";
import Index from "./pages/Index";
import Sales from "./pages/Sales";
import Waitlist from "./pages/Waitlist";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Start from "./pages/Start";
import Create from "./pages/Create";
import Planning from "./pages/Planning";
import Creative from "./pages/Creative";
import Data from "./pages/Data";
import Production from "./pages/Production";
import WorkspaceRedirect from "./pages/WorkspaceRedirect";
import CampaignBuilder from "./pages/CampaignBuilder";
import Campaigns from "./pages/Campaigns";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import AdminKnowledge from "./pages/admin/Knowledge";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminTemplates from "./pages/admin/Templates";
import AdminInviteCodes from "./pages/admin/InviteCodes";
import AdminSubscriptions from "./pages/admin/Subscriptions";
import Settings from "./pages/Settings";
import MetaSettings from "./pages/MetaSettings";
import WeeklyDigestPreview from "./pages/WeeklyDigestPreview";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash for 2 seconds on initial load
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SubscriptionProvider>
          <LumiProvider>
            <SplashScreen isVisible={showSplash} />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <LumiAssistantProvider>
                <Routes>
                  <Route path="/" element={<Sales />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/start" element={<Start />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/planning" element={<Planning />} />
                  <Route path="/creative" element={<Creative />} />
                  <Route path="/data" element={<Data />} />
                  <Route path="/production" element={<Production />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/workspace/:workspaceId" element={<WorkspaceRedirect />} />
                  <Route path="/campaigns/build" element={<CampaignBuilder />} />
                  <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/meta" element={<MetaSettings />} />
                  <Route path="/settings/digest-preview" element={<WeeklyDigestPreview />} />
                  <Route path="/admin/knowledge" element={<AdminKnowledge />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/templates" element={<AdminTemplates />} />
                  <Route path="/admin/invite-codes" element={<AdminInviteCodes />} />
                  <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LumiAssistantProvider>
            </BrowserRouter>
          </LumiProvider>
        </SubscriptionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
