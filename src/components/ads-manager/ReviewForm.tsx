import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignMetricEntry {
  campaign_id: string;
  campaign_name: string;
  spend_3d: string;
  spend_7d: string;
  cpl_3d: string;
  cpl_7d: string;
  roas_3d: string;
  roas_7d: string;
  ctr_3d: string;
  ctr_7d: string;
  notes: string;
}

interface AdEntry {
  ad_id: string;
  ad_name: string;
  spend: string;
  cpl: string;
  roas: string;
  cpp: string;
  flag: 'keep' | 'pause' | 'scale' | 'watch';
}

interface ReviewFormProps {
  brandName: string;
  brandId: string;
  campaigns: Array<{ id: string; name: string }>;
  kpiTargets?: Record<string, any>;
  onSave: (data: { campaign_metrics: CampaignMetricEntry[]; ad_level_data: AdEntry[]; notes: string }) => void;
  onGenerateActionPlan: (data: any) => void;
  isGenerating?: boolean;
  isSaving?: boolean;
}

const FLAG_CONFIG = {
  keep: { label: 'Keep', className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  pause: { label: 'Pause', className: 'bg-destructive/10 text-destructive' },
  scale: { label: 'Scale', className: 'bg-primary/10 text-primary' },
  watch: { label: 'Watch', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
};

function getKpiColor(actual: number, target: number, goalType: 'less_than' | 'greater_than') {
  if (!actual || !target) return '';
  if (goalType === 'less_than') {
    if (actual <= target) return 'text-green-600 dark:text-green-400';
    if (actual <= target * 1.3) return 'text-amber-600 dark:text-amber-400';
    return 'text-destructive';
  }
  if (actual >= target) return 'text-green-600 dark:text-green-400';
  if (actual >= target * 0.7) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

export function ReviewForm({ brandName, brandId, campaigns, kpiTargets, onSave, onGenerateActionPlan, isGenerating, isSaving }: ReviewFormProps) {
  const buildInitialMetrics = (camps: Array<{ id: string; name: string }>) =>
    camps.map((c) => ({
      campaign_id: c.id,
      campaign_name: c.name,
      spend_3d: '', spend_7d: '', cpl_3d: '', cpl_7d: '', roas_3d: '', roas_7d: '', ctr_3d: '', ctr_7d: '', notes: '',
    }));

  const [metrics, setMetrics] = useState<CampaignMetricEntry[]>(buildInitialMetrics(campaigns));
  const [ads, setAds] = useState<AdEntry[]>([]);
  const [notes, setNotes] = useState('');

  // Reset form state when client/campaigns change
  useEffect(() => {
    setMetrics(buildInitialMetrics(campaigns));
    setAds([]);
    setNotes('');
  }, [brandId]);
  const [newAdName, setNewAdName] = useState('');

  const updateMetric = (idx: number, field: keyof CampaignMetricEntry, value: string) => {
    setMetrics((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const addAd = () => {
    if (!newAdName.trim()) return;
    setAds((prev) => [...prev, { ad_id: crypto.randomUUID(), ad_name: newAdName, spend: '', cpl: '', roas: '', cpp: '', flag: 'keep' }]);
    setNewAdName('');
  };

  const updateAd = (idx: number, field: keyof AdEntry, value: string) => {
    setAds((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{brandName} — Review</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onGenerateActionPlan({ campaign_metrics: metrics, ad_level_data: ads, notes })} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Generate Action Plan
          </Button>
          <Button size="sm" onClick={() => onSave({ campaign_metrics: metrics, ad_level_data: ads, notes })} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save Review
          </Button>
        </div>
      </div>

      {/* Campaign metrics */}
      {metrics.map((m, idx) => (
        <Card key={m.campaign_id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{m.campaign_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['spend', 'cpl', 'roas', 'ctr'] as const).map((kpi) => (
                <div key={kpi} className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">{kpi} (3d / 7d)</Label>
                  <div className="flex gap-1">
                    <Input
                      placeholder="3d"
                      value={m[`${kpi}_3d` as keyof CampaignMetricEntry]}
                      onChange={(e) => updateMetric(idx, `${kpi}_3d` as keyof CampaignMetricEntry, e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="7d"
                      value={m[`${kpi}_7d` as keyof CampaignMetricEntry]}
                      onChange={(e) => updateMetric(idx, `${kpi}_7d` as keyof CampaignMetricEntry, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Campaign Notes</Label>
              <Textarea
                value={m.notes}
                onChange={(e) => updateMetric(idx, 'notes', e.target.value)}
                placeholder="Notes about this campaign..."
                className="h-16 text-xs mt-1"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Ad-level data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ad-Level Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Ad name..." value={newAdName} onChange={(e) => setNewAdName(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" variant="outline" onClick={addAd}>Add Ad</Button>
          </div>

          {ads.map((ad, idx) => (
            <div key={ad.ad_id} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end p-2 rounded-lg bg-muted/30">
              <div className="col-span-2 md:col-span-1">
                <span className="text-xs font-medium truncate block">{ad.ad_name}</span>
              </div>
              {(['spend', 'cpl', 'roas', 'cpp'] as const).map((field) => (
                <div key={field}>
                  <Label className="text-[10px] uppercase text-muted-foreground">{field}</Label>
                  <Input value={ad[field]} onChange={(e) => updateAd(idx, field, e.target.value)} className="h-7 text-xs" />
                </div>
              ))}
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Action</Label>
                <Select value={ad.flag} onValueChange={(v) => updateAd(idx, 'flag', v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FLAG_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <Badge variant="outline" className={cn('text-[10px]', config.className)}>{config.label}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Overall notes */}
      <div>
        <Label className="text-xs text-muted-foreground">Overall Review Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Overall review notes..." className="mt-1" />
      </div>
    </div>
  );
}
