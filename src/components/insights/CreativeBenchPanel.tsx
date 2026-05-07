import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Zap, PauseCircle, Play, RefreshCw, RotateCcw,
  ChevronDown, Clock, TrendingUp, Loader2, Sparkles,
  Plus, Video, Layers, Image as ImageIcon, FileText, Target, Trash2,
} from 'lucide-react';

interface BenchItem {
  id: string;
  production_item_id: string | null;
  meta_ad_id: string | null;
  status: string;
  performance_snapshot: any;
  auto_rotate_approved: boolean;
  paused_at: string | null;
  last_live_at: string | null;
  retest_eligible_at: string | null;
}

interface RotationLog {
  id: string;
  action: string;
  old_ad_id: string | null;
  new_ad_id: string | null;
  reason: string | null;
  created_at: string;
}

interface CreativeBenchPanelProps {
  workspaceId: string;
  brandId: string;
  autoRotateEnabled: boolean;
  onAutoRotateChange: (enabled: boolean) => void;
  workspace?: any;
}

const formatIcons: Record<string, React.ElementType> = {
  talking_head: Video,
  b_roll: Video,
  carousel: Layers,
  static: ImageIcon,
};

const stageColors: Record<string, string> = {
  grow: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  nurture: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  convert: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

function getBenchItemName(item: BenchItem): string {
  const snap = item.performance_snapshot;
  if (snap?.name) return snap.name;
  if (snap?.title) return snap.title;
  if (snap?.hook) return snap.hook.substring(0, 60) + (snap.hook.length > 60 ? '…' : '');
  if (item.meta_ad_id) return item.meta_ad_id;
  if (item.production_item_id) return item.production_item_id;
  return 'Untitled';
}

export function CreativeBenchPanel({
  workspaceId,
  brandId,
  autoRotateEnabled,
  onAutoRotateChange,
  workspace,
}: CreativeBenchPanelProps) {
  const [benchItems, setBenchItems] = useState<BenchItem[]>([]);
  const [rotationLogs, setRotationLogs] = useState<RotationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchBenchData();
  }, [workspaceId]);

  // Listen for "Add to bench" requests from the fatigue gauge in CampaignInsightDetail
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.workspaceId === workspaceId) {
        setSelectedConcepts([]);
        setPickerOpen(true);
      }
    };
    window.addEventListener('open-bench-picker', handler);
    return () => window.removeEventListener('open-bench-picker', handler);
  }, [workspaceId]);

  const fetchBenchData = async () => {
    setLoading(true);
    const [benchRes, logRes] = await Promise.all([
      supabase
        .from('creative_bench')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('creative_rotation_log')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setBenchItems((benchRes.data as any[]) || []);
    setRotationLogs((logRes.data as any[]) || []);
    setLoading(false);
  };

  // Parse concepts from workspace
  const getAvailableConcepts = () => {
    if (!workspace) return [];
    const creative = workspace.creative_json || {};
    const creativeMix = creative.creative_mix || creative.customer_journey || {};
    const concepts: any[] = [];

    const existingIds = new Set(benchItems.map(i => i.production_item_id));

    ['grow', 'nurture', 'convert'].forEach(stage => {
      const stageItems = creativeMix[stage] || creativeMix[stage === 'grow' ? 'tofu' : stage === 'nurture' ? 'mofu' : 'bofu'] || [];
      stageItems.forEach((c: any, idx: number) => {
        const conceptId = `${stage}-${idx}`;
        if (!existingIds.has(conceptId)) {
          concepts.push({ ...c, stage, conceptId });
        }
      });
    });

    return concepts;
  };

  const handleAddToBench = async () => {
    if (selectedConcepts.length === 0) return;
    setAdding(true);
    const concepts = getAvailableConcepts();
    const toAdd = concepts.filter(c => selectedConcepts.includes(c.conceptId));

    const inserts = toAdd.map(c => ({
      workspace_id: workspaceId,
      brand_id: brandId,
      production_item_id: c.conceptId,
      status: 'bench',
      performance_snapshot: {
        name: c.title || c.name || c.hook,
        hook: c.hook,
        script: c.script,
        format: c.format,
        stage: c.stage,
        angle: c.angle_name || c.hook_type,
        type: 'concept_library',
      },
      auto_rotate_approved: false,
    }));

    const { error } = await supabase.from('creative_bench').insert(inserts);
    if (error) {
      toast.error('Failed to add concepts to bench');
    } else {
      toast.success(`Added ${toAdd.length} concept${toAdd.length > 1 ? 's' : ''} to bench`);
      setPickerOpen(false);
      setSelectedConcepts([]);
      fetchBenchData();
    }
    setAdding(false);
  };

  const handleRemoveFromBench = async (itemId: string) => {
    const { error } = await supabase.from('creative_bench').delete().eq('id', itemId);
    if (error) {
      toast.error('Failed to remove');
    } else {
      setBenchItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Removed from bench');
    }
  };

  const liveItems = benchItems.filter(i => i.status === 'live');
  const onBench = benchItems.filter(i => i.status === 'bench');
  const pausedItems = benchItems.filter(i => i.status === 'paused');

  const handleSwapNow = async (fatigueAdId: string, benchAdId: string) => {
    setRotating(true);
    try {
      const { error } = await supabase.functions.invoke('rotate-creative', {
        body: { workspaceId, brandId, fatigueAdId, benchAdId, reason: 'Manual swap', isAutoRotation: false },
      });
      if (error) throw error;
      toast.success('Creative rotated successfully!');
      fetchBenchData();
    } catch (err: any) {
      toast.error('Failed to rotate creative');
    } finally {
      setRotating(false);
    }
  };

  const handleApproveForRotation = async (itemId: string, approved: boolean) => {
    const { error } = await supabase
      .from('creative_bench')
      .update({ auto_rotate_approved: approved })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to update');
    } else {
      toast.success(approved ? 'Approved for auto-rotation' : 'Removed from auto-rotation');
      setBenchItems(prev => prev.map(i => i.id === itemId ? { ...i, auto_rotate_approved: approved } : i));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live': return <Badge className="bg-green-100 text-green-700 border-green-200">Live</Badge>;
      case 'bench': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">On Bench</Badge>;
      case 'paused': return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Paused</Badge>;
      case 'retesting': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Retesting</Badge>;
      case 'retired': return <Badge className="bg-muted text-muted-foreground">Retired</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Detect fatigued live ads
  const fatiguedLive = liveItems.filter(item => {
    const snap = item.performance_snapshot;
    if (!snap) return false;
    return (snap.frequency >= 4) || (snap.ctr !== undefined && snap.ctr < 0.8);
  });
  const readyBench = onBench.filter(i => i.auto_rotate_approved && i.meta_ad_id);

  const handleBulkRefresh = async () => {
    if (fatiguedLive.length === 0 || readyBench.length === 0) return;
    setRotating(true);
    try {
      const swapCount = Math.min(fatiguedLive.length, readyBench.length);
      for (let i = 0; i < swapCount; i++) {
        await supabase.functions.invoke('rotate-creative', {
          body: {
            workspaceId, brandId,
            fatigueAdId: fatiguedLive[i].meta_ad_id,
            benchAdId: readyBench[i].meta_ad_id,
            reason: 'Bulk fatigue refresh',
            isAutoRotation: false,
          },
        });
      }
      toast.success(`Swapped ${swapCount} fatigued ad${swapCount > 1 ? 's' : ''} with bench creative!`);
      fetchBenchData();
    } catch {
      toast.error('Failed to refresh creative');
    } finally {
      setRotating(false);
    }
  };

  const availableConcepts = getAvailableConcepts();

  return (
    <div className="space-y-4">
      {/* Fatigue Alert Banner */}
      {fatiguedLive.length > 0 && readyBench.length > 0 && !autoRotateEnabled && (
        <Card className="rounded-2xl border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {fatiguedLive.length} ad{fatiguedLive.length > 1 ? 's' : ''} showing fatigue
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {readyBench.length} bench creative ready to swap in
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleBulkRefresh} disabled={rotating}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white">
                {rotating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Swap Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Rotate Toggle */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--lumi-orange-1)/0.1)] flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
              </div>
              <div>
                <Label className="text-sm font-medium">Auto-Rotate When Fatigued</Label>
                <p className="text-xs text-muted-foreground">Lumi will automatically swap in bench creative when fatigue is detected</p>
              </div>
            </div>
            <Switch checked={autoRotateEnabled} onCheckedChange={onAutoRotateChange} />
          </div>
        </CardContent>
      </Card>

      {/* Bench Creative Section */}
      <Card className="rounded-2xl border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-600" />
              Bench Creative ({onBench.length})
            </CardTitle>
            {workspace && (
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5"
                onClick={() => { setSelectedConcepts([]); setPickerOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />
                Add from Concepts
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {onBench.length === 0 ? (
            <div className="text-center py-6">
              <Sparkles className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">No bench creative yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Add concepts here so Lumi can swap them in when creative fatigue is detected.
              </p>
            </div>
          ) : (
            onBench.map(item => {
              const snap = item.performance_snapshot || {};
              const FormatIcon = formatIcons[snap.format] || FileText;
              return (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{getBenchItemName(item)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {snap.stage && (
                          <Badge className={`text-[10px] px-1.5 py-0 ${stageColors[snap.stage] || ''}`}>
                            {snap.stage.charAt(0).toUpperCase() + snap.stage.slice(1)}
                          </Badge>
                        )}
                        {snap.format && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                            <FormatIcon className="h-2.5 w-2.5" />
                            {snap.format.replace('_', ' ')}
                          </Badge>
                        )}
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input type="checkbox" checked={item.auto_rotate_approved}
                            onChange={(e) => handleApproveForRotation(item.id, e.target.checked)}
                            className="rounded" />
                          Auto-swap
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {liveItems.length > 0 && item.meta_ad_id && (
                      <Button size="sm" variant="outline"
                        onClick={() => handleSwapNow(liveItems[0].meta_ad_id!, item.meta_ad_id!)}
                        disabled={rotating} className="rounded-xl text-xs">
                        {rotating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Swap In
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveFromBench(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Live Creative */}
      {liveItems.length > 0 && (
        <Card className="rounded-2xl border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-600" />
              Live ({liveItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-green-50/50 border border-green-100">
                <div>
                  <p className="text-sm font-medium">{getBenchItemName(item)}</p>
                  {item.performance_snapshot?.ctr !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      CTR: {(item.performance_snapshot.ctr).toFixed(2)}% · Freq: {(item.performance_snapshot.frequency || 0).toFixed(1)}
                    </p>
                  )}
                </div>
                {getStatusBadge(item.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paused */}
      {pausedItems.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-amber-600" />
              Paused ({pausedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pausedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border">
                <div>
                  <p className="text-sm font-medium">{getBenchItemName(item)}</p>
                  {item.paused_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Paused {new Date(item.paused_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {getStatusBadge(item.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Rotation History */}
      {rotationLogs.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full p-4 rounded-xl border bg-card text-sm font-medium hover:bg-muted/50 transition-colors">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Rotation History ({rotationLogs.length})
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {rotationLogs.map(log => (
              <div key={log.id} className="p-3 rounded-xl border text-sm">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">{log.action.replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
                </div>
                {log.reason && <p className="text-xs text-muted-foreground">{log.reason}</p>}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Concept Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Concepts to Bench</DialogTitle>
            <DialogDescription>
              Select concepts from your library to add to the creative bench.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-2">
            {availableConcepts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No concepts available to add. Generate creative concepts first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableConcepts.map((concept: any) => {
                  const FormatIcon = formatIcons[concept.format] || FileText;
                  const isSelected = selectedConcepts.includes(concept.conceptId);
                  return (
                    <div key={concept.conceptId}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedConcepts(prev =>
                          prev.includes(concept.conceptId)
                            ? prev.filter(id => id !== concept.conceptId)
                            : [...prev, concept.conceptId]
                        );
                      }}>
                      <Checkbox checked={isSelected} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{concept.title || concept.name || concept.hook}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge className={`text-[10px] px-1.5 py-0 ${stageColors[concept.stage] || ''}`}>
                            {concept.stage.charAt(0).toUpperCase() + concept.stage.slice(1)}
                          </Badge>
                          {concept.format && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                              <FormatIcon className="h-2.5 w-2.5" />
                              {concept.format.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        {concept.hook && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{concept.hook}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          {availableConcepts.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
              <Button onClick={handleAddToBench} disabled={selectedConcepts.length === 0 || adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add {selectedConcepts.length > 0 ? `(${selectedConcepts.length})` : ''} to Bench
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
