import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Copy, Check, FileText, Calendar, ChevronRight, Lock, Settings2, Hash, Send, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseReportSections, ReportLegendBar, ReportSectionRenderer } from './ReportSectionRenderer';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface CampaignOption {
  id: string;
  name: string;
  status?: string;
  templateName?: string | null;
}

interface ClientReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  campaigns?: CampaignOption[];
  initialReportText?: string;
}

interface PastReport {
  id: string;
  created_at: string;
  date_range_start: string;
  date_range_end: string;
  report_text: string;
  campaign_statuses: Record<string, string>;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function ClientReportModal({
  open,
  onOpenChange,
  brandId,
  dateRangeStart,
  dateRangeEnd,
  campaigns = [],
  initialReportText,
}: ClientReportModalProps) {
  const { tier } = useSubscription();
  const isAgency = tier === 'agency';

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [viewingPast, setViewingPast] = useState<string | null>(null);
  const [pastReportsLoading, setPastReportsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delivery settings
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [slackChannel, setSlackChannel] = useState('');
  const [autoSend, setAutoSend] = useState(false);
  const [sendDays, setSendDays] = useState<string[]>([]);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  useEffect(() => {
    if (open && brandId) {
      fetchPastReports();
      setSelectedIds(new Set(campaigns.map((c) => c.id)));
      if (initialReportText) {
        setReport(initialReportText);
      }
      if (isAgency) fetchDeliverySettings();
    }
    if (!open) {
      setReport(null);
      setViewingPast(null);
    }
  }, [open, brandId]);

  const fetchPastReports = async () => {
    setPastReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('id, created_at, date_range_start, date_range_end, report_text, campaign_statuses')
        .eq('brand_id', brandId)
        .order('date_range_end', { ascending: false })
        .limit(10);
      if (!error && data) {
        setPastReports(data as unknown as PastReport[]);
      }
    } catch (err) {
      console.error('Failed to load past reports:', err);
    } finally {
      setPastReportsLoading(false);
    }
  };

  const fetchDeliverySettings = async () => {
    try {
      const { data } = await supabase
        .from('digest_settings')
        .select('slack_channel_id, report_auto_send, send_days')
        .eq('brand_id', brandId)
        .maybeSingle();
      if (data) {
        setSlackChannel((data as any).slack_channel_id || '');
        setAutoSend((data as any).report_auto_send || false);
        setSendDays((data as any).send_days || []);
      }
    } catch (err) {
      console.error('Failed to load delivery settings:', err);
    }
  };

  const saveDeliverySettings = async () => {
    setSavingDelivery(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('digest_settings')
        .select('id')
        .eq('brand_id', brandId)
        .maybeSingle();

      const payload: any = {
        slack_channel_id: slackChannel || null,
        report_auto_send: autoSend,
        send_days: sendDays,
      };

      if (existing) {
        await supabase.from('digest_settings').update(payload).eq('brand_id', brandId);
      } else {
        await supabase.from('digest_settings').insert({
          ...payload,
          brand_id: brandId,
          created_by: session.user.id,
        });
      }
      toast.success('Delivery settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSavingDelivery(false);
    }
  };

  const testSlackSend = async () => {
    if (!slackChannel) { toast.error('Enter a Slack channel first'); return; }
    setTestingSend(true);
    try {
      const { error } = await supabase.functions.invoke('send-optimization-digest', {
        body: { brandId, reportId: 'test', slackOnly: true, slackChannelOverride: slackChannel },
      });
      if (error) throw error;
      toast.success('Test message sent to Slack!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test');
    } finally {
      setTestingSend(false);
    }
  };

  const toggleCampaign = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === campaigns.length ? new Set() : new Set(campaigns.map((c) => c.id)));
  };

  const toggleDay = (day: string) => {
    setSendDays((prev) => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const generateReport = async () => {
    if (selectedIds.size === 0) { toast.error('Select at least one campaign'); return; }
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-client-report', {
        body: { brandId, dateRangeStart, dateRangeEnd, selectedWorkspaceIds: Array.from(selectedIds) },
      });
      if (error) throw new Error(error.message || 'Failed to generate report');
      if (data?.error) throw new Error(data.error);
      setReport(data.report);
      fetchPastReports();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Report copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const rawReport = viewingPast
    ? pastReports.find((r) => r.id === viewingPast)?.report_text || null
    : report;

  const parsed = rawReport ? parseReportSections(rawReport) : null;

  const statusColor = (s?: string) => {
    const sl = (s || '').toLowerCase();
    if (sl === 'active' || sl === 'live') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    if (sl === 'paused') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <FileText className="h-5 w-5 text-primary" />
            {viewingPast ? 'Past Report' : 'Client Report'}
            {!isAgency && (
              <Badge variant="secondary" className="ml-2 text-[10px] gap-1">
                <Lock className="h-3 w-3" /> Agency
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Agency gate */}
          {!isAgency && !rawReport && !loading && (
            <div className="px-6 pb-6 flex flex-col items-center justify-center gap-4 py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2 max-w-sm">
                <h3 className="font-display font-bold text-lg">Agency Feature</h3>
                <p className="text-sm text-muted-foreground">
                  Client reports with Slack delivery and automated scheduling are available on the Agency plan.
                </p>
              </div>
              <Button variant="lumi" className="rounded-2xl" onClick={() => window.open('/pricing', '_blank')}>
                Upgrade to Agency
              </Button>
            </div>
          )}

          {/* Campaign selection */}
          {isAgency && !rawReport && !loading && (
            <div className="px-6 pb-6 space-y-4">
              {campaigns.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Select campaigns to include:</p>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                      {selectedIds.size === campaigns.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {campaigns.map((c) => (
                        <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                          <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleCampaign(c.id)} />
                          <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                          {c.status && (
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColor(c.status)}`}>{c.status}</Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <div className="text-center space-y-3 pt-2">
                <p className="text-muted-foreground text-sm">Generate a polished, copy-paste-ready weekly report with LUMI's strategic recommendations.</p>
                <Button onClick={generateReport} variant="lumi" size="lg" className="rounded-2xl" disabled={selectedIds.size === 0}>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report ({selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''})
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing campaigns and generating your report…</p>
            </div>
          )}

          {parsed && (
            <>
              {/* Legend + back button */}
              <div className="px-6 space-y-2 shrink-0">
                {viewingPast && (
                  <Button variant="ghost" size="sm" onClick={() => setViewingPast(null)} className="text-xs -ml-2">← Back to current</Button>
                )}
                <ReportLegendBar items={parsed.legend} />
              </div>

              {/* Report body — scrollable */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
                <div className="pb-4">
                  <ReportSectionRenderer sections={parsed.sections} />
                </div>
              </div>

              {/* Sticky footer */}
              <div className="border-t bg-background px-6 py-3 shrink-0 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {!viewingPast && (
                    <Button onClick={() => setReport(null)} variant="outline" size="sm" className="rounded-xl text-xs">
                      <FileText className="h-3.5 w-3.5 mr-1" /> New Report
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(rawReport!)} className="rounded-xl gap-1.5">
                    {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Report</>}
                  </Button>
                </div>

                {/* Delivery settings — agency only */}
                {isAgency && !viewingPast && (
                  <Collapsible open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-1.5">
                          <Settings2 className="h-3.5 w-3.5" />
                          Delivery Settings
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${deliveryOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-3">
                      {/* Slack channel */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                          Slack Channel
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g. client-reports"
                            value={slackChannel}
                            onChange={(e) => setSlackChannel(e.target.value)}
                            className="text-sm h-9 rounded-xl"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl shrink-0 text-xs gap-1"
                            onClick={testSlackSend}
                            disabled={testingSend || !slackChannel}
                          >
                            {testingSend ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Test
                          </Button>
                        </div>
                      </div>

                      {/* Schedule days */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Report Schedule</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map((day) => (
                            <button
                              key={day}
                              onClick={() => toggleDay(day)}
                              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors font-medium capitalize ${
                                sendDays.includes(day)
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Auto-send toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-medium">Auto-send to client</Label>
                          <p className="text-[10px] text-muted-foreground">
                            {autoSend ? 'Reports send automatically on scheduled days' : 'You\'ll review and approve before sending'}
                          </p>
                        </div>
                        <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                      </div>

                      <Button
                        onClick={saveDeliverySettings}
                        size="sm"
                        className="w-full rounded-xl text-xs"
                        disabled={savingDelivery}
                      >
                        {savingDelivery ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Save Delivery Settings
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </>
          )}

          {/* Past Reports accordion */}
          {pastReports.length > 0 && !rawReport && !loading && (
            <div className="px-6 pb-6">
              <Accordion type="single" collapsible className="border-t pt-2">
                <AccordionItem value="history" className="border-0">
                  <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Past Reports ({pastReports.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1.5">
                      {pastReports.map((pr) => (
                        <button
                          key={pr.id}
                          onClick={() => setViewingPast(pr.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors text-sm ${
                            viewingPast === pr.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{pr.date_range_start} – {pr.date_range_end}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {pr.campaign_statuses && Object.values(pr.campaign_statuses).map((emoji, i) => (
                              <span key={i} className="text-xs">{emoji as string}</span>
                            ))}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
