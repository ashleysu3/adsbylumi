import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Link2, Link2Off, RefreshCw, CheckCircle, XCircle, 
  AlertTriangle, Calendar, Shield, ExternalLink, Loader2,
  ArrowLeft
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { PixelVerificationCard } from '@/components/PixelVerificationCard';

export default function MetaSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [brand, setBrand] = useState<any>(null);

  useEffect(() => {
    fetchBrand();
  }, []);

  const fetchBrand = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setBrand(data);
    } catch (error) {
      console.error('Error fetching brand:', error);
      toast.error('Failed to load Meta connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMeta = async () => {
    try {
      setConnecting(true);
      const { data, error } = await supabase.functions.invoke('meta-oauth-init');
      
      if (error) throw error;
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('Error connecting Meta:', error);
      toast.error('Failed to start Meta connection');
      setConnecting(false);
    }
  };

  const handleDisconnectMeta = async () => {
    if (!brand) return;
    
    if (!confirm('Are you sure you want to disconnect your Meta account? This will disable ad syncing and performance tracking.')) {
      return;
    }

    try {
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

      toast.success('Meta account disconnected');
      fetchBrand();
    } catch (error) {
      console.error('Error disconnecting Meta:', error);
      toast.error('Failed to disconnect Meta account');
    }
  };

  const isConnected = !!(brand?.meta_access_token && brand?.meta_account_id);
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
            onClick={() => navigate('/settings')}
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
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    Not Connected
                  </>
                )}
              </CardTitle>
              <Badge 
                variant={isConnected ? (isExpired ? "destructive" : isExpiringSoon ? "secondary" : "default") : "outline"}
                className={isConnected && !isExpired && !isExpiringSoon ? "bg-green-500/10 text-green-500 border-green-500/30" : ""}
              >
                {isConnected ? (isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Active") : "Inactive"}
              </Badge>
            </div>
            <CardDescription>
              {isConnected 
                ? "Your Meta ad account is connected and syncing"
                : "Connect your Meta account to manage ads and track performance"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
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

                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={handleConnectMeta} 
                    disabled={connecting}
                    variant={isExpired || isExpiringSoon ? "lumi" : "outline"}
                    className="gap-2"
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {isExpired ? "Reconnect Account" : "Refresh Connection"}
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
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-gradient-lumi/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="h-8 w-8 text-lumi-orange-1" />
                </div>
                <h3 className="font-semibold mb-2">Connect Your Meta Account</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Link your Meta Business account to create, manage, and track your Facebook and Instagram ads directly from Lumi.
                </p>
                <Button 
                  onClick={handleConnectMeta} 
                  disabled={connecting}
                  variant="lumi"
                  size="lg"
                  className="gap-2"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Connect Meta Account
                    </>
                  )}
                </Button>
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
