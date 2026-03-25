import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronRight, ExternalLink, MessageSquare, Pencil, Target, Check, Loader2 } from 'lucide-react';
import { ClientHealthBadge } from './ClientHealthBadge';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const KPI_OPTIONS = [
  { value: 'cpl', label: 'Cost per Lead (CPL)', goalType: 'less_than' },
  { value: 'cpp', label: 'Cost per Purchase (CPP)', goalType: 'less_than' },
  { value: 'cpc', label: 'Cost per Click (CPC)', goalType: 'less_than' },
  { value: 'roas', label: 'ROAS', goalType: 'greater_than' },
  { value: 'ctr', label: 'Click-Through Rate (CTR)', goalType: 'greater_than' },
  { value: 'cpm', label: 'CPM', goalType: 'less_than' },
];

interface Campaign {
  id: string;
  name: string;
  progress_status: string;
  meta_campaign_status?: string;
  goal?: any;
  metrics?: any;
  hasLiveData?: boolean;
}

interface AgencyClient {
  id: string;
  brand_id: string;
  slack_client_channel?: string;
  slack_internal_channel?: string;
  contact_name?: string;
  contact_email?: string;
  health_status: string;
  notes?: string;
  brand?: {
    id: string;
    name: string;
    meta_account_id?: string;
    last_review_date?: string;
    next_report_due?: string;
  };
  campaigns?: Campaign[];
}

export function ClientScorecard({
  client,
  onEdit,
  onViewDetail,
  onGoalSaved,
}: {
  client: AgencyClient;
  onEdit: (client: AgencyClient) => void;
  onViewDetail: (brandId: string) => void;
  onGoalSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const brand = client.brand;
  const liveCampaigns = (client.campaigns || []).filter(c => c.hasLiveData);
  const draftCampaigns = (client.campaigns || []).filter(c => !c.hasLiveData);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-base">{brand?.name || 'Unknown'}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {brand?.meta_account_id ? `Act: ${brand.meta_account_id}` : 'No ad account'}
                    {client.contact_name && ` · ${client.contact_name}`}
                    {' · '}{(client.campaigns || []).length} campaign{(client.campaigns || []).length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ClientHealthBadge status={client.health_status} />
                {brand?.last_review_date && (
                  <Badge variant="outline" className="text-[10px]">
                    Last review: {format(new Date(brand.last_review_date), 'MMM d')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Live Campaigns with KPI data */}
            {liveCampaigns.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Campaigns</p>
                {liveCampaigns.map((c) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    brandId={client.brand_id}
                    onGoalSaved={onGoalSaved}
                  />
                ))}
              </div>
            )}

            {/* Draft Campaigns */}
            {draftCampaigns.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drafts</p>
                {draftCampaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 text-sm">
                    <span className="text-muted-foreground">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">{c.progress_status}</Badge>
                  </div>
                ))}
              </div>
            )}

            {(client.campaigns || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            )}

            {/* Notes */}
            {client.notes && (
              <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-lg">
                <span className="font-medium text-foreground">Notes:</span> {client.notes}
              </div>
            )}

            {/* Slack info */}
            {(client.slack_client_channel || client.slack_internal_channel) && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                {client.slack_client_channel && (
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Client: #{client.slack_client_channel}</span>
                )}
                {client.slack_internal_channel && (
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Internal: #{client.slack_internal_channel}</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onEdit(client)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => onViewDetail(client.brand_id)}>
                <ExternalLink className="h-3 w-3 mr-1" /> View Detail
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CampaignRow({
  campaign,
  brandId,
  onGoalSaved,
}: {
  campaign: Campaign;
  brandId: string;
  onGoalSaved?: () => void;
}) {
  const [goalOpen, setGoalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kpi, setKpi] = useState(campaign.goal?.primary_kpi || 'cpl');
  const [threshold, setThreshold] = useState(campaign.goal?.primary_kpi_threshold?.toString() || '');

  const goal = campaign.goal;
  const metrics = campaign.metrics || {};
  const kpiConfig = KPI_OPTIONS.find(k => k.value === (goal?.primary_kpi || kpi));

  // Format metric value
  const formatMetric = (key: string, val: number | null | undefined) => {
    if (val == null) return '—';
    if (key === 'roas') return `${val.toFixed(2)}x`;
    if (key === 'ctr') return `${val.toFixed(2)}%`;
    return `$${val.toFixed(2)}`;
  };

  // Status color
  const getStatus = () => {
    if (!goal || !metrics[goal.primary_kpi]) return null;
    const val = metrics[goal.primary_kpi];
    const thresh = goal.primary_kpi_threshold;
    if (goal.primary_kpi_goal_type === 'less_than') {
      if (val <= thresh) return 'green';
      if (val <= thresh * 1.3) return 'amber';
      return 'red';
    } else {
      if (val >= thresh) return 'green';
      if (val >= thresh * 0.7) return 'amber';
      return 'red';
    }
  };

  const status = getStatus();
  const statusEmoji = status === 'green' ? '✅' : status === 'amber' ? '⚠️' : status === 'red' ? '🔴' : '⚪';

  const handleSaveGoal = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const kpiOpt = KPI_OPTIONS.find(k => k.value === kpi);
    const kpiLabel = kpiOpt?.label || kpi.toUpperCase();
    const goalType = kpiOpt?.goalType || 'less_than';

    const goalData = {
      workspace_id: campaign.id,
      brand_id: brandId,
      created_by: user.id,
      primary_kpi: kpi,
      primary_kpi_label: kpiLabel,
      primary_kpi_threshold: parseFloat(threshold) || 0,
      primary_kpi_goal_type: goalType,
    };

    if (goal?.id) {
      await supabase.from('campaign_goals').update({
        primary_kpi: kpi,
        primary_kpi_label: kpiLabel,
        primary_kpi_threshold: parseFloat(threshold) || 0,
        primary_kpi_goal_type: goalType,
        updated_at: new Date().toISOString(),
      }).eq('id', goal.id);
    } else {
      await supabase.from('campaign_goals').insert(goalData);
    }

    toast.success('Goal saved');
    setSaving(false);
    setGoalOpen(false);
    onGoalSaved?.();
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 text-sm gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs">{statusEmoji}</span>
        <span className="font-medium truncate">{campaign.name}</span>
      </div>

      {/* KPI display */}
      <div className="flex items-center gap-3 shrink-0">
        {goal ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{goal.primary_kpi_label?.split('(')[0]?.trim() || goal.primary_kpi?.toUpperCase()}:</span>
            <span className={`font-semibold ${status === 'green' ? 'text-green-600' : status === 'amber' ? 'text-amber-600' : status === 'red' ? 'text-red-600' : 'text-foreground'}`}>
              {formatMetric(goal.primary_kpi, metrics[goal.primary_kpi])}
            </span>
            <span className="text-muted-foreground/70">
              / Goal: {goal.primary_kpi_goal_type === 'less_than' ? '<' : '>'} {formatMetric(goal.primary_kpi, goal.primary_kpi_threshold)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">No goal set</span>
        )}

        {/* Edit goal popover */}
        <Popover open={goalOpen} onOpenChange={setGoalOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Target className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-3" align="end">
            <p className="text-xs font-semibold">Set KPI Goal</p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Primary KPI</Label>
                <Select value={kpi} onValueChange={setKpi}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KPI_OPTIONS.map(k => (
                      <SelectItem key={k.value} value={k.value} className="text-xs">{k.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">
                  Goal ({KPI_OPTIONS.find(k => k.value === kpi)?.goalType === 'less_than' ? 'below' : 'above'})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder={kpi === 'roas' ? '3.0' : kpi === 'ctr' ? '1.5' : '5.00'}
                />
              </div>
            </div>
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleSaveGoal} disabled={saving || !threshold}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Save Goal
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
