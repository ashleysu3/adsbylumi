import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Zap, PauseCircle, Play, RefreshCw, RotateCcw,
  ChevronDown, Clock, TrendingUp, Loader2, Sparkles
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
}

export function CreativeBenchPanel({
  workspaceId,
  brandId,
  autoRotateEnabled,
  onAutoRotateChange,
}: CreativeBenchPanelProps) {
  const [benchItems, setBenchItems] = useState<BenchItem[]>([]);
  const [rotationLogs, setRotationLogs] = useState<RotationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetchBenchData();
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

  const liveItems = benchItems.filter(i => i.status === 'live');
  const onBench = benchItems.filter(i => i.status === 'bench');
  const pausedItems = benchItems.filter(i => i.status === 'paused');
  const retesting = benchItems.filter(i => i.status === 'retesting');

  const handleSwapNow = async (fatigueAdId: string, benchAdId: string) => {
    setRotating(true);
    try {
      const { data, error } = await supabase.functions.invoke('rotate-creative', {
        body: { workspaceId, brandId, fatigueAdId, benchAdId, reason: 'Manual swap', isAutoRotation: false },
      });
      if (error) throw error;
      toast.success('Creative rotated successfully!');
      fetchBenchData();
    } catch (err: any) {
      toast.error('Failed to rotate creative');
      console.error(err);
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

  if (benchItems.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="p-8 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-sm mb-1">No Creative Tracked Yet</h3>
          <p className="text-sm text-muted-foreground">
            Published ads will appear here once they're live. Bench creative will be ready for auto-rotation.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Detect fatigued live ads (frequency >= 4 or low CTR)
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
      // Swap each fatigued ad with a bench ad (up to available bench items)
      const swapCount = Math.min(fatiguedLive.length, readyBench.length);
      for (let i = 0; i < swapCount; i++) {
        await supabase.functions.invoke('rotate-creative', {
          body: {
            workspaceId,
            brandId,
            fatigueAdId: fatiguedLive[i].meta_ad_id,
            benchAdId: readyBench[i].meta_ad_id,
            reason: 'Bulk fatigue refresh',
            isAutoRotation: false,
          },
        });
      }
      toast.success(`Swapped ${swapCount} fatigued ad${swapCount > 1 ? 's' : ''} with bench creative!`);
      fetchBenchData();
    } catch (err: any) {
      toast.error('Failed to refresh creative');
      console.error(err);
    } finally {
      setRotating(false);
    }
  };

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
              <Button
                size="sm"
                onClick={handleBulkRefresh}
                disabled={rotating}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              >
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
                  <p className="text-sm font-medium">{item.meta_ad_id || item.production_item_id || 'Untitled'}</p>
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

      {/* On the Bench */}
      {onBench.length > 0 && (
        <Card className="rounded-2xl border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-600" />
              On the Bench ({onBench.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {onBench.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.production_item_id || 'Untitled'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={item.auto_rotate_approved}
                          onChange={(e) => handleApproveForRotation(item.id, e.target.checked)}
                          className="rounded"
                        />
                        Auto-swap approved
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {liveItems.length > 0 && item.meta_ad_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSwapNow(liveItems[0].meta_ad_id!, item.meta_ad_id!)}
                      disabled={rotating}
                      className="rounded-xl text-xs"
                    >
                      {rotating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Swap In
                    </Button>
                  )}
                  {getStatusBadge(item.status)}
                </div>
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
                  <p className="text-sm font-medium">{item.meta_ad_id || item.production_item_id || 'Untitled'}</p>
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
    </div>
  );
}
