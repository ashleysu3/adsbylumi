import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Copy, ExternalLink, Calendar, Mail, Video, Sparkles, BookOpen, Megaphone, Gift, Eye, Wand2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PartnerWelcomeModal, type PartnerWelcome } from "@/components/PartnerWelcomeModal";

interface PortalData {
  partner: any;
  updates: Array<{ id: string; title: string; body?: string; link_url?: string; link_label?: string; published_at: string; source?: string; category?: string }>;
  config: {
    owner_calendar_url?: string;
    owner_email?: string;
    office_hours_url?: string;
    webinar_request_to?: string;
    brand_assets_url?: string;
  };
}

export default function PartnerPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewPartnerId = searchParams.get("preview_as");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalData | null>(null);
  const [webinarOpen, setWebinarOpen] = useState(false);
  const [webinarBody, setWebinarBody] = useState("");
  const [webinarAudience, setWebinarAudience] = useState("");
  const [sending, setSending] = useState(false);
  const [welcomePreview, setWelcomePreview] = useState<PartnerWelcome | null>(null);
  const [welcomePreviewOpen, setWelcomePreviewOpen] = useState(false);
  const [loadingWelcomePreview, setLoadingWelcomePreview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/auth"); return; }
        const rpcName = previewPartnerId ? "get_partner_portal_admin" : "get_my_partner_portal";
        const args = previewPartnerId ? { p_partner_id: previewPartnerId } : undefined;
        const { data: rpc, error } = await supabase.rpc(rpcName as any, args as any);
        if (error) throw error;
        if (!rpc) {
          if (previewPartnerId) { toast.error("Admin preview not available"); navigate("/admin/partners"); return; }
          navigate("/start"); return;
        }
        setData(rpc as unknown as PortalData);
      } catch (e: any) {
        toast.error(e.message || "Could not load Partner Portal");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, previewPartnerId]);

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const sendWebinarRequest = async () => {
    if (!webinarBody.trim()) return toast.error("Tell us what you have in mind");
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("partner-webinar-request", {
        body: { audience: webinarAudience, message: webinarBody },
      });
      if (error) throw error;
      toast.success("Sent! We'll be in touch.");
      setWebinarOpen(false);
      setWebinarBody("");
      setWebinarAudience("");
    } catch (e: any) {
      toast.error(e.message || "Could not send request");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <Card><CardContent className="p-10 text-center">This portal isn't available for your account.</CardContent></Card>
      </DashboardLayout>
    );
  }

  const p = data.partner;
  const cfg = data.config || {};
  const shareUrl = p.partner_trial_code ? `https://adsbylumi.com/?code=${p.partner_trial_code}` : "";

  const previewWelcomePopup = async () => {
    if (!p.partner_trial_code) { toast.error("No trial code set yet."); return; }
    setLoadingWelcomePreview(true);
    try {
      const { data: result, error } = await supabase.rpc("get_partner_welcome", { p_code: p.partner_trial_code });
      if (error) throw error;
      const payload = result as unknown as PartnerWelcome;
      if (!payload?.partner_display_name) throw new Error("Welcome popup data not ready.");
      setWelcomePreview(payload);
      setWelcomePreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Could not load welcome preview");
    } finally {
      setLoadingWelcomePreview(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {previewPartnerId && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm flex items-center justify-between gap-3">
            <span><strong>Admin preview</strong> — viewing this partner's portal as they would see it.</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/admin/partners")}>Back to partners</Button>
          </div>
        )}
        {/* Hero */}
        <Card className="overflow-hidden border-primary/20">
          <div className="bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-orange-400/10 p-6 flex items-center gap-4">
            {p.partner_photo_url ? (
              <img src={p.partner_photo_url} alt={p.partner_display_name} className="h-20 w-20 rounded-full object-cover border-2 border-background shadow" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold">
                {(p.partner_display_name || "?")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">Welcome back, {p.partner_display_name?.split(" ")[0] || "Partner"}</h1>
                <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />Lumi Partner</Badge>
                {p.membership_comped && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Membership comped</Badge>}
              </div>
              {p.partner_title && <p className="text-sm text-muted-foreground">{p.partner_title}</p>}
            </div>
          </div>
        </Card>

        {/* Referral toolkit */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" /> Your referral toolkit</CardTitle>
            <CardDescription>Share these anywhere — every signup tracks back to you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.referral_link && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Your referral link (Rewardful tracked)</label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={p.referral_link} className="font-mono text-sm" />
                  <Button variant="outline" onClick={() => copy(p.referral_link, "Referral link copied")}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Your trial code</label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={p.partner_trial_code || ""} className="font-mono text-sm uppercase" />
                  <Button variant="outline" onClick={() => copy(p.partner_trial_code, "Code copied")}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Unlocks a {p.trial_days || 14}-day free trial.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Share preview link</label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={shareUrl} className="text-sm" />
                  <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">What your audience sees when they click.</p>
              </div>
            </div>
            <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Want to see exactly what your audience gets after signing up with your code?</p>
              <Button variant="outline" size="sm" onClick={previewWelcomePopup} disabled={loadingWelcomePreview}>
                {loadingWelcomePreview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Preview welcome popup
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        {(p.share_resources || []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Resources for sharing</CardTitle>
              <CardDescription>Swipe copy, graphics, videos — ready to grab.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              {(p.share_resources || []).map((r: any, i: number) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border hover:border-primary/40 hover:bg-muted/40 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{r.title}</div>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                      {r.type && <Badge variant="outline" className="mt-2 text-[10px]">{r.type}</Badge>}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recommended Lumi features for their audience */}
        {((p.recommended_features || []).filter((f: any) => f.selected !== false && (f.feature || f.share_copy))).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Lumi features your audience will love</CardTitle>
              <CardDescription>Hand-picked for the people you serve — with ready-to-share copy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(p.recommended_features || [])
                .filter((f: any) => f.selected !== false && (f.feature || f.share_copy))
                .map((f: any, i: number) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium">{f.feature}</h4>
                  </div>
                  {f.why_audience_cares && (
                    <p className="text-sm text-muted-foreground">{f.why_audience_cares}</p>
                  )}
                  {f.share_copy && (
                    <div className="rounded-md bg-muted/40 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Share copy</p>
                      <p className="text-sm whitespace-pre-wrap">{f.share_copy}</p>
                      <Button size="sm" variant="outline" onClick={() => copy(f.share_copy, "Copy ready to paste")}>
                        <Copy className="h-3 w-3 mr-2" /> Copy
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Brand assets */}
        {cfg.brand_assets_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5" /> Lumi brand assets</CardTitle>
              <CardDescription>Logos, headshots, graphics and more — grab anything you need.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="h-auto py-3 justify-start w-full sm:w-auto" onClick={() => window.open(cfg.brand_assets_url, "_blank")}>
                <FolderOpen className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Open the brand assets folder</div>
                  <div className="text-xs text-muted-foreground">Google Drive — logos, photos, graphics</div>
                </div>
                <ExternalLink className="h-3 w-3 ml-3" />
              </Button>
            </CardContent>
          </Card>
        )}


        {/* Support + grow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Get support & grow with us</CardTitle>
            <CardDescription>We're here to help you succeed with Lumi.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {cfg.owner_calendar_url && (
              <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => window.open(cfg.owner_calendar_url, "_blank")}>
                <Calendar className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Book a 1:1 call</div>
                  <div className="text-xs text-muted-foreground">Strategy time with the founder</div>
                </div>
              </Button>
            )}
            {cfg.office_hours_url ? (
              <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => window.open(cfg.office_hours_url, "_blank")}>
                <Video className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Join office hours</div>
                  <div className="text-xs text-muted-foreground">Weekly live Q&A</div>
                </div>
              </Button>
            ) : (
              <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => navigate("/office-hours")}>
                <Video className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Join office hours</div>
                  <div className="text-xs text-muted-foreground">Mondays, 10am ET</div>
                </div>
              </Button>
            )}
            <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => setWebinarOpen(true)}>
              <Sparkles className="h-4 w-4 mr-3" />
              <div className="text-left">
                <div className="font-medium">Request a joint webinar</div>
                <div className="text-xs text-muted-foreground">Or community training</div>
              </div>
            </Button>
            {cfg.owner_email && (
              <Button variant="outline" className="h-auto py-3 justify-start" onClick={() => window.open(`mailto:${cfg.owner_email}?subject=Lumi Partner — ${encodeURIComponent(p.partner_display_name || "")}`)}>
                <Mail className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Email us directly</div>
                  <div className="text-xs text-muted-foreground">{cfg.owner_email}</div>
                </div>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> What's new in Lumi</CardTitle>
            <CardDescription>Fresh features and announcements to share with your audience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.updates.length === 0 && (
              <p className="text-sm text-muted-foreground">No updates yet — check back soon.</p>
            )}
            {data.updates.map((u) => (
              <div key={`${u.source || 'u'}-${u.id}`} className="border-l-2 border-primary/40 pl-3">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{u.title}</h4>
                    {u.source === 'changelog' && u.category && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{u.category}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(u.published_at).toLocaleDateString()}</span>
                </div>
                {u.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{u.body}</p>}
                {u.link_url && (
                  <a href={u.link_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1">
                    {u.link_label || "Learn more"} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={webinarOpen} onOpenChange={setWebinarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request a joint webinar or training</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Your audience</label>
                <Input value={webinarAudience} onChange={(e) => setWebinarAudience(e.target.value)} placeholder="e.g. 1,200 wedding pros in my community" />
              </div>
              <div>
                <label className="text-xs font-medium">What do you have in mind?</label>
                <Textarea rows={5} value={webinarBody} onChange={(e) => setWebinarBody(e.target.value)} placeholder="Format, topic, timing, anything else we should know..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWebinarOpen(false)}>Cancel</Button>
              <Button onClick={sendWebinarRequest} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Send request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <PartnerWelcomeModal
          previewData={welcomePreview}
          previewOpen={welcomePreviewOpen}
          onPreviewOpenChange={setWelcomePreviewOpen}
        />
      </div>
    </DashboardLayout>
  );
}
