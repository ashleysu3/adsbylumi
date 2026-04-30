import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Sparkles, Lightbulb, Trophy, AlertTriangle, Target, CheckCircle2, XCircle, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// CampaignRetrospective (Patch #24)
//
// Renders the retrospective report. Patch #24 changes:
//   - Goal-vs-actual block is the FIRST thing the user sees (when a goal
//     was set). Big "Hit" / "Missed" / "No goal set" framing.
//   - Data quality banner above the report when AI flagged 'low' or
//     'insufficient'. Tells the user the analysis is on thin ice.
//   - Stats strip below the goal block.
//   - Wins / Misses / Recommendations in cards as before, but skipped
//     entirely when data_quality === 'insufficient'.
// ============================================================================

export interface CampaignRetrospectiveJSON {
  summary: string;
  stats: {
    total_spend: number;
    total_results: number;
    avg_cpl: number | null;
    duration_days: number | null;
    objective: string | null;
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

interface Props {
  workspaceId: string;
  initialRetrospective?: CampaignRetrospectiveJSON | null;
  onGenerated?: (retro: CampaignRetrospectiveJSON) => void;
  /** Triggers the patch #24 setup dialog when the user wants to (re)generate. */
  onRequestRegenerate?: () => void;
}

export function CampaignRetrospective({
  workspaceId, initialRetrospective, onGenerated, onRequestRegenerate,
}: Props) {
  const [retro, setRetro] = useState<CampaignRetrospectiveJSON | null>(initialRetrospective || null);
  const [generating, setGenerating] = useState(false);

  // Same-flow generation (no setup dialog) — used as a fallback when
  // onRequestRegenerate isn't provided. Calls the function with no goal
  // override, so it'll use stored campaign_goals if any.
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-retrospective', {
        body: { workspaceId },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success || !data?.retrospective) {
        throw new Error(data?.error || 'No retrospective returned');
      }
      setRetro(data.retrospective);
      onGenerated?.(data.retrospective);
      toast.success('Retrospective ready');
    } catch (err: any) {
      console.error('retrospective failed:', err);
      toast.error('Could not generate retrospective: ' + (err?.message || 'unknown'));
    } finally {
      setGenerating(false);
    }
  };

  const handleClickGenerate = () => {
    if (onRequestRegenerate) onRequestRegenerate();
    else handleGenerate();
  };

  if (!retro) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div>
            <p className="font-semibold">No retrospective yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Lumi will pull this campaign's Meta performance, measure it against your goal, and produce a post-mortem you can use to inform the next campaign.
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
    <div className="space-y-4">
      {/* Header with regenerate */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Generated {new Date(retro.generated_at).toLocaleString()}
          </p>
          <h3 className="text-lg font-semibold mt-1">{retro.summary}</h3>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={handleClickGenerate}
          disabled={generating}
          className="gap-1.5 shrink-0"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'Refreshing…' : 'Regenerate'}
        </Button>
      </div>

      {/* GOAL vs ACTUAL — the headline */}
      {goalSet ? <GoalVsActual stats={retro.stats} /> : <NoGoalCard />}

      {/* Data quality warning when low/insufficient */}
      {(dq === 'low' || dq === 'insufficient') && retro.data_quality_note && (
        <Card className={cn(
          'border-amber-500/40 bg-amber-500/5',
          insufficient && 'border-destructive/40 bg-destructive/5',
        )}>
          <CardContent className="p-3 flex gap-2 items-start">
            <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', insufficient ? 'text-destructive' : 'text-amber-600')} />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">
                {insufficient ? 'Not enough data for a confident retrospective' : 'Limited data — read with caution'}
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
        <StatTile label="Avg cost / result" value={retro.stats.avg_cpl != null ? fmtCurrency(retro.stats.avg_cpl) : '—'} />
        <StatTile label="Duration" value={retro.stats.duration_days != null ? `${retro.stats.duration_days}d` : '—'} />
      </div>

      {/* Wins/Misses/Recs — suppressed when insufficient */}
      {!insufficient && (
        <>
          <Section
            title="What worked"
            icon={<Trophy className="h-4 w-4 text-emerald-600" />}
            items={retro.wins}
            emptyText="No clear wins surfaced — typically means the data was thin."
            accentClass="bg-emerald-500/5 border-emerald-500/30"
          />
          <Section
            title="What didn't"
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            items={retro.misses}
            emptyText="No clear misses called out."
            accentClass="bg-amber-500/5 border-amber-500/30"
          />
          <Section
            title="What to do differently next time"
            icon={<Lightbulb className="h-4 w-4 text-primary" />}
            items={retro.recommendations}
            emptyText="No specific recommendations."
            accentClass="bg-primary/5 border-primary/30"
            showArrow
          />
        </>
      )}
    </div>
  );
}

function GoalVsActual({ stats }: { stats: CampaignRetrospectiveJSON['stats'] }) {
  const hit = stats.goal_hit;
  const noActual = stats.goal_actual == null;
  const Icon = hit ? CheckCircle2 : noActual ? Info : XCircle;
  const tone = hit ? 'border-emerald-500/40 bg-emerald-500/5'
    : noActual ? 'border-blue-500/40 bg-blue-500/5'
      : 'border-destructive/40 bg-destructive/5';
  const textTone = hit ? 'text-emerald-700'
    : noActual ? 'text-blue-700'
      : 'text-destructive';
  const headline = hit ? 'Goal hit' : noActual ? 'Goal — actual not measurable yet' : 'Goal missed';

  const goalStr = formatGoalLine(stats);
  const actualStr = formatActualLine(stats);
  const deltaStr = stats.goal_delta_pct != null && !noActual
    ? `${Math.abs(stats.goal_delta_pct).toFixed(1)}% ${
        hit ? 'better than target' : 'off target'
      }`
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
            The retro below reflects what happened, but without a goal you can't say whether it was a "win" or a "miss." Re-generate after setting a goal for a sharper read.
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
  title, icon, items, emptyText, accentClass, showArrow,
}: {
  title: string;
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
