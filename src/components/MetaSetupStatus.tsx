import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Circle, MinusCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// MetaSetupStatus (Patch #30 — single source of truth for connection health)
//
// Replaces the trio of:
//   - Connection Status Card (3-indicator header)
//   - Test Connection panel
//   - Setup Diagnostic panel
//   - Readiness Checklist (when not connected)
//
// All four were calling different edge functions and showing different
// answers. This component calls just `check-meta-setup` and renders a
// single unified status: one big indicator + one summary sentence + a
// collapsible list of checks with inline fix actions.
//
// Pixel SETUP (the multi-step install flow with code snippets) is still
// in PixelVerificationCard, reachable via the "Set up pixel" button.
// ============================================================================

type OverallStatus = 'healthy' | 'limited' | 'broken' | 'disconnected';
type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';
type ActionKind = 'reconnect' | 'pixel_setup' | 'page_link' | 'ig_link' | 'choose_ad_account';

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  fix?: ActionHint;
}

interface ActionHint {
  kind: ActionKind;
  label: string;
  detail?: string;
}

interface CheckResult {
  success: true;
  overallStatus: OverallStatus;
  summary: string;
  checks: Check[];
  primaryAction: ActionHint | null;
  meta: any;
  generatedAt: string;
}

interface Props {
  brandId: string;
  /** Called when the user clicks any reconnect / re-authorize / choose-account fix.
   *  Parent should open the MetaAccountConnect flow. */
  onReconnectRequested?: () => void;
  /** Called when the user clicks the pixel setup fix.
   *  Parent should scroll to / expand the PixelVerificationCard. */
  onPixelSetupRequested?: () => void;
}

export function MetaSetupStatus({ brandId, onReconnectRequested, onPixelSetupRequested }: Props) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandDetails, setExpandDetails] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('check-meta-setup', {
        body: { brandId },
      });
      if (error) throw new Error(error.message || 'Check failed');
      if (!data?.success) throw new Error(data?.error || 'No result returned');
      setResult(data as CheckResult);
    } catch (err: any) {
      setError(err?.message || 'Could not run setup check');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, [brandId]);

  const handleAction = (a: ActionHint | null | undefined) => {
    if (!a) return;
    switch (a.kind) {
      case 'reconnect':
      case 'choose_ad_account':
      case 'page_link':
      case 'ig_link':
        onReconnectRequested?.();
        if (!onReconnectRequested) toast.info('Use the Connect Meta button below to reconnect.');
        break;
      case 'pixel_setup':
        onPixelSetupRequested?.();
        if (!onPixelSetupRequested) toast.info('Scroll to the Pixel Verification section to set up.');
        break;
    }
  };

  // First-load skeleton
  if (loading && !result) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking your Meta setup…</span>
        </CardContent>
      </Card>
    );
  }

  if (error && !result) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Couldn't check your Meta setup</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={runCheck} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const { overallStatus, summary, checks, primaryAction } = result;
  const tone = TONE[overallStatus];
  const Icon = tone.icon;

  return (
    <Card className={cn('border', tone.border)}>
      <CardContent className={cn('p-5 space-y-4', tone.bg)}>
        {/* Top indicator + summary */}
        <div className="flex items-start gap-4">
          <Icon className={cn('h-7 w-7 shrink-0 mt-0.5', tone.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn('text-lg font-semibold', tone.color)}>{tone.headline}</h3>
              <Badge variant="outline" className={cn('text-[10px] uppercase', tone.badge)}>{overallStatus}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{summary}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Checked {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {primaryAction && (
              <Button variant="lumi" size="sm" onClick={() => handleAction(primaryAction)} className="gap-1.5">
                {primaryAction.label}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={runCheck} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Recheck
            </Button>
          </div>
        </div>

        {/* Collapsible details */}
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          onClick={() => setExpandDetails(v => !v)}
        >
          {expandDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expandDetails ? 'Hide' : 'Show'} all {checks.length} checks
        </button>

        {expandDetails && (
          <div className="space-y-1.5 pt-1">
            {checks.map(c => (
              <CheckRow key={c.id} check={c} onAction={handleAction} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CheckRow({ check, onAction }: { check: Check; onAction: (a: ActionHint | undefined) => void }) {
  const ICONS: Record<CheckStatus, { icon: React.ElementType; class: string }> = {
    pass: { icon: CheckCircle2, class: 'text-emerald-600' },
    warn: { icon: AlertTriangle, class: 'text-amber-600' },
    fail: { icon: XCircle, class: 'text-destructive' },
    skip: { icon: MinusCircle, class: 'text-muted-foreground' },
  };
  const { icon: Icon, class: cls } = ICONS[check.status];
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background/50 p-2.5">
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cls)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{check.label}</p>
        {check.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{check.detail}</p>}
      </div>
      {check.fix && (
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5 shrink-0" onClick={() => onAction(check.fix)}>
          {check.fix.label}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual treatment per overall status
// ---------------------------------------------------------------------------

const TONE: Record<OverallStatus, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  badge: string;
  headline: string;
}> = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    headline: 'Connected and healthy',
  },
  limited: {
    icon: AlertTriangle,
    color: 'text-amber-700',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    headline: 'Connected with limitations',
  },
  broken: {
    icon: XCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/5',
    border: 'border-destructive/40',
    badge: 'bg-destructive/10 text-destructive border-destructive/30',
    headline: 'Connection has issues',
  },
  disconnected: {
    icon: Circle,
    color: 'text-muted-foreground',
    bg: 'bg-muted/20',
    border: 'border-muted',
    badge: 'bg-muted text-muted-foreground border-muted',
    headline: 'Not connected',
  },
};
