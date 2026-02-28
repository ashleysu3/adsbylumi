import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sparkles, Check, CheckCheck, DollarSign, Pause, Play,
  RefreshCw, Loader2, AlertTriangle, TrendingUp, TrendingDown,
  ShieldCheck, ArrowRight, PlusCircle
} from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'budget_increase' | 'budget_decrease' | 'pause_ad' | 'resume_ad' | 'swap_creative' | 'keep_running' | 'create_creative';
  title: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  requiresDoubleApproval: boolean;
  actionPayload: Record<string, any>;
  priority: number;
  userAction?: boolean;
  actionUrl?: string;
}

interface LumiRecommendationsProps {
  recommendations: Recommendation[];
  loading: boolean;
  onRefresh: () => void;
  onRecommendationExecuted?: () => void;
  compact?: boolean;
  maxItems?: number;
}

function getRecIcon(type: string) {
  switch (type) {
    case 'budget_increase': return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'budget_decrease': return <TrendingDown className="h-4 w-4 text-amber-600" />;
    case 'pause_ad': return <Pause className="h-4 w-4 text-red-500" />;
    case 'resume_ad': return <Play className="h-4 w-4 text-green-500" />;
    case 'swap_creative': return <RefreshCw className="h-4 w-4 text-blue-500" />;
    case 'create_creative': return <PlusCircle className="h-4 w-4 text-purple-500" />;
    default: return <Sparkles className="h-4 w-4 text-primary" />;
  }
}

function getRecBorderColor(type: string) {
  switch (type) {
    case 'budget_increase': return 'border-l-green-500';
    case 'budget_decrease': return 'border-l-amber-500';
    case 'pause_ad': return 'border-l-red-400';
    case 'resume_ad': return 'border-l-green-400';
    case 'swap_creative': return 'border-l-blue-400';
    case 'create_creative': return 'border-l-purple-400';
    default: return 'border-l-primary';
  }
}

const USER_ACTION_TYPES = new Set(['create_creative']);

export function LumiRecommendations({
  recommendations,
  loading,
  onRefresh,
  onRecommendationExecuted,
  compact = false,
  maxItems,
}: LumiRecommendationsProps) {
  const navigate = useNavigate();
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [budgetConfirm, setBudgetConfirm] = useState<Recommendation | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const visibleRecs = maxItems ? recommendations.slice(0, maxItems) : recommendations;
  const pendingRecs = visibleRecs.filter(r => !completed.has(r.id));

  const executeRecommendation = async (rec: Recommendation) => {
    // Budget changes need double approval
    if (rec.requiresDoubleApproval && !budgetConfirm) {
      setBudgetConfirm(rec);
      return;
    }

    setExecuting(prev => ({ ...prev, [rec.id]: true }));
    try {
      const { actionPayload } = rec;

      switch (rec.type) {
        case 'budget_increase':
        case 'budget_decrease': {
          const currentBudget = actionPayload.currentBudget || 25;
          const newBudget = Math.round(currentBudget * (1 + actionPayload.percentageChange / 100));
          await supabase
            .from('campaign_workspaces')
            .update({
              campaign_builder_answers: { budget: newBudget } as any,
              updated_at: new Date().toISOString(),
            })
            .eq('id', actionPayload.workspaceId);
          toast.success(`Budget updated to $${newBudget}/day`);
          break;
        }

        case 'pause_ad':
        case 'resume_ad': {
          const { data, error } = await supabase.functions.invoke('check-campaign-status', {
            body: {
              workspaceId: actionPayload.workspaceId,
              action: actionPayload.action,
              entityId: actionPayload.adId,
              entityType: 'ad',
            },
          });
          if (error || !data?.success) throw new Error(data?.error || 'Failed');
          toast.success(`Ad ${actionPayload.action === 'pause' ? 'paused' : 'resumed'}`);
          break;
        }

        case 'swap_creative': {
          const { data, error } = await supabase.functions.invoke('rotate-creative', {
            body: {
              workspaceId: actionPayload.workspaceId,
              brandId: actionPayload.brandId,
              fatigueAdId: actionPayload.fatigueAdId,
              benchAdId: actionPayload.benchAdId,
              reason: 'Approved Lumi recommendation',
              isAutoRotation: false,
            },
          });
          if (error) throw error;
          toast.success('Creative swapped from bench');
          break;
        }
      }

      setCompleted(prev => new Set(prev).add(rec.id));
      onRecommendationExecuted?.();
    } catch (err: any) {
      console.error('Recommendation execution failed:', err);
      toast.error(err.message || 'Failed to execute recommendation');
    } finally {
      setExecuting(prev => ({ ...prev, [rec.id]: false }));
      setBudgetConfirm(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    const budgetRecs = pendingRecs.filter(r => r.requiresDoubleApproval);
    const nonBudgetRecs = pendingRecs.filter(r => !r.requiresDoubleApproval);

    // Execute non-budget recs immediately
    for (const rec of nonBudgetRecs) {
      await executeRecommendation(rec);
    }

    // Budget recs need confirmation — show first one
    if (budgetRecs.length > 0) {
      setBudgetConfirm(budgetRecs[0]);
    }
    setApprovingAll(false);
  };

  const handleBudgetConfirm = async () => {
    if (budgetConfirm) {
      await executeRecommendation(budgetConfirm);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Lumi is analyzing your campaigns...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="rounded-2xl border-green-200 bg-green-50/30">
        <CardContent className="p-6 text-center">
          <ShieldCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-800">Everything looks good!</p>
          <p className="text-xs text-green-600 mt-1">No action needed right now. Lumi is watching.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-[hsl(var(--lumi-orange-1)/0.3)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
              Lumi Recommendations
            </CardTitle>
            <div className="flex items-center gap-2">
              {pendingRecs.length > 1 && (
                <Button
                  size="sm"
                  variant="lumi"
                  onClick={handleApproveAll}
                  disabled={approvingAll || pendingRecs.length === 0}
                  className="rounded-xl text-xs gap-1.5"
                >
                  {approvingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                  Approve All ({pendingRecs.length})
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                className="rounded-xl text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleRecs.map(rec => {
            const isCompleted = completed.has(rec.id);
            const isExecuting = executing[rec.id];

            return (
              <div
                key={rec.id}
                className={`p-3 rounded-xl border-l-4 border bg-card transition-all ${getRecBorderColor(rec.type)} ${
                  isCompleted ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="mt-0.5">{getRecIcon(rec.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{rec.title}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            rec.confidence === 'high' ? 'border-green-300 text-green-700' :
                            rec.confidence === 'medium' ? 'border-amber-300 text-amber-700' :
                            'border-muted text-muted-foreground'
                          }`}
                        >
                          {rec.confidence}
                        </Badge>
                        {rec.requiresDoubleApproval && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary gap-1">
                            <DollarSign className="h-3 w-3" />
                            Budget
                          </Badge>
                        )}
                      </div>
                      {!compact && (
                        <>
                          <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                          <p className="text-xs text-primary/80 mt-1 font-medium">
                            Impact: {rec.impact}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {rec.userAction || USER_ACTION_TYPES.has(rec.type) ? (
                    <Button
                      size="sm"
                      variant="lumi"
                      onClick={() => {
                        if (rec.actionUrl) navigate(rec.actionUrl);
                      }}
                      className="rounded-xl text-xs shrink-0 gap-1"
                    >
                      Next Step <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={isCompleted ? 'ghost' : 'outline'}
                      onClick={() => executeRecommendation(rec)}
                      disabled={isCompleted || isExecuting}
                      className="rounded-xl text-xs shrink-0"
                    >
                      {isCompleted ? (
                        <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /> Done</>
                      ) : isExecuting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Approve'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {maxItems && recommendations.length > maxItems && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              +{recommendations.length - maxItems} more recommendation{recommendations.length - maxItems > 1 ? 's' : ''} — view details
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget Double Confirmation Dialog */}
      <AlertDialog open={!!budgetConfirm} onOpenChange={(open) => !open && setBudgetConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Budget Change
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>{budgetConfirm?.description}</p>
              {budgetConfirm?.actionPayload && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex justify-between text-sm">
                    <span>Current budget:</span>
                    <span className="font-semibold">${budgetConfirm.actionPayload.currentBudget || 25}/day</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>New budget:</span>
                    <span className="font-semibold text-primary">
                      ${Math.round((budgetConfirm.actionPayload.currentBudget || 25) * (1 + budgetConfirm.actionPayload.percentageChange / 100))}/day
                    </span>
                  </div>
                </div>
              )}
              <p className="text-xs font-medium text-amber-600">
                This will change your daily ad spend. Please confirm.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBudgetConfirm} className="bg-primary">
              Confirm Budget Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
