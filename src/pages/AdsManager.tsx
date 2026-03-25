import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useBrand } from '@/contexts/BrandContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';
import { Plus, LayoutDashboard, ClipboardCheck, CheckCircle, FileText, History, Lock, Loader2 } from 'lucide-react';
import { ClientScorecard } from '@/components/ads-manager/ClientScorecard';
import { ApprovalQueue } from '@/components/ads-manager/ApprovalQueue';
import { ReviewForm } from '@/components/ads-manager/ReviewForm';
import { ReportDraftPreview } from '@/components/ads-manager/ReportDraftPreview';
import { ActionHistoryTimeline } from '@/components/insights/ActionHistoryTimeline';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function AdsManager() {
  const { activeBrand, brands, isAgencyUser } = useBrand();
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [reviewLogs, setReviewLogs] = useState<any[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [approvalLoadingId, setApprovalLoadingId] = useState<string>();

  const [formData, setFormData] = useState({
    brand_id: '',
    slack_client_channel: '',
    slack_internal_channel: '',
    contact_name: '',
    contact_email: '',
    health_status: 'healthy',
    notes: '',
    ad_literacy_level: 'beginner',
  });

  // Reports tab state
  const [reportClientId, setReportClientId] = useState<string>('');
  const [reportDateStart, setReportDateStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0];
  });
  const [reportDateEnd, setReportDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [reviewBrandId, setReviewBrandId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionPlan, setActionPlan] = useState('');

  // Gate: redirect non-agency users
  useEffect(() => {
    if (!isAgencyUser && tier !== 'agency') {
      navigate('/dashboard');
      toast.error('Ads Manager is available for agency accounts only.');
    }
  }, [isAgencyUser, tier, navigate]);

  useEffect(() => {
    if (isAgencyUser || tier === 'agency') {
      loadData();
    }
  }, [brands]);

  const loadData = async () => {
    setLoading(true);

    // 1. Get existing agency_clients
    const { data: existingClients } = await supabase.from('agency_clients').select('*');
    const existingBrandIds = new Set((existingClients || []).map((c: any) => c.brand_id));

    // 2. Auto-create agency_client entries for brands not yet added
    const missingBrands = (brands || []).filter(b => !existingBrandIds.has(b.id));
    if (missingBrands.length > 0) {
      const inserts = missingBrands.map(b => ({
        brand_id: b.id,
        health_status: 'healthy',
      }));
      await supabase.from('agency_clients').insert(inserts);
    }

    // 3. Re-fetch all clients after potential inserts
    const [clientsRes, reviewsRes, reportsRes] = await Promise.all([
      supabase.from('agency_clients').select('*'),
      supabase.from('review_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('weekly_reports').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    // 4. Enrich clients with brand data, campaigns, and goals
    const enrichedClients = await Promise.all(
      ((clientsRes.data as any[]) || []).map(async (client: any) => {
        const [brandRes, campaignsRes, goalsRes] = await Promise.all([
          supabase.from('brands').select('id, name, meta_account_id, last_review_date, next_report_due').eq('id', client.brand_id).single(),
          supabase.from('campaign_workspaces')
            .select('id, name, progress_status, meta_campaign_status, meta_campaign_ids, performance_report_latest, template_id')
            .eq('brand_id', client.brand_id)
            .eq('archived', false)
            .limit(20),
          supabase.from('campaign_goals').select('*').eq('brand_id', client.brand_id),
        ]);

        // Build a goals map by workspace_id
        const goalsMap: Record<string, any> = {};
        (goalsRes.data || []).forEach((g: any) => {
          if (g.workspace_id) goalsMap[g.workspace_id] = g;
        });

        // Enrich campaigns with their goals and latest metrics
        const enrichedCampaigns = (campaignsRes.data || []).map((c: any) => {
          const report = c.performance_report_latest as any;
          const metrics = report?.metrics || {};
          return {
            ...c,
            goal: goalsMap[c.id] || null,
            metrics,
            hasLiveData: !!(c.meta_campaign_ids && c.meta_campaign_status !== 'draft'),
          };
        });

        return { ...client, brand: brandRes.data, campaigns: enrichedCampaigns };
      })
    );

    const enrichedReviews = ((reviewsRes.data as any[]) || []).map((r: any) => {
      const client = enrichedClients.find((c: any) => c.brand_id === r.brand_id);
      return { ...r, brand: client?.brand || { name: 'Unknown' } };
    });

    const enrichedReports = ((reportsRes.data as any[]) || []).map((r: any) => {
      const client = enrichedClients.find((c: any) => c.brand_id === r.brand_id);
      return { ...r, brand: client?.brand || { name: 'Unknown' } };
    });

    setClients(enrichedClients);
    setReviewLogs(enrichedReviews);
    setWeeklyReports(enrichedReports);
    setLoading(false);
  };

  const handleSaveClient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingClient) {
      await supabase.from('agency_clients').update({
        slack_client_channel: formData.slack_client_channel || null,
        slack_internal_channel: formData.slack_internal_channel || null,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        health_status: formData.health_status,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingClient.id);
    } else {
      await supabase.from('agency_clients').insert({
        brand_id: formData.brand_id,
        slack_client_channel: formData.slack_client_channel || null,
        slack_internal_channel: formData.slack_internal_channel || null,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        health_status: formData.health_status,
        notes: formData.notes || null,
      });
    }
    toast.success(editingClient ? 'Client updated' : 'Client added');
    setEditDialog(false);
    setEditingClient(null);
    loadData();
  };

  const openEditDialog = (client?: any) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        brand_id: client.brand_id,
        slack_client_channel: client.slack_client_channel || '',
        slack_internal_channel: client.slack_internal_channel || '',
        contact_name: client.contact_name || '',
        contact_email: client.contact_email || '',
        health_status: client.health_status || 'healthy',
        notes: client.notes || '',
        ad_literacy_level: client.ad_literacy_level || 'beginner',
      });
    } else {
      setEditingClient(null);
      setFormData({ brand_id: '', slack_client_channel: '', slack_internal_channel: '', contact_name: '', contact_email: '', health_status: 'healthy', notes: '', ad_literacy_level: 'beginner' });
    }
    setEditDialog(true);
  };

  const handleGenerateReport = async () => {
    if (!reportClientId) { toast.error('Select a client first'); return; }
    setIsGeneratingReport(true);
    try {
      const client = clients.find((c: any) => c.brand_id === reportClientId);
      const { data: agencyBranding } = await supabase.from('agency_branding').select('*').eq('brand_id', reportClientId).maybeSingle();

      const { data, error } = await supabase.functions.invoke('generate-client-report', {
        body: {
          brandId: reportClientId,
          dateRangeStart: reportDateStart,
          dateRangeEnd: reportDateEnd,
          mode: 'agency',
          adLiteracyLevel: client?.ad_literacy_level || 'beginner',
          agencyNotes: client?.notes || '',
          whiteLabel: agencyBranding?.white_label_reports ? { companyName: agencyBranding.company_name } : null,
        },
      });
      if (error) throw error;

      // Parse agency action items from report and create pending_optimizations
      const reportText = data?.report || '';
      const actionSection = reportText.match(/###\s*(?:📋\s*)?Agency Action Items([\s\S]*?)(?=###|$)/i)?.[1] || '';
      const actionItems = actionSection.match(/- \[[ x]?\]\s*(.+)/g) || [];
      if (actionItems.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        for (const item of actionItems) {
          const desc = item.replace(/- \[[ x]?\]\s*/, '').trim();
          if (desc && desc.length > 5) {
            await supabase.from('pending_optimizations').insert({
              brand_id: reportClientId,
              recommendation_type: 'agency_report',
              action_description: desc,
              status: 'pending',
            });
          }
        }
      }

      toast.success('Report generated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate report');
    }
    setIsGeneratingReport(false);
  };

  const handleSaveReview = async (data: any) => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !reviewBrandId) { setIsSaving(false); return; }

    await supabase.from('review_logs').insert({
      brand_id: reviewBrandId,
      reviewer_id: user.id,
      campaign_metrics: data.campaign_metrics,
      ad_level_data: data.ad_level_data,
      action_plan: actionPlan || null,
      notes: data.notes || null,
      approval_status: 'pending',
    });

    await supabase.from('brands').update({ last_review_date: new Date().toISOString().split('T')[0] }).eq('id', reviewBrandId);

    toast.success('Review saved');
    setIsSaving(false);
    setActionPlan('');
    loadData();
  };

  const handleGenerateActionPlan = async (data: any) => {
    setIsGenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-review-action-plan', {
        body: { brand_id: reviewBrandId, campaign_metrics: data.campaign_metrics, ad_level_data: data.ad_level_data, notes: data.notes },
      });
      if (error) throw error;
      setActionPlan(result?.action_plan || 'No action plan generated.');
      toast.success('Action plan generated');
    } catch (err) {
      toast.error('Failed to generate action plan');
    }
    setIsGenerating(false);
  };

  const handleApproveReview = async (reviewId: string) => {
    setApprovalLoadingId(reviewId);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('review_logs').update({
      approval_status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', reviewId);
    toast.success('Review approved ✅');
    setApprovalLoadingId(undefined);
    loadData();
  };

  const handleRejectReview = async (reviewId: string) => {
    setApprovalLoadingId(reviewId);
    await supabase.from('review_logs').update({ approval_status: 'dismissed' }).eq('id', reviewId);
    toast.success('Review dismissed');
    setApprovalLoadingId(undefined);
    loadData();
  };

  const handleGoalSaved = () => {
    loadData();
  };

  // Gate check
  if (!isAgencyUser && tier !== 'agency') {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Agency Feature</h2>
          <p className="text-muted-foreground">Ads Manager is only available for agency-tier accounts.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const healthCounts = {
    healthy: clients.filter((c) => c.health_status === 'healthy').length,
    watching: clients.filter((c) => c.health_status === 'watching').length,
    needs_attention: clients.filter((c) => c.health_status === 'needs_attention').length,
  };

  const existingBrandIds = clients.map((c: any) => c.brand_id);
  const availableBrands = (brands || []).filter((b) => !existingBrandIds.includes(b.id));
  const reviewClient = clients.find((c: any) => c.brand_id === reviewBrandId);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ads Manager</h1>
            <p className="text-sm text-muted-foreground">Manage all your clients, reviews, and reports in one place.</p>
          </div>
          {availableBrands.length > 0 && (
            <Button onClick={() => openEditDialog()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Client
            </Button>
          )}
        </div>

        {/* Health overview cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Healthy', count: healthCounts.healthy, emoji: '✅', bg: 'bg-green-500/10' },
            { label: 'Watching', count: healthCounts.watching, emoji: '⚠️', bg: 'bg-amber-500/10' },
            { label: 'Needs Attention', count: healthCounts.needs_attention, emoji: '🔴', bg: 'bg-destructive/10' },
          ].map((s) => (
            <Card key={s.label} className={s.bg}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.emoji} {s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview" className="text-xs"><LayoutDashboard className="h-3 w-3 mr-1" /> Clients</TabsTrigger>
            <TabsTrigger value="review" className="text-xs"><ClipboardCheck className="h-3 w-3 mr-1" /> Review</TabsTrigger>
            <TabsTrigger value="approve" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" /> Approve</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs"><FileText className="h-3 w-3 mr-1" /> Reports</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs"><History className="h-3 w-3 mr-1" /> Audit Log</TabsTrigger>
          </TabsList>

          {/* Clients Tab */}
          <TabsContent value="overview" className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading clients...</span>
              </div>
            ) : clients.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No clients yet. Add your first client to get started.</p></CardContent></Card>
            ) : (
              clients.map((client: any) => (
                <ClientScorecard
                  key={client.id}
                  client={client}
                  onEdit={openEditDialog}
                  onViewDetail={(brandId) => navigate(`/ads-manager/client/${brandId}`)}
                  onGoalSaved={handleGoalSaved}
                />
              ))
            )}
          </TabsContent>

          {/* Review Tab */}
          <TabsContent value="review" className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Select Client:</Label>
              <Select value={reviewBrandId} onValueChange={setReviewBrandId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.brand_id} value={c.brand_id}>{c.brand?.name || 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reviewBrandId && reviewClient ? (
              <>
                {actionPlan && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Generated Action Plan</CardTitle></CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{actionPlan}</p></CardContent>
                  </Card>
                )}
                <ReviewForm
                  brandName={reviewClient.brand?.name || ''}
                  brandId={reviewBrandId}
                  campaigns={reviewClient.campaigns || []}
                  onSave={handleSaveReview}
                  onGenerateActionPlan={handleGenerateActionPlan}
                  isGenerating={isGenerating}
                  isSaving={isSaving}
                />
              </>
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Select a client to begin a review.</CardContent></Card>
            )}
          </TabsContent>

          {/* Approve Tab */}
          <TabsContent value="approve">
            <ApprovalQueue reviews={reviewLogs} onApprove={handleApproveReview} onReject={handleRejectReview} loadingId={approvalLoadingId} />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            {weeklyReports.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No reports yet.</CardContent></Card>
            ) : (
              weeklyReports.map((r: any) => (
                <ReportDraftPreview
                  key={r.id}
                  report={r}
                  status="draft"
                  onApprove={() => toast.success('Report approved')}
                  onSend={() => toast.success('Report sent')}
                  onUpdateText={() => {}}
                />
              ))
            )}
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            {activeBrand?.id ? (
              <ActionHistoryTimeline brandId={activeBrand.id} />
            ) : (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Select a brand to view audit log.</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Add/Edit Client Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!editingClient && (
                <div>
                  <Label>Brand</Label>
                  <Select value={formData.brand_id} onValueChange={(v) => setFormData((prev) => ({ ...prev, brand_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a brand..." /></SelectTrigger>
                    <SelectContent>
                      {availableBrands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact Name</Label><Input value={formData.contact_name} onChange={(e) => setFormData((p) => ({ ...p, contact_name: e.target.value }))} /></div>
                <div><Label>Contact Email</Label><Input value={formData.contact_email} onChange={(e) => setFormData((p) => ({ ...p, contact_email: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Slack Client Channel</Label><Input value={formData.slack_client_channel} onChange={(e) => setFormData((p) => ({ ...p, slack_client_channel: e.target.value }))} /></div>
                <div><Label>Slack Internal Channel</Label><Input value={formData.slack_internal_channel} onChange={(e) => setFormData((p) => ({ ...p, slack_internal_channel: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Health Status</Label>
                <Select value={formData.health_status} onValueChange={(v) => setFormData((p) => ({ ...p, health_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthy">✅ Healthy</SelectItem>
                    <SelectItem value="watching">⚠️ Watching</SelectItem>
                    <SelectItem value="needs_attention">🔴 Needs Attention</SelectItem>
                    <SelectItem value="paused">⏸️ Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleSaveClient} className="w-full">{editingClient ? 'Update Client' : 'Add Client'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
