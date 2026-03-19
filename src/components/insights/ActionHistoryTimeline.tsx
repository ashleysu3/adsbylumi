import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Pause, Play, TrendingUp, RefreshCw, Zap, Link2, History } from 'lucide-react';

interface ActionLogEntry {
  id: string;
  brand_id: string;
  workspace_id: string | null;
  action_type: string;
  action_detail: Record<string, any>;
  source: string;
  meta_entity_id: string | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  paused_ad: { icon: <Pause className="h-3.5 w-3.5" />, label: 'Ad Paused', color: 'bg-destructive/10 text-destructive' },
  activated_ad: { icon: <Play className="h-3.5 w-3.5" />, label: 'Ad Activated', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  campaign_paused: { icon: <Pause className="h-3.5 w-3.5" />, label: 'Campaign Paused', color: 'bg-destructive/10 text-destructive' },
  campaign_activated: { icon: <Play className="h-3.5 w-3.5" />, label: 'Campaign Activated', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  ad_paused: { icon: <Pause className="h-3.5 w-3.5" />, label: 'Ad Paused', color: 'bg-destructive/10 text-destructive' },
  ad_activated: { icon: <Play className="h-3.5 w-3.5" />, label: 'Ad Activated', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  adset_paused: { icon: <Pause className="h-3.5 w-3.5" />, label: 'Ad Set Paused', color: 'bg-destructive/10 text-destructive' },
  adset_activated: { icon: <Play className="h-3.5 w-3.5" />, label: 'Ad Set Activated', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  budget_change: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Budget Changed', color: 'bg-primary/10 text-primary' },
  creative_swap: { icon: <RefreshCw className="h-3.5 w-3.5" />, label: 'Creative Rotated', color: 'bg-accent text-accent-foreground' },
  budget_hog: { icon: <Zap className="h-3.5 w-3.5" />, label: 'Budget Hog Paused', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  scale: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Budget Scaled', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  cross_campaign_impact: { icon: <Link2 className="h-3.5 w-3.5" />, label: 'Cross-Campaign Impact', color: 'bg-primary/10 text-primary' },
};

const SOURCE_LABELS: Record<string, string> = {
  user: 'You',
  lumi_auto: 'LUMI (auto)',
  lumi_approved: 'LUMI (approved)',
};

export function ActionHistoryTimeline({ brandId }: { brandId: string }) {
  const [actions, setActions] = useState<ActionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    supabase
      .from('ad_action_log')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data }) => {
        setActions((data as any[]) || []);
        setLoading(false);
      });
  }, [brandId]);

  if (loading) return null;
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Action History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action) => {
            const config = ACTION_CONFIG[action.action_type] || {
              icon: <Zap className="h-3.5 w-3.5" />,
              label: action.action_type.replace(/_/g, ' '),
              color: 'bg-muted text-muted-foreground',
            };
            const detail = action.action_detail as Record<string, any>;
            const description = detail?.description || detail?.reason || detail?.recommendation || '';

            return (
              <div key={action.id} className="flex items-start gap-3 text-sm">
                <div className={`mt-0.5 rounded-full p-1.5 ${config.color}`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{config.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {SOURCE_LABELS[action.source] || action.source}
                    </Badge>
                  </div>
                  {description && (
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{description}</p>
                  )}
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    {format(new Date(action.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}