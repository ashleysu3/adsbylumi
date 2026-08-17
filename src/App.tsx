import { useState, useEffect, lazy, Suspense } from "react";
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
import { CampaignDraftProvider } from "@/contexts/CampaignDraftContext";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { GlobalAnnouncementBanner } from "@/components/GlobalAnnouncementBanner";
import { PartnerWelcomeModal } from "@/components/PartnerWelcomeModal";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import SplashScreen from "@/components/SplashScreen";
import ScrollToTop from "@/components/ScrollToTop";

import Index from "./pages/Index";
import Sales from "./pages/Sales";
import Waitlist from "./pages/Waitlist";
import Auth from "./pages/Auth";
import Reactivate from "./pages/Reactivate";
import WelcomeBack from "./pages/WelcomeBack";
import GuidedOnboarding from "./pages/GuidedOnboarding";
import Dashboard from "./pages/Dashboard";
import Start from "./pages/Start";
const Create = lazy(() => import("./pages/Create"));
const AdPerformance = lazy(() => import("./pages/Data"));
import WorkspaceRedirect from "./pages/WorkspaceRedirect";
import CampaignBuilder from "./pages/CampaignBuilder";

import Studio from "./pages/Studio";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
const AdminKnowledge = lazy(() => import("./pages/admin/Knowledge"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminTemplates = lazy(() => import("./pages/admin/Templates"));
const AdminMagicTemplates = lazy(() => import("./pages/admin/MagicTemplates"));
const AdminCreativeToolkit = lazy(() => import("./pages/admin/CreativeToolkit"));
const AdminSubscriptions = lazy(() => import("./pages/admin/Subscriptions"));
const AdminBugReports = lazy(() => import("./pages/admin/BugReports"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminTeam = lazy(() => import("./pages/admin/Team"));
const AdminStripe = lazy(() => import("./pages/admin/Stripe"));
const AdminCoupons = lazy(() => import("./pages/admin/Coupons"));
const AdminUpdates = lazy(() => import("./pages/admin/Updates"));
const AdminUpdatesResults = lazy(() => import("./pages/admin/UpdatesResults"));
const AdminFeatures = lazy(() => import("./pages/admin/Features"));
const AdminStockBroll = lazy(() => import("./pages/admin/StockBroll"));
const AdminDemoAds = lazy(() => import("./pages/admin/DemoAds"));
const AdminApprovals = lazy(() => import("./pages/admin/Approvals"));
import { useReferralCapture } from "./hooks/useReferralCapture";

function ReferralCaptureMount() {
  useReferralCapture();
  return null;
}
import Settings from "./pages/Settings";
import MetaSettings from "./pages/MetaSettings";
import TrackingSetup from "./pages/TrackingSetup";
import WeeklyDigestPreview from "./pages/WeeklyDigestPreview";

import Offers from "./pages/Offers";
import Style from "./pages/Style";
import ContentLibrary from "./pages/ContentLibrary";
const CreativeStudio = lazy(() => import("./pages/CreativeStudio"));
import Glossary from "./pages/Glossary";
import NotFound from "./pages/NotFound";
import AdvancedBuild from "./pages/AdvancedBuild";
import BetaFeedback from "./pages/BetaFeedback";
import Partners from "./pages/Partners";
import Refer from "./pages/Refer";
import PartnerDashboard from "./pages/PartnerDashboard";
import CreativeToolkit from "./pages/CreativeToolkit";
import TrendTranslator from "./pages/TrendTranslator";
const AdminAffiliates = lazy(() => import("./pages/admin/Affiliates"));
const AdminPayouts = lazy(() => import("./pages/admin/Payouts"));
const AdminPartners = lazy(() => import("./pages/admin/Partners"));
const AdminPartnerApplications = lazy(() => import("./pages/admin/PartnerApplications"));
const AdminEmailLogs = lazy(() => import("./pages/admin/EmailLogs"));
const AdminEmails = lazy(() => import("./pages/admin/Emails"));
const AdminTestReports = lazy(() => import("./pages/admin/TestReports"));
const AdminCancellations = lazy(() => import("./pages/admin/Cancellations"));
const AdminDisputeEvidence = lazy(() => import("./pages/admin/DisputeEvidence"));
import ClientPortal from "./pages/ClientPortal";
import SharedReport from "./pages/SharedReport";
import AgencySettings from "./pages/AgencySettings";
import CancellationPolicy from "./pages/CancellationPolicy";
import Pricing from "./pages/Pricing";
import AdsManager from "./pages/AdsManager";
import AdsManagerClient from "./pages/AdsManagerClient";
import SubmitReview from "./pages/SubmitReview";
const AdminReviews = lazy(() => import("./pages/admin/Reviews"));
const AdminMetaDebug = lazy(() => import("./pages/admin/MetaDebug"));
const AdminOverlayTemplates = lazy(() => import("./pages/admin/OverlayTemplates"));
import FreeTrial from "./pages/FreeTrial";
import AdPackReveal from "./pages/AdPackReveal";
import Welcome from "./pages/Welcome";
import BrandPatterns from "./pages/BrandPatterns";
import Retrospectives from "./pages/Retrospectives";
import RecommendedStrategy from "./pages/RecommendedStrategy";
import StrategyPlan from "./pages/StrategyPlan";
import AdStrategy from "./pages/AdStrategy";
const AdminStrategies = lazy(() => import("./pages/admin/Strategies"));
import OfficeHours from "./pages/OfficeHours";
import PartnerPortal from "./pages/PartnerPortal";
import AdGenerator from "./pages/AdGenerator";
import BrandSetup from "./pages/BrandSetup";
import Photos from "./pages/Photos";
const Creative = lazy(() => import("./pages/Creative"));
const MyCreatives = lazy(() => import("./pages/MyCreatives"));
import Launch from "./pages/Launch";
import Performance from "./pages/Performance";
import CloserLook from "./pages/CloserLook";
import {
  GoalsPlaceholder,
  TroubleshootingPlaceholder,
  CloserLookPlaceholder,
} from "./pages/Placeholder";
import Voice from "./pages/Voice";
import Audience from "./pages/Audience";
import InitialSetup from "./pages/InitialSetup";


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
              <CampaignDraftProvider>
              <SplashScreen isVisible={showSplash} />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <LumiAssistantProvider>
                  <ReferralCaptureMount />
                  <GlobalAnnouncementBanner />
                  <ImpersonationBanner />
                  <PartnerWelcomeModal />
                  <WhatsNewModal />
                  
                  
                <Suspense fallback={<div className="min-h-screen" />}>
                <Routes>
                  <Route path="/" element={<Sales />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reactivate/:token" element={<Reactivate />} />
                  <Route path="/welcome-back" element={<WelcomeBack />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/your-ad-pack" element={<AdPackReveal />} />
                  <Route path="/join" element={<FreeTrial />} />
                  <Route path="/freetrial" element={<Navigate to="/join" replace />} />
                  <Route path="/free-trial" element={<Navigate to="/join" replace />} />
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/onboarding" element={<GuidedOnboarding />} />
                  <Route path="/start" element={<Start />} />
                  <Route path="/create" element={<Create />} />
                  <Route path="/recommended-strategy" element={<Navigate to="/create" replace />} />
                  <Route path="/strategy-plan" element={<Navigate to="/strategy" replace />} />
                  <Route path="/home" element={<Navigate to="/studio" replace />} />
                  <Route path="/dashboard" element={<Navigate to="/initial-setup" replace />} />
                  <Route path="/planning" element={<Navigate to="/studio" replace />} />
                  <Route path="/strategy" element={<AdStrategy />} />
                  <Route path="/strategy-builder" element={<Navigate to="/create" replace />} />
                  
                  <Route path="/creative" element={<Creative />} />
                  <Route path="/launch" element={<Launch />} />
                  <Route path="/studio" element={<Studio />} />
                  <Route path="/my-ads" element={<Navigate to="/studio" replace />} />
                  <Route path="/live-ads" element={<Navigate to="/studio" replace />} />
                  <Route path="/ad-performance" element={<Navigate to="/studio" replace />} />
                  <Route path="/live-ads/:campaignId" element={<CloserLook />} />
                  <Route path="/data" element={<AdPerformance />} />
                  <Route path="/performance" element={<Navigate to="/studio" replace />} />
                  <Route path="/performance-summary" element={<Navigate to="/studio" replace />} />
                  <Route path="/performance-history" element={<Navigate to="/studio" replace />} />
                  <Route path="/past-reports" element={<Navigate to="/studio" replace />} />
                  <Route path="/production" element={<Navigate to="/studio" replace />} />
                  <Route path="/campaigns" element={<Navigate to="/studio" replace />} />
                  <Route path="/ad-generator" element={<AdGenerator />} />
                  <Route path="/brand-setup" element={<BrandSetup />} />
                  <Route path="/photos" element={<Photos />} />
                  <Route path="/workspace/:workspaceId" element={<WorkspaceRedirect />} />
                  <Route path="/campaigns/build" element={<CampaignBuilder />} />
                  <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
                  <Route path="/meta-callback" element={<MetaOAuthCallback />} />
                  <Route path="/settings" element={<Settings />} />
   <Route path="/meta-settings" element={<MetaSettings />} />
   <Route path="/settings/meta" element={<Navigate to="/meta-settings" replace />} />
                  <Route path="/tracking-setup" element={<TrackingSetup />} />
                  <Route path="/settings/digest-preview" element={<WeeklyDigestPreview />} />
                  <Route path="/content-library" element={<ContentLibrary />} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/style" element={<Style />} />
                  <Route path="/creative-studio" element={<CreativeStudio />} />
                  <Route path="/lab" element={<Navigate to="/creative-studio?mode=lab" replace />} />
                  <Route path="/my-creatives" element={<MyCreatives />} />
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
                  <Route path="/admin/stock-broll" element={<AdminStockBroll />} />
                  <Route path="/admin/demo-ads" element={<AdminDemoAds />} />
                  <Route path="/admin/approvals" element={<AdminApprovals />} />
                  <Route path="/admin/affiliates" element={<AdminAffiliates />} />
                  <Route path="/admin/payouts" element={<AdminPayouts />} />
                  <Route path="/admin/partners" element={<AdminPartners />} />
                  <Route path="/admin/partner-applications" element={<AdminPartnerApplications />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/templates" element={<AdminTemplates />} />
                  <Route path="/admin/magic-templates" element={<AdminMagicTemplates />} />
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
                  <Route path="/admin/test-reports" element={<AdminTestReports />} />
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
                 <Route path="/admin/features" element={<AdminFeatures />} />
                  <Route path="/tasks" element={<Navigate to="/studio?tasks=open" replace />} />
                  <Route path="/audience" element={<Audience />} />
                  <Route path="/goals" element={<Navigate to="/strategy" replace />} />
                  <Route path="/voice" element={<Voice />} />
                  <Route path="/initial-setup" element={<InitialSetup />} />
                  <Route path="/troubleshooting" element={<TroubleshootingPlaceholder />} />
                  <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </LumiAssistantProvider>
            </BrowserRouter>
              </CampaignDraftProvider>
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
