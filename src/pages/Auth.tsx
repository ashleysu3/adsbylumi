import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LumiCharacter } from "@/components/LumiCharacter";
import lumiLogo from "@/assets/lumi-logo.png";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const validateInviteCode = async (code: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("invite_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      toast.error("Invalid invite code");
      return false;
    }

    // Check if code is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error("This invite code has expired");
      return false;
    }

    // Check if code has reached max uses
    if (data.current_uses >= data.max_uses) {
      toast.error("This invite code has reached its maximum uses");
      return false;
    }

    return true;
  };

  const incrementInviteCodeUsage = async (code: string) => {
    const { data } = await supabase
      .from("invite_codes")
      .select("id, current_uses")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (data) {
      await supabase
        .from("invite_codes")
        .update({ current_uses: data.current_uses + 1 })
        .eq("id", data.id);
    }
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
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        // Validate invite code first for signup
        if (!inviteCode.trim()) {
          toast.error("Please enter an invite code");
          setLoading(false);
          return;
        }

        const isValidCode = await validateInviteCode(inviteCode);
        if (!isValidCode) {
          setLoading(false);
          return;
        }

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
        
        // Increment invite code usage on successful signup
        await incrementInviteCodeUsage(inviteCode);
        
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
                    Need a code? <a href="/" className="text-primary hover:underline">Join the waitlist</a>
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
            <Button
              type="submit"
              className="w-full h-11 text-base"
              variant="lumi"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LumiCharacter size="xs" state="loading" className="mr-2" />
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
