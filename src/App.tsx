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
import { RenderQueueProvider } from "@/contexts/RenderQueueContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { GlobalAnnouncementBanner } from "@/components/GlobalAnnouncementBanner";
import { PartnerWelcomeModal } from "@/components/PartnerWelcomeModal";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import SplashScreen from "@/components/SplashScreen";

import Index from "./pages/Index";
import Sales from "./pages/Sales";
import Waitlist from "./pages/Waitlist";
import Auth from "./pages/Auth";
import Reactivate from "./pages/Reactivate";
import WelcomeBack from "./pages/WelcomeBack";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Start from "./pages/Start";
import Create from "./pages/Create";
import AdPerformance from "./pages/Data";
import WorkspaceRedirect from "./pages/WorkspaceRedirect";
import CampaignBuilder from "./pages/CampaignBuilder";

import Campaigns from "./pages/Campaigns";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import AdminKnowledge from "./pages/admin/Knowledge";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminTemplates from "./pages/admin/Templates";
import AdminCreativeToolkit from "./pages/admin/CreativeToolkit";
import AdminSubscriptions from "./pages/admin/Subscriptions";
import AdminBugReports from "./pages/admin/BugReports";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import AdminTeam from "./pages/admin/Team";
import AdminStripe from "./pages/admin/Stripe";
import AdminCoupons from "./pages/admin/Coupons";
import AdminUpdates from "./pages/admin/Updates";
import AdminUpdatesResults from "./pages/admin/UpdatesResults";
import { useReferralCapture } from "./hooks/useReferralCapture";

function ReferralCaptureMount() {
  useReferralCapture();
  return null;
}
import Settings from "./pages/Settings";
import MetaSettings from "./pages/MetaSettings";
import WeeklyDigestPreview from "./pages/WeeklyDigestPreview";

import Offers from "./pages/Offers";
import Style from "./pages/Style";
import ContentLibrary from "./pages/ContentLibrary";
import CreativeStudio from "./pages/CreativeStudio";
import Glossary from "./pages/Glossary";
import NotFound from "./pages/NotFound";
import AdvancedBuild from "./pages/AdvancedBuild";
import BetaFeedback from "./pages/BetaFeedback";
import Partners from "./pages/Partners";
import Refer from "./pages/Refer";
import PartnerDashboard from "./pages/PartnerDashboard";
import CreativeToolkit from "./pages/CreativeToolkit";
import TrendTranslator from "./pages/TrendTranslator";
import AdminAffiliates from "./pages/admin/Affiliates";
import AdminPartners from "./pages/admin/Partners";
import AdminEmailLogs from "./pages/admin/EmailLogs";
import AdminEmails from "./pages/admin/Emails";
import AdminCancellations from "./pages/admin/Cancellations";
import AdminDisputeEvidence from "./pages/admin/DisputeEvidence";
import ClientPortal from "./pages/ClientPortal";
import SharedReport from "./pages/SharedReport";
import AgencySettings from "./pages/AgencySettings";
import CancellationPolicy from "./pages/CancellationPolicy";
import Pricing from "./pages/Pricing";
import AdsManager from "./pages/AdsManager";
import AdsManagerClient from "./pages/AdsManagerClient";
import SubmitReview from "./pages/SubmitReview";
import AdminReviews from "./pages/admin/Reviews";
import AdminMetaDebug from "./pages/admin/MetaDebug";
import AdminOverlayTemplates from "./pages/admin/OverlayTemplates";
import FreeTrial from "./pages/FreeTrial";
import Welcome from "./pages/Welcome";
import BrandPatterns from "./pages/BrandPatterns";
import Retrospectives from "./pages/Retrospectives";
import RecommendedStrategy from "./pages/RecommendedStrategy";
import StrategyPlan from "./pages/StrategyPlan";
import AdminStrategies from "./pages/admin/Strategies";
import OfficeHours from "./pages/OfficeHours";
import PartnerPortal from "./pages/PartnerPortal";

function CreativeRedirect() {
  const location = useLocation();
  return <Navigate to={`/creative-studio${location.search}`} replace />;
}
const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ImpersonationProvider>
        <SubscriptionProvider>
          <LumiProvider>
              <BrandProvider>
              <RenderQueueProvider>
              <SplashScreen isVisible={showSplash} />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <LumiAssistantProvider>
                  <ReferralCaptureMount />
                  <GlobalAnnouncementBanner />
                  <ImpersonationBanner />
                  <PartnerWelcomeModal />
                  <WhatsNewModal />
                  
                  
                <Routes>
                  <Route path="/" element={<Sales />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reactivate/:token" element={<Reactivate />} />
                  <Route path="/welcome-back" element={<WelcomeBack />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/freetrial" element={<FreeTrial />} />
                  <Route path="/free-trial" element={<Navigate to="/freetrial" replace />} />
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/start" element={<Start />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/recommended-strategy" element={<RecommendedStrategy />} />
                  <Route path="/strategy-plan" element={<StrategyPlan />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/planning" element={<Navigate to="/campaigns" replace />} />
                  <Route path="/creative" element={<CreativeRedirect />} />
                  <Route path="/ad-performance" element={<AdPerformance />} />
                  <Route path="/data" element={<Navigate to="/ad-performance" replace />} />
                  <Route path="/performance" element={<Navigate to="/ad-performance" replace />} />
                  <Route path="/performance-history" element={<Navigate to="/ad-performance" replace />} />
                  <Route path="/past-reports" element={<Navigate to="/ad-performance" replace />} />
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
                  <Route path="/style" element={<Style />} />
                  <Route path="/creative-studio" element={<CreativeStudio />} />
                  <Route path="/brand/patterns" element={<Navigate to="/retrospectives" replace />} />
                  <Route path="/retrospectives" element={<Retrospectives />} />
                  <Route path="/glossary" element={<Glossary />} />
                  <Route path="/creative-toolkit" element={<CreativeToolkit />} />
                  
                  <Route path="/advanced-build" element={<AdvancedBuild />} />
                  <Route path="/beta-feedback" element={<BetaFeedback />} />
                  <Route path="/partners" element={<Partners />} />
                  <Route path="/report/:shareToken" element={<SharedReport />} />
                  <Route path="/refer" element={<Refer />} />
                  <Route path="/partner-dashboard" element={<PartnerDashboard />} />
                  <Route path="/admin/knowledge" element={<AdminKnowledge />} />
                  <Route path="/admin/affiliates" element={<AdminAffiliates />} />
                  <Route path="/admin/partners" element={<AdminPartners />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/templates" element={<AdminTemplates />} />
                  <Route path="/admin/strategies" element={<AdminStrategies />} />
                  <Route path="/admin/creative-toolkit" element={<AdminCreativeToolkit />} />
                  <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                  <Route path="/admin/bug-reports" element={<AdminBugReports />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/team" element={<AdminTeam />} />
                  <Route path="/admin/stripe" element={<AdminStripe />} />
                  <Route path="/admin/coupons" element={<AdminCoupons />} />
                  <Route path="/admin/email-logs" element={<AdminEmailLogs />} />
                  <Route path="/admin/emails" element={<AdminEmails />} />
                  <Route path="/admin/cancellations" element={<AdminCancellations />} />
                  <Route path="/admin/dispute-evidence" element={<AdminDisputeEvidence />} />
                  <Route path="/client-portal/:portalId" element={<ClientPortal />} />
                  <Route path="/agency-settings" element={<AgencySettings />} />
                  <Route path="/cancellation-policy" element={<CancellationPolicy />} />
                  <Route path="/office-hours" element={<OfficeHours />} />
                  <Route path="/partner-portal" element={<PartnerPortal />} />
                  <Route path="/ads-manager" element={<AdsManager />} />
                  <Route path="/ads-manager/client/:id" element={<AdsManagerClient />} />
                  <Route path="/review" element={<SubmitReview />} />
                  <Route path="/admin/reviews" element={<AdminReviews />} />
                  <Route path="/admin/meta-debug" element={<AdminMetaDebug />} />
                  <Route path="/admin/overlay-templates" element={<AdminOverlayTemplates />} />
                  <Route path="/admin/updates" element={<AdminUpdates />} />
                  <Route path="/admin/updates/:campaignId" element={<AdminUpdatesResults />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LumiAssistantProvider>
            </BrowserRouter>
              </RenderQueueProvider>
              </BrandProvider>
        </LumiProvider>
      </SubscriptionProvider>
      </ImpersonationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
