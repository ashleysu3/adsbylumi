import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CampaignKPISummary } from './CampaignKPISummary';
import { CampaignGoalRow } from './CampaignGoalRow';
import { LumiKPIConfig } from '@/lib/lumi-kpi-config';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CampaignKPIWithGoalEditorProps {
  campaign: {
    id: string;
    brandId?: string;
    metrics: Record<string, number | null | undefined> | null;
  };
  kpiConfig: LumiKPIConfig;
  primaryValue: number | null;
  goals: any | null;
  onGoalSaved: (goal: any) => void;
}

export function CampaignKPIWithGoalEditor({
  campaign,
  kpiConfig,
  primaryValue,
  goals,
  onGoalSaved,
}: CampaignKPIWithGoalEditorProps) {
  const [open, setOpen] = useState(false);

  const handleUpdateGoal = async (goal: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const goalData = {
      workspace_id: campaign.id,
      brand_id: campaign.brandId,
      created_by: user.id,
      primary_kpi: kpiConfig.primary,
      primary_kpi_label: kpiConfig.primaryLabel,
      primary_kpi_threshold: goal,
      primary_kpi_goal_type: kpiConfig.primary === 'roas' ? 'greater_than' : 'less_than',
    };

    if (goals?.id) {
      await supabase.from('campaign_goals').update({ primary_kpi_threshold: goal }).eq('id', goals.id);
    } else {
      await supabase.from('campaign_goals').upsert(goalData, { onConflict: 'workspace_id' });
    }

    const { data: refreshed } = await supabase
      .from('campaign_goals')
      .select('*')
      .eq('workspace_id', campaign.id)
      .maybeSingle();

    if (refreshed) {
      onGoalSaved(refreshed);
    }
    setOpen(false);
    toast.success('Goal updated!');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <CampaignKPISummary
            metrics={campaign.metrics}
            kpiConfig={kpiConfig}
            goals={goals}
            onEditGoals={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <CampaignGoalRow
          kpiConfig={kpiConfig}
          currentValue={primaryValue}
          userGoal={goals?.primary_kpi_threshold ?? null}
          onUpdateGoal={handleUpdateGoal}
        />
      </PopoverContent>
    </Popover>
  );
}
