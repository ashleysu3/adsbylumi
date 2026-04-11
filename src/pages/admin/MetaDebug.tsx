import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Search, Loader2, Globe, Target, DollarSign, Users, BarChart3, AlertTriangle, CheckCircle, XCircle, Monitor } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { useSearchParams } from "react-router-dom";

interface CampaignDebugInfo {
  id: string;
  name: string;
  progress_status: string;
  meta_campaign_status: string | null;
  meta_campaign_ids: any;
  meta_errors: any;
  campaign_builder_answers: any;
  final_answers: any;
  strategy_json: any;
  offer_name: string | null;
  offer_url: string | null;
  offer_price: string | null;
  template_id: string | null;
  tracking_verified: boolean | null;
  published_at: string | null;
  created_at: string;
}

interface BrandDebugInfo {
  id: string;
  name: string;
  user_id: string;
  meta_account_id: string | null;
  meta_pixel_id: string | null;
  meta_pixel_name: string | null;
  page_id: string | null;
  page_name: string | null;
  instagram_account_id: string | null;
  instagram_account_name: string | null;
  meta_token_expires_at: string | null;
  multi_advertiser_ads: boolean | null;
  site_links_enabled: boolean | null;
}

export default function AdminMetaDebug() {
  const [searchParams] = useSearchParams();
  const [searchEmail, setSearchEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<BrandDebugInfo[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignDebugInfo[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("email")) {
      handleSearch();
    }
  }, []);

  const handleSearch = async () => {
    const email = searchEmail.trim();
    if (!email) return;
    setLoading(true);
    setBrands([]);
    setCampaigns([]);
    setSelectedBrandId(null);

    try {
      // Find user by email via profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      if (!profile) {
        toast.error("User not found");
        setLoading(false);
        return;
      }

      setUserEmail(profile.email);

      // Fetch brands for this user
      const { data: brandData } = await supabase
        .from("brands")
        .select("id, name, user_id, meta_account_id, meta_pixel_id, meta_pixel_name, page_id, page_name, instagram_account_id, instagram_account_name, meta_token_expires_at, multi_advertiser_ads, site_links_enabled")
        .eq("user_id", profile.id);

      if (brandData && brandData.length > 0) {
        setBrands(brandData);
        setSelectedBrandId(brandData[0].id);
        await fetchCampaigns(brandData[0].id);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const fetchCampaigns = async (brandId: string) => {
    const { data } = await supabase
      .from("campaign_workspaces")
      .select("id, name, progress_status, meta_campaign_status, meta_campaign_ids, meta_errors, campaign_builder_answers, final_answers, strategy_json, offer_name, offer_url, offer_price, template_id, tracking_verified, published_at, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    setCampaigns(data || []);
  };

  const handleBrandSelect = async (brandId: string) => {
    setSelectedBrandId(brandId);
    await fetchCampaigns(brandId);
  };

  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  const getStatusColor = (status: string | null) => {
    if (!status) return "secondary";
    if (status === "active" || status === "published") return "default";
    if (status === "paused") return "outline";
    if (status === "error") return "destructive";
    return "secondary";
  };

  const extractBuilderField = (answers: any, field: string) => {
    if (!answers) return "—";
    return answers[field] ?? "—";
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AdminTabs />
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Monitor className="w-6 h-6" /> Meta Debug
        </h1>
        <p className="text-muted-foreground mb-6">Inspect a user's Meta Ads Manager setup, campaign configuration, and every selection made on their behalf.</p>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Enter user email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-md"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </Button>
        </div>

        {/* Brand selector */}
        {brands.length > 1 && (
          <div className="flex gap-2 mb-4">
            {brands.map(b => (
              <Button
                key={b.id}
                variant={selectedBrandId === b.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleBrandSelect(b.id)}
              >
                {b.name}
              </Button>
            ))}
          </div>
        )}

        {/* Brand Meta Connection Summary */}
        {selectedBrand && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5" /> Meta Connection — {selectedBrand.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Ad Account ID</p>
                  <p className="font-mono font-medium">{selectedBrand.meta_account_id || "Not connected"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Page</p>
                  <p className="font-medium">{selectedBrand.page_name || "—"} <span className="text-muted-foreground font-mono text-xs">{selectedBrand.page_id}</span></p>
                </div>
                <div>
                  <p className="text-muted-foreground">Instagram</p>
                  <p className="font-medium">{selectedBrand.instagram_account_name || "—"} <span className="text-muted-foreground font-mono text-xs">{selectedBrand.instagram_account_id}</span></p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pixel</p>
                  <p className="font-medium">{selectedBrand.meta_pixel_name || "—"} <span className="text-muted-foreground font-mono text-xs">{selectedBrand.meta_pixel_id}</span></p>
                </div>
                <div>
                  <p className="text-muted-foreground">Token Expires</p>
                  <p className="font-medium">{selectedBrand.meta_token_expires_at ? new Date(selectedBrand.meta_token_expires_at).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Multi-Advertiser Ads</p>
                  <p className="font-medium">{selectedBrand.multi_advertiser_ads ? "ON" : "OFF"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Site Links</p>
                  <p className="font-medium">{selectedBrand.site_links_enabled ? "ON" : "OFF"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaigns */}
        {campaigns.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Campaigns ({campaigns.length})</h2>
            {campaigns.map(c => (
              <CampaignDebugCard key={c.id} campaign={c} />
            ))}
          </div>
        )}

        {selectedBrand && campaigns.length === 0 && !loading && (
          <p className="text-muted-foreground text-center py-8">No campaigns found for this brand.</p>
        )}
      </div>
    </DashboardLayout>
  );
}

function CampaignDebugCard({ campaign }: { campaign: CampaignDebugInfo }) {
  const [expanded, setExpanded] = useState(false);
  const answers = campaign.campaign_builder_answers || {};
  const finalAnswers = campaign.final_answers || {};
  const strategy = campaign.strategy_json || {};
  const metaIds = campaign.meta_campaign_ids || {};

  const objective = answers.objective || finalAnswers.objective || strategy.objective || "—";
  const optimizationEvent = answers.optimization_event || finalAnswers.optimization_event || strategy.optimization_event || "—";
  const budget = answers.budget || "—";
  const budgetLevel = answers.budgetLevel || "—";
  const audienceType = answers.audience_type || finalAnswers.audience_type || strategy.audience_type || "Broad (default)";
  const placements = answers.placements || finalAnswers.placements || "Advantage+ (default)";
  const destinationUrl = answers.destination_url || campaign.offer_url || "—";
  const pixelId = answers.pixel_id || finalAnswers.pixel_id || "—";
  const customConversion = campaign.tracking_verified ? "Verified" : "Not verified";

  return (
    <Card className="border">
      <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge variant={campaign.meta_campaign_status === "active" ? "default" : "secondary"}>
              {campaign.meta_campaign_status || campaign.progress_status}
            </Badge>
            {campaign.published_at && (
              <span className="text-xs text-muted-foreground">Published {new Date(campaign.published_at).toLocaleDateString()}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
            <SummaryField icon={<Target className="w-4 h-4" />} label="Objective" value={objective} />
            <SummaryField icon={<BarChart3 className="w-4 h-4" />} label="Optimization Event" value={optimizationEvent} />
            <SummaryField icon={<DollarSign className="w-4 h-4" />} label="Budget" value={budget !== "—" ? `$${budget}/day (${budgetLevel})` : "—"} />
            <SummaryField icon={<Users className="w-4 h-4" />} label="Audience" value={audienceType} />
            <SummaryField icon={<Monitor className="w-4 h-4" />} label="Placements" value={String(placements)} />
            <SummaryField icon={<Globe className="w-4 h-4" />} label="Destination URL" value={destinationUrl} />
            <SummaryField label="Offer" value={campaign.offer_name || "—"} />
            <SummaryField label="Offer Price" value={campaign.offer_price || "—"} />
            <SummaryField label="Pixel" value={pixelId} />
            <SummaryField label="Tracking" value={customConversion} />
          </div>

          {/* Meta Campaign IDs */}
          {metaIds.campaignId && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Meta Campaign ID</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{metaIds.campaignId}</code>
            </div>
          )}

          {/* Meta Errors */}
          {campaign.meta_errors && (
            <div className="mb-3">
              <p className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3" /> Meta Errors
              </p>
              <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(campaign.meta_errors, null, 2)}
              </pre>
            </div>
          )}

          {/* Expandable raw JSON sections */}
          <Separator className="my-3" />
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground font-medium mb-1">Builder Answers (raw JSON)</summary>
            <ScrollArea className="max-h-48">
              <pre className="bg-muted p-2 rounded overflow-auto">{JSON.stringify(answers, null, 2)}</pre>
            </ScrollArea>
          </details>
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-muted-foreground font-medium mb-1">Final Answers (raw JSON)</summary>
            <ScrollArea className="max-h-48">
              <pre className="bg-muted p-2 rounded overflow-auto">{JSON.stringify(finalAnswers, null, 2)}</pre>
            </ScrollArea>
          </details>
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-muted-foreground font-medium mb-1">Strategy JSON</summary>
            <ScrollArea className="max-h-48">
              <pre className="bg-muted p-2 rounded overflow-auto">{JSON.stringify(strategy, null, 2)}</pre>
            </ScrollArea>
          </details>
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-muted-foreground font-medium mb-1">Meta Campaign IDs (raw)</summary>
            <ScrollArea className="max-h-48">
              <pre className="bg-muted p-2 rounded overflow-auto">{JSON.stringify(metaIds, null, 2)}</pre>
            </ScrollArea>
          </details>
        </CardContent>
      )}
    </Card>
  );
}

function SummaryField({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="font-medium truncate" title={value}>{value}</p>
    </div>
  );
}
