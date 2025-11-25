import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface MetaAccountConnectProps {
  brandId: string;
  currentAccountId?: string | null;
  onUpdate: () => void;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
}

export function MetaAccountConnect({ brandId, currentAccountId, onUpdate }: MetaAccountConnectProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (currentAccountId) {
      setSelectedAccount(currentAccountId);
    }
  }, [currentAccountId]);

  const handleOAuthFlow = async () => {
    setOauthLoading(true);
    try {
      const redirectUri = `${window.location.origin}/meta-oauth-callback`;

      // Call edge function to get OAuth URL
      const { data, error } = await supabase.functions.invoke('meta-oauth-init', {
        body: { brandId, redirectUri }
      });

      if (error) throw error;

      // Open OAuth popup
      const popup = window.open(
        data.authUrl,
        'Meta OAuth',
        'width=600,height=700,scrollbars=yes'
      );

      // Listen for OAuth callback
      const handleCallback = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'META_OAUTH_SUCCESS') {
          const { code } = event.data;
          popup?.close();

          // Exchange code for accounts and store token
          const { data: callbackData, error: callbackError } = await supabase.functions.invoke(
            'meta-oauth-callback',
            {
              body: { code, brandId, redirectUri }
            }
          );

          if (callbackError) throw callbackError;

          setAccounts(callbackData.accounts || []);
          toast.success(`Found ${callbackData.accounts?.length || 0} ad accounts`);
        } else if (event.data.type === 'META_OAUTH_ERROR') {
          throw new Error(event.data.error || 'OAuth failed');
        }
      };

      window.addEventListener('message', handleCallback);
      
      // Cleanup listener when popup closes
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleCallback);
          setOauthLoading(false);
        }
      }, 500);

    } catch (error: any) {
      console.error('OAuth flow error:', error);
      toast.error(error.message || "Failed to connect to Meta");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedAccount) {
      toast.error("Please select an ad account");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ meta_account_id: selectedAccount })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Meta ad account connected");
      
      // Trigger campaign sync with detailed progress
      const syncToastId = toast.loading("Syncing campaigns and performance data from Meta...");
      
      const { data: brand } = await supabase
        .from('brands')
        .select('meta_access_token')
        .eq('id', brandId)
        .single();
      
      const { data: syncResult, error: syncError } = await supabase.functions.invoke(
        'sync-meta-campaigns',
        {
          body: {
            brandId,
            metaAccountId: selectedAccount,
            metaAccessToken: brand?.meta_access_token
          }
        }
      );
      
      if (syncError) {
        console.error('Sync error:', syncError);
        toast.error("Campaign sync failed", { 
          id: syncToastId,
          description: "You can manually sync campaigns from the Data page"
        });
      } else {
        const count = syncResult?.synced || 0;
        const skipped = syncResult?.skipped || 0;
        const campaigns = syncResult?.campaigns || [];
        const withPerformanceData = campaigns.filter((c: any) => c.hasPerformanceData).length;
        
        if (count > 0) {
          toast.success(`✓ Synced ${count} campaign${count !== 1 ? 's' : ''}`, { 
            id: syncToastId,
            description: withPerformanceData > 0 
              ? `Performance data loaded for ${withPerformanceData} campaign${withPerformanceData !== 1 ? 's' : ''}. View in Data Dashboard.`
              : skipped > 0 
                ? `${skipped} campaign${skipped !== 1 ? 's were' : ' was'} already synced` 
                : "View campaigns in Data Dashboard"
          });
        } else if (skipped > 0) {
          toast.success("All campaigns are up to date", { 
            id: syncToastId,
            description: `${skipped} campaign${skipped !== 1 ? 's' : ''} already in workspace`
          });
        } else {
          toast.info("No active campaigns found", { 
            id: syncToastId,
            description: "Create campaigns in Meta Ads Manager to sync them here"
          });
        }
      }

      onUpdate();
      setOpen(false);
      setAccounts([]);
    } catch (error: any) {
      console.error('Error saving account:', error);
      toast.error("Failed to save ad account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setAccounts([]);
        setOauthLoading(false);
      }
    }}>
      <DialogTrigger asChild>
        {currentAccountId ? (
          <Button variant="outline" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Change Account
          </Button>
        ) : (
          <Button variant="default" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Connect Meta Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {currentAccountId ? "Change Meta Ad Account" : "Connect Meta Ad Account"}
          </DialogTitle>
          <DialogDescription>
            Connect your Meta Business account to enable campaign creation and management.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentAccountId && (
            <div className="rounded-lg bg-muted p-3 text-sm mb-4">
              <p className="font-medium mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Currently Connected:
              </p>
              <code className="text-xs">{currentAccountId}</code>
            </div>
          )}

          {accounts.length === 0 ? (
            <Card className="p-6 border-2 border-dashed">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Link2 className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Connect to Meta Business</p>
                  <p className="text-sm text-muted-foreground">
                    Sign in with Meta to view and select your ad accounts
                  </p>
                </div>
                <Button 
                  onClick={handleOAuthFlow} 
                  disabled={oauthLoading}
                  size="lg"
                  className="w-full"
                >
                  {oauthLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect with Meta
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">
                  Select Ad Account ({accounts.length} available)
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose which ad account to use for this brand
                </p>
              </div>

              <RadioGroup value={selectedAccount} onValueChange={setSelectedAccount}>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {accounts.map((account) => (
                    <Card 
                      key={account.id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
                        selectedAccount === account.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedAccount(account.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={account.id} id={account.id} className="mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <Label 
                            htmlFor={account.id} 
                            className="font-medium cursor-pointer"
                          >
                            {account.name}
                          </Label>
                          <code className="text-xs text-muted-foreground block">
                            {account.id}
                          </code>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </RadioGroup>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={handleOAuthFlow}
                  disabled={oauthLoading}
                  className="flex-1"
                >
                  {oauthLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Refresh Accounts"
                  )}
                </Button>
                <Button 
                  onClick={handleSaveAccount} 
                  disabled={loading || !selectedAccount}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Connect Account"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
