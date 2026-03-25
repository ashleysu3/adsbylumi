import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useBrand } from '@/contexts/BrandContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseReportSections, ReportSectionRenderer } from '@/components/insights/ReportSectionRenderer';
import { ArrowLeft, Loader2, Send, FileText, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function WeeklyDigestPreview() {
  const navigate = useNavigate();
  const { activeBrand, isAgencyUser } = useBrand();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [campaignCount, setCampaignCount] = useState(0);
  const [dateStart, setDateStart] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (activeBrand?.id) checkCampaigns();
    else setLoading(false);
  }, [activeBrand?.id]);

  const checkCampaigns = async () => {
    if (!activeBrand?.id) return;
    try {
      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select('id')
        .eq('brand_id', activeBrand.id)
        .not('meta_campaign_ids', 'is', null)
        .neq('meta_campaign_status', 'draft')
        .eq('archived', false);

      if (error) throw error;
      setCampaignCount(data?.length || 0);
    } catch (error) {
      console.error('Error checking campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!activeBrand?.id) return;
    setGenerating(true);
    setReportText(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-client-report', {
        body: {
          brandId: activeBrand.id,
          dateRangeStart: dateStart,
          dateRangeEnd: dateEnd,
          mode: isAgencyUser ? 'agency' : 'self-serve',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setReportText(data?.reportText || data?.report_text || '');
      toast.success('Performance Report generated!');
    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!activeBrand?.id) return;
    setSendingTest(true);
    try {
      // Get a workspace to trigger the email
      const { data: ws } = await supabase
        .from('campaign_workspaces')
        .select('id')
        .eq('brand_id', activeBrand.id)
        .not('meta_campaign_ids', 'is', null)
        .eq('archived', false)
        .limit(1)
        .single();

      if (!ws) throw new Error('No published campaigns found');

      const { error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { workspaceId: ws.id },
      });

      if (error) throw error;
      toast.success('Test email queued! Check your inbox.');
    } catch (error: any) {
      console.error('Error sending test:', error);
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const parsed = reportText ? parseReportSections(reportText) : null;

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
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient-lumi">Performance Report Preview</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate and preview your performance report
            </p>
          </div>
          <Button
            onClick={handleSendTestEmail}
            disabled={sendingTest || campaignCount === 0}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test Email
          </Button>
        </div>

        {/* Date range + Generate */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-40 h-9" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-40 h-9" />
              </div>
              <Button onClick={handleGeneratePreview} disabled={generating || campaignCount === 0} variant="lumi" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {generating ? 'Generating...' : 'Generate Performance Report'}
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {campaignCount} campaign{campaignCount !== 1 ? 's' : ''} with data
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report content */}
        {parsed ? (
          <Card className="overflow-hidden border-2">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5" />
                <Badge variant="outline" className="text-white border-white/30">Performance Report</Badge>
              </div>
              <CardTitle className="text-2xl">📊 Performance Report</CardTitle>
              <p className="text-slate-300 text-sm mt-1">
                {activeBrand?.name} · {format(new Date(dateStart), 'MMM d')} — {format(new Date(dateEnd), 'MMM d, yyyy')}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <ReportSectionRenderer
                sections={parsed.sections}
                brandId={activeBrand?.id}
                mode={isAgencyUser ? 'agency' : 'self-serve'}
              />
            </CardContent>
          </Card>
        ) : campaignCount === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Published Campaigns</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Publish a campaign to generate your performance report
              </p>
              <Button onClick={() => navigate('/campaigns')} variant="outline">
                Go to Campaigns
              </Button>
            </CardContent>
          </Card>
        ) : !generating ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Ready to Generate</h3>
              <p className="text-sm text-muted-foreground">
                Choose your date range and click "Generate Performance Report" to preview
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Generating your performance report...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
