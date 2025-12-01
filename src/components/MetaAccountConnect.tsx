import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface MetaAccountConnectProps {
  brandId: string;
  currentAccountId?: string | null;
  currentPageId?: string | null;
  currentPageName?: string | null;
  onUpdate: () => void;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
}

interface FacebookPage {
  id: string;
  name: string;
  category?: string;
}

export function MetaAccountConnect({ 
  brandId, 
  currentAccountId, 
  currentPageId,
  currentPageName,
  onUpdate 
}: MetaAccountConnectProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [step, setStep] = useState<'connect' | 'select-account' | 'select-page'>('connect');

  useEffect(() => {
    if (currentAccountId) {
      setSelectedAccount(currentAccountId);
    }
    if (currentPageId) {
      setSelectedPage(currentPageId);
    }
  }, [currentAccountId, currentPageId]);

  const handleOAuthFlow = async () => {
    setOauthLoading(true);
    try {
      const redirectUri = `${window.location.origin}/meta-oauth-callback`;

      const { data, error } = await supabase.functions.invoke('meta-oauth-init', {
        body: { brandId, redirectUri }
      });

      if (error) throw error;

      const popup = window.open(
        data.authUrl,
        'Meta OAuth',
        'width=600,height=700,scrollbars=yes'
      );

      const handleCallback = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'META_OAUTH_SUCCESS') {
          const { code } = event.data;
          popup?.close();

          const { data: callbackData, error: callbackError } = await supabase.functions.invoke(
            'meta-oauth-callback',
            {
              body: { code, brandId, redirectUri }
            }
          );

          if (callbackError) throw callbackError;

          setAccounts(callbackData.accounts || []);
          setPages(callbackData.pages || []);
          
          const accountCount = callbackData.accounts?.length || 0;
          const pageCount = callbackData.pages?.length || 0;
          
          toast.success(`Found ${accountCount} ad account${accountCount !== 1 ? 's' : ''} and ${pageCount} Page${pageCount !== 1 ? 's' : ''}`);
          
          setStep('select-account');
        } else if (event.data.type === 'META_OAUTH_ERROR') {
          throw new Error(event.data.error || 'OAuth failed');
        }
      };

      window.addEventListener('message', handleCallback);
      
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

  const handleSelectAccount = () => {
    if (!selectedAccount) {
      toast.error("Please select an ad account");
      return;
    }
    setStep('select-page');
  };

  const handleSaveConnection = async () => {
    if (!selectedAccount) {
      toast.error("Please select an ad account");
      return;
    }
    if (!selectedPage) {
      toast.error("Please select a Facebook Page");
      return;
    }

    const selectedPageData = pages.find(p => p.id === selectedPage);

    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ 
          meta_account_id: selectedAccount,
          page_id: selectedPage,
          page_name: selectedPageData?.name || null
        })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Meta ad account and Page connected");
      
      // Trigger campaign sync
      const syncToastId = toast.loading("Syncing campaigns from Meta...");
      
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
        
        if (count > 0) {
          toast.success(`Synced ${count} campaign${count !== 1 ? 's' : ''}`, { 
            id: syncToastId,
            description: "View campaigns in Data Dashboard"
          });
        } else if (skipped > 0) {
          toast.success("All campaigns are up to date", { 
            id: syncToastId,
            description: `${skipped} campaign${skipped !== 1 ? 's' : ''} already synced`
          });
        } else {
          toast.info("No active campaigns found", { 
            id: syncToastId,
            description: "Create campaigns to sync them here"
          });
        }
      }

      onUpdate();
      setOpen(false);
      resetState();
    } catch (error: any) {
      console.error('Error saving connection:', error);
      toast.error("Failed to save connection");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setAccounts([]);
    setPages([]);
    setStep('connect');
    setOauthLoading(false);
  };

  const isConnected = currentAccountId && currentPageId;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetState();
    }}>
      <DialogTrigger asChild>
        {isConnected ? (
          <Button variant="outline" size="sm">
            <Link2 className="mr-2 h-4 w-4" />
            Change Connection
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
            {isConnected ? "Change Meta Connection" : "Connect Meta Account"}
          </DialogTitle>
          <DialogDescription>
            Connect your Meta Business account to enable campaign creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isConnected && (
            <div className="rounded-lg bg-muted p-3 text-sm mb-4">
              <p className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Currently Connected
              </p>
              <div className="space-y-1 text-xs">
                <p><span className="text-muted-foreground">Ad Account:</span> <code>{currentAccountId}</code></p>
                <p><span className="text-muted-foreground">Page:</span> {currentPageName || currentPageId}</p>
              </div>
            </div>
          )}

          {step === 'connect' && (
            <Card className="p-6 border-2 border-dashed">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Link2 className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Connect to Meta Business</p>
                  <p className="text-sm text-muted-foreground">
                    Sign in with Meta to select your ad account and Facebook Page
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
          )}

          {step === 'select-account' && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">
                  Step 1: Select Ad Account
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose which ad account to use for this brand
                </p>
              </div>

              <RadioGroup value={selectedAccount} onValueChange={setSelectedAccount}>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                  {accounts.map((account) => (
                    <Card 
                      key={account.id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                        selectedAccount === account.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedAccount(account.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={account.id} id={account.id} className="mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={account.id} className="font-medium cursor-pointer">
                            {account.name}
                          </Label>
                          <code className="text-xs text-muted-foreground block">{account.id}</code>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </RadioGroup>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('connect')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSelectAccount} disabled={!selectedAccount} className="flex-1">
                  Next: Select Page
                </Button>
              </div>
            </div>
          )}

          {step === 'select-page' && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">
                  Step 2: Select Facebook Page
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Your ads will be published from this Page
                </p>
              </div>

              {pages.length === 0 ? (
                <Card className="p-4 border-destructive/50 bg-destructive/5">
                  <p className="text-sm text-destructive font-medium mb-2">No Pages Found</p>
                  <p className="text-xs text-muted-foreground">
                    You need a Facebook Page to create ads. Please create a Page in Facebook and try again.
                  </p>
                </Card>
              ) : (
                <RadioGroup value={selectedPage} onValueChange={setSelectedPage}>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {pages.map((page) => (
                      <Card 
                        key={page.id}
                        className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                          selectedPage === page.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedPage(page.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value={page.id} id={`page-${page.id}`} className="mt-0.5" />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={`page-${page.id}`} className="font-medium cursor-pointer">
                              {page.name}
                            </Label>
                            {page.category && (
                              <p className="text-xs text-muted-foreground">{page.category}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </RadioGroup>
              )}

              <Separator />

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Selected:</strong> Ad Account: {accounts.find(a => a.id === selectedAccount)?.name || selectedAccount}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('select-account')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleSaveConnection} 
                  disabled={loading || !selectedPage || pages.length === 0}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Complete Setup"
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
