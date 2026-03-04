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
import lumiLogo from "@/assets/lumi-logo.png";

const REMEMBERED_EMAIL_KEY = "lumi_remembered_email";

export default function Auth() {
  // Check for signup query param to auto-switch to signup form
  const searchParams = new URLSearchParams(window.location.search);
  const startWithSignup = searchParams.get('signup') === 'true';
  const returnToParam = searchParams.get('returnTo');
  const safeReturnTo =
    returnToParam && returnToParam.startsWith('/') && !returnToParam.startsWith('//')
      ? returnToParam
      : null;
  
  const [isLogin, setIsLogin] = useState(!startWithSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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

  // Atomic invite code claim - prevents race conditions
  const claimInviteCode = async (code: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('claim_invite_code', { 
      code_input: code 
    });
    
    if (error) {
      console.error('Invite code claim error:', error);
      toast.error("Invalid or expired invite code");
      return false;
    }
    
    if (!data) {
      toast.error("Invalid, expired, or fully used invite code");
      return false;
    }
    
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Handle remember me preference
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
        
        toast.success("Welcome back!");
        navigate(safeReturnTo || "/start");
      } else {
        // Validate invite code first for signup
        if (!inviteCode.trim()) {
          toast.error("Please enter an invite code");
          setLoading(false);
          return;
        }

        // Atomically claim the invite code (validates + increments in one operation)
        const isValidCode = await claimInviteCode(inviteCode);
        if (!isValidCode) {
          setLoading(false);
          return;
        }

        // Check if this is a beta invite code
        const { data: codeData } = await supabase
          .from('invite_codes')
          .select('is_beta')
          .eq('code', inviteCode.toUpperCase().trim())
          .maybeSingle();
        const isBetaCode = codeData?.is_beta === true;

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
        
        // Sync to Flodesk + send welcome email + beta welcome if applicable (fire-and-forget)
        try {
          const postSignupTasks = [
            supabase.functions.invoke('sync-flodesk', {
              body: { 
                email: email.toLowerCase().trim(), 
                firstName: fullName.split(' ')[0] || '',
                lastName: fullName.split(' ').slice(1).join(' ') || '',
                segment: 'active' 
              }
            }),
            supabase.functions.invoke('send-welcome-email', {
              body: {
                email: email.toLowerCase().trim(),
                fullName: fullName.trim(),
              }
            }),
          ];

          // If beta code, also send beta welcome email
          if (isBetaCode) {
            postSignupTasks.push(
              supabase.functions.invoke('send-beta-welcome-email', {
                body: {
                  email: email.toLowerCase().trim(),
                  fullName: fullName.trim(),
                }
              })
            );
          }

          await Promise.allSettled(postSignupTasks);
        } catch (err) {
          console.error('Post-signup sync failed:', err);
        }
        
        // Mark profile as beta user if applicable
        if (isBetaCode && data.user) {
          supabase
            .from('profiles')
            .update({ is_beta_user: true } as any)
            .eq('id', data.user.id)
            .then(({ error: profileErr }) => {
              if (profileErr) console.error('Failed to mark beta user:', profileErr);
            });
        }

        // Check if user is immediately confirmed (auto-confirm is enabled)
        if (data.user && data.session) {
          toast.success("Account created! Let's choose your plan.");
          navigate("/pricing");
        } else if (data.user && !data.session) {
          toast.success("Account created! Please check your email to confirm.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
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
      toast.error(error.message || "Failed to send reset email");
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
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    variant="glow"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="LUMI-XXXXXX"
                    required={!isLogin}
                    className="h-11 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Don't have a code yet? <a href="/#waitlist" className="text-primary hover:underline font-medium">Get on the waitlist</a>
                  </p>
                </div>
              </>
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
