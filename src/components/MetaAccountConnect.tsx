import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MetaSetupDiagnostic, type DiagnosticResult } from "@/components/MetaSetupDiagnostic";

interface MetaAccountConnectProps {
  brandId: string;
  currentAccountId?: string | null;
  currentPageId?: string | null;
  currentPageName?: string | null;
  currentInstagramId?: string | null;
  currentInstagramName?: string | null;
  tokenExpired?: boolean;
  triggerSize?: "sm" | "default" | "lg";
  /**
   * When true, the dialog will auto-open if the user just completed OAuth in same-tab flow
   * and still needs to select an ad account + Page.
   */
  autoOpen?: boolean;
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

interface InstagramAccount {
  id: string;
  name: string;
  username?: string;
  profile_picture_url?: string;
  linked_page_id: string;
  linked_page_name: string;
}

export function MetaAccountConnect({ 
  brandId, 
  currentAccountId, 
  currentPageId,
  currentPageName,
  currentInstagramId,
  currentInstagramName,
  tokenExpired = false,
  triggerSize = "sm",
  autoOpen = false,
  onUpdate 
}: MetaAccountConnectProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [selectedInstagram, setSelectedInstagram] = useState<string>("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [step, setStep] = useState<'connect' | 'select-account' | 'select-page' | 'select-instagram'>('connect');

  const runPostOAuthDiagnostic = async (accts: AdAccount[], pgs: FacebookPage[], igs: InstagramAccount[]) => {
    try {
      setDiagnosticLoading(true);
      const { data, error } = await supabase.functions.invoke('diagnose-meta-setup', {
        body: {
          brandId,
          accounts: accts,
          pages: pgs,
          instagramAccounts: igs,
        }
      });
      if (!error && data?.success) {
        setDiagnosticResult(data);
      }
    } catch {
      // Non-fatal
    } finally {
      setDiagnosticLoading(false);
    }
  };

  useEffect(() => {
    if (currentAccountId) {
      setSelectedAccount(currentAccountId);
    }
    if (currentPageId) {
      setSelectedPage(currentPageId);
    }
    if (currentInstagramId) {
      setSelectedInstagram(currentInstagramId);
    }
  }, [currentAccountId, currentPageId, currentInstagramId]);

  const getPendingSelectionPayload = () => {
    try {
      const flagRaw = sessionStorage.getItem("meta_oauth_needs_selection");
      if (!flagRaw) return null;

      const flag = JSON.parse(flagRaw);
      if (flag?.brandId && flag.brandId !== brandId) return null;

      const raw = sessionStorage.getItem("meta_oauth_last_result");
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const payload = parsed?.accounts ? parsed : (parsed?.data ?? parsed);

      const pendingAccounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
      const pendingPages = Array.isArray(payload?.pages) ? payload.pages : [];
      const pendingInstagram = Array.isArray(payload?.instagramAccounts)
        ? payload.instagramAccounts
        : [];

      if (!pendingAccounts.length && !pendingPages.length && !pendingInstagram.length) return null;

      return {
        accounts: pendingAccounts as AdAccount[],
        pages: pendingPages as FacebookPage[],
        instagramAccounts: pendingInstagram as InstagramAccount[],
      };
    } catch {
      return null;
    }
  };

  const bootstrapSelectionFromOauth = () => {
    const payload = getPendingSelectionPayload();
    if (!payload) return false;

    setAccounts(payload.accounts);
    setPages(payload.pages);
    setInstagramAccounts(payload.instagramAccounts);
    setStep('select-account');
    return true;
  };

  // If we just returned from same-tab OAuth, auto-open + resume selection.
  useEffect(() => {
    if (!autoOpen) return;
    const payload = getPendingSelectionPayload();
    if (payload) setOpen(true);
  }, [autoOpen, brandId]);

  // When the dialog opens, try to resume selection from stored OAuth result.
  useEffect(() => {
    if (!open) return;
    if (step !== 'connect') return;
    if (accounts.length || pages.length || instagramAccounts.length) return;
    bootstrapSelectionFromOauth();
  }, [open, brandId, step, accounts.length, pages.length, instagramAccounts.length]);

  const handleOAuthFlow = async () => {
    setOauthLoading(true);

    // Mobile Safari (and most mobile browsers) block popups even with immediate window.open.
    // Detect mobile and use same-tab redirect flow instead.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // On desktop, open popup immediately (user-gesture context) to avoid blockers.
    const popup = isMobile ? null : window.open('about:blank', 'Meta OAuth', 'width=600,height=700,scrollbars=yes');

    try {
      const redirectUri = `${window.location.origin}/meta-oauth-callback`;

      const { data, error } = await supabase.functions.invoke('meta-oauth-init', {
        body: { brandId, redirectUri }
      });

      if (error) {
        popup?.close();
        throw error;
      }

      if (isMobile) {
        // Same-tab redirect for mobile — avoids popup blocking entirely
        window.location.href = data.authUrl;
        return;
      }

      // Desktop: navigate the popup to the auth URL
      if (popup) {
        popup.location.href = data.authUrl;
      } else {
        // Popup was blocked despite immediate open — fallback to same-tab
        window.location.href = data.authUrl;
        return;
      }

      const handleCallback = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'META_OAUTH_SUCCESS') {
          // Defer async work so errors are caught/handled (async event handlers don't propagate).
          void (async () => {
            try {
              popup?.close();

              // Prefer the full payload (popup completed the exchange)
              let callbackData = event.data.data;

              // Back-compat: if popup only sent `code`, complete exchange here.
              if (!callbackData && event.data.code) {
                const { data: exchanged, error: exchangeError } = await supabase.functions.invoke(
                  'meta-oauth-callback',
                  {
                    body: { code: event.data.code, brandId, redirectUri },
                  }
                );
                if (exchangeError) throw exchangeError;
                callbackData = exchanged;
              }

              if (!callbackData) {
                throw new Error('No data received from OAuth callback');
              }

              const returnedAccounts = callbackData.accounts || [];
              const returnedPages = callbackData.pages || [];
              const returnedInstagram = callbackData.instagramAccounts || [];

              setAccounts(returnedAccounts);
              setPages(returnedPages);
              setInstagramAccounts(returnedInstagram);

              // Check for critical permission warnings
              if (callbackData.permissionWarning) {
                toast.warning(callbackData.permissionWarning, { duration: 12000 });
              }

              // Surface per-IG permission warnings
              if (Array.isArray(callbackData.igPermissionWarnings) && callbackData.igPermissionWarnings.length > 0) {
                toast.warning(callbackData.igPermissionWarnings[0], { duration: 12000 });
              }

              const accountCount = returnedAccounts.length;
              const pageCount = returnedPages.length;
              const igCount = returnedInstagram.length;

              toast.success(
                `Found ${accountCount} ad account${accountCount !== 1 ? 's' : ''}, ${pageCount} Page${pageCount !== 1 ? 's' : ''}, and ${igCount} Instagram account${igCount !== 1 ? 's' : ''}`
              );

              // Run diagnostic in background
              runPostOAuthDiagnostic(returnedAccounts, returnedPages, returnedInstagram);

              // On reconnection, auto-confirm previous selections if they still exist
              if (tokenExpired && currentAccountId && currentPageId) {
                const prevAccountStillExists = returnedAccounts.some((a: AdAccount) => a.id === currentAccountId);
                const prevPageStillExists = returnedPages.some((p: FacebookPage) => p.id === currentPageId);
                const prevIgStillExists = !currentInstagramId || returnedInstagram.some((ig: InstagramAccount) => ig.id === currentInstagramId);

                if (prevAccountStillExists && prevPageStillExists && prevIgStillExists) {
                  setSelectedAccount(currentAccountId);
                  setSelectedPage(currentPageId);
                  if (currentInstagramId) setSelectedInstagram(currentInstagramId);
                  toast.info('Reconnected — your previous ad account, Page, and Instagram selections are still valid.');
                  setStep('select-account');
                  setTimeout(() => {
                    autoSaveReconnection(currentAccountId, currentPageId, currentInstagramId || undefined, returnedPages, returnedInstagram);
                  }, 100);
                  return;
                }
              }

              // Auto-select if only one option for each
              if (accountCount === 1 && pageCount === 1) {
                setSelectedAccount(returnedAccounts[0].id);
                setSelectedPage(returnedPages[0].id);
                if (igCount === 1) {
                  setSelectedInstagram(returnedInstagram[0].id);
                }
                toast.info(`We found just one of everything — confirming your setup.`);
              }

              setStep('select-account');
            } catch (err: any) {
              console.error('OAuth callback handling error:', err);
              toast.error(err?.message || 'OAuth failed');
            } finally {
              setOauthLoading(false);
              window.removeEventListener('message', handleCallback);
            }
          })();
        } else if (event.data?.type === 'META_OAUTH_ERROR') {
          const msg = event.data.error || 'OAuth failed';
          toast.error(msg);
          setOauthLoading(false);
          window.removeEventListener('message', handleCallback);
        } else if (event.data?.type === 'META_OAUTH_FALLBACK_TO_SAME_TAB') {
          // Popup lost session (Safari/Incognito) - redirect main window to callback URL (same-tab flow)
          popup?.close();
          window.removeEventListener('message', handleCallback);
          setOauthLoading(false);
          
          // Navigate main window to the callback URL - this triggers same-tab flow
          // which has proper "Sign in to continue" UI with session recovery
          if (event.data.callbackUrl) {
            window.location.href = event.data.callbackUrl;
          } else {
            toast.error('Session lost. Please try again.');
          }
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

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-meta-token', {
        body: { brandId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Meta token refreshed successfully", {
          description: `Valid until ${new Date(data.newExpiresAt).toLocaleDateString()}`
        });
        onUpdate();
      } else {
        toast.error("Could not refresh token", {
          description: data.error || "Please reconnect your Meta account"
        });
      }
    } catch (error: any) {
      console.error('Manual refresh error:', error);
      toast.error("Failed to refresh token", {
        description: "Please try reconnecting your Meta account"
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-save reconnection when previous selections are still valid
  const autoSaveReconnection = async (
    accountId: string,
    pageId: string,
    instagramId?: string,
    availablePages?: FacebookPage[],
    availableInstagram?: InstagramAccount[]
  ) => {
    const selectedPageData = (availablePages || pages).find(p => p.id === pageId);
    const selectedInstagramData = instagramId
      ? (availableInstagram || instagramAccounts).find(ig => ig.id === instagramId)
      : null;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({
          meta_account_id: accountId,
          page_id: pageId,
          page_name: selectedPageData?.name || null,
          instagram_account_id: instagramId || null,
          instagram_account_name: selectedInstagramData?.name || selectedInstagramData?.username || null,
          multi_advertiser_ads: false,
          site_links_enabled: false
        })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Meta reconnected successfully");

      // Trigger campaign sync
      const syncToastId = toast.loading("Syncing campaigns from Meta...");
      const { data: syncResult, error: syncError } = await supabase.functions.invoke(
        'sync-meta-campaigns',
        { body: { brandId, metaAccountId: accountId } }
      );

      if (syncError) {
        toast.error("Campaign sync failed", { id: syncToastId, description: "You can manually sync from the Data page" });
      } else {
        const count = syncResult?.synced || 0;
        if (count > 0) {
          toast.success(`Synced ${count} campaign${count !== 1 ? 's' : ''}`, { id: syncToastId });
        } else {
          toast.success("All campaigns up to date", { id: syncToastId });
        }
      }

      try { sessionStorage.removeItem("meta_oauth_needs_selection"); } catch { /* ignore */ }

      onUpdate();
      setOpen(false);
      resetState();
    } catch (error: any) {
      console.error('Auto-save reconnection error:', error);
      toast.error("Failed to save — please select your accounts manually");
      setStep('select-account');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPage = () => {
    if (!selectedPage) {
      toast.error("Please select a Facebook Page");
      return;
    }
    
    // Find Instagram accounts linked to the selected page first, then include others
    const linkedInstagram = instagramAccounts.filter(ig => ig.linked_page_id === selectedPage);
    const otherInstagram = instagramAccounts.filter(ig => ig.linked_page_id !== selectedPage);
    
    // If there's exactly one linked Instagram, auto-select it
    if (linkedInstagram.length === 1) {
      setSelectedInstagram(linkedInstagram[0].id);
    } else if (linkedInstagram.length === 0 && instagramAccounts.length === 1) {
      // If no page-linked IG but only one total, auto-select
      setSelectedInstagram(instagramAccounts[0].id);
    }
    
    setStep('select-instagram');
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
    const selectedInstagramData = instagramAccounts.find(ig => ig.id === selectedInstagram);

    setLoading(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ 
          meta_account_id: selectedAccount,
          page_id: selectedPage,
          page_name: selectedPageData?.name || null,
          instagram_account_id: selectedInstagram || null,
          instagram_account_name: selectedInstagramData?.name || selectedInstagramData?.username || null,
          // Set defaults - multi-advertiser OFF, site links OFF
          multi_advertiser_ads: false,
          site_links_enabled: false
        })
        .eq('id', brandId);

      if (error) throw error;

      toast.success("Meta ad account and Page connected");
      
      // Trigger campaign sync - token is retrieved server-side from Vault
      const syncToastId = toast.loading("Syncing campaigns from Meta...");
      
      const { data: syncResult, error: syncError } = await supabase.functions.invoke(
        'sync-meta-campaigns',
        {
          body: {
            brandId,
            metaAccountId: selectedAccount
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

      try {
        sessionStorage.removeItem("meta_oauth_needs_selection");
      } catch {
        // ignore
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
    setInstagramAccounts([]);
    setSelectedInstagram("");
    setStep('connect');
    setOauthLoading(false);
  };

  const isConnected = currentAccountId && currentPageId;
  const needsReconnect = tokenExpired || (isConnected && !currentPageName);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetState();
    }}>
      <DialogTrigger asChild>
        {needsReconnect ? (
          <Button variant="destructive" size={triggerSize} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reconnect Meta
          </Button>
        ) : isConnected ? (
          <Button variant="outline" size={triggerSize}>
            <Link2 className="mr-2 h-4 w-4" />
            Change Connection
          </Button>
        ) : (
          <Button variant="default" size={triggerSize}>
            <Link2 className="mr-2 h-4 w-4" />
            Connect Meta Account
          </Button>
        )}
      </DialogTrigger>
      
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {needsReconnect ? "Reconnect Meta Account" : isConnected ? "Change Meta Connection" : "Connect Meta Account"}
          </DialogTitle>
          <DialogDescription>
            {needsReconnect 
              ? "Your Meta connection has expired. Please reconnect to continue managing your campaigns."
              : "Connect your Meta Business account to enable campaign creation."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {needsReconnect && isConnected && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm mb-4">
              <p className="font-medium mb-2 flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Connection Expired
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Your Meta access has expired. Please reconnect to continue syncing campaigns and performance data.
              </p>
              <div className="space-y-1 text-xs">
                <p><span className="text-muted-foreground">Previous Account:</span> <code>{currentAccountId}</code></p>
                <p><span className="text-muted-foreground">Page:</span> {currentPageName || currentPageId}</p>
              </div>
            </div>
          )}
          {isConnected && !needsReconnect && (
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
                  <p className="text-xs text-muted-foreground mb-2">
                    We couldn't find any Facebook Pages linked to this account. This can happen if:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>You're logged into a different Facebook account than expected</li>
                    <li>Your page is managed through Meta Business Manager</li>
                    <li>You don't have Admin or Editor access to the page</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Try disconnecting and reconnecting with the correct Facebook account, or make sure you have Admin access to the page.
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
                  onClick={handleSelectPage} 
                  disabled={!selectedPage || pages.length === 0}
                  className="flex-1"
                >
                  Next: Select Instagram
                </Button>
              </div>
            </div>
          )}

          {step === 'select-instagram' && (
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">
                  Step 3: Select Instagram Account
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Your ads will also appear on Instagram from this account
                </p>
              </div>

              {instagramAccounts.length === 0 ? (
                <Card className="p-4 border-amber-500/50 bg-amber-500/5">
                  <p className="text-sm text-amber-600 font-medium mb-2">No Instagram Accounts Found</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    No Instagram Business or Creator accounts were found through your Facebook Pages or ad account connections.
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    <strong>To fix this:</strong>
                  </p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Go to your Facebook Page → Settings → Linked Accounts</li>
                    <li>Connect your Instagram account (must be a Business or Creator account)</li>
                    <li>Or add the Instagram account to your ad account in Meta Business Settings</li>
                    <li>Come back here and reconnect Meta to see your Instagram account</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-3">
                    You can still create ads without Instagram — they'll appear on Facebook only.
                  </p>
                </Card>
              ) : (
                <RadioGroup value={selectedInstagram} onValueChange={setSelectedInstagram}>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {instagramAccounts.map((ig) => (
                      <Card 
                        key={ig.id}
                        className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
                          selectedInstagram === ig.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedInstagram(ig.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value={ig.id} id={`ig-${ig.id}`} className="mt-0.5" />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={`ig-${ig.id}`} className="font-medium cursor-pointer">
                              {ig.name || ig.username}
                            </Label>
                            {ig.username && (
                              <p className="text-xs text-muted-foreground">@{ig.username}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Linked to: {ig.linked_page_name}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </RadioGroup>
              )}

              <Separator />

              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <strong>Ad Account:</strong> {accounts.find(a => a.id === selectedAccount)?.name || selectedAccount}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Facebook Page:</strong> {pages.find(p => p.id === selectedPage)?.name || selectedPage}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('select-page')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleSaveConnection} 
                  disabled={loading}
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
