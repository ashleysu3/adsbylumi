import { useEffect, useState } from 'react';
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
import { 
  Link2, Link2Off, CheckCircle, XCircle, 
  AlertTriangle, Calendar, Shield, ExternalLink, Loader2,
  ArrowLeft, Zap, Key
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { PixelVerificationCard } from '@/components/PixelVerificationCard';

export default function MetaSettings() {
  const navigate = useNavigate();
  const { brandId: activeBrandId, setBrandId: setActiveBrandId } = useLumi();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [autoTesting, setAutoTesting] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<'checking' | 'healthy' | 'warning' | 'error' | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    error?: string;
    isAutoTest?: boolean;
    details?: {
      tokenValid?: boolean;
      permissionsValid?: boolean;
      permissions?: string[];
      adAccountName?: string;
      adAccountId?: string;
    };
  } | null>(null);

  useEffect(() => {
    fetchBrand();
  }, []);

  // Auto-test connection when brand is loaded and connected
  useEffect(() => {
    if (brand?.id && brand?.meta_account_id && hasValidToken && !testResult) {
      runAutoTest();
    }
  }, [brand?.id, brand?.meta_account_id, hasValidToken]);

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
        return;
      }

      if (data.success) {
        if (data.details?.permissionsValid === false) {
          setConnectionHealth('warning');
        } else {
          setConnectionHealth('healthy');
        }
      } else {
        setConnectionHealth('error');
      }

      // Store result but don't show the full panel unless manually tested
      setTestResult({ ...data, isAutoTest: true });
    } catch {
      setConnectionHealth('error');
    } finally {
      setAutoTesting(false);
    }
  };

  const fetchBrand = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Must be a string literal (not built dynamically) so the typed client returns a real row shape.
      const brandSelect =
        'id,user_id,name,meta_account_id,page_id,page_name,instagram_account_id,instagram_account_name,meta_token_expires_at,meta_pixel_id,meta_pixel_name,meta_pixel_events' as const;

      const fetchById = async (id: string) => {
        // Safety: only load brands owned by the current user.
        // Prevents stale/incorrect brandIds (e.g. from cached state) from breaking Meta OAuth.
        const { data, error } = await supabase
          .from('brands')
          .select(brandSelect)
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      };

      const fetchLatestForUser = async () => {
        const { data, error } = await supabase
          .from('brands')
          .select(brandSelect)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      };

      const data = activeBrandId ? (await fetchById(activeBrandId)) : (await fetchLatestForUser());
      const resolved = data ?? (await fetchLatestForUser());

      setBrand(resolved);
      if (resolved?.id) {
        setActiveBrandId(resolved.id);
        // Avoid reading meta_access_token client-side; treat meta_token_expires_at as the "token present" signal.
        setHasValidToken(!!resolved.meta_token_expires_at);
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
      // Delete token from vault
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
        })
        .eq('id', brand.id);

      if (error) throw error;

      setHasValidToken(false);
      toast.success('Meta account disconnected');
      fetchBrand();
    } catch (error) {
      console.error('Error disconnecting Meta:', error);
      toast.error('Failed to disconnect Meta account');
    }
  };

  const handleTestConnection = async () => {
    if (!brand?.id) {
      toast.error('No brand found');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      setConnectionHealth('checking');

      const { data, error } = await supabase.functions.invoke('test-meta-connection', {
        body: { brandId: brand.id }
      });

      if (error) {
        setConnectionHealth('error');
        setTestResult({
          success: false,
          message: 'Test failed',
          error: error.message || 'Could not complete connection test',
          isAutoTest: false
        });
        return;
      }

      // Update health status based on result
      if (data.success) {
        if (data.details?.permissionsValid === false) {
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
    } catch (error: any) {
      console.error('Test connection error:', error);
      setConnectionHealth('error');
      setTestResult({
        success: false,
        message: 'Test failed',
        error: error.message || 'An unexpected error occurred',
        isAutoTest: false
      });
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

        {/* Connection Status Card */}
        <Card variant="gradient">
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
                        <span className="text-xs font-medium">Issue</span>
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

                <div className="flex gap-3 pt-2">
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
                                <Badge variant={testResult.details.permissionsValid ? "default" : "secondary"} className={testResult.details.permissionsValid ? "bg-green-500/10 text-green-600 border-green-500/30" : ""}>
                                  {testResult.details.permissionsValid ? "All granted" : "Some missing"}
                                </Badge>
                              </div>
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
                                <li>Some permissions are missing. Reconnect and approve all requested permissions.</li>
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
                    onClick={handleTestConnection} 
                    disabled={testing}
                    variant="outline"
                    className="gap-2"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {testing ? "Testing..." : "Test Connection"}
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

        {/* Pixel Verification Card */}
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
    </DashboardLayout>
  );
}
