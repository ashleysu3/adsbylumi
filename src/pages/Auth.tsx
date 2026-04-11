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
import lumiLogo from "@/assets/lumi-logo.png";

const REMEMBERED_EMAIL_KEY = "lumi_remembered_email";

export default function Auth() {
  const searchParams = new URLSearchParams(window.location.search);
  const startWithSignup = searchParams.get('signup') === 'true';
  const returnToParam = searchParams.get('returnTo');
  const inviteToken = searchParams.get('invite');
  const safeReturnTo =
    returnToParam && returnToParam.startsWith('/') && !returnToParam.startsWith('//')
      ? returnToParam
      : null;
  
  const [isLogin, setIsLogin] = useState(!startWithSignup);
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

  // Redirect already-authenticated users away from auth page
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        if (inviteToken) {
          await acceptInvite(inviteToken);
        }
        navigate(safeReturnTo || "/start", { replace: true });
      }
    });
  }, [navigate, safeReturnTo, inviteToken]);

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
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
        
        toast.success("Welcome back!");
        if (inviteToken) await acceptInvite(inviteToken);
        navigate(safeReturnTo || "/start");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });
        if (error) throw error;
        
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

        if (data.user && data.session) {
          toast.success("Account created! Let's set up your brand.");
          navigate("/onboarding");
        } else if (data.user && !data.session) {
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
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
