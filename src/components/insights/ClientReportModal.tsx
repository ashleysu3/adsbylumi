import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Copy, Check, FileText, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseReportSections, ReportLegendBar, ReportSectionRenderer } from './ReportSectionRenderer';

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
  /** Pre-set a past report to view (read-only mode) */
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

export function ClientReportModal({
  open,
  onOpenChange,
  brandId,
  dateRangeStart,
  dateRangeEnd,
  campaigns = [],
  initialReportText,
}: ClientReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [viewingPast, setViewingPast] = useState<string | null>(null);
  const [pastReportsLoading, setPastReportsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && brandId) {
      fetchPastReports();
      setSelectedIds(new Set(campaigns.map((c) => c.id)));
      if (initialReportText) {
        setReport(initialReportText);
      }
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <FileText className="h-5 w-5 text-primary" />
            {viewingPast ? 'Past Report' : 'Client Report'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          {/* Campaign selection */}
          {!rawReport && !loading && (
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
              {/* Legend + back button (sticky) */}
              <div className="px-6 space-y-2">
                {viewingPast && (
                  <Button variant="ghost" size="sm" onClick={() => setViewingPast(null)} className="text-xs -ml-2">← Back to current</Button>
                )}
                <ReportLegendBar items={parsed.legend} />
              </div>

              {/* Report body */}
              <ScrollArea className="flex-1 min-h-0 px-6 py-3">
                <div className="pb-4">
                  <ReportSectionRenderer sections={parsed.sections} />
                </div>
              </ScrollArea>

              {/* Sticky footer */}
              <div className="border-t bg-background px-6 py-3 flex items-center justify-between gap-2">
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
