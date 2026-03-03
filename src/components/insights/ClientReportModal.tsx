import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, FileText, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ClientReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
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
}: ClientReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [viewingPast, setViewingPast] = useState<string | null>(null);
  const [pastReportsLoading, setPastReportsLoading] = useState(false);

  useEffect(() => {
    if (open && brandId) {
      fetchPastReports();
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

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-client-report', {
        body: { brandId, dateRangeStart, dateRangeEnd },
      });

      if (error) throw new Error(error.message || 'Failed to generate report');
      if (data?.error) throw new Error(data.error);

      setReport(data.report);
      // Refresh past reports list
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
    } catch {
      toast.error('Failed to copy');
    }
  };

  const displayedReport = viewingPast
    ? pastReports.find((r) => r.id === viewingPast)?.report_text || null
    : report;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <FileText className="h-5 w-5 text-primary" />
            {viewingPast ? 'Past Report' : 'Client Report'}
          </DialogTitle>
        </DialogHeader>

        {/* Main content */}
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {!displayedReport && !loading && (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">
                Generate a polished, copy-paste-ready weekly report for your client.
              </p>
              <Button
                onClick={generateReport}
                variant="lumi"
                size="lg"
                className="rounded-2xl"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing campaigns and generating your report…
              </p>
            </div>
          )}

          {displayedReport && (
            <>
              <div className="flex items-center justify-between gap-2">
                {viewingPast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewingPast(null)}
                    className="text-xs"
                  >
                    ← Back to current
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(displayedReport)}
                  className="rounded-xl gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Report
                    </>
                  )}
                </Button>
              </div>

              <ScrollArea className="flex-1 max-h-[50vh]">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans p-4 bg-muted/30 rounded-xl border">
                  {displayedReport}
                </pre>
              </ScrollArea>

              {!viewingPast && (
                <Button
                  onClick={generateReport}
                  variant="outline"
                  size="sm"
                  className="self-center rounded-xl text-xs"
                  disabled={loading}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Regenerate
                </Button>
              )}
            </>
          )}

          {/* Past Reports */}
          {pastReports.length > 0 && (
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
                          viewingPast === pr.id
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">
                            {pr.date_range_start} – {pr.date_range_end}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {pr.campaign_statuses &&
                            Object.values(pr.campaign_statuses).map((emoji, i) => (
                              <span key={i} className="text-xs">
                                {emoji}
                              </span>
                            ))}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
