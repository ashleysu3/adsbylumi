import { useEffect, useRef, useState } from 'react';
import { MetaSetupStatus } from '@/components/MetaSetupStatus';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MetaAccountConnect } from '@/components/MetaAccountConnect';
import { useLumi } from '@/contexts/LumiContext';
import { useBrand } from '@/contexts/BrandContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import {
  Link2, Link2Off, CheckCircle, XCircle,
  AlertTriangle, Shield, ExternalLink, Loader2,
  ArrowLeft, Zap, RefreshCw,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

import { MetaConnectionCheckLog } from '@/components/MetaConnectionCheckLog';
import { logMetaConnectionCheck, type MetaCheckItem } from '@/lib/log-meta-check';

export default function MetaSettings() {
  const navigate = useNavigate();
  const { setBrandId: setLumiBrandId } = useLumi();
  const { activeBrand, loading: brandContextLoading } = useBrand();
  const { getEffectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  
  const [brand, setBrand] = useState<any>(null);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoTesting, setAutoTesting] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<'checking' | 'healthy' | 'warning' | 'error' | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticRecheckCount, setDiagnosticRecheckCount] = useState(0);
  // Bumped after each connection check so the log panel re-fetches
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const bumpLog = () => setLogRefreshKey((k) => k + 1);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    error?: string;
    isAutoTest?: boolean;
    details?: {
      tokenValid?: boolean;
      permissionsValid?: boolean;
      permissions?: string[];
      missingPermissions?: string[];
      hasInstagramMediaAccess?: boolean;
      instagramMediaError?: string;
      adAccountName?: string;
      adAccountId?: string;
    };
  } | null>(null);

  // Re-fetch when active brand changes
  useEffect(() => {
    if (!brandContextLoading && activeBrand?.id) {
      fetchBrand(activeBrand.id);
    } else if (!brandContextLoading && !activeBrand) {
      setLoading(false);
    }
  }, [activeBrand?.id, brandContextLoading]);

  // Auto-test connection when brand is loaded and connected
  useEffect(() => {
    if (brand?.id && brand?.meta_account_id && hasValidToken && !testResult) {
      runAutoTest();
    }
  }, [brand?.id, brand?.meta_account_id, hasValidToken]);

  // Run diagnostic when connected
  useEffect(() => {
    if (brand?.id && brand?.meta_account_id && hasValidToken && !diagnosticResult) {
      runDiagnostic();
    }
  }, [brand?.id, brand?.meta_account_id, hasValidToken]);

  const runDiagnostic = async () => {
    if (!brand?.id) return;
    setDiagnosticLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-meta-setup', {
        body: { brandId: brand.id }
      });
      if (error) throw error;
      if (data?.success) {
        setDiagnosticResult(data);
      }

      // Log the diagnostic outcome
      const userId = await getEffectiveUserId();
      if (userId) {
        const checks: MetaCheckItem[] = Array.isArray(data?.checks)
          ? data.checks.map((c: any) => ({
              label: c.label || c.name || 'Check',
              status: c.passed === true ? 'pass' : c.passed === false ? 'fail' : (c.status || 'skip'),
              note: c.message || c.detail,
            }))
          : [];
        const failed = checks.filter((c) => c.status === 'fail').length;
        const warned = checks.filter((c) => c.status === 'warn').length;
        const outcome = !data?.success || failed > 0 ? 'error' : warned > 0 ? 'warning' : 'success';
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'diagnostic',
          outcome,
          summary: data?.summary || (failed > 0 ? `${failed} check(s) failed` : warned > 0 ? `${warned} warning(s)` : 'Diagnostic passed'),
          checksPerformed: checks,
          details: data || {},
        });
        bumpLog();
      }
    } catch (err) {
      console.error('Diagnostic failed:', err);
      const userId = await getEffectiveUserId();
      if (userId && brand?.id) {
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'diagnostic',
          outcome: 'error',
          summary: 'Diagnostic could not run',
          details: { error: (err as Error)?.message },
        });
        bumpLog();
      }
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleDiagnosticRecheck = async () => {
    setDiagnosticRecheckCount(prev => prev + 1);
    await runDiagnostic();
  };

  // Convert a test-meta-connection response into a structured set of
  // checks + outcome for the connection log.
  const buildTestChecks = (data: any): { checks: MetaCheckItem[]; outcome: 'success' | 'warning' | 'error'; summary: string } => {
    const d = data?.details || {};
    const checks: MetaCheckItem[] = [];
    if ('tokenValid' in d) checks.push({ label: 'Access token', status: d.tokenValid ? 'pass' : 'fail', note: d.tokenValid ? undefined : 'Token rejected by Meta' });
    if ('permissionsValid' in d) {
      const missing = Array.isArray(d.missingPermissions) ? d.missingPermissions : [];
      checks.push({
        label: 'Permissions',
        status: d.permissionsValid ? 'pass' : (missing.length > 0 ? 'warn' : 'fail'),
        note: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
      });
    }
    if ('hasInstagramMediaAccess' in d) {
      checks.push({
        label: 'Instagram media access',
        status: d.hasInstagramMediaAccess ? 'pass' : 'warn',
        note: d.instagramMediaError || (d.hasInstagramMediaAccess ? undefined : 'No IG media access'),
      });
    }
    if (d.adAccountId) {
      checks.push({ label: 'Ad account reachable', status: 'pass', note: d.adAccountName ? `${d.adAccountName} (${d.adAccountId})` : d.adAccountId });
    }
    let outcome: 'success' | 'warning' | 'error';
    if (!data?.success) outcome = 'error';
    else if (d.permissionsValid === false || d.hasInstagramMediaAccess === false) outcome = 'warning';
    else outcome = 'success';
    const summary = data?.message || (outcome === 'success' ? 'All checks passed' : outcome === 'warning' ? 'Connected with limited access' : (data?.error || 'Connection test failed'));
    return { checks, outcome, summary };
  };

  const runAutoTest = async () => {
    if (!brand?.id || autoTesting) return;

    try {
      setAutoTesting(true);
      setConnectionHealth('checking');

      const { data, error } = await supabase.functions.invoke('test-meta-connection', {
        body: { brandId: brand.id }
      });

      if (error) {
        setConnectionHealth('error');
        const userId = await getEffectiveUserId();
        if (userId) {
          await logMetaConnectionCheck({
            brandId: brand.id,
            userId,
            checkType: 'auto_test',
            outcome: 'error',
            summary: 'Auto test could not run',
            details: { error: error.message },
          });
          bumpLog();
        }
        return;
      }

      if (data.success) {
        if (data.details?.permissionsValid === false || data.details?.hasInstagramMediaAccess === false) {
          setConnectionHealth('warning');
        } else {
          setConnectionHealth('healthy');
        }
      } else {
        setConnectionHealth('error');
      }

      // Store result but don't show the full panel unless manually tested
      setTestResult({ ...data, isAutoTest: true });

      const userId = await getEffectiveUserId();
      if (userId) {
        const { checks, outcome, summary } = buildTestChecks(data);
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'auto_test',
          outcome,
          summary,
          checksPerformed: checks,
          details: data?.details || {},
        });
        bumpLog();
      }
    } catch (err) {
      setConnectionHealth('error');
      const userId = await getEffectiveUserId();
      if (userId && brand?.id) {
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'auto_test',
          outcome: 'error',
          summary: 'Auto test threw an exception',
          details: { error: (err as Error)?.message },
        });
        bumpLog();
      }
    } finally {
      setAutoTesting(false);
    }
  };

  const fetchBrand = async (targetBrandId?: string) => {
    const brandIdToFetch = targetBrandId || activeBrand?.id;
    if (!brandIdToFetch) {
      setLoading(false);
      return;
    }

    try {
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) {
        navigate('/auth');
        return;
      }

      // meta_access_token is no longer client-readable; use meta_connected generated flag
      const brandSelect =
        'id,user_id,name,meta_account_id,page_id,page_name,instagram_account_id,instagram_account_name,meta_token_expires_at,meta_connected,meta_pixel_id,meta_pixel_name,meta_pixel_events' as const;

      const { data, error } = await supabase
        .from('brands')
        .select(brandSelect)
        .eq('id', brandIdToFetch)
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) throw error;

      setBrand(data);
      if (data?.id) {
        setLumiBrandId(data.id);
        // Token is valid only if both the token itself exists AND has an expiration date
        setHasValidToken(!!data.meta_token_expires_at && !!(data as any).meta_connected);
      } else {
        setHasValidToken(false);
      }
    } catch (error) {
      console.error('Error fetching brand:', error);
      toast.error('Failed to load Meta connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectMeta = async () => {
    if (!brand) return;
    
    if (!confirm('Are you sure you want to disconnect your Meta account? This will disable ad syncing and performance tracking.')) {
      return;
    }

    try {
      // Delete token from vault + brands table (updated RPC handles both)
      await supabase.rpc('delete_meta_token', { p_brand_id: brand.id });

      const { error } = await supabase
        .from('brands')
        .update({
          meta_access_token: null,
          meta_account_id: null,
          page_id: null,
          page_name: null,
          instagram_account_id: null,
          instagram_account_name: null,
          meta_token_expires_at: null,
          meta_pixel_id: null,
          meta_pixel_name: null,
          meta_pixel_events: null,
          meta_pixel_verified_at: null,
        })
        .eq('id', brand.id);

      if (error) throw error;

      // Reset all UI state so stale "healthy" status doesn't persist
      setHasValidToken(false);
      setTestResult(null);
      setConnectionHealth(null);
      toast.success('Meta account disconnected');

      const userId = await getEffectiveUserId();
      if (userId) {
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'disconnect',
          outcome: 'success',
          summary: 'User disconnected Meta account',
        });
        bumpLog();
      }

      fetchBrand();
    } catch (error) {
      console.error('Error disconnecting Meta:', error);
      toast.error('Failed to disconnect Meta account');
      const userId = await getEffectiveUserId();
      if (userId && brand?.id) {
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'disconnect',
          outcome: 'error',
          summary: 'Disconnect failed',
          details: { error: (error as Error)?.message },
        });
        bumpLog();
      }
    }
  };

  const handleManualRefresh = async () => {
    if (!brand?.id) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-meta-token', {
        body: { brandId: brand.id }
      });
      if (error) throw error;
      const userId = await getEffectiveUserId();
      if (data.success) {
        toast.success("Meta token refreshed successfully", {
          description: `Valid until ${new Date(data.newExpiresAt).toLocaleDateString()}`
        });
        if (userId) {
          await logMetaConnectionCheck({
            brandId: brand.id,
            userId,
            checkType: 'refresh',
            outcome: 'success',
            summary: `Token refreshed (valid until ${new Date(data.newExpiresAt).toLocaleDateString()})`,
            checksPerformed: [{ label: 'Token refresh', status: 'pass' }],
            details: { newExpiresAt: data.newExpiresAt },
          });
          bumpLog();
        }
        fetchBrand();
      } else {
        toast.error("Could not refresh token", {
          description: data.error || "Please reconnect your Meta account"
        });
        if (userId) {
          await logMetaConnectionCheck({
            brandId: brand.id,
            userId,
            checkType: 'refresh',
            outcome: 'error',
            summary: data.error || 'Token refresh failed',
            checksPerformed: [{ label: 'Token refresh', status: 'fail', note: data.error }],
            details: data || {},
          });
          bumpLog();
        }
      }
    } catch (error: any) {
      console.error('Manual refresh error:', error);
      toast.error("Failed to refresh token", {
        description: "Please try reconnecting your Meta account"
      });
      const userId = await getEffectiveUserId();
      if (userId && brand?.id) {
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'refresh',
          outcome: 'error',
          summary: 'Token refresh threw an exception',
          details: { error: error?.message },
        });
        bumpLog();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleTestConnection = async (opts?: { skipRefresh?: boolean }) => {
    if (!brand?.id) {
      toast.error('No brand found');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      setConnectionHealth('checking');

      // First, attempt a silent token refresh so "Test" also keeps the token fresh.
      // Failures here are non-fatal — the test below will surface real auth issues.
      if (!opts?.skipRefresh) {
        try {
          setRefreshing(true);
          const { data: refreshData } = await supabase.functions.invoke('refresh-meta-token', {
            body: { brandId: brand.id }
          });
          if (refreshData?.success) {
            // Pull updated expiry into local brand state
            fetchBrand();
          }
        } catch (refreshErr) {
          console.warn('Silent token refresh failed (continuing to test):', refreshErr);
        } finally {
          setRefreshing(false);
        }
      }

      const { data, error } = await supabase.functions.invoke('test-meta-connection', {
        body: { brandId: brand.id }
      });

      const userId = await getEffectiveUserId();

      if (error) {
        setConnectionHealth('error');
        setTestResult({
          success: false,
          message: 'Test failed',
          error: error.message || 'Could not complete connection test',
          isAutoTest: false
        });
        if (userId) {
          await logMetaConnectionCheck({
            brandId: brand.id,
            userId,
            checkType: 'manual_test',
            outcome: 'error',
            summary: error.message || 'Test invocation failed',
            details: { error: error.message },
          });
          bumpLog();
        }
        return;
      }

      // Update health status based on result
      if (data.success) {
        if (data.details?.permissionsValid === false || data.details?.hasInstagramMediaAccess === false) {
          setConnectionHealth('warning');
        } else {
          setConnectionHealth('healthy');
        }
        toast.success('Connection test passed!');
      } else {
        setConnectionHealth('error');
        toast.error(data.message || 'Connection test failed');
      }

      setTestResult({ ...data, isAutoTest: false });

      if (userId) {
        const { checks, outcome, summary } = buildTestChecks(data);
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'manual_test',
          outcome,
          summary,
          checksPerformed: checks,
          details: data?.details || {},
        });
        bumpLog();
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      setConnectionHealth('error');
      setTestResult({
        success: false,
        message: 'Test failed',
        error: error.message || 'An unexpected error occurred',
        isAutoTest: false
      });
      const userId = await getEffectiveUserId();
      if (userId && brand?.id) {
        await logMetaConnectionCheck({
          brandId: brand.id,
          userId,
          checkType: 'manual_test',
          outcome: 'error',
          summary: 'Manual test threw an exception',
          details: { error: error?.message },
        });
        bumpLog();
      }
    } finally {
      setTesting(false);
    }
  };

  // Connection is valid if we have an account ID AND a valid token in vault
  const hasAccountId = !!brand?.meta_account_id;
  const isAwaitingSelection = !hasAccountId && hasValidToken;
  const isConnected = hasAccountId && hasValidToken;
  const isPartiallyConnected = hasAccountId && !hasValidToken; // Has account but token missing/expired
  const tokenExpiresAt = brand?.meta_token_expires_at ? new Date(brand.meta_token_expires_at) : null;
  const daysUntilExpiry = tokenExpiresAt ? differenceInDays(tokenExpiresAt, new Date()) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient-lumi">Meta Connection</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your Meta (Facebook/Instagram) ad account connection
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* NOT CONNECTED — single CTA, one-line explainer                */}
        {/* ============================================================ */}
        {!isConnected && !isPartiallyConnected && !isAwaitingSelection && (
          <Card variant="gradient" id="meta-connect-section">
            <CardContent className="py-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-gradient-lumi/10 flex items-center justify-center mx-auto">
                <Link2 className="h-8 w-8 text-lumi-orange-1" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl font-semibold">Connect your Meta account</h3>
                <p className="text-sm text-muted-foreground">
                  Link your Meta Business account so LUMI can create, manage, and track your Facebook and Instagram ads.
                </p>
              </div>
              {brand?.id ? (
                <MetaAccountConnect
                  brandId={brand.id}
                  currentAccountId={brand.meta_account_id}
                  currentPageId={brand.page_id}
                  currentPageName={brand.page_name}
                  currentInstagramId={brand.instagram_account_id}
                  currentInstagramName={brand.instagram_account_name}
                  triggerSize="lg"
                  onUpdate={fetchBrand}
                />
              ) : (
                <Button variant="lumi" size="lg" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* AWAITING SELECTION                                           */}
        {/* ============================================================ */}
        {isAwaitingSelection && (
          <Card variant="gradient" id="meta-connect-section">
            <CardContent className="py-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl font-semibold">Finish your Meta connection</h3>
                <p className="text-sm text-muted-foreground">
                  We're connected to Meta — now choose the ad account and Facebook Page for this brand.
                </p>
              </div>
              {brand?.id && (
                <MetaAccountConnect
                  brandId={brand.id}
                  currentAccountId={brand.meta_account_id}
                  currentPageId={brand.page_id}
                  currentPageName={brand.page_name}
                  currentInstagramId={brand.instagram_account_id}
                  currentInstagramName={brand.instagram_account_name}
                  triggerSize="lg"
                  autoOpen
                  onUpdate={fetchBrand}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* PARTIALLY CONNECTED — token missing/expired                  */}
        {/* ============================================================ */}
        {isPartiallyConnected && (
          <Card variant="gradient" id="meta-connect-section" className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Reconnect to keep LUMI running
              </CardTitle>
              <CardDescription>
                Your Meta access token expired or was revoked. Reconnect to restore ad management and tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Previous Ad Account</p>
                  <p className="font-mono text-xs">{brand?.meta_account_id}</p>
                </div>
                {brand?.page_name && (
                  <div className="p-3 bg-muted/30 rounded-lg opacity-70">
                    <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Previous Page</p>
                    <p className="text-xs font-medium">{brand.page_name}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <MetaAccountConnect
                  brandId={brand.id}
                  currentAccountId={brand.meta_account_id}
                  currentPageId={brand.page_id}
                  currentPageName={brand.page_name}
                  currentInstagramId={brand.instagram_account_id}
                  currentInstagramName={brand.instagram_account_name}
                  tokenExpired
                  onUpdate={fetchBrand}
                />
                <Button onClick={() => handleTestConnection()} disabled={testing || refreshing} variant="outline" size="sm" className="gap-2">
                  {testing || refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {refreshing ? 'Refreshing…' : testing ? 'Testing…' : 'Test & Refresh'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDisconnectMeta} className="text-destructive hover:text-destructive">
                  <Link2Off className="h-4 w-4 mr-2" />Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* UNIFIED SETUP STATUS + CHECKLIST                             */}
        {/* MetaSetupStatus = single source: status banner + 5/5 checks  */}
        {/* with inline fix actions. Replaces Connection Card + Health   */}
        {/* Check + Readiness Checklist.                                 */}
        {/* ============================================================ */}
        {brand?.id && (
          <MetaSetupStatus
            brandId={brand.id}
            onReconnectRequested={() => {
              document.getElementById('meta-connect-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onPixelSetupRequested={() => navigate('/tracking-setup')}
          />
        )}

        {/* ============================================================ */}
        {/* CONNECTED — compact essentials + small secondary actions     */}
        {/* ============================================================ */}
        {isConnected && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium text-foreground">
                  You're connected — LUMI can run ads on this account.
                </div>
                {connectionHealth === 'checking' && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verifying…
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <Essential label="Ad Account ID" value={brand?.meta_account_id} mono />
                <Essential label="Facebook Page" value={brand?.page_name || '—'} />
                <Essential label="Instagram" value={brand?.instagram_account_name || 'Not linked'} />
                <Essential
                  label="Token expires"
                  value={tokenExpiresAt ? format(tokenExpiresAt, 'MMM d, yyyy') : '—'}
                  tone={isExpired ? 'error' : isExpiringSoon ? 'warn' : 'default'}
                  hint={daysUntilExpiry !== null ? (isExpired ? 'Expired' : `${daysUntilExpiry} days left`) : undefined}
                />
              </div>

              {(isExpired || isExpiringSoon) && (
                <Alert variant={isExpired ? 'destructive' : 'default'} className="border-yellow-500/30 bg-yellow-500/5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {isExpired
                      ? 'Your Meta connection has expired. Reconnect to resume ad management and tracking.'
                      : 'Your Meta token will expire soon. Reconnect to avoid interruption.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Inline test result only when manual test or error */}
              {testResult && (!testResult.isAutoTest || !testResult.success) && (
                <div className={`p-3 rounded-md border text-xs ${testResult.success ? 'border-green-500/30 bg-green-500/5 text-green-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <p className="font-medium">{testResult.message}</p>
                      {testResult.error && <p className="text-muted-foreground mt-0.5">{testResult.error}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setTestResult(null)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => handleTestConnection()} disabled={testing || refreshing} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  {testing || refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {refreshing ? 'Refreshing…' : testing ? 'Testing…' : 'Recheck'}
                </Button>
                <MetaAccountConnect
                  brandId={brand.id}
                  currentAccountId={brand.meta_account_id}
                  currentPageId={brand.page_id}
                  currentPageName={brand.page_name}
                  currentInstagramId={brand.instagram_account_id}
                  currentInstagramName={brand.instagram_account_name}
                  tokenExpired={isExpired || isExpiringSoon}
                  onUpdate={fetchBrand}
                />
                <Button variant="ghost" size="sm" onClick={handleDisconnectMeta} className="h-8 text-xs text-destructive hover:text-destructive">
                  <Link2Off className="h-3.5 w-3.5 mr-1.5" />Disconnect
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/tracking-setup')} className="h-8 text-xs ml-auto">
                  Tracking & Pixel Setup →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* COLLAPSED: What LUMI can access                              */}
        {/* ============================================================ */}
        <CollapsibleSection
          icon={<Shield className="h-4 w-4" />}
          title="What LUMI can access"
          subtitle="Permissions, encryption, and Meta API details"
        >
          <div className="space-y-3 pt-2">
            <AccessRow title="Ad Account Management" desc="Create, edit, and manage ad campaigns" />
            <AccessRow title="Performance Insights" desc="Read campaign metrics and analytics" />
            <AccessRow title="Page Publishing" desc="Post ads to your Facebook Page" />
            <p className="text-xs text-muted-foreground pt-3 border-t">
              Your credentials are encrypted and stored securely. We never share your data with third parties. Tokens expire after 60 days and require re-authentication.
            </p>
            <Button variant="link" className="p-0 h-auto text-xs" asChild>
              <a href="https://developers.facebook.com/docs/marketing-api" target="_blank" rel="noopener noreferrer">
                Learn more about Meta API permissions
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </CollapsibleSection>

        {/* ============================================================ */}
        {/* COLLAPSED: Connection history                                */}
        {/* ============================================================ */}
        {brand?.id && (
          <CollapsibleSection
            icon={<RefreshCw className="h-4 w-4" />}
            title="Connection history"
            subtitle={connectionHealth === 'healthy' ? 'Last check passed' : connectionHealth === 'warning' ? 'Last check: limited access' : connectionHealth === 'error' ? 'Last check: issues found' : 'View previous checks'}
          >
            <div className="pt-2">
              <MetaConnectionCheckLog brandId={brand.id} refreshKey={logRefreshKey} />
            </div>
          </CollapsibleSection>
        )}
      </div>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Small helpers — kept inline so this page stays self-contained
// ---------------------------------------------------------------------------

function Essential({
  label, value, mono, tone = 'default', hint,
}: { label: string; value?: string | null; mono?: boolean; tone?: 'default' | 'warn' | 'error'; hint?: string }) {
  const toneClass =
    tone === 'error' ? 'border-destructive/30 bg-destructive/5' :
    tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5' :
    'bg-muted/30';
  return (
    <div className={`p-3 rounded-md border ${toneClass}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-xs font-medium truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function AccessRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  icon, title, subtitle, children,
}: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
      >
        <span className="text-muted-foreground">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}
