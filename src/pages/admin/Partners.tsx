import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, Copy, Pencil, Upload, X, Users, Link2, Gift, ExternalLink, Check, Mail, RotateCcw, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PerkItem { title: string; description: string }
interface LinkItem { label: string; url: string }
interface StrategyItem { title: string; description: string }
interface ResourceItem { title: string; description: string; url: string; type: string }
interface UpdateItem { id?: string; title: string; body: string; link_url: string; link_label: string; is_published: boolean }

interface Partner {
  id: string;
  email: string;
  partner_trial_code: string | null;
  partner_display_name: string | null;
  partner_title: string | null;
  partner_photo_url: string | null;
  welcome_message: string | null;
  perks: PerkItem[];
  support_links: LinkItem[];
  recommended_strategies: StrategyItem[];
  share_resources: ResourceItem[];
  is_active: boolean;
  trial_days: number;
  referral_link: string | null;
  partner_user_id: string | null;
  partner_email: string | null;
  membership_comped: boolean;
  partner_application_id: string | null;
  rewardful_affiliate_id: string | null;
  created_at: string;
}

interface PartnerApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  website?: string;
  audience_description?: string;
  promotion_plan?: string;
  how_will_you_share?: string;
  status: string;
  application_type: string;
  rewardful_affiliate_id?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

interface AffiliateRecord {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  state?: string;
  visitors_count?: number;
  leads_count?: number;
  conversions_count?: number;
  commissions_total_cents?: number;
  earnings_balance?: { amount_cents?: number };
  campaign?: { name?: string };
  links?: { token?: string; url?: string }[];
}

const blankForm = (): Partial<Partner> => ({
  email: "",
  partner_trial_code: "",
  partner_display_name: "",
  partner_title: "",
  partner_photo_url: "",
  welcome_message: "",
  perks: [],
  support_links: [],
  recommended_strategies: [],
  share_resources: [],
  is_active: true,
  trial_days: 14,
  referral_link: "",
  partner_user_id: null,
  partner_email: "",
  membership_comped: false,
  partner_application_id: null,
  rewardful_affiliate_id: null,
});


export default function AdminPartners() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateRecord[]>([]);
  const [editing, setEditing] = useState<Partial<Partner> | null>(null);
  const [editingTab, setEditingTab] = useState<string>("overview");
  const [uploading, setUploading] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [appActionLoading, setAppActionLoading] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [syncingPromo, setSyncingPromo] = useState(false);

  // Global config
  const [config, setConfig] = useState<{ owner_email: string; owner_calendar_url: string; office_hours_url: string; webinar_request_to: string }>({
    owner_email: "", owner_calendar_url: "", office_hours_url: "", webinar_request_to: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Updates manager
  const [updates, setUpdates] = useState<any[]>([]);
  const [editingUpdate, setEditingUpdate] = useState<UpdateItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const [partnersRes, configRes, updatesRes, affRes] = await Promise.all([
        supabase.from("partner_access_tokens").select("*").order("created_at", { ascending: false }),
        supabase.from("site_settings").select("value").eq("key", "partner_portal_config").maybeSingle(),
        supabase.from("partner_updates" as any).select("*").order("published_at", { ascending: false }),
        supabase.functions.invoke('admin-get-affiliates', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        }).catch((e) => { console.error('affiliates load failed', e); return { data: null, error: e }; }),
      ]);
      if (partnersRes.error) throw partnersRes.error;
      setPartners((partnersRes.data || []) as unknown as Partner[]);
      if (configRes.data?.value) setConfig({ ...config, ...(configRes.data.value as any) });
      setUpdates(updatesRes.data || []);
      const affData: any = (affRes as any)?.data || {};
      setApplications((affData.applications || []).filter((a: PartnerApplication) => a.application_type === 'partner'));
      setAffiliates(affData.affiliates || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lookup helpers
  const partnersByAppId = useMemo(() => {
    const map = new Map<string, Partner>();
    partners.forEach((p) => { if (p.partner_application_id) map.set(p.partner_application_id, p); });
    return map;
  }, [partners]);

  const partnersByEmail = useMemo(() => {
    const map = new Map<string, Partner>();
    partners.forEach((p) => {
      const e = (p.partner_email || p.email || '').toLowerCase();
      if (e) map.set(e, p);
    });
    return map;
  }, [partners]);

  const affiliateForPartner = useCallback((p: Partial<Partner> | null): AffiliateRecord | null => {
    if (!p) return null;
    if (p.rewardful_affiliate_id) {
      const byId = affiliates.find((a) => a.id === p.rewardful_affiliate_id);
      if (byId) return byId;
    }
    const email = (p.partner_email || p.email || '').toLowerCase();
    if (email) return affiliates.find((a) => (a.email || '').toLowerCase() === email) || null;
    return null;
  }, [affiliates]);

  const applicationForPartner = useCallback((p: Partial<Partner> | null): PartnerApplication | null => {
    if (!p) return null;
    if (p.partner_application_id) {
      return applications.find((a) => a.id === p.partner_application_id) || null;
    }
    const email = (p.partner_email || p.email || '').toLowerCase();
    if (email) return applications.find((a) => a.email.toLowerCase() === email) || null;
    return null;
  }, [applications]);

  // Open from an application (creates a pre-filled new-partner dialog if no linked row yet)
  const openFromApplication = useCallback((app: PartnerApplication) => {
    const existing = partnersByAppId.get(app.id) || partnersByEmail.get(app.email.toLowerCase());
    if (existing) {
      setEditing(existing);
      setEditingTab("application");
      return;
    }
    const baseCode = (app.first_name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) + '14';
    setEditing({
      ...blankForm(),
      partner_display_name: `${app.first_name} ${app.last_name}`.trim(),
      partner_trial_code: baseCode,
      partner_email: app.email,
      email: app.email,
      partner_application_id: app.id,
      rewardful_affiliate_id: app.rewardful_affiliate_id || null,
    });
    setEditingTab("application");
  }, [partnersByAppId, partnersByEmail]);

  // Deep-link: ?app=APP_ID auto-opens the dialog once data is loaded
  useEffect(() => {
    const appId = searchParams.get('app');
    if (!appId || loading || editing) return;
    const app = applications.find((a) => a.id === appId);
    if (app) {
      openFromApplication(app);
      // clear param so we don't re-open
      const next = new URLSearchParams(searchParams);
      next.delete('app');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, applications, loading, editing, openFromApplication, setSearchParams]);


  const handleSave = async () => {
    if (!editing) return;
    const code = (editing.partner_trial_code || "").toUpperCase().trim();
    if (!code) return toast.error("Trial code is required");
    if (!editing.partner_display_name) return toast.error("Partner name is required");

    setSaving(true);
    try {
      const payload: any = {
        email: editing.email || `${code.toLowerCase()}@partner.local`,
        partner_trial_code: code,
        partner_display_name: editing.partner_display_name,
        partner_title: editing.partner_title || null,
        partner_photo_url: editing.partner_photo_url || null,
        welcome_message: editing.welcome_message || null,
        perks: editing.perks || [],
        support_links: editing.support_links || [],
        recommended_strategies: editing.recommended_strategies || [],
        share_resources: editing.share_resources || [],
        is_active: editing.is_active ?? true,
        trial_days: editing.trial_days ?? 14,
        referral_link: editing.referral_link || null,
        partner_email: editing.partner_email || null,
        membership_comped: editing.membership_comped ?? false,
        partner_application_id: editing.partner_application_id || null,
        rewardful_affiliate_id: editing.rewardful_affiliate_id || null,
      };
      if (editing.id) {
        const { error } = await supabase.from("partner_access_tokens").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Partner updated");
      } else {
        const { error } = await supabase.from("partner_access_tokens").insert(payload);
        if (error) throw error;
        toast.success("Partner created");
      }
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!editing?.id || !linkEmail.trim()) return toast.error("Save partner first, then link an account");
    setLinking(true);
    try {
      const { data, error } = await supabase.rpc("admin_link_partner_user" as any, { p_partner_id: editing.id, p_email: linkEmail.trim() });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) throw new Error(res?.error || "Could not link");
      toast.success("Account linked");
      setEditing({ ...editing, partner_user_id: res.partner_user_id, partner_email: linkEmail.trim() });
      setLinkEmail("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!editing?.id) return;
    try {
      const { error } = await supabase.from("partner_access_tokens").update({ partner_user_id: null, partner_email: null, membership_comped: false }).eq("id", editing.id);
      if (error) throw error;
      setEditing({ ...editing, partner_user_id: null, partner_email: null, membership_comped: false });
      toast.success("Unlinked");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("partner_access_tokens").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleActive = async (p: Partner) => {
    try {
      const { error } = await supabase.from("partner_access_tokens").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) throw error;
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // Approve from inside the unified dialog: runs the same flow as the Affiliates page
  const handleApproveApplication = async () => {
    if (!editing) return;
    const app = applicationForPartner(editing);
    if (!app) return toast.error("No application linked");
    setAppActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-affiliate', {
        body: { email: app.email, firstName: app.first_name, lastName: app.last_name, campaignId: 'partner' }
      });
      if (error) throw error;
      const referralLink = (data as any)?.referralLink || '';
      const referralCode = (data as any)?.referralCode || '';
      const affiliateId = (data as any)?.id || null;

      // Ensure unique trial code (use the one in the form, fall back to generated)
      let trialCode = (editing.partner_trial_code || '').toUpperCase().trim();
      if (!trialCode) {
        const base = (app.first_name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) + '14';
        const { data: existing } = await supabase.from('partner_access_tokens').select('partner_trial_code').ilike('partner_trial_code', `${base}%`);
        trialCode = existing && existing.length > 0 ? `${base}${existing.length}` : base;
      }

      // Save / upsert the partner record
      const payload: any = {
        email: editing.email || app.email,
        partner_trial_code: trialCode,
        partner_display_name: editing.partner_display_name || `${app.first_name} ${app.last_name}`.trim(),
        partner_title: editing.partner_title || null,
        partner_photo_url: editing.partner_photo_url || null,
        welcome_message: editing.welcome_message || null,
        perks: editing.perks || [],
        support_links: editing.support_links || [],
        recommended_strategies: editing.recommended_strategies || [],
        share_resources: editing.share_resources || [],
        is_active: true,
        trial_days: editing.trial_days ?? 14,
        referral_link: referralLink || editing.referral_link || null,
        partner_email: app.email,
        membership_comped: editing.membership_comped ?? false,
        partner_application_id: app.id,
        rewardful_affiliate_id: affiliateId,
      };
      let savedId = editing.id;
      if (savedId) {
        const { error: upErr } = await supabase.from('partner_access_tokens').update(payload).eq('id', savedId);
        if (upErr) throw upErr;
      } else {
        const { data: inserted, error: insErr } = await supabase.from('partner_access_tokens').insert(payload).select('id').single();
        if (insErr) throw insErr;
        savedId = inserted.id;
      }

      // Mark application approved
      const { error: appErr } = await supabase.from('partner_applications').update({
        status: 'approved',
        rewardful_affiliate_id: affiliateId,
        updated_at: new Date().toISOString(),
      }).eq('id', app.id);
      if (appErr) throw appErr;

      // Send welcome email
      const { error: emailErr } = await supabase.functions.invoke('send-partner-approval', {
        body: {
          email: app.email,
          firstName: app.first_name,
          lastName: app.last_name,
          referralLink,
          referralCode,
          rewardfulAffiliateId: affiliateId,
          customMessage: approvalMessage || undefined,
          partnerTrialCode: trialCode,
        }
      });
      if (emailErr) console.error('approval email failed', emailErr);

      toast.success("Approved, partner created, welcome email sent 🎉");
      setApprovalMessage("");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error("Failed to approve: " + (e.message || 'Unknown error'));
    } finally {
      setAppActionLoading(false);
    }
  };

  const handleDeclineApplication = async () => {
    const app = applicationForPartner(editing);
    if (!app) return;
    setAppActionLoading(true);
    try {
      const { error } = await supabase.from('partner_applications').update({
        status: 'declined', updated_at: new Date().toISOString(),
      }).eq('id', app.id);
      if (error) throw error;
      toast.success("Application declined");
      setConfirmDecline(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAppActionLoading(false);
    }
  };

  const handleReconsiderApplication = async () => {
    const app = applicationForPartner(editing);
    if (!app) return;
    setAppActionLoading(true);
    try {
      const { error } = await supabase.from('partner_applications').update({
        status: 'pending', updated_at: new Date().toISOString(),
      }).eq('id', app.id);
      if (error) throw error;
      toast.success("Status reset to pending");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAppActionLoading(false);
    }
  };

  const handleApplicationNoteSave = async (notes: string) => {
    const app = applicationForPartner(editing);
    if (!app) return;
    await supabase.from('partner_applications').update({
      notes, updated_at: new Date().toISOString(),
    }).eq('id', app.id);
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path);
      setEditing((e) => e ? { ...e, partner_photo_url: data.publicUrl } : e);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://adsbylumi.com/?code=${code}`);
    toast.success("Referral link copied");
  };

  const syncStripePromo = async () => {
    if (!editing?.id) { toast.error("Save the partner first"); return; }
    if (!editing.partner_trial_code) { toast.error("Set a trial code first"); return; }
    setSyncingPromo(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-partner-promo", {
        body: { partner_id: editing.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Synced "${(data as any).code}" as Stripe promo code`);
      setEditing({
        ...editing,
        ...({
          stripe_coupon_id: (data as any).stripe_coupon_id,
          stripe_promotion_code_id: (data as any).stripe_promotion_code_id,
          stripe_promo_synced_at: new Date().toISOString(),
        } as any),
      });
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to sync Stripe promo");
    } finally {
      setSyncingPromo(false);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const { error } = await supabase.from("site_settings").upsert({ key: "partner_portal_config", value: config as any }, { onConflict: "key" });
      if (error) throw error;
      toast.success("Portal settings saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingConfig(false); }
  };

  const saveUpdate = async () => {
    if (!editingUpdate) return;
    try {
      const payload: any = {
        title: editingUpdate.title,
        body: editingUpdate.body || null,
        link_url: editingUpdate.link_url || null,
        link_label: editingUpdate.link_label || null,
        is_published: editingUpdate.is_published,
      };
      if (editingUpdate.id) {
        const { error } = await supabase.from("partner_updates" as any).update(payload).eq("id", editingUpdate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partner_updates" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Saved");
      setEditingUpdate(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteUpdate = async (id: string) => {
    if (!confirm("Delete this update?")) return;
    try {
      const { error } = await supabase.from("partner_updates" as any).delete().eq("id", id);
      if (error) throw error;
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <AdminTabs />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Partners</h1>
            <p className="text-muted-foreground text-sm">Configure custom welcome packages for affiliates and partners.</p>
          </div>
          <Button onClick={() => setEditing(blankForm())}>
            <Plus className="h-4 w-4 mr-2" /> New Partner
          </Button>
        </div>

        {/* Global portal config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Partner Portal global settings</CardTitle>
            <CardDescription>These power the support buttons inside every partner's portal.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <div><Label>Your direct email</Label><Input value={config.owner_email} onChange={(e) => setConfig({ ...config, owner_email: e.target.value })} placeholder="andrew@adsbylumi.com" /></div>
            <div><Label>Webinar requests sent to</Label><Input value={config.webinar_request_to} onChange={(e) => setConfig({ ...config, webinar_request_to: e.target.value })} placeholder="Defaults to direct email" /></div>
            <div><Label>Book-a-call URL</Label><Input value={config.owner_calendar_url} onChange={(e) => setConfig({ ...config, owner_calendar_url: e.target.value })} placeholder="https://cal.com/..." /></div>
            <div><Label>Office hours URL (optional)</Label><Input value={config.office_hours_url} onChange={(e) => setConfig({ ...config, office_hours_url: e.target.value })} placeholder="https://meet.google.com/..." /></div>
            <div className="sm:col-span-2"><Button onClick={saveConfig} disabled={savingConfig}>{savingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save portal settings</Button></div>
          </CardContent>
        </Card>

        {/* Updates manager */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">"What's new in Lumi" updates</CardTitle>
              <CardDescription>Shown to all partners in their portal.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setEditingUpdate({ title: "", body: "", link_url: "", link_label: "", is_published: true })}>
              <Plus className="h-4 w-4 mr-1" /> Add update
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {updates.length === 0 && <p className="text-sm text-muted-foreground">No updates yet.</p>}
            {updates.map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-2 p-3 rounded border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.title}</span>
                    {!u.is_published && <Badge variant="outline">Draft</Badge>}
                  </div>
                  {u.body && <p className="text-xs text-muted-foreground line-clamp-2">{u.body}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditingUpdate(u)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteUpdate(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Partner Applications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Partner Applications
              {applications.filter((a) => a.status === 'pending').length > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-0">
                  {applications.filter((a) => a.status === 'pending').length} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Open an application to review, approve, and turn it into a managed partner — all in one place.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {applications.length === 0 && <p className="text-sm text-muted-foreground">No partner applications yet.</p>}
            {applications.map((app) => {
              const linkedPartner = partnersByAppId.get(app.id) || partnersByEmail.get(app.email.toLowerCase());
              return (
                <div key={app.id} className="flex items-start justify-between gap-3 p-3 rounded border hover:bg-muted/40 cursor-pointer" onClick={() => openFromApplication(app)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{app.first_name} {app.last_name}</span>
                      <Badge variant="outline" className="capitalize text-xs">{app.status}</Badge>
                      {linkedPartner && <Badge variant="outline" className="text-xs"><Link2 className="h-3 w-3 mr-1" />Has partner</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{app.email}</p>
                    {app.audience_description && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{app.audience_description}</p>}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-4">
            {partners.map((p) => {
              const aff = affiliateForPartner(p);
              const linkedApp = applicationForPartner(p);
              return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  {p.partner_photo_url ? (
                    <img src={p.partner_photo_url} alt={p.partner_display_name || ""} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                      {(p.partner_display_name || "?")[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{p.partner_display_name || "Unnamed"}</h3>
                      <Badge variant="outline">{p.partner_trial_code}</Badge>
                      <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                      {p.membership_comped && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><Gift className="h-3 w-3 mr-1" />Comped</Badge>}
                      {p.partner_user_id && <Badge variant="outline"><Link2 className="h-3 w-3 mr-1" />Linked</Badge>}
                      {linkedApp && <Badge variant="outline" className="text-xs capitalize">App: {linkedApp.status}</Badge>}
                    </div>
                    {p.partner_title && <p className="text-sm text-muted-foreground">{p.partner_title}</p>}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>{(p.perks || []).length} perks</span>
                      <span>{(p.support_links || []).length} support links</span>
                      <span>{(p.recommended_strategies || []).length} strategies</span>
                      <span>{(p.share_resources || []).length} resources</span>
                      {aff && <span className="text-foreground">· {aff.conversions_count ?? 0} conv · ${(((aff.earnings_balance?.amount_cents ?? aff.commissions_total_cents) || 0) / 100).toFixed(0)} earned</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                    <Button size="sm" variant="ghost" onClick={() => p.partner_trial_code && copyLink(p.partner_trial_code)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setEditingTab("overview"); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            {partners.length === 0 && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No partners yet. Click "New Partner" to add one.</CardContent></Card>
            )}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit Partner" : "New Partner"}</DialogTitle>
              <DialogDescription>Anyone who signs up with this code gets the custom welcome experience below.</DialogDescription>
            </DialogHeader>
            {editing && (() => {
              const linkedApp = applicationForPartner(editing);
              const linkedAff = affiliateForPartner(editing);
              return (
              <Tabs value={editingTab} onValueChange={setEditingTab} className="py-2">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1 text-xs">Portal</TabsTrigger>
                  <TabsTrigger value="application" className="flex-1 text-xs" disabled={!linkedApp}>
                    Application {linkedApp && <Badge variant="outline" className="ml-1 text-[10px] capitalize">{linkedApp.status}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="affiliate" className="flex-1 text-xs" disabled={!linkedAff}>Affiliate</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Partner name *</Label>
                    <Input value={editing.partner_display_name || ""} onChange={(e) => setEditing({ ...editing, partner_display_name: e.target.value })} placeholder="Ashley Ebert" />
                  </div>
                  <div>
                    <Label>Trial code *</Label>
                    <Input value={editing.partner_trial_code || ""} onChange={(e) => setEditing({ ...editing, partner_trial_code: e.target.value.toUpperCase() })} placeholder="ASHLEY" />
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p className="text-xs text-muted-foreground">
                        {(editing as any).stripe_promotion_code_id
                          ? `Synced as Stripe promo code · ${(editing as any).stripe_promo_synced_at ? new Date((editing as any).stripe_promo_synced_at).toLocaleDateString() : ""}`
                          : "Not yet synced as a Stripe promo code."}
                      </p>
                      <Button type="button" size="sm" variant="outline" disabled={!editing.id || syncingPromo} onClick={() => syncStripePromo()}>
                        {syncingPromo ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        {(editing as any).stripe_promotion_code_id ? "Re-sync Stripe promo" : "Sync to Stripe"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Title / subtitle</Label>
                  <Input value={editing.partner_title || ""} onChange={(e) => setEditing({ ...editing, partner_title: e.target.value })} placeholder="Wedding Industry Strategist" />
                </div>
                <div>
                  <Label>Partner photo</Label>
                  <div className="flex items-center gap-3 mt-1">
                    {editing.partner_photo_url && (
                      <img src={editing.partner_photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                    )}
                    <label className="inline-flex">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                      <Button type="button" variant="outline" disabled={uploading} asChild>
                        <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}Upload</span>
                      </Button>
                    </label>
                    {editing.partner_photo_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ ...editing, partner_photo_url: "" })}>Remove</Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Custom welcome message</Label>
                  <Textarea rows={4} value={editing.welcome_message || ""} onChange={(e) => setEditing({ ...editing, welcome_message: e.target.value })} placeholder="Personal note from the partner to new signups..." />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div>
                    <Label>Free trial length</Label>
                    <div className="flex gap-2 mt-1">
                      {[7, 14, 30].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant={(editing.trial_days ?? 14) === d ? "default" : "outline"}
                          onClick={() => setEditing({ ...editing, trial_days: d })}
                        >
                          {d} days
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Partner referral link</Label>
                    {(() => {
                      const aff = affiliateForPartner(editing);
                      const autoLink = aff?.links?.[0]?.url || "";
                      const usingAuto = !editing.referral_link && !!autoLink;
                      return (
                        <>
                          <Input
                            value={editing.referral_link || autoLink}
                            onChange={(e) => setEditing({ ...editing, referral_link: e.target.value })}
                            placeholder="https://adsbylumi.com/?via=ashley"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {usingAuto
                              ? `Auto-filled from Rewardful${editing.partner_trial_code ? ` and linked to trial code ${editing.partner_trial_code}` : ""}. Edit to override.`
                              : autoLink
                                ? "Manual override active. Clear to use the Rewardful link."
                                : "Signups with this code give the partner referral credit."}
                          </p>
                          {usingAuto && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => setEditing({ ...editing, referral_link: autoLink })}
                            >
                              Save Rewardful link to partner
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Partner account + comp toggle */}
                <div className="border-t pt-3 space-y-3">
                  <div>
                    <Label>Partner Lumi account</Label>
                    <p className="text-xs text-muted-foreground mb-2">Link this partner to a Lumi user so they see the Partner Portal banner and (optionally) get a comped membership.</p>
                    {editing.partner_user_id ? (
                      <div className="flex items-center justify-between rounded border p-2">
                        <div className="text-sm">
                          <Link2 className="h-3 w-3 inline mr-1" />
                          {editing.partner_email || editing.partner_user_id}
                        </div>
                        <Button size="sm" variant="ghost" onClick={handleUnlink}>Unlink</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="partner@email.com" type="email" />
                        <Button onClick={handleLinkAccount} disabled={linking || !editing.id}>
                          {linking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Link
                        </Button>
                      </div>
                    )}
                    {!editing.id && <p className="text-xs text-amber-600 mt-1">Save the partner first to link an account.</p>}
                  </div>

                  <div className="flex items-center justify-between rounded border p-3 bg-emerald-500/5">
                    <div>
                      <Label className="flex items-center gap-2"><Gift className="h-4 w-4" /> Comp their Lumi membership</Label>
                      <p className="text-xs text-muted-foreground">Grants Agency-tier access for free. Requires linked account.</p>
                    </div>
                    <Switch
                      checked={editing.membership_comped ?? false}
                      disabled={!editing.partner_user_id}
                      onCheckedChange={(v) => setEditing({ ...editing, membership_comped: v })}
                    />
                  </div>
                </div>

                <RepeaterField
                  label="Bonus perks"
                  items={(editing.perks || []) as any}
                  onChange={(perks) => setEditing({ ...editing, perks: perks as any })}
                  fields={[{ key: "title", placeholder: "Perk title" }, { key: "description", placeholder: "Description" }]}
                />

                <RepeaterField
                  label="Support links (calls, office hours, etc.)"
                  items={(editing.support_links || []) as any}
                  onChange={(support_links) => setEditing({ ...editing, support_links: support_links as any })}
                  fields={[{ key: "label", placeholder: "Button label" }, { key: "url", placeholder: "https://..." }]}
                />

                <RepeaterField
                  label="Recommended strategies"
                  items={(editing.recommended_strategies || []) as any}
                  onChange={(recommended_strategies) => setEditing({ ...editing, recommended_strategies: recommended_strategies as any })}
                  fields={[{ key: "title", placeholder: "Strategy name" }, { key: "description", placeholder: "Why it's great for their audience" }]}
                />

                <RepeaterField
                  label="Share resources (shown in their Partner Portal)"
                  items={(editing.share_resources || []) as any}
                  onChange={(share_resources) => setEditing({ ...editing, share_resources: share_resources as any })}
                  fields={[
                    { key: "title", placeholder: "Resource title (e.g. Swipe copy)" },
                    { key: "description", placeholder: "Short description" },
                    { key: "url", placeholder: "https://..." },
                    { key: "type", placeholder: "Type (copy, graphic, video, email)" },
                  ]}
                />

                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">When off, the code stops working for new signups.</p>
                  </div>
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                </div>
                </TabsContent>

                {/* APPLICATION TAB */}
                {linkedApp && (
                  <TabsContent value="application" className="space-y-4 pt-3">
                    <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{linkedApp.first_name} {linkedApp.last_name}</p>
                          <p className="text-xs text-muted-foreground">{linkedApp.email}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">{linkedApp.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Applied {new Date(linkedApp.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                      {linkedApp.website && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Website: </span>
                          <a href={linkedApp.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {linkedApp.website} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Audience description</Label>
                        <p className="text-sm whitespace-pre-wrap mt-1">{linkedApp.audience_description || "Not provided"}</p>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">How they'll share / promotion plan</Label>
                        <p className="text-sm whitespace-pre-wrap mt-1">{linkedApp.promotion_plan || linkedApp.how_will_you_share || "Not provided"}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Admin notes</Label>
                      <Textarea
                        defaultValue={linkedApp.notes || ""}
                        placeholder="Internal notes about this application..."
                        className="min-h-[80px]"
                        onBlur={(e) => { if (e.target.value !== (linkedApp.notes || "")) handleApplicationNoteSave(e.target.value); }}
                      />
                    </div>

                    {linkedApp.status === "pending" && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Custom welcome message (optional)</Label>
                          <Textarea
                            value={approvalMessage}
                            onChange={(e) => setApprovalMessage(e.target.value)}
                            placeholder="Personal note included in their approval email..."
                            className="min-h-[80px]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={appActionLoading} onClick={handleApproveApplication}>
                            {appActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Approve & Send Welcome Email
                          </Button>
                          <Button variant="destructive" disabled={appActionLoading} onClick={() => setConfirmDecline(true)}>
                            <X className="h-4 w-4 mr-2" /> Decline
                          </Button>
                        </div>
                      </>
                    )}

                    {linkedApp.status === "declined" && (
                      <Button variant="outline" disabled={appActionLoading} onClick={handleReconsiderApplication}>
                        {appActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                        Reconsider Application
                      </Button>
                    )}

                    {linkedApp.status === "approved" && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                        ✅ Approved {linkedApp.updated_at ? `on ${new Date(linkedApp.updated_at).toLocaleDateString()}` : ''}.
                      </div>
                    )}
                  </TabsContent>
                )}

                {/* AFFILIATE TAB */}
                {linkedAff && (
                  <TabsContent value="affiliate" className="space-y-4 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Leads</p><p className="text-xl font-semibold">{linkedAff.leads_count ?? linkedAff.visitors_count ?? 0}</p></div>
                      <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Conversions</p><p className="text-xl font-semibold">{linkedAff.conversions_count ?? 0}</p></div>
                      <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Earned</p><p className="text-xl font-semibold">${(((linkedAff.earnings_balance?.amount_cents ?? linkedAff.commissions_total_cents) || 0) / 100).toFixed(2)}</p></div>
                      <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Status</p><Badge className="capitalize">{linkedAff.state || 'active'}</Badge></div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Referral code</Label>
                      <p className="text-sm font-mono">{linkedAff.links?.[0]?.token || '—'}</p>
                    </div>
                    {linkedAff.links?.[0]?.url && (
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Referral link</Label>
                        <div className="flex gap-2">
                          <Input readOnly value={linkedAff.links[0].url} className="font-mono text-xs" />
                          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(linkedAff.links![0].url!); toast.success("Copied"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      Open in Rewardful <ExternalLink className="h-3 w-3" />
                    </a>
                  </TabsContent>
                )}
              </Tabs>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Partner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update editor */}
        <Dialog open={!!editingUpdate} onOpenChange={(v) => !v && setEditingUpdate(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingUpdate?.id ? "Edit update" : "New update"}</DialogTitle></DialogHeader>
            {editingUpdate && (
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={editingUpdate.title} onChange={(e) => setEditingUpdate({ ...editingUpdate, title: e.target.value })} /></div>
                <div><Label>Body</Label><Textarea rows={4} value={editingUpdate.body} onChange={(e) => setEditingUpdate({ ...editingUpdate, body: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Link URL</Label><Input value={editingUpdate.link_url} onChange={(e) => setEditingUpdate({ ...editingUpdate, link_url: e.target.value })} /></div>
                  <div><Label>Link label</Label><Input value={editingUpdate.link_label} onChange={(e) => setEditingUpdate({ ...editingUpdate, link_label: e.target.value })} placeholder="Learn more" /></div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Published</Label>
                  <Switch checked={editingUpdate.is_published} onCheckedChange={(v) => setEditingUpdate({ ...editingUpdate, is_published: v })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUpdate(null)}>Cancel</Button>
              <Button onClick={saveUpdate}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline confirmation */}
        <Dialog open={confirmDecline} onOpenChange={setConfirmDecline}>
          <DialogContent>
            <DialogHeader><DialogTitle>Decline application?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This marks the application as declined. You can reconsider later.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDecline(false)}>Cancel</Button>
              <Button variant="destructive" disabled={appActionLoading} onClick={handleDeclineApplication}>
                {appActionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function RepeaterField<T extends Record<string, string>>({
  label, items, onChange, fields,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  fields: { key: keyof T & string; placeholder: string }[];
}) {
  const update = (i: number, key: string, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: value } as T;
    onChange(next);
  };
  const add = () => {
    const empty: any = {};
    fields.forEach((f) => (empty[f.key] = ""));
    onChange([...items, empty]);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border p-2 bg-muted/30">
            <div className="flex-1 space-y-1">
              {fields.map((f) => (
                <Input
                  key={f.key}
                  value={(item as any)[f.key] || ""}
                  onChange={(e) => update(i, f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ))}
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground">None added yet.</p>}
      </div>
    </div>
  );
}
