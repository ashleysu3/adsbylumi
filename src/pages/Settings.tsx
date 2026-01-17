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
import { toast } from 'sonner';
import { 
  User, Bell, Shield, CreditCard, LogOut, Loader2, ExternalLink, Crown,
  Link2, Eye, Sliders, Mail, AlertTriangle, TrendingDown, Smile, X
} from 'lucide-react';
import EmojiQuickPicker from '@/components/EmojiQuickPicker';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';

interface NotificationPrefs {
  weekly_digest: boolean;
  critical_alerts: boolean;
  performance_drops: boolean;
}

interface AlertThresholds {
  ctr_warning: number;
  ctr_critical: number;
  roas_warning: number;
  roas_critical: number;
  frequency_warning: number;
  frequency_critical: number;
}

interface EmojiSettings {
  use_emojis: boolean;
  brand_emojis: string[];
  bullet_emoji: string;
}

const DEFAULT_EMOJIS = ['✨', '🎯', '💡', '🚀', '💪', '⭐'];
const BULLET_OPTIONS = ['✅', '→', '•', '✓', '▸', '★', '💫', '🔥'];

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    weekly_digest: true,
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
  
  const [emojiSettings, setEmojiSettings] = useState<EmojiSettings>({
    use_emojis: true,
    brand_emojis: DEFAULT_EMOJIS,
    bullet_emoji: '✅',
  });
  
  const [newEmoji, setNewEmoji] = useState('');
  
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

      const [profileRes, brandRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('brands').select('*').eq('user_id', user.id).single(),
      ]);

      setProfile(profileRes.data);
      
      if (brandRes.data) {
        setBrand(brandRes.data);
        if (brandRes.data.notification_preferences) {
          setNotificationPrefs(brandRes.data.notification_preferences as unknown as NotificationPrefs);
        }
        if (brandRes.data.alert_thresholds) {
          setAlertThresholds(brandRes.data.alert_thresholds as unknown as AlertThresholds);
        }
        // Load emoji settings
        setEmojiSettings({
          use_emojis: brandRes.data.use_emojis ?? true,
          brand_emojis: brandRes.data.brand_emojis ?? DEFAULT_EMOJIS,
          bullet_emoji: brandRes.data.bullet_emoji ?? '✅',
        });
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

  const handleSaveEmojiSettings = async () => {
    if (!brand) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({ 
          use_emojis: emojiSettings.use_emojis,
          brand_emojis: emojiSettings.brand_emojis,
          bullet_emoji: emojiSettings.bullet_emoji,
        })
        .eq('id', brand.id);

      if (error) throw error;
      toast.success('Emoji settings saved');
    } catch (error) {
      console.error('Error saving emoji settings:', error);
      toast.error('Failed to save emoji settings');
    } finally {
      setSaving(false);
    }
  };

  const addEmoji = () => {
    if (!newEmoji.trim()) return;
    if (emojiSettings.brand_emojis.length >= 6) {
      toast.error('Maximum 6 emojis allowed');
      return;
    }
    if (emojiSettings.brand_emojis.includes(newEmoji.trim())) {
      toast.error('Emoji already added');
      return;
    }
    setEmojiSettings(prev => ({
      ...prev,
      brand_emojis: [...prev.brand_emojis, newEmoji.trim()]
    }));
    setNewEmoji('');
  };

  const removeEmoji = (emoji: string) => {
    setEmojiSettings(prev => ({
      ...prev,
      brand_emojis: prev.brand_emojis.filter(e => e !== emoji)
    }));
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

  const handleCancelCodeSubscription = async () => {
    if (!confirm('Are you sure you want to cancel? This will end your access immediately.')) {
      return;
    }
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'cancelled',
          cancel_at_period_end: true 
        })
        .eq('user_id', user.id)
        .in('status', ['active', 'trial']);

      if (error) throw error;

      toast.success('Subscription cancelled');
      refreshSubscription();
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setSaving(false);
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
            <TabsTrigger value="brand-copy" className="gap-2">
              <Smile className="h-4 w-4" />
              Brand Copy
            </TabsTrigger>
            <TabsTrigger value="connections" className="gap-2">
              <Link2 className="h-4 w-4" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Sliders className="h-4 w-4" />
              Alert Thresholds
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
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
                <CardTitle>Danger Zone</CardTitle>
                <CardDescription>Irreversible actions for your account</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand Copy Settings Tab */}
          <TabsContent value="brand-copy" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5" />
                  Emoji Preferences
                </CardTitle>
                <CardDescription>
                  Control how emojis are used in your AI-generated ad copy. Meta recommends strategic emoji use for higher engagement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Use Emojis in Copy</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable emoji usage in generated headlines, descriptions, and primary copy
                    </p>
                  </div>
                  <Switch
                    checked={emojiSettings.use_emojis}
                    onCheckedChange={(checked) => setEmojiSettings(prev => ({ ...prev, use_emojis: checked }))}
                  />
                </div>
                
                {emojiSettings.use_emojis && (
                  <>
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-base">Your Brand Emojis</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose up to 6 emojis that represent your brand. These will be used in your ad copy.
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {emojiSettings.brand_emojis.map((emoji) => (
                          <div 
                            key={emoji}
                            className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg border"
                          >
                            <span className="text-xl">{emoji}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-destructive/20"
                              onClick={() => removeEmoji(emoji)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      {emojiSettings.brand_emojis.length < 6 && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <EmojiQuickPicker 
                            onSelect={(emoji) => {
                              if (emojiSettings.brand_emojis.length >= 6) {
                                toast.error('Maximum 6 emojis allowed');
                                return;
                              }
                              if (emojiSettings.brand_emojis.includes(emoji)) {
                                toast.error('Emoji already added');
                                return;
                              }
                              setEmojiSettings(prev => ({
                                ...prev,
                                brand_emojis: [...prev.brand_emojis, emoji]
                              }));
                            }}
                            selectedEmojis={emojiSettings.brand_emojis}
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
                            <Button variant="ghost" size="sm" onClick={addEmoji}>
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-base">Bullet Point Style</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose the emoji or symbol used for bullet points in your primary copy
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {BULLET_OPTIONS.map((bullet) => (
                          <Button
                            key={bullet}
                            variant={emojiSettings.bullet_emoji === bullet ? "default" : "outline"}
                            size="sm"
                            onClick={() => setEmojiSettings(prev => ({ ...prev, bullet_emoji: bullet }))}
                            className="text-lg w-10 h-10 p-0"
                          >
                            {bullet}
                          </Button>
                        ))}
                      </div>
                      
                      <div className="bg-muted/50 rounded-lg p-4 border">
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Preview</p>
                        <div className="space-y-1 text-sm">
                          <p>{emojiSettings.bullet_emoji} Stop wasting time on ads that don't convert</p>
                          <p>{emojiSettings.bullet_emoji} Get AI-powered creative that actually works</p>
                          <p>{emojiSettings.bullet_emoji} Launch campaigns in minutes, not days</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="pt-4">
                  <Button onClick={handleSaveEmojiSettings} disabled={saving} variant="lumi">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Emoji Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Meta Best Practices for Copy</CardTitle>
                <CardDescription>How Lumi formats your primary copy based on Meta's recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">✓ What Lumi Does</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Uses line breaks for readability</li>
                      <li>• Adds strategic emoji placement</li>
                      <li>• Creates scannable bullet lists</li>
                      <li>• Varies copy lengths (short/medium/long)</li>
                      <li>• Puts the hook first, CTA last</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">✗ What Lumi Avoids</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Emoji overload (max 2-3 per section)</li>
                      <li>• Wall-of-text paragraphs</li>
                      <li>• ALL CAPS abuse</li>
                      <li>• Clickbait or misleading claims</li>
                      <li>• Generic, non-specific language</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Meta (Facebook/Instagram)
                </CardTitle>
                <CardDescription>Connect your Meta ad account to manage campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${metaConnected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    <span className="text-sm">
                      {metaConnected ? `Connected (${brand?.meta_account_id})` : 'Not connected'}
                    </span>
                  </div>
                  <Button onClick={() => navigate('/settings/meta')} variant="outline" className="gap-2">
                    {metaConnected ? 'Manage' : 'Connect'}
                    <ExternalLink className="h-4 w-4" />
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
                    <Label className="text-base">Weekly Performance Digest</Label>
                    <p className="text-sm text-muted-foreground">Get a summary of your campaign performance every week</p>
                  </div>
                  <Switch
                    checked={notificationPrefs.weekly_digest}
                    onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, weekly_digest: checked }))}
                  />
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
                    Preview Weekly Digest
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alert Thresholds Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  CTR Thresholds
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
                  ROAS Thresholds
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
                <CardTitle>Ad Frequency Thresholds</CardTitle>
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
                          <span>{currentTier.limits.brands === -1 ? 'Unlimited' : currentTier.limits.brands}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ad Accounts</span>
                          <span>{currentTier.limits.adAccounts === -1 ? 'Unlimited' : currentTier.limits.adAccounts}</span>
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
                        ? 'Upgrade to a paid plan for additional features' 
                        : 'Upgrade, downgrade, or switch billing frequency'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => navigate('/pricing')} variant="lumi" className="gap-2">
                        <Crown className="h-4 w-4" />
                        View All Plans
                      </Button>
                      {!isCodeBased && (
                        <Button onClick={handleManageSubscription} disabled={portalLoading} variant="outline" className="gap-2">
                          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sliders className="h-4 w-4" />}
                          Change Plan in Portal
                        </Button>
                      )}
                    </div>
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
                    ) : isCodeBased ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {isTrial 
                            ? 'Cancel your trial to avoid being billed. Your access will end immediately upon cancellation.'
                            : 'Cancel your complimentary access. Your data will be preserved but you\'ll need to subscribe to regain access.'
                          }
                        </p>
                        <Button onClick={handleCancelCodeSubscription} disabled={saving} variant="destructive" className="gap-2">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                          {isTrial ? 'Cancel Trial' : 'Cancel Access'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          If you cancel, you'll retain access to your current plan until the end of your billing period. 
                          Your campaigns and data will be preserved.
                        </p>
                        <Button onClick={handleManageSubscription} disabled={portalLoading} variant="destructive" className="gap-2">
                          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                          Cancel Subscription
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card variant="glow">
                <CardHeader>
                  <CardTitle>No Active Subscription</CardTitle>
                  <CardDescription>Subscribe to unlock all features of Lumi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose a plan to get started with AI-powered ad creation, psychology-driven copy, and automated campaign management.
                  </p>
                  <Button onClick={() => navigate('/pricing')} variant="lumi" className="gap-2">
                    <Crown className="h-4 w-4" />
                    View Plans
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
