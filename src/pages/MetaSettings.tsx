import { useEffect, useRef, useState } from 'react';
import { MetaSetupStatus } from '@/components/MetaSetupStatus';
import { LumiEducationCard } from '@/components/LumiEducationCard';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MetaAccountConnect } from '@/components/MetaAccountConnect';
import { useLumi } from '@/contexts/LumiContext';
import { useBrand } from '@/contexts/BrandContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { 
  Link2, Link2Off, CheckCircle, XCircle, 
  AlertTriangle, Calendar, Shield, ExternalLink, Loader2,
  ArrowLeft, Zap, Key, RefreshCw, Sparkles
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { PixelVerificationCard } from '@/components/PixelVerificationCard';
import { MetaReadinessChecklist } from '@/components/MetaReadinessChecklist';
import { MetaSetupDiagnostic, type DiagnosticResult } from '@/components/MetaSetupDiagnostic';
import { MetaConnectionCheckLog } from '@/components/MetaConnectionCheckLog';
import { logMetaConnectionCheck, type MetaCheckItem } from '@/lib/log-meta-check';

export default function MetaSettings() {
  const navigate = useNavigate();
  const { setBrandId: setLumiBrandId } = useLumi();
  const { activeBrand, loading: brandContextLoading } = useBrand();
  const { getEffectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const pixelSectionRef = useRef<HTMLDivElement | null>(null);
  const [brand, setBrand] = useState<any>(null);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoTesting, setAutoTesting] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<'checking' | 'healthy' | 'warning' | 'error' | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
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

      // Include meta_access_token so hasValidToken reflects actual token state (not just expiration date)
      const brandSelect =
        'id,user_id,name,meta_account_id,page_id,page_name,instagram_account_id,instagram_account_name,meta_token_expires_at,meta_access_token,meta_pixel_id,meta_pixel_name,meta_pixel_events' as const;

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
        // Token is valid only if both the token itself AND expiration date exist
        setHasValidToken(!!data.meta_token_expires_at && !!data.meta_access_token);
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
        {/* Education card for successful connection */}
        {isConnected && (
          <LumiEducationCard
            cardId="meta-connected-tip"
            headline="You're connected! Here's what happens next."
            body="Lumi will now be able to publish your ads directly to Meta and pull in your performance data automatically."
          />
        )}
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
             onClick={() => navigate('/dashboard')}
          >
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

        {/* Patch #30 — unified Meta setup status (single source of truth) */}
        {brand?.id && (
          <MetaSetupStatus
            brandId={brand.id}
            onReconnectRequested={() => {
              document.getElementById('meta-connect-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onPixelSetupRequested={() => {
              pixelSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        )}

        {/* Connection Status Card */}
        <Card variant="gradient" id="meta-connect-section">
          <CardHeader>

            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Connected
                  </>
                ) : isPartiallyConnected ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Reconnection Required
                  </>
                ) : isAwaitingSelection ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Almost Connected
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    Not Connected
                  </>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Connection Health Indicator */}
                {isConnected && connectionHealth && (
                  <div className="flex items-center gap-1.5">
                    {connectionHealth === 'checking' && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs">Verifying...</span>
                      </div>
                    )}
                    {connectionHealth === 'healthy' && (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-medium">Verified</span>
                      </div>
                    )}
                    {connectionHealth === 'warning' && (
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-xs font-medium">Limited</span>
                      </div>
                    )}
                    {connectionHealth === 'error' && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <div className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="text-xs font-medium">
                          {testResult?.error ? 'Connection Issue' : 'Issue'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <Badge 
                  variant={isConnected ? (isExpired ? "destructive" : isExpiringSoon ? "secondary" : "default") : isPartiallyConnected ? "secondary" : "outline"}
                  className={isConnected && !isExpired && !isExpiringSoon ? "bg-green-500/10 text-green-500 border-green-500/30" : isPartiallyConnected ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : ""}
                >
                  {isConnected ? (isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Active") : isPartiallyConnected ? "Token Missing" : "Inactive"}
                </Badge>
              </div>
            </div>
              <CardDescription>
                {isConnected 
                  ? "Your Meta ad account is connected and syncing"
                  : isPartiallyConnected
                  ? "Your Meta account needs to be reconnected to restore access"
                  : isAwaitingSelection
                  ? "Meta access granted — now choose the ad account and Facebook Page for this brand"
                  : "Connect your Meta account to manage ads and track performance"
                }
              </CardDescription>
              {/* Inline error alert when connection test fails */}
              {connectionHealth === 'error' && testResult?.error && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium">Connection issue: </span>
                    {testResult.error}
                  </AlertDescription>
                </Alert>
              )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Partially Connected State - Needs Reconnection */}
            {isPartiallyConnected && (
              <>
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription>
                    <span className="font-medium block mb-1">Your Meta connection has lost its access token.</span>
                    <span className="text-muted-foreground">
                      This can happen when:
                    </span>
                    <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                      <li>The token expired (tokens last ~60 days)</li>
                      <li>You changed your Meta password</li>
                      <li>You revoked app permissions in Meta settings</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Previous Ad Account</p>
                    <p className="font-mono text-sm">{brand?.meta_account_id}</p>
                  </div>
                  {brand?.page_name && (
                    <div className="p-4 bg-muted/30 rounded-lg opacity-60">
                      <p className="text-xs text-muted-foreground uppercase mb-1">Previous Page</p>
                      <p className="text-sm font-medium">{brand.page_name}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
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
                  <Button 
                    onClick={() => handleTestConnection()} 
                    disabled={testing || refreshing}
                    variant="outline"
                    className="gap-2"
                  >
                    {testing || refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {refreshing ? "Refreshing..." : testing ? "Testing..." : "Test & Refresh Connection"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleDisconnectMeta}
                    className="text-destructive hover:text-destructive"
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            )}

            {/* Fully Connected State */}
            {isConnected && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Ad Account ID</p>
                    <p className="font-mono text-sm">{brand?.meta_account_id}</p>
                  </div>
                  {brand?.page_name && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase mb-1">Facebook Page</p>
                      <p className="text-sm font-medium">{brand.page_name}</p>
                    </div>
                  )}
                  {brand?.instagram_account_name && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase mb-1">Instagram Account</p>
                      <p className="text-sm font-medium">{brand.instagram_account_name}</p>
                    </div>
                  )}
                </div>

                {/* Token Expiry Info */}
                {tokenExpiresAt && (
                  <div className={`p-4 rounded-lg border ${
                    isExpired 
                      ? 'bg-destructive/10 border-destructive/30' 
                      : isExpiringSoon 
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-muted/30 border-border'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4" />
                      <p className="text-xs text-muted-foreground uppercase">Token Expiration</p>
                    </div>
                    <p className="text-sm font-medium">
                      {isExpired 
                        ? `Expired on ${format(tokenExpiresAt, 'MMM d, yyyy')}`
                        : `Expires ${format(tokenExpiresAt, 'MMM d, yyyy')} (${daysUntilExpiry} days)`
                      }
                    </p>
                    {(isExpired || isExpiringSoon) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {isExpired 
                          ? "Please reconnect your Meta account to continue syncing"
                          : "Reconnect soon to avoid disruption"
                        }
                      </p>
                    )}
                  </div>
                )}

                {/* Warning Alert */}
                {(isExpired || isExpiringSoon) && (
                  <Alert variant={isExpired ? "destructive" : "default"} className="border-yellow-500/30 bg-yellow-500/5">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {isExpired 
                        ? "Your Meta connection has expired. Reconnect to resume ad management and tracking."
                        : "Your Meta token will expire soon. Reconnect to ensure uninterrupted service."
                      }
                    </AlertDescription>
                  </Alert>
                )}

                {/* Test Connection Result - Only show full panel for manual tests or errors */}
                {testResult && (!testResult.isAutoTest || !testResult.success) && (
                  <div className={`p-4 rounded-lg border ${
                    testResult.success 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-destructive/10 border-destructive/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      {testResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                          {testResult.message}
                        </p>
                        {testResult.error && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {testResult.error}
                          </p>
                        )}
                        {testResult.details && (
                          <div className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Token:</span>
                              <Badge variant={testResult.details.tokenValid ? "default" : "destructive"} className={testResult.details.tokenValid ? "bg-green-500/10 text-green-600 border-green-500/30" : ""}>
                                {testResult.details.tokenValid ? "Valid" : "Invalid"}
                              </Badge>
                            </div>
                            {testResult.details.permissionsValid !== undefined && (
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Permissions:</span>
                                <Badge variant={testResult.details.permissionsValid ? "default" : "destructive"} className={testResult.details.permissionsValid ? "bg-green-500/10 text-green-600 border-green-500/30" : ""}>
                                  {testResult.details.permissionsValid
                                    ? "All granted"
                                    : testResult.details.missingPermissions?.length
                                    ? `Missing: ${testResult.details.missingPermissions.join(', ')}`
                                    : testResult.details.hasInstagramMediaAccess === false
                                    ? "Instagram access blocked"
                                    : "Needs attention"}
                                </Badge>
                              </div>
                            )}
                            {testResult.details.hasInstagramMediaAccess === false && (
                              <Alert className="mt-2 border-amber-500/30 bg-amber-500/5">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <AlertDescription className="text-xs space-y-2">
                                  <p><span className="font-medium">Instagram post browsing isn't available yet for this connection.</span></p>
                                  <p>Try disconnecting and reconnecting your Meta account — this will automatically update your access. Make sure the Instagram profile is a Business or Creator account linked to your selected Facebook Page.</p>
                                  {testResult.details.instagramMediaError && (
                                    <p><span className="font-medium">Meta returned:</span> {testResult.details.instagramMediaError}</p>
                                  )}
                                </AlertDescription>
                              </Alert>
                            )}
                            {testResult.details.adAccountName && (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-muted-foreground">Ad Account:</span>
                                <span className="font-medium">{testResult.details.adAccountName}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Troubleshooting tips for errors */}
                        {!testResult.success && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-md">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Troubleshooting:</p>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                              {testResult.details?.tokenValid === false && (
                                <li>Your token may have expired. Try reconnecting your Meta account.</li>
                              )}
                              {testResult.details?.permissionsValid === false && (
                                <li>Some access may be missing. Try disconnecting and reconnecting your Meta account to refresh it.</li>
                              )}
                              {testResult.details?.hasInstagramMediaAccess === false && (
                                <li>Instagram post browsing isn't available yet. Disconnect and reconnect to update your access.</li>
                              )}
                              {!testResult.details?.tokenValid && (
                                <li>Check if you've changed your Meta password recently.</li>
                              )}
                              <li>Try disconnecting and reconnecting your Meta account.</li>
                            </ul>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setTestResult(null)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button 
                    onClick={() => handleTestConnection()} 
                    disabled={testing || refreshing}
                    variant="outline"
                    className="gap-2"
                  >
                    {testing || refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {refreshing ? "Refreshing..." : testing ? "Testing..." : "Test & Refresh Connection"}
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
                  <Button 
                    variant="ghost" 
                    onClick={handleDisconnectMeta}
                    className="text-destructive hover:text-destructive"
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            )}

            {/* Awaiting Selection State (token stored, but no ad account chosen yet) */}
            {isAwaitingSelection && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-gradient-lumi/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-lumi-orange-1" />
                </div>
                <h3 className="font-semibold mb-2">Finish Your Meta Connection</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  We’re connected to Meta—now select the ad account and Facebook Page you want to use for this brand.
                </p>
                {brand?.id ? (
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
                ) : (
                  <Button variant="lumi" size="lg" onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                )}
              </div>
            )}

            {/* Not Connected State */}
            {!isConnected && !isPartiallyConnected && !isAwaitingSelection && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-gradient-lumi/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="h-8 w-8 text-lumi-orange-1" />
                </div>
                <h3 className="font-semibold mb-2">Connect Your Meta Account</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Link your Meta Business account to create, manage, and track your Facebook and Instagram ads directly from Lumi.
                </p>
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup Diagnostic — show when connected and diagnostic has results */}
        {isConnected && diagnosticResult && (
          <MetaSetupDiagnostic
            result={diagnosticResult}
            brandId={brand?.id || ''}
            onRecheck={handleDiagnosticRecheck}
            rechecking={diagnosticLoading}
            recheckCount={diagnosticRecheckCount}
            onAskLumi={() => {
              // Open Lumi with meta-setup context
              const event = new CustomEvent('open-lumi', { detail: { context: 'meta-setup', message: 'I need help with my Meta setup' } });
              window.dispatchEvent(event);
            }}
          />
        )}

        {/* Meta Readiness Checklist — only show when NOT fully connected */}
        {brand?.id && !isConnected && (
          <MetaReadinessChecklist
            brandId={brand.id}
            onConnectMeta={() => {
              // Connect flow is handled by the connection card above
            }}
          />
        )}

        {/* Permissions & Info Card */}
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions & Security
            </CardTitle>
            <CardDescription>
              What we access and how your data is protected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Ad Account Management</p>
                  <p className="text-xs text-muted-foreground">Create, edit, and manage ad campaigns</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Performance Insights</p>
                  <p className="text-xs text-muted-foreground">Read campaign metrics and analytics</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Page Publishing</p>
                  <p className="text-xs text-muted-foreground">Post ads to your Facebook page</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Your credentials are encrypted and stored securely. We never share your data with third parties.
                Tokens expire after 60 days and require re-authentication.
              </p>
            </div>

            <Button variant="link" className="p-0 h-auto text-sm" asChild>
              <a href="https://developers.facebook.com/docs/marketing-api" target="_blank" rel="noopener noreferrer">
                Learn more about Meta API permissions
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Connection check log — visible whenever there's a brand to log against */}
        {brand?.id && (
          <MetaConnectionCheckLog brandId={brand.id} refreshKey={logRefreshKey} />
        )}

        {/* Pixel Verification Card — only show when connected (readiness checklist covers it otherwise) */}
        {isConnected && (
          <div ref={pixelSectionRef}>
            <PixelVerificationCard 
              brandId={brand?.id || ''} 
              isMetaConnected={isConnected}
              initialPixelData={brand?.meta_pixel_id ? {
                id: brand.meta_pixel_id,
                name: brand.meta_pixel_name || 'Meta Pixel',
                events: brand.meta_pixel_events || {}
              } : null}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
