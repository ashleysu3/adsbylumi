import { useState } from 'react';
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
  ShieldCheck
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
  nextSteps?: string[];
  recsRef?: React.Ref<HTMLDivElement>;
  campaignId?: string;
}

function getRecIcon(type: string) {
  switch (type) {
    case 'budget_increase': return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'budget_decrease': return <TrendingDown className="h-4 w-4 text-amber-600" />;
    case 'pause_ad': return <Pause className="h-4 w-4 text-red-500" />;
    case 'resume_ad': return <Play className="h-4 w-4 text-green-500" />;
    case 'swap_creative': return <RefreshCw className="h-4 w-4 text-blue-500" />;
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
    default: return 'border-l-primary';
  }
}

const AUTOMATABLE_TYPES = new Set(['budget_increase', 'budget_decrease', 'pause_ad', 'resume_ad', 'swap_creative']);

export function LumiRecommendations({
  recommendations,
  loading,
  onRefresh,
  onRecommendationExecuted,
  compact = false,
  maxItems,
  nextSteps = [],
  recsRef,
  campaignId,
}: LumiRecommendationsProps) {
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [budgetConfirm, setBudgetConfirm] = useState<Recommendation | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  // Only show automatable recs (filter out user-action types)
  const automatableRecs = recommendations.filter(r => AUTOMATABLE_TYPES.has(r.type));

  // Convert next_steps to automatable recs only (budget/pause related)
  const nextStepRecs: Recommendation[] = nextSteps
    .filter(step => {
      const lower = step.toLowerCase();
      return lower.includes('budget') || lower.includes('pause') || lower.includes('scale') || lower.includes('resume');
    })
    .map((step, i) => ({
      id: `next-step-${i}`,
      type: (step.toLowerCase().includes('increase') || step.toLowerCase().includes('scale') ? 'budget_increase' : 'budget_decrease') as Recommendation['type'],
      title: step.length > 80 ? step.slice(0, 77) + '...' : step,
      description: step,
      impact: 'AI-recommended action',
      confidence: 'medium' as const,
      requiresDoubleApproval: step.toLowerCase().includes('budget'),
      actionPayload: {},
      priority: 10 + i,
    }));

  const allRecommendations = [...automatableRecs, ...nextStepRecs];
  const visibleRecs = maxItems ? allRecommendations.slice(0, maxItems) : allRecommendations;
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
      <Card className="rounded-2xl border-2 border-[hsl(var(--lumi-orange-1)/0.4)] bg-gradient-to-br from-[hsl(var(--lumi-orange-1)/0.06)] via-[hsl(var(--lumi-pink-1)/0.05)] to-[hsl(var(--lumi-purple-1)/0.06)] overflow-hidden relative">
          {/* Animated shimmer band */}
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, hsl(var(--lumi-orange-1)/0.18) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'lumi-shimmer 2s linear infinite',
            }}
          />
          <style>{`@keyframes lumi-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          <CardContent className="p-6 relative">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-[hsl(var(--lumi-orange-1)/0.3)] blur-xl animate-pulse" />
                <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-pink-1))] flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 text-white animate-pulse" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-foreground">Lumi is analyzing your campaigns</p>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--lumi-orange-1))] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--lumi-pink-1))] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--lumi-purple-1))] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Pulling fresh data from Meta and reviewing performance — this usually takes 10–30 seconds. You can keep working.
                </p>
                <div className="mt-3 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full w-1/3 rounded-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))]"
                    style={{ animation: 'lumi-progress 1.6s ease-in-out infinite' }}
                  />
                  <style>{`@keyframes lumi-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
                </div>
              </div>
            </div>
          </CardContent>
      </Card>
    );
  }

  if (allRecommendations.length === 0) {
    return <div ref={recsRef} />;
  }

  return (
    <div ref={recsRef}>
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
                      <p className="text-sm font-semibold">{rec.title}</p>
                      {(rec as any).campaignName && (
                        <p className="text-xs text-muted-foreground mt-0.5">{(rec as any).campaignName}</p>
                      )}
                    </div>
                  </div>
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
    </div>
  );
}
