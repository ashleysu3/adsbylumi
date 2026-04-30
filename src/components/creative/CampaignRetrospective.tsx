import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, TrendingDown, Lightbulb, Trophy, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// CampaignRetrospective (Patch #20)
//
// Post-mortem report for a single campaign workspace. Renders the cached
// retrospective_json if it exists, with a button to (re)generate. Calls
// the `generate-campaign-retrospective` edge function which pulls Meta
// data + LUMI's creative metadata, runs an AI post-mortem, and persists
// the report + extracted brand_learnings.
// ============================================================================

export interface CampaignRetrospectiveJSON {
  summary: string;
  stats: {
    total_spend: number;
    total_results: number;
    avg_cpl: number | null;
    duration_days: number | null;
    objective: string | null;
  };
  wins: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  misses: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  recommendations: Array<{ insight: string; supporting_data?: string; confidence: 'high' | 'medium' | 'low' }>;
  generated_at: string;
}

interface Props {
  workspaceId: string;
  initialRetrospective?: CampaignRetrospectiveJSON | null;
  onGenerated?: (retro: CampaignRetrospectiveJSON) => void;
}

export function CampaignRetrospective({ workspaceId, initialRetrospective, onGenerated }: Props) {
  const [retro, setRetro] = useState<CampaignRetrospectiveJSON | null>(initialRetrospective || null);
  const [generating, setGenerating] = useState(false);

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

  if (!retro) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div>
            <p className="font-semibold">No retrospective yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Lumi will pull this campaign's Meta performance + your creative metadata and produce a post-mortem
              you can use to inform the next campaign.
            </p>
          </div>
          <Button variant="lumi" className="gap-1.5" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Analyzing…' : 'Generate retrospective'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + regenerate */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Generated {new Date(retro.generated_at).toLocaleString()}
          </p>
          <h3 className="text-lg font-semibold mt-1">{retro.summary}</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-1.5 shrink-0"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'Refreshing…' : 'Regenerate'}
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Spend" value={fmtCurrency(retro.stats.total_spend)} />
        <StatTile label="Results" value={fmtNumber(retro.stats.total_results)} />
        <StatTile label="Avg cost / result" value={retro.stats.avg_cpl != null ? fmtCurrency(retro.stats.avg_cpl) : '—'} />
        <StatTile label="Duration" value={retro.stats.duration_days != null ? `${retro.stats.duration_days}d` : '—'} />
      </div>

      {/* Wins */}
      <Section
        title="What worked"
        icon={<Trophy className="h-4 w-4 text-emerald-600" />}
        items={retro.wins}
        emptyText="No clear wins surfaced — typically means the data was thin."
        accentClass="bg-emerald-500/5 border-emerald-500/30"
      />

      {/* Misses */}
      <Section
        title="What didn't"
        icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
        items={retro.misses}
        emptyText="No clear misses called out."
        accentClass="bg-amber-500/5 border-amber-500/30"
      />

      {/* Recommendations */}
      <Section
        title="What to do differently next time"
        icon={<Lightbulb className="h-4 w-4 text-primary" />}
        items={retro.recommendations}
        emptyText="No specific recommendations."
        accentClass="bg-primary/5 border-primary/30"
        showArrow
      />
    </div>
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
  title,
  icon,
  items,
  emptyText,
  accentClass,
  showArrow,
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

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}
function fmtNumber(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}
