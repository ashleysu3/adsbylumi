import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SparkleIcon } from "@/components/SparkleIcon";
import { mapAuthError } from "@/lib/mapAuthError";
import { seedDeferredTask } from "@/lib/onboarding-tasks";
import { trackLumiEventOnce } from "@/lib/lumi-pixel";
import lumiLogo from "@/assets/lumi-logo.png";

const REMEMBERED_EMAIL_KEY = "lumi_remembered_email";

export default function Auth() {
  const searchParams = new URLSearchParams(window.location.search);
  const startWithSignup = searchParams.get('signup') === 'true';
  const hasPaid = searchParams.get('paid') === 'true';
  const returnToParam = searchParams.get('returnTo');
  const inviteToken = searchParams.get('invite');
  const safeReturnTo =
    returnToParam && returnToParam.startsWith('/') && !returnToParam.startsWith('//')
      ? returnToParam
      : null;

  // Payment-first: only allow signup form for users coming back from Stripe checkout
  // (paid=true) or accepting a team invite. Anyone else gets sent to the checkout page.
  const canShowSignup = hasPaid || !!inviteToken;
  const [isLogin, setIsLogin] = useState(!startWithSignup || !canShowSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  // If returning from Stripe checkout, resolve any partner promo code used at checkout
  // and prime the PartnerWelcomeModal so it pops up after the user signs in.
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!hasPaid || !sessionId) return;
    // Keyed on the Stripe session id so a refresh of this page (which the
    // user lands on mid-signup and may reload) doesn't double-count.
    trackLumiEventOnce(`subscribe_${sessionId}`, 'Subscribe');
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('resolve-checkout-partner', {
          body: { session_id: sessionId },
        });
        if (error) return;
        const code = (data as any)?.partner_code;
        if (code) {
          const { setPartnerWelcomeCode } = await import('@/components/PartnerWelcomeModal');
          setPartnerWelcomeCode(code);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect already-authenticated (non-anonymous) users away from auth page.
  // Anonymous users need to stay so they can upgrade to a permanent account.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !(session.user as any)?.is_anonymous) {
        if (inviteToken) {
          await acceptInvite(inviteToken);
        }
        navigate(safeReturnTo || "/studio", { replace: true });
      }
    });
  }, [navigate, safeReturnTo, inviteToken]);

  // Ensure public.profiles.email matches auth.users.email. The handle_new_user
  // trigger only fires on user creation, so anonymous→permanent upgrades leave
  // profiles.email null. Call this after any signUp/updateUser that sets email.
  const syncProfileEmail = async (userId: string, emailValue: string, fullNameValue?: string) => {
    try {
      const patch: Record<string, any> = { email: emailValue };
      if (fullNameValue && fullNameValue.trim()) patch.full_name = fullNameValue.trim();
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId);
      if (error) console.error("[auth] syncProfileEmail failed:", error);
    } catch (err) {
      console.error("[auth] syncProfileEmail threw:", err);
    }
  };

  const acceptInvite = async (token: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_team_invite', { p_token: token });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        toast.success(`You've joined ${result.brand_name} as ${result.role}!`);
      } else {
        toast.error(result?.error || 'Invalid invite link');
      }
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to accept invite');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        if (!canShowSignup) {
          toast.error("Please choose a plan to create your account.");
          navigate('/join');
          return;
        }
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
        
        toast.success("Welcome back!");
        if (inviteToken) await acceptInvite(inviteToken);
        navigate(safeReturnTo || "/studio");
      } else {
        // If the current session is anonymous (ad-first onboarding), upgrade
        // it in place with updateUser so the user keeps their brand row and
        // any generated ads instead of getting a brand new user_id.
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const isAnon = !!(currentSession?.user as any)?.is_anonymous;

        let userId: string | undefined;
        let hasSession = false;

        if (isAnon) {
          const { data, error } = await supabase.auth.updateUser({
            email,
            password,
            data: { full_name: fullName },
          });
          if (error) throw error;
          userId = data.user?.id;
          hasSession = !!userId;
        } else {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: `${window.location.origin}/welcome`,
            },
          });
          if (error) throw error;
          userId = data.user?.id;
          hasSession = !!data.session;
        }

        // handle_new_user only fires at user creation, so an anonymous→permanent
        // upgrade leaves profiles.email null. Sync it here so welcome emails,
        // Stripe, and email display all work post-signup.
        if (userId) {
          await syncProfileEmail(userId, email.toLowerCase().trim(), fullName);
        }

        // Sync to Flodesk + send welcome email (fire-and-forget)
        try {
          await Promise.allSettled([
            supabase.functions.invoke('sync-flodesk', {
              body: {
                email: email.toLowerCase().trim(),
                firstName: fullName.split(' ')[0] || '',
                lastName: fullName.split(' ').slice(1).join(' ') || '',
                segment: 'active'
              }
            }),
            supabase.functions.invoke('send-beta-welcome-email', {
              body: {
                email: email.toLowerCase().trim(),
                fullName: fullName.trim(),
              }
            }),
          ]);
        } catch (err) {
          console.error('Post-signup sync failed:', err);
        }

        if (userId && hasSession) {
          toast.success(isAnon ? "Account created! Your ad is saved." : "Account created! Welcome to Lumi.");
          // If the ad-first onboarding flow already assembled a b-roll ad from
          // stock footage, nudge them to swap in their own now that they have
          // an account to save it to.
          if (isAnon && safeReturnTo) {
            try {
              const brandIdFromReturn = new URLSearchParams(safeReturnTo.split("?")[1] || "").get("brand");
              const flagKey = brandIdFromReturn ? `lumi_onboarding_broll_ready_${brandIdFromReturn}` : null;
              if (flagKey && localStorage.getItem(flagKey)) {
                localStorage.removeItem(flagKey);
                seedDeferredTask({
                  title: "Swap in your own b-roll footage",
                  description: "Your first ad's b-roll video used stock footage to get you moving fast — head to Creative Studio to replace it with your own clips.",
                  link_to: "/creative-studio",
                  brand_id: brandIdFromReturn,
                });
              }
            } catch { /* localStorage unavailable — skip the nudge */ }
          }

          // If the user just paid at Stripe checkout, don't wait for the async
          // webhook — reconcile from Stripe now, then poll check-subscription
          // so they never land back in the app in "preview mode".
          if (hasPaid) {
            const stripeSessionId = searchParams.get('session_id') || undefined;
            try {
              await supabase.functions.invoke('reconcile-subscription', {
                body: stripeSessionId ? { session_id: stripeSessionId } : {},
              });
            } catch (err) {
              console.error('[auth] reconcile-subscription failed:', err);
            }
            // Short poll — check-subscription reads the row we just upserted.
            for (let i = 0; i < 5; i++) {
              const { data: subCheck } = await supabase.functions.invoke('check-subscription');
              if ((subCheck as any)?.subscribed) break;
              await new Promise(r => setTimeout(r, 1000));
            }
          }

          // Anonymous → paid upgrade: honor the returnTo they came in with
          // (e.g. /launch?brand=xyz) so they land back on the ad they built.
          navigate(safeReturnTo || "/welcome");
        } else if (userId) {
          toast.success("Account created! Please check your email to confirm.");
        }
      }
    } catch (error: any) {
      toast.error(mapAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your email address first");
      return;
    }
    
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      toast.error(mapAuthError(error));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-lumi-purple-1/10 px-4">
      <Card variant="gradient" className="w-full max-w-md shadow-elevated rounded-2xl">
        <CardHeader className="space-y-1 text-center">
          <img 
            src={lumiLogo}
            alt="Lumi" 
            className="h-14 mx-auto mb-2"
          />
          <CardDescription className="text-base">
            {isLogin
              ? "Welcome back! Let's keep building."
              : "Meta Ads, Simplified. Let's get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 mb-4"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const { lovable } = await import("@/integrations/lovable/index");
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (result.error) {
                  toast.error(result.error.message || "Google sign-in failed");
                  setLoading(false);
                  return;
                }
                if (result.redirected) return;
                navigate(safeReturnTo || "/studio", { replace: true });
              } catch (e: any) {
                toast.error(e?.message || "Google sign-in failed");
                setLoading(false);
              }
            }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  variant="glow"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required={!isLogin}
                  className="h-11"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                variant="glow"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                variant="glow"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-11"
              />
            </div>
            {isLogin && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label 
                  htmlFor="rememberMe" 
                  className="text-sm font-normal text-muted-foreground cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 text-base"
              variant="lumi"
              disabled={loading}
            >
              {loading ? (
                <>
                  <SparkleIcon size="xs" state="loading" className="mr-2" />
                  {isLogin ? "Signing in..." : "Setting things up..."}
                </>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Let's Go ✨"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            {isLogin ? (
              <button
                type="button"
                onClick={() => {
                  if (canShowSignup) {
                    setIsLogin(false);
                  } else {
                    navigate('/join');
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Don't have an account? Choose a plan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
