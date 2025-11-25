import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  FileText, 
  ShoppingCart, 
  PhoneCall, 
  TrendingUp, 
  Play,
  Loader2,
  Info
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignFlowBreadcrumb } from "@/components/CampaignFlowBreadcrumb";

const iconMap: Record<string, any> = {
  Video,
  FileText,
  ShoppingCart,
  PhoneCall,
  TrendingUp,
  Play,
};

export default function Planning() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [offersWithRecommendations, setOffersWithRecommendations] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setBrand(brandData);

      const { data: templatesData } = await supabase
        .from("campaign_templates")
        .select("*")
        .eq("active", true)
        .order("created_at");

      setTemplates(templatesData || []);

      // Fetch offers with recommendations
      if (brandData) {
        const { data: offersData } = await supabase
          .from("offers")
          .select(`
            *,
            campaign_templates:recommended_template_id (
              name,
              slug
            )
          `)
          .eq("brand_id", brandData.id)
          .not("recommended_template_id", "is", null);

        setOffersWithRecommendations(offersData || []);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
    }
  };

  const handleTemplateClick = async (template: any) => {
    if (!brand) {
      toast.error("Please complete brand setup first");
      return;
    }

    setLoading(true);
    try {
      // Create strategy first
      const strategyData = {
        brand_id: brand.id,
        template_id: template.id,
        name: template.name,
        campaign_type: template.strategy_template.campaign_type,
        messaging_framework: template.strategy_template.messaging_framework,
        audience_psychology: template.strategy_template.audience_psychology,
        optimization_goals: template.strategy_template.optimization_goals,
        kpi_benchmarks: template.strategy_template.kpi_benchmarks,
        contextual_keywords: [],
        status: "active",
      };

      const { data: newStrategy, error: strategyError } = await supabase
        .from("strategies")
        .insert(strategyData)
        .select()
        .single();

      if (strategyError) throw strategyError;

      // Create campaign workspace
      const workspaceData = {
        brand_id: brand.id,
        template_id: template.id,
        strategy_id: newStrategy.id,
        name: template.name,
        strategy_json: template.strategy_template,
        progress_status: "creative_in_progress",
      };

      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("campaign_workspaces")
        .insert(workspaceData)
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      toast.success(`${template.name} workspace created!`);
      navigate(`/workspace/${newWorkspace.id}`);
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast.error(error.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (template: any) => {
    setSelectedTemplate(template);
    setShowDetails(true);
  };

  if (!brand) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>Please complete your brand setup first.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <CampaignFlowBreadcrumb currentStep="planning" />
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Choose Your Campaign Type</h2>
          <p className="text-muted-foreground">Pick a pre-built strategy and we'll guide you through the rest</p>
        </div>

        {offersWithRecommendations.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">💡</div>
                <div className="space-y-2">
                  <p className="font-semibold">Quick Start</p>
                  <p className="text-sm text-muted-foreground">
                    We've already recommended campaigns for your offers in the Brand Dashboard. 
                    You can create campaigns instantly from there with all details pre-filled!
                  </p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                    View My Offers
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const Icon = iconMap[template.icon] || Video;
            return (
              <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 relative">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetails(template); }}>
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-xl">{template.name}</CardTitle>
                  {offersWithRecommendations.some(o => o.recommended_template_id === template.id) && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      Recommended for: {offersWithRecommendations.find(o => o.recommended_template_id === template.id)?.name}
                    </Badge>
                  )}
                  <CardDescription className="min-h-[48px]">{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Objective:</span>
                      <Badge variant="secondary">{template.objective}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Traffic:</span>
                      <Badge variant="outline">{template.audience_type}</Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-3"><strong>Use this for:</strong> {template.use_case}</p>
                    <Button className="w-full" onClick={() => handleTemplateClick(template)} disabled={loading}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Choose This"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                {selectedTemplate && (() => {
                  const Icon = iconMap[selectedTemplate.icon] || Video;
                  return <Icon className="h-6 w-6 text-primary" />;
                })()}
                <span>{selectedTemplate?.name}</span>
              </DialogTitle>
              <DialogDescription>{selectedTemplate?.long_description}</DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Campaign Structure</p>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.campaign_structure}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Budget Suggestion</p>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.budget_suggestion || "Flexible"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">What You'll Get</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Pre-configured campaign strategy</li>
                    <li>• Psychology-driven messaging framework</li>
                    <li>• AI-generated ad scripts and copy</li>
                    <li>• Creative direction and shot lists</li>
                    <li>• KPI benchmarks and optimization goals</li>
                  </ul>
                </div>
                <div className="flex space-x-3 pt-4">
                  <Button className="flex-1" onClick={() => { setShowDetails(false); handleTemplateClick(selectedTemplate); }} disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Choose This Template"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowDetails(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
