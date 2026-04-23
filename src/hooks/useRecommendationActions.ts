import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Shared recommendation shape — keep in sync with generate-recommendations
// edge function and the Recommendation interface in LumiRecommendations.tsx.
export interface Recommendation {
  id: string;
  type:
    | 'budget_increase'
    | 'budget_decrease'
    | 'pause_ad'
    | 'resume_ad'
    | 'swap_creative'
    | 'keep_running'
    | 'create_creative'
    | 'promote_to_scaling';
  title: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  requiresDoubleApproval: boolean;
  actionPayload: Record<string, any>;
  priority: number;
  userAction?: boolean;
  actionUrl?: string;
  // When true, the rec is advisory only — no actionable button should be
  // rendered. Used by the frontend to wrap LLM-generated `next_steps` text
  // that doesn't map to a concrete API action.
  isInfoOnly?: boolean;
  // optional decorators added by consumers
  campaignName?: string;
  campaignId?: string;
}

/**
 * Centralizes the "approve / apply" logic for a structured recommendation.
 *
 * Why a hook: the logic used to live inline in `LumiRecommendations.tsx` on
 * the campaign detail view. The home-page cards in `InsightsHome.tsx` also
 * want to execute recs directly (Pause Ad, Swap Creative, etc.), so both
 * surfaces now share the same implementation — one less place for behavior
 * to drift.
 *
 * Budget-type recs are NOT applied directly here. The UI surfaces open the
 * existing `BudgetAdjustmentPanel` so users can review the suggested change
 * before it writes to Meta. That intentional friction is preserved.
 */
export function useRecommendationActions(options?: {
  onExecuted?: () => void;
}) {
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const executeRecommendation = useCallback(
    async (rec: Recommendation): Promise<boolean> => {
      if (!rec) return false;

      setExecuting((prev) => ({ ...prev, [rec.id]: true }));
      try {
        const { actionPayload = {} } = rec;

        switch (rec.type) {
          case 'budget_increase':
          case 'budget_decrease': {
            // Budget writes happen through BudgetAdjustmentPanel, not here —
            // this branch is kept for the legacy "approve from list" flow in
            // LumiRecommendations. Writes the suggested budget straight onto
            // the workspace row; the panel does the richer Meta-side update.
            const currentBudget = actionPayload.currentBudget || 25;
            const pct = actionPayload.percentageChange ?? 0;
            const newBudget = Math.round(currentBudget * (1 + pct / 100));
            const { error } = await supabase
              .from('campaign_workspaces')
              .update({
                campaign_builder_answers: { budget: newBudget } as any,
                updated_at: new Date().toISOString(),
              })
              .eq('id', actionPayload.workspaceId);
            if (error) throw error;
            toast.success(`Budget updated to $${newBudget}/day`);
            break;
          }

          case 'pause_ad':
          case 'resume_ad': {
            const { data, error } = await supabase.functions.invoke(
              'check-campaign-status',
              {
                body: {
                  workspaceId: actionPayload.workspaceId,
                  action: actionPayload.action,
                  entityId: actionPayload.adId,
                  entityType: 'ad',
                },
              },
            );
            if (error || !data?.success) {
              throw new Error(data?.error || error?.message || 'Action failed');
            }
            toast.success(
              `Ad ${actionPayload.action === 'pause' ? 'paused' : 'resumed'}`,
            );
            break;
          }

          case 'swap_creative': {
            const { error } = await supabase.functions.invoke(
              'rotate-creative',
              {
                body: {
                  workspaceId: actionPayload.workspaceId,
                  brandId: actionPayload.brandId,
                  fatigueAdId: actionPayload.fatigueAdId,
                  benchAdId: actionPayload.benchAdId,
                  reason: 'Approved Lumi recommendation',
                  isAutoRotation: false,
                },
              },
            );
            if (error) throw error;
            toast.success('Creative swapped from bench');
            break;
          }

          case 'promote_to_scaling': {
            // Duplicates the source ad into the target (Scaling) ad set,
            // then pauses the original in Testing. If the pause fails Meta
            // still created the duplicate — we surface a warning toast so
            // the user can clean up in Meta Ads Manager manually.
            const { data, error } = await supabase.functions.invoke(
              'promote-ad-to-scaling',
              {
                body: {
                  workspaceId: actionPayload.workspaceId,
                  brandId: actionPayload.brandId,
                  sourceAdId: actionPayload.sourceAdId,
                  sourceAdName: actionPayload.sourceAdName,
                  targetAdSetId: actionPayload.targetAdSetId,
                  reason: actionPayload.reason || 'Approved Lumi promote-to-scaling recommendation',
                },
              },
            );
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Promote failed');
            if (data.pausedInTesting === false) {
              toast.warning(
                `Ad promoted to Scaling, but we couldn't pause the original in Testing. Pause it manually in Meta Ads Manager to avoid duplicate delivery.`,
              );
            } else {
              toast.success(`Ad promoted to Scaling — paused in Testing`);
            }
            break;
          }

          default:
            // keep_running / create_creative are navigations handled by the UI,
            // not executions — no-op here.
            return false;
        }

        setCompleted((prev) => new Set(prev).add(rec.id));
        options?.onExecuted?.();
        return true;
      } catch (err: any) {
        console.error('Recommendation execution failed:', err);
        toast.error(err?.message || 'Failed to execute recommendation');
        return false;
      } finally {
        setExecuting((prev) => ({ ...prev, [rec.id]: false }));
      }
    },
    [options],
  );

  return { executeRecommendation, executing, completed, setCompleted };
}

/**
 * Classifies a rec for UI purposes. The home-card and detail surfaces use
 * this to pick a button label, icon, and the interaction style (direct
 * execution vs. opening the budget panel vs. navigating to another page).
 */
export type RecActionKind =
  | 'execute' // fires executeRecommendation (pause, resume, swap)
  | 'budget' // opens BudgetAdjustmentPanel
  | 'navigate' // navigates to actionUrl / creative studio
  | 'add_posts'; // opens the post-picker dialog

export interface RecActionDescriptor {
  kind: RecActionKind;
  label: string;
  iconKey: string;
  // For navigate, the URL to go to.
  url?: string;
}

/**
 * Decide what action button to show for a rec, based on the structured
 * rec.type. Falls back to title heuristics only when the type is the
 * generic `keep_running` (since keep_running covers several intents).
 */
export function describeRecAction(
  rec: Recommendation,
  campaignId: string,
): RecActionDescriptor {
  switch (rec.type) {
    case 'budget_increase':
      return { kind: 'budget', label: 'Increase Budget', iconKey: 'TrendingUp' };
    case 'budget_decrease':
      return { kind: 'budget', label: 'Decrease Budget', iconKey: 'TrendingDown' };
    case 'pause_ad':
      return { kind: 'execute', label: 'Pause Ad', iconKey: 'Pause' };
    case 'resume_ad':
      return { kind: 'execute', label: 'Resume Ad', iconKey: 'Play' };
    case 'swap_creative':
      return { kind: 'execute', label: 'Swap Creative', iconKey: 'RefreshCw' };
    case 'create_creative':
      return {
        kind: 'navigate',
        label: 'Refresh Creative',
        iconKey: 'RefreshCw',
        url: rec.actionUrl || `/creative-studio?workspace=${campaignId}&refreshCreative=true`,
      };
    case 'promote_to_scaling':
      return { kind: 'execute', label: 'Promote to Scaling', iconKey: 'Rocket' };
    case 'keep_running': {
      // keep_running is intentionally vague — fall back to the title signal.
      const title = (rec.title || '').toLowerCase();
      if (title.includes('click') || title.includes('resonat') || title.includes('ctr')) {
        return { kind: 'add_posts', label: 'Add New Posts', iconKey: 'Plus' };
      }
      return {
        kind: 'navigate',
        label: 'View Details',
        iconKey: 'Eye',
        url: rec.actionUrl || `/campaign/${campaignId}`,
      };
    }
    default:
      return {
        kind: 'navigate',
        label: 'Try New Angles',
        iconKey: 'Wand2',
        url: rec.actionUrl || `/creative-studio?workspace=${campaignId}`,
      };
  }
}
