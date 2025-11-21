import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Sales from "./pages/Sales";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Planning from "./pages/Planning";
import Creative from "./pages/Creative";
import CampaignWorkspace from "./pages/CampaignWorkspace";
import Campaigns from "./pages/Campaigns";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import AdminKnowledge from "./pages/admin/Knowledge";
import AdminAnalytics from "./pages/admin/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Sales />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/creative" element={<Creative />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/workspace/:workspaceId" element={<CampaignWorkspace />} />
          <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
          <Route path="/admin/knowledge" element={<AdminKnowledge />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
