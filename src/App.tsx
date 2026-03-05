import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { LumiProvider } from "@/contexts/LumiContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { LumiAssistantProvider } from "@/components/LumiAssistant";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { GlobalAnnouncementBanner } from "@/components/GlobalAnnouncementBanner";
import SplashScreen from "@/components/SplashScreen";
import { FloatingBugButton } from "@/components/FloatingBugButton";
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
import AdminBugReports from "./pages/admin/BugReports";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import AdminTeam from "./pages/admin/Team";
import Settings from "./pages/Settings";
import MetaSettings from "./pages/MetaSettings";
import WeeklyDigestPreview from "./pages/WeeklyDigestPreview";
import Pricing from "./pages/Pricing";
import Offers from "./pages/Offers";
import ContentLibrary from "./pages/ContentLibrary";
import CreativeStudio from "./pages/CreativeStudio";
import Glossary from "./pages/Glossary";
import NotFound from "./pages/NotFound";
import AdvancedBuild from "./pages/AdvancedBuild";
import BetaFeedback from "./pages/BetaFeedback";
import PerformanceHistory from "./pages/PerformanceHistory";
import PastReports from "./pages/PastReports";
import Partners from "./pages/Partners";
import Refer from "./pages/Refer";
import AdminAffiliates from "./pages/admin/Affiliates";

function CreativeRedirect() {
  const location = useLocation();
  return <Navigate to={`/creative-studio${location.search}`} replace />;
}
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
            <ImpersonationProvider>
              <BrandProvider>
              <SplashScreen isVisible={showSplash} />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <LumiAssistantProvider>
                  <GlobalAnnouncementBanner />
                  <ImpersonationBanner />
                  <FloatingBugButton />
                <Routes>
                  <Route path="/" element={<Sales />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/start" element={<Start />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/planning" element={<Navigate to="/campaigns" replace />} />
                  <Route path="/creative" element={<CreativeRedirect />} />
                  <Route path="/data" element={<Data />} />
                  <Route path="/production" element={<Navigate to="/campaigns" replace />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/workspace/:workspaceId" element={<WorkspaceRedirect />} />
                  <Route path="/campaigns/build" element={<CampaignBuilder />} />
                  <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
                  <Route path="/meta-callback" element={<MetaOAuthCallback />} />
                  <Route path="/settings" element={<Settings />} />
   <Route path="/meta-settings" element={<MetaSettings />} />
   <Route path="/settings/meta" element={<Navigate to="/meta-settings" replace />} />
                  <Route path="/settings/digest-preview" element={<WeeklyDigestPreview />} />
                  <Route path="/content-library" element={<ContentLibrary />} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/creative-studio" element={<CreativeStudio />} />
                  <Route path="/glossary" element={<Glossary />} />
                  <Route path="/advanced-build" element={<AdvancedBuild />} />
                  <Route path="/beta-feedback" element={<BetaFeedback />} />
                  <Route path="/performance-history" element={<PerformanceHistory />} />
                  <Route path="/past-reports" element={<PastReports />} />
                  <Route path="/partners" element={<Partners />} />
                  <Route path="/refer" element={<Refer />} />
                  <Route path="/admin/knowledge" element={<AdminKnowledge />} />
                  <Route path="/admin/affiliates" element={<AdminAffiliates />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/templates" element={<AdminTemplates />} />
                  <Route path="/admin/invite-codes" element={<AdminInviteCodes />} />
                  <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                  <Route path="/admin/bug-reports" element={<AdminBugReports />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/team" element={<AdminTeam />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LumiAssistantProvider>
            </BrowserRouter>
          </BrandProvider>
        </ImpersonationProvider>
      </LumiProvider>
    </SubscriptionProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
