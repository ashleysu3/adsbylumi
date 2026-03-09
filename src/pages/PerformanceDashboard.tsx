import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart2, RefreshCw, Settings, Share2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import lumiLogo from "@/assets/lumi-logo.png";

const KPI_OPTIONS = [
  { value: 'cplpv', label: 'Cost per Landing Page View (CPLPV)', goalType: 'less_than', format: 'currency' },
  { value: 'cpc', label: 'Cost per Click (CPC)', goalType: 'less_than', format: 'currency' },
  { value: 'cpl', label: 'Cost per Lead (CPL)', goalType: 'less_than', format: 'currency' },
  { value: 'cppv', label: 'Cost per Profile Visit (CPPV)', goalType: 'less_than', format: 'currency' },
  { value: 'cp2sc', label: 'Cost per 2-Second Continuous View (CP2SC)', goalType: 'less_than', format: 'currency' },
  { value: 'roas', label: 'Return on Ad Spend (ROAS)', goalType: 'greater_than', format: 'multiplier' },
  { value: 'ctr', label: 'Click-Through Rate (CTR)', goalType: 'greater_than', format: 'percentage' },
  { value: 'cpm', label: 'Cost per 1,000 Impressions (CPM)', goalType: 'less_than', format: 'currency' },
  { value: 'purchases', label: 'Purchases (weekly count)', goalType: 'greater_than', format: 'number' },
];

function formatKpiValue(value: number, kpi: string) {
  if (['cpl', 'cpc', 'cplpv', 'cppv', 'cp2sc', 'cpm'].includes(kpi)) return `$${value.toFixed(2)}`;
  if (kpi === 'roas') return `${value.toFixed(1)}x`;
  if (kpi === 'ctr') return `${(value * 100).toFixed(1)}%`;
  return String(Math.round(value));
}

const DATE_RANGES = [
  { label: 'Last 3 days', days: 3 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
];

export default function PerformanceDashboard() {
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState(7);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestSettings, setDigestSettings] = useState({
    send_day: 'monday',
    send_time: '08:00',
    timezone: 'America/New_York',
    date_range_days: 7,
    additional_emails: [] as string[],
    enabled: true,
  });
  const [digestLoading, setDigestLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // Load cached report
  const loadCachedReport = useCallback(async () => {
    if (!activeBrand?.id) return;
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), dateRange), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('optimization_reports')
      .select('*')
      .eq('brand_id', activeBrand.id)
      .eq('date_range_start', startDate)
      .eq('date_range_end', endDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const createdAt = new Date(data.created_at);
      const hoursDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 3) {
        setReport(data);
        setLastUpdated(format(createdAt, 'MMM d, h:mm a'));
        return;
      }
    }

    // Also try to load most recent report regardless of date range
    const { data: latest } = await supabase
      .from('optimization_reports')
      .select('*')
      .eq('brand_id', activeBrand.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      setReport(latest);
      setLastUpdated(format(new Date(latest.created_at), 'MMM d, h:mm a'));
    }
  }, [activeBrand?.id, dateRange]);

  useEffect(() => { loadCachedReport(); }, [loadCachedReport]);

  // Load digest settings
  useEffect(() => {
    if (!activeBrand?.id) return;
    supabase
      .from('digest_settings')
      .select('*')
      .eq('brand_id', activeBrand.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDigestSettings({
            send_day: data.send_day,
            send_time: data.send_time,
            timezone: data.timezone,
            date_range_days: data.date_range_days,
            additional_emails: data.additional_emails || [],
            enabled: data.enabled ?? true,
          });
        }
      });
  }, [activeBrand?.id]);

  const runReport = async () => {
    if (!activeBrand?.id) return;
    setLoading(true);
    try {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), dateRange), 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('run-optimization-report', {
        body: { brandId: activeBrand.id, dateRangeStart: startDate, dateRangeEnd: endDate },
      });

      if (error) throw error;
      if (data?.report) {
        setReport(data.report);
        setLastUpdated(format(new Date(), 'MMM d, h:mm a'));
        toast.success('Performance report updated');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const saveDigestSettings = async () => {
    if (!activeBrand?.id) return;
    setDigestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('digest_settings')
        .upsert({
          brand_id: activeBrand.id,
          created_by: user.id,
          ...digestSettings,
        }, { onConflict: 'brand_id' });

      if (error) throw error;
      toast.success('Digest settings saved');
      setDigestOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setDigestLoading(false);
    }
  };

  const reportData = (report?.report_data || []) as any[];
  const summary = (report?.summary || { green: 0, yellow: 0, red: 0, unconfigured: 0, total: 0 }) as any;

  const configuredCampaigns = reportData.filter(c => c.has_goals && !['unconfigured', 'error', 'no_data'].includes(c.status));
  const unconfiguredCampaigns = reportData.filter(c => !c.has_goals || c.status === 'unconfigured');

  // Sort: red → yellow → green
  const sortedCampaigns = [...configuredCampaigns].sort((a, b) => {
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const statusDotClass = (status: string) => {
    if (status === 'green') return 'bg-green-500 animate-pulse';
    if (status === 'yellow') return 'bg-amber-400 animate-pulse';
    if (status === 'red') return 'bg-red-500 animate-pulse';
    return 'bg-muted-foreground/30';
  };

  const kpiStatusIcon = (value: number, threshold: number, goalType: string) => {
    const met = goalType === 'less_than' ? value <= threshold : value >= threshold;
    const close = goalType === 'less_than' ? value <= threshold * 1.25 : value >= threshold * 0.75;
    if (met) return '✅';
    if (close) return '🟡';
    return '🔴';
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-primary" />
              Weekly Performance
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Campaign health across your active ads</p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-1" /> Share
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                {report?.share_token ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Shareable Report Link</p>
                    <div className="flex gap-2">
                      <Input readOnly value={`https://adsbylumi.com/report/${report.share_token}`} className="text-xs" />
                      <Button size="sm" variant="outline" onClick={() => {
                        navigator.clipboard.writeText(`https://adsbylumi.com/report/${report.share_token}`);
                        toast.success('Link copied');
                      }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">This link shows a read-only snapshot. Anyone with the link can view it.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Run a report first to generate a shareable link.</p>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={() => setDigestOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={runReport} disabled={loading} size="sm" variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {loading ? 'Pulling Meta data...' : 'Run Report Now'}
            </Button>
          </div>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 flex-wrap">
          {DATE_RANGES.map(r => (
            <Button
              key={r.days}
              variant={dateRange === r.days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(r.days)}
            >
              {r.label}
            </Button>
          ))}
          {lastUpdated && (
            <span className="text-xs text-muted-foreground ml-auto">
              Last updated: {lastUpdated} · <button className="underline" onClick={runReport}>Refresh</button>
            </span>
          )}
        </div>

        {/* Summary Row */}
        {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Active campaigns</div>
            </CardContent></Card>
            <Card className="border-green-200 dark:border-green-800"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{summary.green}</div>
              <div className="text-xs text-muted-foreground">🟢 Green</div>
            </CardContent></Card>
            <Card className="border-amber-200 dark:border-amber-800"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{summary.yellow}</div>
              <div className="text-xs text-muted-foreground">🟡 Yellow</div>
            </CardContent></Card>
            <Card className="border-red-200 dark:border-red-800"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{summary.red}</div>
              <div className="text-xs text-muted-foreground">🔴 Need attention</div>
            </CardContent></Card>
          </div>
        )}

        {/* Campaign Cards */}
        {sortedCampaigns.length > 0 && (
          <div className="space-y-4">
            {sortedCampaigns.map((c, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${statusDotClass(c.status)}`} />
                      <CardTitle className="text-lg">{c.workspace_name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">LIVE</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* KPI rows */}
                  {c.goals && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{c.goals.primary_kpi_label}</span>
                        <span>
                          <span className="font-semibold">{formatKpiValue(c.primary_kpi_value, c.goals.primary_kpi)}</span>
                          <span className="text-muted-foreground ml-2">
                            Goal: {c.goals.primary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.primary_kpi_threshold, c.goals.primary_kpi)}
                          </span>
                          <span className="ml-2">{kpiStatusIcon(c.primary_kpi_value, c.goals.primary_kpi_threshold, c.goals.primary_kpi_goal_type)}</span>
                        </span>
                      </div>
                      {c.goals.secondary_kpi && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{c.goals.secondary_kpi_label}</span>
                          <span>
                            <span className="font-semibold">{formatKpiValue(c.secondary_kpi_value || 0, c.goals.secondary_kpi)}</span>
                            <span className="text-muted-foreground ml-2">
                              Goal: {c.goals.secondary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.secondary_kpi_threshold, c.goals.secondary_kpi)}
                            </span>
                            <span className="ml-2">{kpiStatusIcon(c.secondary_kpi_value || 0, c.goals.secondary_kpi_threshold, c.goals.secondary_kpi_goal_type)}</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Frequency</span>
                        <span>
                          <span className="font-semibold">{c.metrics?.frequency?.toFixed(1) || '0'}</span>
                          <span className="text-muted-foreground ml-2">Goal: &lt;{c.goals.frequency_threshold || 4}</span>
                          <span className="ml-2">{(c.metrics?.frequency || 0) < (c.goals.frequency_threshold || 4) ? '✅' : '⚠️'}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {c.recommendations?.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <img src={lumiLogo} className="h-4 w-4" alt="" /> LUMI RECOMMENDS
                      </div>
                      {c.recommendations.map((r: any, ri: number) => (
                        <div key={ri} className="text-sm flex gap-2 mb-1">
                          <span>{r.icon}</span>
                          <span>{r.action}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Budget hogs */}
                  {c.budget_hogs?.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                      {c.budget_hogs.map((h: any, hi: number) => (
                        <div key={hi} className="text-sm text-amber-800 dark:text-amber-200">
                          ⚠️ "{h.name}" spending {((h.spend / (c.metrics?.spend || 1)) * 100).toFixed(0)}% of budget at ${h.costPerResult.toFixed(2)} CPR
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/campaigns`)}>
                      View Campaign <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Unconfigured Campaigns */}
        {unconfiguredCampaigns.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Unconfigured</h3>
            {unconfiguredCampaigns.map((c, i) => (
              <Card key={i} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                      <span className="font-medium">{c.workspace_name}</span>
                      <Badge variant="outline" className="text-xs">LIVE</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">No performance goals set for this campaign. LUMI can't track performance without a target.</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => navigate('/campaigns')}>Set Goals →</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/campaigns')}>View Campaign →</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!report && !loading && (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active campaigns yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Once your campaigns are live, LUMI will track their performance here.</p>
              <Button onClick={() => navigate('/campaigns')}>Go to Campaigns →</Button>
            </CardContent>
          </Card>
        )}

        {/* Digest Settings Dialog */}
        <Dialog open={digestOpen} onOpenChange={setDigestOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Digest Settings</DialogTitle>
              <DialogDescription>Configure your weekly performance email digest.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Send digest on</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => (
                    <Button key={day} size="sm" variant={digestSettings.send_day === day ? 'default' : 'outline'}
                      onClick={() => setDigestSettings(p => ({ ...p, send_day: day }))}>
                      {day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3)}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Send time</Label>
                <Select value={digestSettings.send_time} onValueChange={v => setDigestSettings(p => ({ ...p, send_time: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0');
                      const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
                      return <SelectItem key={h} value={`${h}:00`}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Timezone</Label>
                <Select value={digestSettings.timezone} onValueChange={v => setDigestSettings(p => ({ ...p, timezone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','UTC','Europe/London'].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Review the last</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={1} max={30} value={digestSettings.date_range_days}
                    onChange={e => setDigestSettings(p => ({ ...p, date_range_days: parseInt(e.target.value) || 7 }))}
                    className="w-20" />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Additional recipients</Label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="email@example.com" value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newEmail.includes('@')) {
                        setDigestSettings(p => ({ ...p, additional_emails: [...p.additional_emails, newEmail] }));
                        setNewEmail('');
                      }
                    }} />
                  <Button size="sm" variant="outline" onClick={() => {
                    if (newEmail.includes('@')) {
                      setDigestSettings(p => ({ ...p, additional_emails: [...p.additional_emails, newEmail] }));
                      setNewEmail('');
                    }
                  }}>Add</Button>
                </div>
                {digestSettings.additional_emails.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {digestSettings.additional_emails.map((e, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer"
                        onClick={() => setDigestSettings(p => ({
                          ...p,
                          additional_emails: p.additional_emails.filter((_, idx) => idx !== i)
                        }))}>
                        {e} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable digest</Label>
                <Switch checked={digestSettings.enabled}
                  onCheckedChange={v => setDigestSettings(p => ({ ...p, enabled: v }))} />
              </div>
              <Button onClick={saveDigestSettings} disabled={digestLoading} className="w-full">
                {digestLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
