import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, FileText, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface WeeklyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  metrics_snapshot: any;
  report_text: string;
  campaign_statuses: Record<string, string>;
  created_at: string;
}

const METRICS = [
  { key: 'spend', label: 'Spend', color: 'hsl(var(--primary))', format: (v: number) => `$${v?.toFixed(0) ?? 0}` },
  { key: 'cpl', label: 'CPL', color: '#f59e0b', format: (v: number) => `$${v?.toFixed(2) ?? 0}` },
  { key: 'ctr', label: 'CTR', color: '#10b981', format: (v: number) => `${v?.toFixed(2) ?? 0}%` },
  { key: 'roas', label: 'ROAS', color: '#8b5cf6', format: (v: number) => `${v?.toFixed(2) ?? 0}x` },
];

interface Props {
  brandId: string;
  onViewReport: (reportText: string) => void;
}

export function PerformanceHistoryCard({ brandId, onViewReport }: Props) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [activeMetric, setActiveMetric] = useState('spend');
  const [loading, setLoading] = useState(true);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [hasPublishedCampaigns, setHasPublishedCampaigns] = useState(false);
  const autoGenAttempted = useRef(false);

  useEffect(() => {
    if (!brandId) return;
    (async () => {
      setLoading(true);

      // Fetch reports and check for published campaigns in parallel
      const [reportsRes, campaignsRes] = await Promise.all([
        supabase
          .from('weekly_reports')
          .select('*')
          .eq('brand_id', brandId)
          .order('date_range_end', { ascending: true })
          .limit(52),
        supabase
          .from('campaign_workspaces')
          .select('id, meta_campaign_ids, meta_campaign_status')
          .eq('brand_id', brandId)
          .not('meta_campaign_ids', 'is', null)
          .limit(10),
      ]);

      const fetchedReports = (reportsRes.data as unknown as WeeklyReport[]) || [];
      setReports(fetchedReports);

      const published = (campaignsRes.data || []).filter((w: any) => {
        const cid = w.meta_campaign_ids?.campaignId;
        return cid && w.meta_campaign_status !== 'draft';
      });
      setHasPublishedCampaigns(published.length > 0);

      setLoading(false);
    })();
  }, [brandId]);

  // Auto-generate report if published campaigns exist but no recent report
  useEffect(() => {
    if (loading || autoGenAttempted.current || !hasPublishedCampaigns) return;
    if (reports.length > 0) {
      // Check if latest report is older than 7 days
      const latest = reports[reports.length - 1];
      const daysSince = (Date.now() - new Date(latest.date_range_end).getTime()) / 86400000;
      if (daysSince < 7) return;
    }
    autoGenAttempted.current = true;
    triggerAutoGenerate();
  }, [loading, hasPublishedCampaigns, reports]);

  const triggerAutoGenerate = async () => {
    setAutoGenerating(true);
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

      const { data, error } = await supabase.functions.invoke('generate-client-report', {
        body: {
          brandId,
          dateRangeStart: thirtyDaysAgo.toISOString().split('T')[0],
          dateRangeEnd: now.toISOString().split('T')[0],
        },
      });

      if (error) throw error;
      if (data?.report) {
        // Refetch reports
        const { data: refreshed } = await supabase
          .from('weekly_reports')
          .select('*')
          .eq('brand_id', brandId)
          .order('date_range_end', { ascending: true })
          .limit(52);
        setReports((refreshed as unknown as WeeklyReport[]) || []);
        toast.success('Performance report auto-generated');
      }
    } catch (err: any) {
      console.error('Auto-generate report failed:', err);
      // Silent fail — don't toast errors for auto-generation
    } finally {
      setAutoGenerating(false);
    }
  };

  const hasReports = reports.length > 0;
  const metric = METRICS.find(m => m.key === activeMetric)!;

  const chartData = hasReports
    ? reports.map(r => {
        const snap = (r.metrics_snapshot || {}) as Record<string, any>;
        // Aggregate across all campaigns in snapshot
        let total = 0;
        let count = 0;
        Object.values(snap).forEach((campaign: any) => {
          if (campaign && typeof campaign === 'object' && activeMetric in campaign) {
            total += Number(campaign[activeMetric] || 0);
            count++;
          }
        });
        // For rate metrics (cpl, ctr, roas), average; for spend, sum
        const value = activeMetric === 'spend' ? total : count > 0 ? total / count : 0;
        return {
          week: format(parseISO(r.date_range_end), 'MMM d'),
          value,
        };
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card variant="glow">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle>Performance History</CardTitle>
            </div>
            {hasReports && (
              <div className="flex gap-1">
                {METRICS.map(m => (
                  <Button
                    key={m.key}
                    variant={activeMetric === m.key ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    onClick={() => setActiveMetric(m.key)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <CardDescription>Week-over-week trends from your reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || autoGenerating ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">{autoGenerating ? 'Generating your first performance report…' : 'Loading…'}</p>
            </div>
          ) : hasReports ? (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => metric.format(v)} width={60} />
                  <Tooltip formatter={(v: number) => [metric.format(v), metric.label]} />
                  <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Clock className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Not enough data yet</p>
                <p className="text-xs max-w-[300px]">
                  {hasPublishedCampaigns
                    ? 'Your campaigns need a few more days of data before we can generate your first report. Check back soon!'
                    : 'Once you launch your first campaign, performance reports will appear here automatically.'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Reports List */}
      <Card variant="glow">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Past Reports</CardTitle>
          </div>
          <CardDescription>
            {hasReports
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} available`
              : 'Reports will appear here as they are generated'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasReports ? (
            <div className="space-y-1">
              {[...reports].reverse().map(r => (
                <button
                  key={r.id}
                  onClick={() => onViewReport(r.report_text)}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors hover:bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">
                      {format(parseISO(r.date_range_start), 'MMM d')} – {format(parseISO(r.date_range_end), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.campaign_statuses && Object.values(r.campaign_statuses).map((emoji, i) => (
                      <span key={i} className="text-xs">{emoji as string}</span>
                    ))}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <p className="text-sm">No reports yet — they'll auto-generate when campaign data is available.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
