import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ClientHealthBadge } from '@/components/ads-manager/ClientHealthBadge';
import { ActionHistoryTimeline } from '@/components/insights/ActionHistoryTimeline';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function AdsManagerClient() {
  const { id: brandId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [brandRes, clientRes, campRes, goalsRes, reviewsRes] = await Promise.all([
        supabase.from('brands').select('*').eq('id', brandId).single(),
        supabase.from('agency_clients').select('*').eq('brand_id', brandId).maybeSingle(),
        supabase.from('campaign_workspaces').select('id, name, progress_status, meta_campaign_status, offer_name').eq('brand_id', brandId).eq('archived', false),
        supabase.from('campaign_goals').select('*').eq('brand_id', brandId),
        supabase.from('review_logs').select('*').eq('brand_id', brandId).order('review_date', { ascending: false }).limit(10),
      ]);

      if (brandRes.error) throw new Error(`Failed to load brand: ${brandRes.error.message}`);

      setBrand(brandRes.data);
      setClient(clientRes.data ?? null);
      setCampaigns(campRes.data || []);
      setGoals(goalsRes.data || []);
      setReviews((reviewsRes.data as any[]) || []);
    } catch (e: any) {
      console.error("AdsManagerClient fetch error:", e);
      setError(e.message || "Failed to load client data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [brandId]);

  if (loading) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading...</div></DashboardLayout>;
  if (error) return (
    <DashboardLayout>
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchData}>Try again</Button>
      </div>
    </DashboardLayout>
  );
  if (!brand) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Brand not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/ads-manager')}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              {brand.name}
              {client && <ClientHealthBadge status={client.health_status} />}
            </h1>
            <p className="text-xs text-muted-foreground">
              {brand.meta_account_id ? `Meta Account: ${brand.meta_account_id}` : 'No ad account connected'}
              {client?.contact_name && ` · ${client.contact_name}`}
              {client?.contact_email && ` · ${client.contact_email}`}
            </p>
          </div>
        </div>

        {/* Client Notes */}
        {client?.notes && (
          <Card className="bg-muted/20">
            <CardContent className="py-3 text-sm">{client.notes}</CardContent>
          </Card>
        )}

        {/* Campaigns with KPIs */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Campaigns ({campaigns.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active campaigns.</p>
            ) : (
              campaigns.map((c) => {
                const goal = goals.find((g: any) => g.workspace_id === c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30">
                    <div>
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.offer_name && <span className="text-xs text-muted-foreground ml-2">· {c.offer_name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {goal && (
                        <Badge variant="outline" className="text-[10px]">
                          {goal.primary_kpi_label}: {goal.primary_kpi_goal_type === 'less_than' ? '≤' : '≥'} {goal.primary_kpi_threshold}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{c.progress_status}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Reviews</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              reviews.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                  <span>{format(new Date(r.review_date), 'EEE, MMM d yyyy')}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      r.approval_status === 'approved' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                      r.approval_status === 'pending' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }>{r.approval_status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Audit Log */}
        {brandId && <ActionHistoryTimeline brandId={brandId} />}
      </div>
    </DashboardLayout>
  );
}
