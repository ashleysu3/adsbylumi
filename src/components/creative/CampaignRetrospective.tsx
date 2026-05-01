import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Sparkles, Lightbulb, Trophy, AlertTriangle, Target,
  CheckCircle2, XCircle, Info, Share2, Download,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ShareRetrospectiveDialog } from '@/components/creative/ShareRetrospectiveDialog';

// ============================================================================
// CampaignRetrospective (Patch #27 — reframed + share/print)
//
// Patch #27 changes:
//   - Section labels: "What worked" / "What underperformed (and why)" /
//     "Worth testing next" — softer, learning-not-blame framing.
//   - Renders the new `narrative` field at the top (plain-English debrief).
//   - Share button → opens email-share dialog.
//   - Download PDF button → window.print() with print CSS that hides app
//     chrome and shows a branded header.
//   - Hidden branded print header pulls from agency_branding (when set)
//     so agencies sending to clients get their own logo + colors.
// ============================================================================

export interface CampaignRetrospectiveJSON {
  summary: string;
  narrative?: string;
  stats: {
    total_spend: number;
    total_results: number;
    avg_cpl: number | null;
    duration_days: number | null;
    objective: string | null;
    primary_kpi?: string | null;
    primary_kpi_label?: string | null;
    goal_label?: string | null;
    goal_threshold?: number | null;
    goal_unit?: string | null;
    goal_direction?: 'less_than' | 'greater_than' | null;
    goal_actual?: number | null;
    goal_hit?: boolean | null;
    goal_delta_pct?: number | null;
  };
  data_quality?: 'high' | 'medium' | 'low' | 'insufficient';
  data_quality_note?: string;
  wins: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  misses: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  recommendations: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  generated_at: string;
}

interface BrandHeaderInfo {
  campaignName: string;
  brandName: string;
  agencyLogoUrl: string | null;
  agencyName: string | null;
  primaryColor: string;
  whiteLabel: boolean;
}

interface Props {
  workspaceId: string;
  initialRetrospective?: CampaignRetrospectiveJSON | null;
  onGenerated?: (retro: CampaignRetrospectiveJSON) => void;
  onRequestRegenerate?: () => void;
}

export function CampaignRetrospective({
  workspaceId, initialRetrospective, onGenerated, onRequestRegenerate,
}: Props) {
  const [retro, setRetro] = useState<CampaignRetrospectiveJSON | null>(initialRetrospective || null);
  const [generating, setGenerating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [headerInfo, setHeaderInfo] = useState<BrandHeaderInfo | null>(null);

  // Load brand + agency_branding for the print header.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ws } = await supabase
        .from('campaign_workspaces')
        .select('brand_id, name, offer_name')
        .eq('id', workspaceId).maybeSingle();
      if (!ws || cancelled) return;
      const [{ data: brand }, { data: agency }] = await Promise.all([
        supabase.from('brands').select('id, name').eq('id', ws.brand_id).maybeSingle(),
        supabase.from('agency_branding')
          .select('logo_url, company_name, primary_color, white_label_reports')
          .eq('brand_id', ws.brand_id).maybeSingle(),
      ]);
      if (cancelled) return;
      const useWhite = !!agency?.white_label_reports;
      setHeaderInfo({
        campaignName: ws.offer_name || ws.name || 'Campaign',
        brandName: brand?.name || '',
        agencyLogoUrl: useWhite ? (agency?.logo_url || null) : null,
        agencyName: useWhite ? (agency?.company_name || null) : null,
        primaryColor: (useWhite && agency?.primary_color) || '#7c3aed',
        whiteLabel: useWhite,
      });
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-retrospective', {
        body: { workspaceId },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success || !data?.retrospective) throw new Error(data?.error || 'No retrospective returned');
      setRetro(data.retrospective);
      onGenerated?.(data.retrospective);
      toast.success('Retrospective ready');
    } catch (err: any) {
      toast.error('Could not generate retrospective: ' + (err?.message || 'unknown'));
    } finally {
      setGenerating(false);
    }
  };

  const handleClickGenerate = () => {
    if (onRequestRegenerate) onRequestRegenerate();
    else handleGenerate();
  };

  const handlePrint = () => {
    // Print CSS hides everything except .lumi-printable. The user picks
    // "Save as PDF" in their browser's print dialog.
    document.body.classList.add('lumi-printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('lumi-printing');
    }, 50);
  };

  if (!retro) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div>
            <p className="font-semibold">No retrospective yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Lumi will pull this campaign's Meta performance, measure it against your goal, and produce a plain-English debrief you can share.
            </p>
          </div>
          <Button variant="lumi" className="gap-1.5" onClick={handleClickGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Analyzing…' : 'Generate retrospective'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dq = retro.data_quality || 'medium';
  const insufficient = dq === 'insufficient';
  const goalSet = retro.stats.goal_threshold != null;

  return (
    <>
      {/* Inline print styles. Scoped via .lumi-printing on <body> so they
          only apply during a print operation. */}
      <style>{printCSS}</style>

      <div className="lumi-printable space-y-4">
        {/* Branded print-only header */}
        {headerInfo && (
          <div className="lumi-print-only" style={{ display: 'none' }}>
            <div className="lumi-print-header" style={{ borderBottomColor: headerInfo.primaryColor }}>
              <div className="lumi-print-brand">
                {headerInfo.agencyLogoUrl ? (
                  <img src={headerInfo.agencyLogoUrl} alt={headerInfo.agencyName || ''} className="lumi-print-logo" />
                ) : null}
                <div>
                  <div className="lumi-print-eyebrow">
                    {(headerInfo.whiteLabel ? headerInfo.agencyName : headerInfo.brandName) || 'Campaign'} · Campaign Retrospective
                  </div>
                  <div className="lumi-print-title">{headerInfo.campaignName}</div>
                  <div className="lumi-print-date">Generated {new Date(retro.generated_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* On-screen header with action buttons */}
        <div className="lumi-screen-only flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Generated {new Date(retro.generated_at).toLocaleString()}
            </p>
            <h3 className="text-lg font-semibold mt-1">{retro.summary}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="gap-1.5" disabled={insufficient}>
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5" disabled={insufficient}>
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleClickGenerate} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Refreshing…' : 'Regenerate'}
            </Button>
          </div>
        </div>

        {/* Print-only summary (so the PDF leads with the takeaway) */}
        <p className="lumi-print-only" style={{ display: 'none', fontSize: '15px', fontWeight: 600, color: '#111827' }}>
          {retro.summary}
        </p>

        {/* Goal vs actual */}
        {goalSet ? <GoalVsActual stats={retro.stats} /> : <NoGoalCard />}

        {/* Data quality warning */}
        {(dq === 'low' || dq === 'insufficient') && retro.data_quality_note && (
          <Card className={cn(
            'border-amber-500/40 bg-amber-500/5',
            insufficient && 'border-destructive/40 bg-destructive/5',
          )}>
            <CardContent className="p-3 flex gap-2 items-start">
              <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', insufficient ? 'text-destructive' : 'text-amber-600')} />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">
                  {insufficient ? 'Not enough data for a confident debrief' : 'Limited data — read with caution'}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{retro.data_quality_note}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Spend" value={fmtCurrency(retro.stats.total_spend)} />
          <StatTile label="Results" value={fmtNumber(retro.stats.total_results)} />
          <StatTile label={'Avg ' + (retro.stats.primary_kpi_label || 'cost / result')} value={retro.stats.avg_cpl != null ? fmtCurrency(retro.stats.avg_cpl) : '—'} />
          <StatTile label="Duration" value={retro.stats.duration_days != null ? `${retro.stats.duration_days}d` : '—'} />
        </div>

        {/* Plain-English narrative */}
        {retro.narrative && (
          <Card className="rounded-2xl">
            <CardContent className="p-5 prose prose-sm max-w-none text-foreground">
              {retro.narrative.split(/\n\n+/).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-foreground">{para}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Sections — only when we have confident data */}
        {!insufficient && (
          <>
            <Section
              title="What worked"
              icon={<Trophy className="h-4 w-4 text-emerald-600" />}
              items={retro.wins}
              emptyText="No standout wins surfaced — typically means the data was thin or evenly distributed."
              accentClass="bg-emerald-500/5 border-emerald-500/30"
            />
            <Section
              title="What underperformed (and why)"
              icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
              items={retro.misses}
              emptyText="No clear underperformers stood out."
              accentClass="bg-amber-500/5 border-amber-500/30"
              subtitle="This isn't about blame — it's the pattern to learn from for the next round."
            />
            <Section
              title="Worth testing next"
              icon={<Lightbulb className="h-4 w-4 text-primary" />}
              items={retro.recommendations}
              emptyText="No specific test ideas surfaced."
              accentClass="bg-primary/5 border-primary/30"
              showArrow
            />
          </>
        )}
      </div>

      {/* Share dialog */}
      <ShareRetrospectiveDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        workspaceId={workspaceId}
        campaignName={headerInfo?.campaignName || 'this campaign'}
      />
    </>
  );
}

function GoalVsActual({ stats }: { stats: CampaignRetrospectiveJSON['stats'] }) {
  const hit = stats.goal_hit;
  const noActual = stats.goal_actual == null;
  const Icon = hit ? CheckCircle2 : noActual ? Info : XCircle;
  const tone = hit ? 'border-emerald-500/40 bg-emerald-500/5'
    : noActual ? 'border-blue-500/40 bg-blue-500/5'
      : 'border-destructive/40 bg-destructive/5';
  const textTone = hit ? 'text-emerald-700' : noActual ? 'text-blue-700' : 'text-destructive';
  const headline = hit ? 'Goal hit' : noActual ? 'Goal — actual not measurable yet' : 'Goal missed';

  const goalStr = formatGoalLine(stats);
  const actualStr = formatActualLine(stats);
  const deltaStr = stats.goal_delta_pct != null && !noActual
    ? `${Math.abs(stats.goal_delta_pct).toFixed(1)}% ${hit ? 'better than target' : 'off target'}`
    : null;

  return (
    <Card className={cn('rounded-2xl', tone)}>
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className={cn('h-6 w-6 shrink-0 mt-0.5', textTone)} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', textTone)}>{headline}</p>
          <p className="text-base font-bold mt-0.5">
            {goalStr}{actualStr && <> → <span className={textTone}>{actualStr}</span></>}
          </p>
          {deltaStr && <p className="text-xs text-muted-foreground mt-0.5">{deltaStr}</p>}
        </div>
        <Target className="h-5 w-5 text-muted-foreground/50 shrink-0" />
      </CardContent>
    </Card>
  );
}

function NoGoalCard() {
  return (
    <Card className="rounded-2xl border-dashed bg-muted/20">
      <CardContent className="p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold">No goal was set for this campaign</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The debrief below reflects what happened, but without a goal you can't say whether it was a "win" or "miss." Re-generate after setting a goal for a sharper read.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function Section({
  title, subtitle, icon, items, emptyText, accentClass, showArrow,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  items: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  emptyText: string;
  accentClass: string;
  showArrow?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground -mt-1">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className={cn('rounded-lg border p-3', accentClass)}>
              <p className="text-sm font-medium">
                {showArrow && '→ '}{item.insight}
              </p>
              {item.supporting_data && (
                <p className="text-xs text-muted-foreground mt-1.5">{item.supporting_data}</p>
              )}
              <div className="mt-1.5">
                <ConfidencePill confidence={item.confidence} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    medium: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    low: 'bg-muted text-muted-foreground border-muted',
  }[confidence];
  return <Badge variant="outline" className={cn('text-[10px] capitalize', styles)}>{confidence} confidence</Badge>;
}

function formatGoalLine(stats: CampaignRetrospectiveJSON['stats']): string {
  if (stats.goal_threshold == null) return '';
  const arrow = stats.goal_direction === 'greater_than' ? '≥' : '≤';
  const v = formatValue(stats.goal_threshold, stats.goal_unit || '');
  return `${stats.goal_label || 'Goal'} ${arrow} ${v}`;
}
function formatActualLine(stats: CampaignRetrospectiveJSON['stats']): string | null {
  if (stats.goal_actual == null) return null;
  return formatValue(stats.goal_actual, stats.goal_unit || '');
}
function formatValue(n: number, unit: string): string {
  if (unit === '$') return `$${n.toFixed(2)}`;
  if (unit === 'x') return `${n.toFixed(2)}x`;
  if (unit === '%') return `${n.toFixed(2)}%`;
  return String(n);
}
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtNumber(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}

// ---------------------------------------------------------------------------
// Print CSS — only applies when body has class `lumi-printing`. Keeps
// browser print-to-PDF hiding everything except `.lumi-printable` and
// showing the branded header.
// ---------------------------------------------------------------------------
const printCSS = `
@media print {
  body.lumi-printing * { visibility: hidden !important; }
  body.lumi-printing .lumi-printable, body.lumi-printing .lumi-printable * { visibility: visible !important; }
  body.lumi-printing .lumi-printable {
    position: absolute !important; left: 0 !important; top: 0 !important;
    width: 100% !important; padding: 0 !important;
  }
  body.lumi-printing .lumi-screen-only { display: none !important; }
  body.lumi-printing .lumi-print-only { display: block !important; }
  body.lumi-printing .lumi-print-header {
    border-bottom: 4px solid #7c3aed;
    padding: 16px 24px 12px; margin-bottom: 18px;
  }
  body.lumi-printing .lumi-print-brand { display: flex; gap: 16px; align-items: flex-start; }
  body.lumi-printing .lumi-print-logo { max-height: 48px; max-width: 220px; object-fit: contain; }
  body.lumi-printing .lumi-print-eyebrow {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
    color: #6b7280; font-weight: 600;
  }
  body.lumi-printing .lumi-print-title { font-size: 22px; font-weight: 700; color: #111827; margin-top: 2px; }
  body.lumi-printing .lumi-print-date { font-size: 11px; color: #6b7280; margin-top: 4px; }
  @page { size: letter; margin: 0.5in; }
}
`;
