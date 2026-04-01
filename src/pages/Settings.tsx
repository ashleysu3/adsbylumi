import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { toast } from 'sonner';
import { 
  User, Bell, CreditCard, LogOut, Loader2, ExternalLink, Crown,
  Sliders, Mail, AlertTriangle, TrendingDown, Eye, BookOpen, RotateCcw,
  Smile, X, Link2, CheckCircle2, XCircle
} from 'lucide-react';
import { CancelSubscriptionModal } from '@/components/CancelSubscriptionModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlossaryTooltip } from '@/components/GlossaryTooltip';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';
import EmojiQuickPicker from '@/components/EmojiQuickPicker';
import { CancellationPolicyBanner } from '@/components/CancellationPolicyBanner';
import { FlodeskIntegrationCard } from '@/components/FlodeskIntegrationCard';
import { KitIntegrationCard } from '@/components/KitIntegrationCard';

interface NotificationPrefs {
  report_frequency: 'off' | 'daily' | 'weekly';
  critical_alerts: boolean;
  performance_drops: boolean;
  last_report_sent_at?: string;
}

interface AlertThresholds {
  ctr_warning: number;
  ctr_critical: number;
  roas_warning: number;
  roas_critical: number;
  frequency_warning: number;
  frequency_critical: number;
}

function UpgradePlanSection() {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleUpgradeCheckout = async (priceId: string) => {
    try {
      setCheckoutLoading(priceId);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="space-y-2">
            <p className="font-semibold text-sm">Solo Monthly</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">${SUBSCRIPTION_TIERS.solo.monthlyPrice}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
            <Button
              variant="lumi"
              size="sm"
              className="w-full gap-2"
              disabled={checkoutLoading !== null}
              onClick={() => handleUpgradeCheckout(SUBSCRIPTION_TIERS.solo.monthlyPriceId)}
            >
              {checkoutLoading === SUBSCRIPTION_TIERS.solo.monthlyPriceId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              Upgrade Monthly
            </Button>
          </div>
        </Card>
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">Solo Annual</p>
              <Badge variant="secondary" className="text-xs">Save ~17%</Badge>
            </div>
            <p className="text-2xl font-bold">${SUBSCRIPTION_TIERS.solo.annualPrice}<span className="text-sm font-normal text-muted-foreground">/yr</span></p>
            <Button
              variant="lumi"
              size="sm"
              className="w-full gap-2"
              disabled={checkoutLoading !== null}
              onClick={() => handleUpgradeCheckout(SUBSCRIPTION_TIERS.solo.annualPriceId)}
            >
              {checkoutLoading === SUBSCRIPTION_TIERS.solo.annualPriceId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              Upgrade Annual
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { getEffectiveUserId } = useImpersonation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    report_frequency: 'weekly',
    critical_alerts: true,
    performance_drops: true,
  });
  
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>({
    ctr_warning: 0.8,
    ctr_critical: 0.5,
    roas_warning: 1.5,
    roas_critical: 1.0,
    frequency_warning: 4,
    frequency_critical: 6,
  });

  const [creativeAutomation, setCreativeAutomation] = useState({
    auto_rotate_enabled: false,
    auto_retest_enabled: false,
    fatigue_threshold: 4,
    retest_cooldown_days: 14,
    fatigue_action: 'notify_only' as 'auto_rotate' | 'notify_only',
  });

  // Copy Style state
  const DEFAULT_EMOJIS = ['✨', '🎯', '💡', '🚀', '💪', '⭐'];
  const BULLET_OPTIONS = ['✅', '→', '•', '✓', '▸', '★', '💫', '🔥'];
  const [copyPerspective, setCopyPerspective] = useState<'I' | 'We'>('I');
  const [useEmojis, setUseEmojis] = useState(true);
  const [brandEmojis, setBrandEmojis] = useState<string[]>(DEFAULT_EMOJIS);
  const [bulletEmoji, setBulletEmoji] = useState('✅');
  const [newEmoji, setNewEmoji] = useState('');
  const [savingCopyStyle, setSavingCopyStyle] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  
  const { isLoading: subLoading, isSubscribed, tier, isAnnual, subscriptionEnd, cancelAtPeriodEnd, refreshSubscription, isCodeBased, isTrial, status } = useSubscription();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Use effective user ID for impersonation support
      const effectiveUserId = await getEffectiveUserId();
      if (!effectiveUserId) return;

      const [profileRes, brandRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', effectiveUserId).single(),
        supabase.from('brands').select('*').eq('user_id', effectiveUserId).single(),
      ]);

      setProfile(profileRes.data);
      
      if (brandRes.data) {
        setBrand(brandRes.data);
        // Load copy style
        setCopyPerspective(brandRes.data.copy_perspective === 'We' ? 'We' : 'I');
        setUseEmojis(brandRes.data.use_emojis ?? true);
        setBrandEmojis(brandRes.data.brand_emojis || DEFAULT_EMOJIS);
        setBulletEmoji(brandRes.data.bullet_emoji || '✅');
        
        if (brandRes.data.notification_preferences) {
          const prefs = brandRes.data.notification_preferences as any;
          const reportFrequency = prefs.report_frequency || 
            (prefs.weekly_digest === false ? 'off' : 'weekly');
          setNotificationPrefs({
            report_frequency: reportFrequency,
            critical_alerts: prefs.critical_alerts ?? true,
            performance_drops: prefs.performance_drops ?? true,
            last_report_sent_at: prefs.last_report_sent_at,
          });
          if (prefs.creative_automation) {
            setCreativeAutomation(prev => ({ ...prev, ...prefs.creative_automation }));
          }
        }
        if (brandRes.data.alert_thresholds) {
          setAlertThresholds(brandRes.data.alert_thresholds as unknown as AlertThresholds);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update profile');
      console.error(error);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    if (!brand) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ notification_preferences: notificationPrefs as any })
        .eq('id', brand.id);

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAlertThresholds = async () => {
    if (!brand) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ alert_thresholds: alertThresholds as any })
        .eq('id', brand.id);

      if (error) throw error;
      toast.success('Alert thresholds saved');
    } catch (error) {
      console.error('Error saving thresholds:', error);
      toast.error('Failed to save thresholds');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCreativeAutomation = async () => {
    if (!brand) return;
    
    setSaving(true);
    try {
      const currentPrefs = (brand.notification_preferences as any) || {};
      const { error } = await supabase
        .from('brands')
        .update({ 
          notification_preferences: {
            ...currentPrefs,
            creative_automation: creativeAutomation,
          } as any 
        })
        .eq('id', brand.id);

      if (error) throw error;
      toast.success('Creative automation settings saved');
    } catch (error) {
      console.error('Error saving creative automation:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  const currentTier = tier ? SUBSCRIPTION_TIERS[tier] : null;
  const metaConnected = !!(brand?.meta_access_token && brand?.meta_account_id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <CancellationPolicyBanner />
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient-lumi">Settings</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="copystyle" className="gap-2">
              <Smile className="h-4 w-4" />
              Copy Style
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Sliders className="h-4 w-4" />
              Alert Thresholds
            </TabsTrigger>
            <TabsTrigger value="creative" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Creative Automation
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Link2 className="h-4 w-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your account profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={profile?.email || ''} disabled className="bg-muted" />
                    <p className="text-sm text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" name="fullName" type="text" variant="glow" defaultValue={profile?.full_name || ''} placeholder="Enter your full name" />
                  </div>
                  <Button type="submit" variant="lumi">Save Changes</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>Sign out of your account</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Copy Style Tab */}
          <TabsContent value="copystyle" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5" />
                  Copy Style
                </CardTitle>
                <CardDescription>Set your ad copy voice, emoji preferences, and bullet point style</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Copy Perspective Toggle */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Ad Copy Voice</Label>
                  <p className="text-sm text-muted-foreground">
                    Should your ads say "I" or "We"? Choose the voice that fits your brand.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCopyPerspective('I')}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        copyPerspective === 'I'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" />
                        <span className="font-semibold text-sm">Personal "I"</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        "I help entrepreneurs scale..."<br />
                        "My program teaches you..."
                      </p>
                    </button>
                    <button
                      onClick={() => setCopyPerspective('We')}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        copyPerspective === 'We'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" />
                        <span className="font-semibold text-sm">Team "We"</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        "We help entrepreneurs scale..."<br />
                        "Our program teaches you..."
                      </p>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Emoji Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Use Emojis in Copy</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable emojis in generated ad copy
                    </p>
                  </div>
                  <Switch
                    checked={useEmojis}
                    onCheckedChange={setUseEmojis}
                  />
                </div>

                {useEmojis && (
                  <>
                    {/* Brand Emojis */}
                    <div className="space-y-3">
                      <Label className="text-sm">Your Brand Emojis (up to 6)</Label>
                      <div className="flex flex-wrap gap-2">
                        {brandEmojis.map((emoji) => (
                          <div
                            key={emoji}
                            className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg border"
                          >
                            <span className="text-xl">{emoji}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-destructive/20"
                              onClick={() => setBrandEmojis(prev => prev.filter(e => e !== emoji))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      {brandEmojis.length < 6 && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <EmojiQuickPicker
                            onSelect={(emoji) => {
                              if (brandEmojis.length >= 6) {
                                toast.error('Maximum 6 emojis allowed');
                                return;
                              }
                              if (brandEmojis.includes(emoji)) {
                                toast.error('Emoji already added');
                                return;
                              }
                              setBrandEmojis(prev => [...prev, emoji]);
                            }}
                            selectedEmojis={brandEmojis}
                          />
                          <span className="text-xs text-muted-foreground">or</span>
                          <div className="flex gap-2">
                            <Input
                              value={newEmoji}
                              onChange={(e) => setNewEmoji(e.target.value)}
                              placeholder="Paste emoji..."
                              className="w-24"
                              maxLength={4}
                            />
                            <Button variant="ghost" size="sm" onClick={() => {
                              if (!newEmoji.trim()) return;
                              if (brandEmojis.length >= 6) { toast.error('Maximum 6 emojis allowed'); return; }
                              if (brandEmojis.includes(newEmoji.trim())) { toast.error('Emoji already added'); return; }
                              setBrandEmojis(prev => [...prev, newEmoji.trim()]);
                              setNewEmoji('');
                            }}>
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bullet Style */}
                    <div className="space-y-3">
                      <Label className="text-sm">Bullet Point Style</Label>
                      <div className="flex flex-wrap gap-2">
                        {BULLET_OPTIONS.map((bullet) => (
                          <Button
                            key={bullet}
                            variant={bulletEmoji === bullet ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBulletEmoji(bullet)}
                            className="text-lg w-10 h-10 p-0"
                          >
                            {bullet}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-4">
                  <Button
                    onClick={async () => {
                      if (!brand) return;
                      setSavingCopyStyle(true);
                      try {
                        const { error } = await supabase
                          .from('brands')
                          .update({
                            copy_perspective: copyPerspective,
                            use_emojis: useEmojis,
                            brand_emojis: brandEmojis,
                            bullet_emoji: bulletEmoji,
                          })
                          .eq('id', brand.id);
                        if (error) throw error;
                        toast.success('Copy style saved');
                      } catch (error: any) {
                        toast.error('Failed to save copy style');
                      } finally {
                        setSavingCopyStyle(false);
                      }
                    }}
                    disabled={savingCopyStyle}
                    variant="lumi"
                  >
                    {savingCopyStyle && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Copy Style
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>Choose what emails you receive from Lumi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Performance Report Frequency</Label>
                    <p className="text-sm text-muted-foreground">How often do you want Lumi to email you a performance summary?</p>
                  </div>
                  <Select
                    value={notificationPrefs.report_frequency}
                    onValueChange={(value: 'off' | 'daily' | 'weekly') => 
                      setNotificationPrefs(prev => ({ ...prev, report_frequency: value }))
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Critical Alerts</Label>
                    <p className="text-sm text-muted-foreground">Urgent notifications for budget depletion, expired tokens, etc.</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.critical_alerts}
                    onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, critical_alerts: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Performance Drop Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified when your CTR, ROAS, or other metrics decline significantly</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.performance_drops}
                    onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, performance_drops: checked }))}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button onClick={handleSaveNotificationPrefs} disabled={saving} variant="lumi">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Preferences
                  </Button>
                  <Button onClick={() => navigate('/settings/digest-preview')} variant="outline" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview Performance Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alert Thresholds Tab */}
          <TabsContent value="alerts" className="space-y-6">
            {/* Glossary link */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Not sure what these terms mean?
                </p>
                <Button variant="ghost" size="sm" onClick={() => navigate('/glossary')} className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  View Ads Glossary
                </Button>
              </CardContent>
            </Card>

            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <GlossaryTooltip term="ctr">CTR Thresholds</GlossaryTooltip>
                </CardTitle>
                <CardDescription>Set your minimum acceptable click-through rate percentages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Warning Level (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={alertThresholds.ctr_warning}
                      onChange={(e) => setAlertThresholds(prev => ({ ...prev, ctr_warning: parseFloat(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Alert when CTR falls below this</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Critical Level (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={alertThresholds.ctr_critical}
                      onChange={(e) => setAlertThresholds(prev => ({ ...prev, ctr_critical: parseFloat(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Urgent alert when CTR falls below this</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  <GlossaryTooltip term="roas">ROAS Thresholds</GlossaryTooltip>
                </CardTitle>
                <CardDescription>Set your minimum acceptable return on ad spend</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Warning Level (x)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={alertThresholds.roas_warning}
                      onChange={(e) => setAlertThresholds(prev => ({ ...prev, roas_warning: parseFloat(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Alert when ROAS falls below this</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Critical Level (x)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={alertThresholds.roas_critical}
                      onChange={(e) => setAlertThresholds(prev => ({ ...prev, roas_critical: parseFloat(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-muted-foreground">Urgent alert when ROAS falls below this</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="glow">
              <CardHeader>
                <CardTitle>
                  <GlossaryTooltip term="frequency">Ad Frequency Thresholds</GlossaryTooltip>
                </CardTitle>
                <CardDescription>Set when to alert about creative fatigue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Warning Level</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      value={alertThresholds.frequency_warning}
                      onChange={(e) => setAlertThresholds(prev => ({ ...prev, frequency_warning: parseFloat(e.target.value) || 1 }))}
                    />
                    <p className="text-xs text-muted-foreground">Alert when frequency exceeds this</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Critical Level</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      value={alertThresholds.frequency_critical}
                      onChange={(e) => setAlertThresholds(prev => ({ ...prev, frequency_critical: parseFloat(e.target.value) || 1 }))}
                    />
                    <p className="text-xs text-muted-foreground">Urgent alert when frequency exceeds this</p>
                  </div>
                </div>

                <Button onClick={handleSaveAlertThresholds} disabled={saving} variant="lumi" className="mt-4">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Thresholds
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Creative Automation Tab */}
          <TabsContent value="creative" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Creative Rotation
                </CardTitle>
                <CardDescription>
                  Control how Lumi manages your creative lifecycle — auto-swap fatigued ads and retest paused performers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Fatigue Action Preference */}
                <div className="space-y-3">
                  <Label className="text-base">When Fatigue is Detected</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose what happens when Lumi detects creative fatigue (high frequency + dropping CTR)
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="fatigue_action"
                        checked={creativeAutomation.fatigue_action === 'auto_rotate'}
                        onChange={() => setCreativeAutomation(prev => ({ ...prev, fatigue_action: 'auto_rotate', auto_rotate_enabled: true }))}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-sm">Auto-rotate from bench</p>
                        <p className="text-xs text-muted-foreground">
                          Lumi will automatically pause the fatigued ad and swap in approved bench creative
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="fatigue_action"
                        checked={creativeAutomation.fatigue_action === 'notify_only'}
                        onChange={() => setCreativeAutomation(prev => ({ ...prev, fatigue_action: 'notify_only', auto_rotate_enabled: false }))}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-sm">Just notify me</p>
                        <p className="text-xs text-muted-foreground">
                          You'll get an alert + a one-press button to swap bench creative when you're ready
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Fatigue Frequency Threshold</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="2"
                    max="10"
                    value={creativeAutomation.fatigue_threshold}
                    onChange={(e) => setCreativeAutomation(prev => ({ ...prev, fatigue_threshold: parseFloat(e.target.value) || 4 }))}
                  />
                  <p className="text-xs text-muted-foreground">Ads with frequency above this will be flagged as fatigued (default: 4)</p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-Retest Paused Ads</Label>
                    <p className="text-sm text-muted-foreground">
                      When the bench is empty, Lumi will re-enable previously paused ads that had good performance
                    </p>
                  </div>
                  <Switch
                    checked={creativeAutomation.auto_retest_enabled}
                    onCheckedChange={(checked) => setCreativeAutomation(prev => ({ ...prev, auto_retest_enabled: checked }))}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Retest Cooldown (days)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="7"
                    max="60"
                    value={creativeAutomation.retest_cooldown_days}
                    onChange={(e) => setCreativeAutomation(prev => ({ ...prev, retest_cooldown_days: parseInt(e.target.value) || 14 }))}
                  />
                  <p className="text-xs text-muted-foreground">Minimum days before a paused ad is eligible for retesting (default: 14)</p>
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveCreativeAutomation} disabled={saving} variant="lumi">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Automation Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            {subLoading ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading subscription details...</span>
                  </div>
                </CardContent>
              </Card>
            ) : isSubscribed && currentTier ? (
              <>
                <Card variant="gradient">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-primary animate-sparkle-pulse" />
                          <span className="text-gradient-lumi">{currentTier.name}</span> Plan
                        </CardTitle>
                        <CardDescription>
                          {isCodeBased ? 'Activated via invite code' : isAnnual ? 'Annual billing' : 'Monthly billing'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {isTrial && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                            Trial
                          </Badge>
                        )}
                        {isCodeBased && (
                          <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                            Invite Code
                          </Badge>
                        )}
                        <Badge className="bg-gradient-lumi text-white border-0">
                          {status === 'trial' ? 'Trial Active' : 'Active'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Billing Amount */}
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {isCodeBased ? 'Your Cost' : 'Current Price'}
                        </p>
                        <p className="text-2xl font-bold">
                          {isCodeBased ? (
                            <>$0<span className="text-sm font-normal text-muted-foreground">/month</span></>
                          ) : (
                            <>
                              ${isAnnual ? currentTier.annualPrice : currentTier.monthlyPrice}
                              <span className="text-sm font-normal text-muted-foreground">/{isAnnual ? 'year' : 'month'}</span>
                            </>
                          )}
                        </p>
                        {isCodeBased && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Complimentary via invite code
                          </p>
                        )}
                      </div>

                      {/* Next Billing / End Date */}
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {cancelAtPeriodEnd 
                            ? 'Access Ends' 
                            : isTrial 
                              ? 'Trial Ends' 
                              : isCodeBased 
                                ? 'Access Period'
                                : 'Next Billing Date'
                          }
                        </p>
                        <p className="text-lg font-medium">
                          {subscriptionEnd 
                            ? new Date(subscriptionEnd).toLocaleDateString() 
                            : isCodeBased 
                              ? 'Ongoing'
                              : '—'
                          }
                        </p>
                        {cancelAtPeriodEnd && <Badge variant="destructive" className="mt-1">Cancelling</Badge>}
                      </div>

                      {/* Payment Method Quick Link */}
                      {!isCodeBased && (
                        <div>
                          <p className="text-sm text-muted-foreground">Payment Method</p>
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-primary font-medium"
                            onClick={handleManageSubscription}
                            disabled={portalLoading}
                          >
                            {portalLoading ? 'Loading...' : 'Update Card →'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Plan Limits</p>
                      <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Brands</span>
                          <span>{currentTier.limits.brands}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ad Accounts</span>
                          <span>{currentTier.limits.adAccounts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ad Spend Cap</span>
                          <span>{currentTier.limits.adSpendCap === -1 ? 'Unlimited' : `$${currentTier.limits.adSpendCap.toLocaleString()}/mo`}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Only show billing management for Stripe subscriptions */}
                {!isCodeBased && (
                  <Card variant="glow">
                    <CardHeader>
                      <CardTitle>Billing & Payment</CardTitle>
                      <CardDescription>Manage your payment methods and billing information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button onClick={handleManageSubscription} disabled={portalLoading} variant="lumi" className="gap-2">
                          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          Update Payment Method
                        </Button>
                        <Button onClick={handleManageSubscription} disabled={portalLoading} variant="outline" className="gap-2">
                          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                          View Billing History
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Opens Stripe's secure billing portal where you can update payment methods, view invoices, and download receipts.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card variant="glow">
                  <CardHeader>
                    <CardTitle>Change Plan</CardTitle>
                    <CardDescription>
                      {isCodeBased 
                        ? 'Upgrade to a paid plan to lock in founders pricing' 
                        : 'Upgrade, downgrade, or switch billing frequency'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isCodeBased ? (
                      <UpgradePlanSection />
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={handleManageSubscription} disabled={portalLoading} variant="lumi" className="gap-2">
                          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                          Change Plan
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">
                      {isTrial ? 'Cancel Trial' : 'Cancel Subscription'}
                    </CardTitle>
                    <CardDescription>
                      {isTrial 
                        ? 'Cancel your trial before being billed'
                        : 'End your subscription at the end of the current billing period'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {cancelAtPeriodEnd ? (
                      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <p className="text-sm font-medium text-destructive mb-1">
                          {isTrial ? 'Trial is set to cancel' : 'Subscription is set to cancel'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Your {isTrial ? 'trial' : 'subscription'} will end on {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'the scheduled date'}. 
                          You'll retain access until then.
                        </p>
                        {!isCodeBased && (
                          <Button onClick={handleManageSubscription} disabled={portalLoading} variant="outline" size="sm" className="mt-3 gap-2">
                            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Reactivate Subscription
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {isCodeBased
                            ? isTrial
                              ? 'Cancel your trial to avoid being billed. Your access will end immediately upon cancellation.'
                              : 'Cancel your complimentary access. Your data will be preserved but you\'ll need to subscribe to regain access.'
                            : 'If you cancel, you\'ll retain access to your current plan until the end of your billing period. Your campaigns and data will be preserved.'}
                        </p>
                        <Button onClick={() => setCancelModalOpen(true)} disabled={saving} variant="destructive" className="gap-2">
                          <LogOut className="h-4 w-4" />
                          {isTrial ? 'Cancel Trial' : 'Cancel Subscription'}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                <CancelSubscriptionModal
                  open={cancelModalOpen}
                  onOpenChange={setCancelModalOpen}
                  subscriptionEnd={subscriptionEnd}
                  isCodeBased={isCodeBased}
                  isTrial={isTrial}
                  tierName={currentTier.name}
                  onCancelled={refreshSubscription}
                />
              </>
            ) : (
              <Card variant="glow">
                <CardHeader>
                  <CardTitle>No Active Subscription</CardTitle>
                  <CardDescription>Subscribe to unlock all features of Lumi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose a plan to get started with smart ad creation, psychology-driven copy, and automated campaign management.
                  </p>
                  <Button onClick={() => navigate('/auth')} variant="lumi" className="gap-2">
                    <Crown className="h-4 w-4" />
                    View Plans
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <FlodeskIntegrationCard brand={brand} onRefresh={fetchData} />
            <KitIntegrationCard brand={brand} onRefresh={fetchData} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
