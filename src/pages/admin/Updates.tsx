import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Sparkles, Send, Calendar, Trash2, BarChart3, Mail, Eye, MousePointer, RotateCw, Lightbulb, Check, X, GitCommit } from "lucide-react";
import { toast } from "sonner";

interface ChangelogEntry {
  id: string;
  title: string;
  body: string | null;
  category: string;
  created_at: string;
  included_in_campaign_id: string | null;
  approval_status?: string;
  source?: string;
  commit_refs?: Array<{ sha?: string; message?: string; author?: string | null; url?: string | null }>;
}

interface Campaign {
  id: string;
  month_label: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  user_subject: string | null;
  partner_subject: string | null;
  created_at: string;
}

export default function AdminUpdates() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("hub");
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [signals, setSignals] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New entry
  const [newEntry, setNewEntry] = useState({ title: "", body: "", category: "feature" });
  const [ideas, setIdeas] = useState<Array<{ title: string; body: string; category: string }>>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  // Draft builder
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [angles, setAngles] = useState<Record<string, string[]>>({});
  const [customNote, setCustomNote] = useState("");
  const [monthLabel, setMonthLabel] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  });
  const [generating, setGenerating] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [s, e, c] = await Promise.all([
        supabase.rpc("admin_get_newsletter_signals"),
        supabase.from("changelog_entries").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("newsletter_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      setSignals(s.data);
      setEntries((e.data as any[]) || []);
      setCampaigns(c.data || []);
    } catch (err: any) {
      toast.error("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addEntry() {
    if (!newEntry.title.trim()) return toast.error("Title required");
    const { error } = await supabase.from("changelog_entries").insert(newEntry);
    if (error) return toast.error(error.message);
    toast.success("Added");
    setNewEntry({ title: "", body: "", category: "feature" });
    load();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("changelog_entries").delete().eq("id", id);
    load();
  }

  async function setApproval(id: string, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("changelog_entries")
      .update({ approval_status: status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved & published" : "Rejected");
    load();
  }


  async function suggestIdeas() {
    setIdeasLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-update-ideas", { body: {} });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setIdeas(data.ideas || []);
      if ((data.ideas || []).length === 0) toast.info("No ideas came back — try again");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIdeasLoading(false);
    }
  }

  async function addIdea(idx: number) {
    const idea = ideas[idx];
    const { error } = await supabase.from("changelog_entries").insert(idea);
    if (error) return toast.error(error.message);
    toast.success("Added to changelog");
    setIdeas((arr) => arr.filter((_, i) => i !== idx));
    load();
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  async function suggestAngles(entry: ChangelogEntry) {
    try {
      const { data, error } = await supabase.functions.invoke("suggest-update-angles", {
        body: { title: entry.title, body: entry.body },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setAngles((a) => ({ ...a, [entry.id]: data.angles || [] }));
      toast.success("Got angle ideas");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function generateDraft() {
    if (selectedIds.size === 0) return toast.error("Select at least one update");
    setGenerating(true);
    try {
      const selected = entries.filter((e) => selectedIds.has(e.id));
      const { data, error } = await supabase.functions.invoke("generate-newsletter-draft", {
        body: {
          monthLabel,
          selectedUpdates: selected.map((e) => ({ id: e.id, title: e.title, body: e.body, category: e.category })),
          angles,
          customNote,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const draft = data.draft;
      // Persist campaign
      const { data: campaign, error: cErr } = await supabase.from("newsletter_campaigns").insert({
        month_label: monthLabel,
        selected_update_ids: Array.from(selectedIds),
        angles,
        custom_note: customNote,
        user_subject: draft.user_subject_options?.[0],
        user_resend_subject: draft.user_resend_subject_options?.[0],
        partner_subject: draft.partner_subject_options?.[0],
        partner_resend_subject: draft.partner_resend_subject_options?.[0],
        user_html: draft.user_html,
        partner_html: draft.partner_html,
        status: "draft",
      }).select().single();
      if (cErr) throw cErr;
      setActiveDraft({ ...draft, ...campaign });
      setCurrentCampaignId(campaign.id);
      setDraftDialogOpen(true);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function openCampaign(c: Campaign) {
    const { data } = await supabase.from("newsletter_campaigns").select("*").eq("id", c.id).maybeSingle();
    if (!data) return;
    setActiveDraft({
      ...data,
      user_subject_options: [data.user_subject].filter(Boolean),
      user_resend_subject_options: [data.user_resend_subject].filter(Boolean),
      partner_subject_options: [data.partner_subject].filter(Boolean),
      partner_resend_subject_options: [data.partner_resend_subject].filter(Boolean),
    });
    setCurrentCampaignId(c.id);
    setDraftDialogOpen(true);
  }

  async function saveDraft() {
    if (!currentCampaignId || !activeDraft) return;
    const { error } = await supabase.from("newsletter_campaigns").update({
      user_subject: activeDraft.user_subject,
      user_resend_subject: activeDraft.user_resend_subject,
      partner_subject: activeDraft.partner_subject,
      partner_resend_subject: activeDraft.partner_resend_subject,
      user_html: activeDraft.user_html,
      partner_html: activeDraft.partner_html,
    }).eq("id", currentCampaignId);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  }

  async function sendNow() {
    if (!currentCampaignId) return;
    if (!confirm("Send to all opted-in users and partners now?")) return;
    await saveDraft();
    toast.loading("Sending…", { id: "send" });
    const { data, error } = await supabase.functions.invoke("dispatch-newsletter", {
      body: { campaignId: currentCampaignId, mode: "send" },
    });
    toast.dismiss("send");
    if (error || data?.error) return toast.error(data?.error || error?.message);
    toast.success(`Sent ${data.sent}, failed ${data.failed}`);
    setDraftDialogOpen(false);
    load();
  }

  async function resendUnopened() {
    if (!currentCampaignId) return;
    if (!confirm("Resend with new subject to recipients who haven't opened in 48h?")) return;
    const { data, error } = await supabase.functions.invoke("dispatch-newsletter", {
      body: { campaignId: currentCampaignId, mode: "resend" },
    });
    if (error || data?.error) return toast.error(data?.error || error?.message);
    toast.success(`Resent to ${data.resent}`);
    load();
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-7 h-7 text-primary" /> Updates &amp; Newsletter
          </h1>
          <p className="text-muted-foreground mt-1">Log product updates, draft monthly newsletters, track results.</p>
        </div>
        <AdminTabs />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="hub">Build a draft</TabsTrigger>
            <TabsTrigger value="changelog">Changelog</TabsTrigger>
            <TabsTrigger value="campaigns">Past campaigns</TabsTrigger>
          </TabsList>

          {/* HUB */}
          <TabsContent value="hub" className="space-y-4">
            {signals && (
              <Card>
                <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Changelog (60d)" value={signals.changelog?.length || 0} />
                  <Stat label="New users (30d)" value={signals.new_users_30d} />
                  <Stat label="Strategies (30d)" value={signals.recent_strategies} />
                  <Stat label="Active partners" value={signals.active_partners} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>This month's updates</CardTitle>
                <p className="text-sm text-muted-foreground">Check the items to highlight. Hit "Suggest angles" for ideas on how to talk about each one.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {entries.filter((e) => e.approval_status !== "draft" && e.approval_status !== "rejected").length === 0 && <p className="text-sm text-muted-foreground">No approved entries yet. Add one (or approve a draft) in the Changelog tab.</p>}
                {entries.filter((e) => e.approval_status !== "draft" && e.approval_status !== "rejected").map((e) => (
                  <div key={e.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.title}</span>
                        <Badge variant="outline" className="text-xs">{e.category}</Badge>
                        {e.included_in_campaign_id && <Badge variant="secondary" className="text-xs">already sent</Badge>}
                      </div>
                      {e.body && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.body}</p>}
                      {angles[e.id] && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {angles[e.id].map((a, i) => <Badge key={i} variant="outline" className="text-xs">{a}</Badge>)}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => suggestAngles(e)}>
                      <Sparkles className="w-3 h-3 mr-1" /> Angles
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your note + month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Month label</Label>
                  <Input value={monthLabel} onChange={(e) => setMonthLabel(e.target.value)} />
                </div>
                <div>
                  <Label>Custom note from Ashley</Label>
                  <Textarea rows={4} value={customNote} onChange={(e) => setCustomNote(e.target.value)} placeholder="What's on your heart for this month's newsletter?" />
                </div>
                <Button onClick={generateDraft} disabled={generating || selectedIds.size === 0} className="w-full">
                  <Sparkles className="w-4 h-4 mr-2" /> {generating ? "Drafting…" : "Generate draft"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHANGELOG */}
          <TabsContent value="changelog" className="space-y-4">
            {entries.some((e) => e.approval_status === "draft") && (
              <Card className="border-amber-500/40 bg-amber-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitCommit className="w-5 h-5 text-amber-600" />
                    Pending approval
                    <Badge variant="secondary" className="ml-2">
                      {entries.filter((e) => e.approval_status === "draft").length}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Auto-drafted from recent code changes. Approve to publish to "What's new" and partner portals — or reject to discard.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entries
                    .filter((e) => e.approval_status === "draft")
                    .map((e) => (
                      <div key={e.id} className="p-3 border rounded-lg bg-background space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{e.title}</span>
                              <Badge variant="outline" className="text-xs capitalize">{e.category}</Badge>
                              {e.source === "github" && (
                                <Badge variant="outline" className="text-xs">
                                  <GitCommit className="w-3 h-3 mr-1" /> GitHub
                                </Badge>
                              )}
                            </div>
                            {e.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{e.body}</p>}
                            {Array.isArray(e.commit_refs) && e.commit_refs.length > 0 && (
                              <details className="mt-2 text-xs text-muted-foreground">
                                <summary className="cursor-pointer hover:text-foreground">
                                  {e.commit_refs.length} commit{e.commit_refs.length === 1 ? "" : "s"}
                                </summary>
                                <ul className="mt-1 space-y-0.5 pl-3">
                                  {e.commit_refs.map((c, i) => (
                                    <li key={i} className="font-mono">
                                      {c.sha && <span className="text-primary mr-1">{c.sha}</span>}
                                      {c.message}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="default" onClick={() => setApproval(e.id, "approved")}>
                              <Check className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setApproval(e.id, "rejected")}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}


            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" /> Need ideas?
                </CardTitle>
                <p className="text-sm text-muted-foreground">Let Lumi suggest fresh update ideas based on what's been shipping lately.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={suggestIdeas} disabled={ideasLoading} variant="outline">
                  <Sparkles className="w-4 h-4 mr-2" /> {ideasLoading ? "Brainstorming…" : "Suggest update ideas"}
                </Button>
                {ideas.length > 0 && (
                  <div className="space-y-2">
                    {ideas.map((idea, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{idea.title}</span>
                            <Badge variant="outline" className="text-xs capitalize">{idea.category}</Badge>
                          </div>
                          {idea.body && <p className="text-sm text-muted-foreground mt-1">{idea.body}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setNewEntry(idea); toast.success("Loaded — tweak below"); }}>
                            Edit
                          </Button>
                          <Button size="sm" onClick={() => addIdea(i)}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Log a new update</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Title (e.g., New: AI Hook Library)" value={newEntry.title} onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })} />
                <Textarea placeholder="What changed, why it matters…" rows={3} value={newEntry.body} onChange={(e) => setNewEntry({ ...newEntry, body: e.target.value })} />
                <div className="flex gap-2">
                  <Select value={newEntry.category} onValueChange={(v) => setNewEntry({ ...newEntry, category: v })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="improvement">Improvement</SelectItem>
                      <SelectItem value="fix">Fix</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={addEntry}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Recent entries</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.title}</span>
                        <Badge variant="outline" className="text-xs">{e.category}</Badge>
                      </div>
                      {e.body && <p className="text-sm text-muted-foreground mt-1">{e.body}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteEntry(e.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CAMPAIGNS */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Past &amp; scheduled</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{c.month_label}</div>
                      <div className="text-sm text-muted-foreground">
                        {c.user_subject || "(no subject)"} · <Badge variant="outline">{c.status}</Badge>
                        {c.sent_at && ` · sent ${new Date(c.sent_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/updates/${c.id}`)}>
                        <BarChart3 className="w-3 h-3 mr-1" /> Results
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openCampaign(c)}>Open</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DRAFT DIALOG */}
        <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Draft · {activeDraft?.month_label}</DialogTitle>
            </DialogHeader>
            {activeDraft && (
              <Tabs defaultValue="user">
                <TabsList>
                  <TabsTrigger value="user">User edition</TabsTrigger>
                  <TabsTrigger value="partner">Partner edition</TabsTrigger>
                </TabsList>
                <TabsContent value="user" className="space-y-3">
                  <SubjectPicker
                    label="Subject"
                    value={activeDraft.user_subject}
                    options={activeDraft.user_subject_options || []}
                    onChange={(v) => setActiveDraft({ ...activeDraft, user_subject: v })}
                  />
                  <SubjectPicker
                    label="Resend subject (48h follow-up)"
                    value={activeDraft.user_resend_subject}
                    options={activeDraft.user_resend_subject_options || []}
                    onChange={(v) => setActiveDraft({ ...activeDraft, user_resend_subject: v })}
                  />
                  <Tabs defaultValue="preview">
                    <TabsList><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="html">HTML</TabsTrigger></TabsList>
                    <TabsContent value="preview">
                      <div className="border rounded-lg p-4 bg-white max-h-96 overflow-y-auto" dangerouslySetInnerHTML={{ __html: activeDraft.user_html || "" }} />
                    </TabsContent>
                    <TabsContent value="html">
                      <Textarea rows={16} value={activeDraft.user_html || ""} onChange={(e) => setActiveDraft({ ...activeDraft, user_html: e.target.value })} className="font-mono text-xs" />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="partner" className="space-y-3">
                  <SubjectPicker
                    label="Subject"
                    value={activeDraft.partner_subject}
                    options={activeDraft.partner_subject_options || []}
                    onChange={(v) => setActiveDraft({ ...activeDraft, partner_subject: v })}
                  />
                  <SubjectPicker
                    label="Resend subject (48h follow-up)"
                    value={activeDraft.partner_resend_subject}
                    options={activeDraft.partner_resend_subject_options || []}
                    onChange={(v) => setActiveDraft({ ...activeDraft, partner_resend_subject: v })}
                  />
                  <Tabs defaultValue="preview">
                    <TabsList><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="html">HTML</TabsTrigger></TabsList>
                    <TabsContent value="preview">
                      <div className="border rounded-lg p-4 bg-white max-h-96 overflow-y-auto" dangerouslySetInnerHTML={{ __html: activeDraft.partner_html || "" }} />
                    </TabsContent>
                    <TabsContent value="html">
                      <Textarea rows={16} value={activeDraft.partner_html || ""} onChange={(e) => setActiveDraft({ ...activeDraft, partner_html: e.target.value })} className="font-mono text-xs" />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            )}
            <div className="flex justify-between gap-2 mt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveDraft}>Save</Button>
                {activeDraft?.status === 'sent' && (
                  <Button variant="outline" onClick={resendUnopened}><RotateCw className="w-4 h-4 mr-1" /> Resend unopened</Button>
                )}
              </div>
              {activeDraft?.status !== 'sent' && (
                <Button onClick={sendNow}><Send className="w-4 h-4 mr-1" /> Send now</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SubjectPicker({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
      {options.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {options.map((o, i) => (
            <button key={i} onClick={() => onChange(o)} className="text-xs px-2 py-1 rounded border hover:bg-muted">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
