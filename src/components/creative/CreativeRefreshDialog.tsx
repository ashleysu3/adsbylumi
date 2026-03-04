import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Sparkles, BarChart3, Zap, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatInvokeError } from '@/lib/formatInvokeError';

interface PerformanceData {
  hasData: boolean;
  summary: string;
  topFormats?: string[];
  topCopyAngles?: string[];
  keyPatterns?: string[];
  recommendations?: string[];
  adsAnalyzed?: number;
  dateRange?: string;
}

interface CreativeRefreshDialogProps {
  open: boolean;
  onClose: () => void;
  onBuildOnWhatWorks: (performanceContext: PerformanceData) => void;
  onStartFresh: () => void;
  brandId: string;
  campaignObjective?: string;
}

export function CreativeRefreshDialog({
  open,
  onClose,
  onBuildOnWhatWorks,
  onStartFresh,
  brandId,
  campaignObjective,
}: CreativeRefreshDialogProps) {
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);

  useEffect(() => {
    if (open && brandId) {
      fetchPerformanceData();
    }
  }, [open, brandId]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-past-creatives', {
        body: { brandId, campaignObjective: campaignObjective || 'sales' },
      });
      if (error) throw error;
      setPerformanceData(data);
    } catch (err: any) {
      console.error('Failed to fetch performance data:', err);
      setPerformanceData({ hasData: false, summary: formatInvokeError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
            Time for Fresh Creative
          </DialogTitle>
          <DialogDescription>
            Lumi analyzed your ad account to help you decide what to build next.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your past ad performance...</p>
          </div>
        ) : performanceData?.hasData ? (
          <div className="space-y-4">
            {/* Performance Summary */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4 text-primary" />
                Performance Snapshot
              </div>
              <p className="text-sm text-muted-foreground">{performanceData.summary}</p>
              {performanceData.adsAnalyzed && (
                <p className="text-xs text-muted-foreground">
                  {performanceData.adsAnalyzed} ads analyzed · {performanceData.dateRange}
                </p>
              )}
            </div>

            {/* Top Formats */}
            {performanceData.topFormats && performanceData.topFormats.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  Formats That Work
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {performanceData.topFormats.map((f, i) => (
                    <Badge key={i} variant="secondary" className="rounded-lg text-xs">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Top Copy Angles */}
            {performanceData.topCopyAngles && performanceData.topCopyAngles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Top Copy Angles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {performanceData.topCopyAngles.map((a, i) => (
                    <Badge key={i} variant="outline" className="rounded-lg text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}


            {performanceData.keyPatterns && performanceData.keyPatterns.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  What's Working
                </p>
                <ul className="space-y-1">
                  {performanceData.keyPatterns.map((p, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                variant="default"
                className="rounded-xl h-auto py-3 px-4 flex flex-col items-start text-left gap-1"
                onClick={() => onBuildOnWhatWorks(performanceData)}
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Build on What's Working
                </span>
                <span className="text-xs opacity-80 font-normal">
                  Generate angles inspired by your top performers
                </span>
              </Button>
              <Button
                variant="outline"
                className="rounded-xl h-auto py-3 px-4 flex flex-col items-start text-left gap-1"
                onClick={onStartFresh}
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Start Fresh
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  Explore entirely new creative directions
                </span>
              </Button>
            </div>
          </div>
        ) : (
          /* No performance data available */
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {performanceData?.summary || "No past ad data available yet. Let's start fresh!"}
              </p>
            </div>
            <Button
              className="w-full rounded-xl gap-2"
              onClick={onStartFresh}
            >
              Generate New Angles <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
