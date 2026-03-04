import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, FileText, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

  useEffect(() => {
    if (!brandId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('brand_id', brandId)
        .order('date_range_end', { ascending: true })
        .limit(52);
      setReports((data as unknown as WeeklyReport[]) || []);
      setLoading(false);
    })();
  }, [brandId]);

  if (loading || reports.length === 0) return null;

  const metric = METRICS.find(m => m.key === activeMetric)!;
  const chartData = reports.map(r => {
    const snap = (r.metrics_snapshot || {}) as Record<string, any>;
    return {
      week: format(parseISO(r.date_range_end), 'MMM d'),
      value: Number(snap[activeMetric] ?? snap[activeMetric.toUpperCase()] ?? 0),
    };
  });

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
          </div>
          <CardDescription>Week-over-week trends from your reports</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Past Reports List */}
      <Card variant="glow">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Past Reports</CardTitle>
          </div>
          <CardDescription>{reports.length} report{reports.length !== 1 ? 's' : ''} available</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
