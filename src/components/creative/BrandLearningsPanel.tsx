import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Trophy, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ============================================================================
// BrandLearningsPanel (Patch #21)
//
// Surfaces the brand's accumulated learnings — pulled from past campaign
// retrospectives — so the user sees what Lumi knows when generating new
// angles. The same learnings get passed into the generate-creative-angles
// edge function as prompt context.
// ============================================================================

interface BrandLearning {
  id: string;
  category: 'win' | 'miss' | 'recommendation';
  insight: string;
  supporting_data: string | null;
  confidence: 'high' | 'medium' | 'low';
  source_workspace_id: string | null;
  created_at: string;
}

interface Props {
  brandId?: string;
  /** Hide the panel entirely if there are no learnings yet. Default true. */
  hideIfEmpty?: boolean;
  /** Compact mode — collapsed by default, fewer items shown when expanded. */
  compact?: boolean;
}

export function BrandLearningsPanel({ brandId, hideIfEmpty = true, compact }: Props) {
  const [learnings, setLearnings] = useState<BrandLearning[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('brand_learnings' as any)
        .select('id, category, insight, supporting_data, confidence, source_workspace_id, created_at')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        if (!error && data) setLearnings(data as any);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [brandId]);

  const handleDismiss = async (id: string) => {
    setLearnings(prev => prev.filter(l => l.id !== id));
    await supabase.from('brand_learnings' as any).update({ is_active: false }).eq('id', id);
  };

  if (hideIfEmpty && !loading && learnings.length === 0) return null;

  const wins = learnings.filter(l => l.category === 'win');
  const misses = learnings.filter(l => l.category === 'miss');
  const recs = learnings.filter(l => l.category === 'recommendation');

  // In compact mode, show only top-confidence items per category.
  const top = (arr: BrandLearning[], n: number) =>
    [...arr]
      .sort((a, b) => confRank(b.confidence) - confRank(a.confidence))
      .slice(0, n);

  const showWins = compact ? top(wins, 2) : wins;
  const showMisses = compact ? top(misses, 2) : misses;
  const showRecs = compact ? top(recs, 3) : recs;

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            What Lumi knows about this brand
            <Badge variant="outline" className="text-[10px] ml-1">{learnings.length}</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">
          Pulled from your past campaign retrospectives. These steer the angles + copy Lumi generates next.
        </p>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-2 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {showWins.length > 0 && (
            <LearningGroup
              title="What's worked"
              icon={<Trophy className="h-3.5 w-3.5 text-emerald-600" />}
              items={showWins}
              accentClass="bg-emerald-500/5 border-emerald-500/30"
              onDismiss={handleDismiss}
            />
          )}
          {showMisses.length > 0 && (
            <LearningGroup
              title="What hasn't"
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
              items={showMisses}
              accentClass="bg-amber-500/5 border-amber-500/30"
              onDismiss={handleDismiss}
            />
          )}
          {showRecs.length > 0 && (
            <LearningGroup
              title="Recommendations"
              icon={<Lightbulb className="h-3.5 w-3.5 text-primary" />}
              items={showRecs}
              accentClass="bg-primary/5 border-primary/30"
              onDismiss={handleDismiss}
            />
          )}

          {compact && (wins.length + misses.length + recs.length) > (showWins.length + showMisses.length + showRecs.length) && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Showing top-confidence items only. {learnings.length} total active learnings.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function confRank(c: string) {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1;
}

function LearningGroup({
  title,
  icon,
  items,
  accentClass,
  onDismiss,
}: {
  title: string;
  icon: React.ReactNode;
  items: BrandLearning[];
  accentClass: string;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className={cn('rounded-md border p-2.5 flex gap-2', accentClass)}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.insight}</p>
              {item.supporting_data && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {item.supporting_data}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(item.id)}
              className="text-muted-foreground/60 hover:text-destructive shrink-0 self-start"
              aria-label="Dismiss learning"
              title="Dismiss this learning"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
