import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useBrand } from '@/contexts/BrandContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mail, ArrowLeft, Loader2, TrendingUp, TrendingDown, 
  CheckCircle, AlertTriangle, Sparkles, Calendar, Send
} from 'lucide-react';
import { format } from 'date-fns';

interface CampaignOption {
  id: string;
  name: string;
  hasData: boolean;
}

export default function WeeklyDigestPreview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!brand) return;

      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select('id, name, performance_report_latest, performance_history')
        .eq('brand_id', brand.id)
        .not('meta_campaign_ids', 'is', null)
        .eq('archived', false);

      if (error) throw error;

      const campaignOptions: CampaignOption[] = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        hasData: !!(c.performance_report_latest || (c.performance_history as any[])?.length > 0),
      }));

      setCampaigns(campaignOptions);
      
      // Auto-select first campaign with data
      const firstWithData = campaignOptions.find(c => c.hasData);
      if (firstWithData) {
        setSelectedCampaign(firstWithData.id);
        loadPreviewData(firstWithData.id);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadPreviewData = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select('name, offer_name, performance_report_latest, performance_history')
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      const report = data.performance_report_latest;
      const history = (data.performance_history as any[]) || [];
      const latestMetrics = history[history.length - 1]?.metrics || {};

      setPreviewData({
        campaignName: data.offer_name || data.name,
        metrics: latestMetrics,
        report,
        dateRange: `${format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'MMM d')} - ${format(new Date(), 'MMM d, yyyy')}`,
      });
    } catch (error) {
      console.error('Error loading preview:', error);
      setPreviewData(null);
    }
  };

  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    loadPreviewData(campaignId);
  };

  const handleSendTestEmail = async () => {
    if (!selectedCampaign) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { workspaceId: selectedCampaign },
      });

      if (error) throw error;
      
      toast.success('Test email queued! Check your inbox.');
    } catch (error: any) {
      console.error('Error sending test:', error);
      toast.error('Failed to send test email');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient-lumi">Weekly Digest Preview</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              See what your weekly performance report will look like
            </p>
          </div>
          <Button 
            onClick={handleSendTestEmail} 
            disabled={generating || !selectedCampaign}
            variant="lumi"
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Test Email
          </Button>
        </div>

        {/* Campaign Selector */}
        {campaigns.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Preview for:</label>
                <Select value={selectedCampaign} onValueChange={handleCampaignChange}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.id} disabled={!c.hasData}>
                        {c.name} {!c.hasData && '(No data)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Preview */}
        {previewData ? (
          <Card className="overflow-hidden border-2">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5" />
                <Badge variant="outline" className="text-white border-white/30">
                  Email Preview
                </Badge>
              </div>
              <CardTitle className="text-2xl">📊 Weekly Performance Report</CardTitle>
              <CardDescription className="text-slate-300">
                {previewData.campaignName}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Date Range */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{previewData.dateRange}</span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  label="Spend" 
                  value={`$${(previewData.metrics.spend || 0).toFixed(2)}`} 
                />
                <MetricCard 
                  label="Reach" 
                  value={(previewData.metrics.reach || 0).toLocaleString()} 
                />
                <MetricCard 
                  label="Conversions" 
                  value={previewData.metrics.leads || previewData.metrics.purchases || 0} 
                />
                <MetricCard 
                  label="Cost/Result" 
                  value={`$${(previewData.metrics.cpl || previewData.metrics.cpp || 0).toFixed(2)}`} 
                />
              </div>

              {/* Lumi Insights */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-lumi-orange-1" />
                  <span className="font-semibold text-sm">Lumi's Weekly Insights</span>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Your top performing creative is driving 60% of conversions</li>
                  <li>• Consider increasing budget on high-ROAS ad sets</li>
                  <li>• Test new hooks to combat creative fatigue</li>
                </ul>
              </div>

              {/* What's Working */}
              {previewData.report?.kpi_evaluation && (
                <div className="p-4 rounded-lg bg-green-500/10 border-l-4 border-green-500">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-sm">What's Working</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {previewData.report.kpi_evaluation.ctr?.status === 'healthy' && (
                      <li>• CTR is performing well</li>
                    )}
                    {previewData.report.kpi_evaluation.cpc?.status === 'healthy' && (
                      <li>• Cost per click is efficient</li>
                    )}
                    <li>• Top of funnel is driving awareness</li>
                  </ul>
                </div>
              )}

              {/* Needs Attention */}
              {previewData.report?.creative_diagnosis?.problem && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border-l-4 border-yellow-500">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold text-sm">Needs Attention</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• {previewData.report.creative_diagnosis.problem}</li>
                    {previewData.metrics.frequency > 3 && (
                      <li>• Ad frequency is {previewData.metrics.frequency?.toFixed(1)} - consider refreshing creative</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {previewData.report?.next_steps && previewData.report.next_steps.length > 0 && (
                <div className="p-4 rounded-lg bg-blue-500/10 border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-sm">Your Next Steps</span>
                  </div>
                  <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                    {previewData.report.next_steps.slice(0, 3).map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* CTA */}
              <div className="text-center pt-4">
                <Button variant="lumi" size="lg">
                  View Full Dashboard →
                </Button>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                This is an automated weekly report from Lumi.<br />
                Keep going - you're doing great! 🎉
              </div>
            </CardContent>
          </Card>
        ) : campaigns.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Mail className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Published Campaigns</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Publish a campaign to see your weekly digest preview
              </p>
              <Button onClick={() => navigate('/campaigns')} variant="outline">
                Go to Campaigns
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading preview data...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg text-center">
      <p className="text-xs text-muted-foreground uppercase mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
