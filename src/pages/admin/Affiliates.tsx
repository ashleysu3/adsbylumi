import { useState, useEffect } from "react";
import { Users, Search, ExternalLink, Mail, Check, X, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import PartnerApplicationDrawer from "@/components/admin/PartnerApplicationDrawer";

export default function AdminAffiliates() {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [appFilter, setAppFilter] = useState('all');
  const [emailModal, setEmailModal] = useState<{ name: string; email: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState('A note from the LUMI team');
  const [emailBody, setEmailBody] = useState('');
  const [declineModal, setDeclineModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('admin-get-affiliates', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (error) throw error;
      setAffiliates(data.affiliates || []);
      setApplications(data.applications || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load affiliate data");
    }
    setLoading(false);
  };

  const filteredAffiliates = affiliates.filter(a => {
    const name = `${a.first_name || ''} ${a.last_name || ''} ${a.email || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const filteredApps = applications
    .filter(a => a.application_type === 'partner')
    .filter(a => appFilter === 'all' || a.status === appFilter);

  const totalConversions = affiliates.reduce((sum, a) => sum + (a.conversions_count || 0), 0);

  const handleApprove = async (app: any, customMessage?: string) => {
    setActionLoading(app.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-affiliate', {
        body: {
          email: app.email,
          firstName: app.first_name,
          lastName: app.last_name,
          campaignId: 'partner',
        }
      });

      if (error) throw error;

      const referralLink = data?.referralLink || '';
      const referralCode = data?.referralCode || '';
      const affiliateId = data?.id || null;

      const { error: updateErr } = await supabase
        .from('partner_applications')
        .update({
          status: 'approved',
          rewardful_affiliate_id: affiliateId,
          updated_at: new Date().toISOString()
        })
        .eq('id', app.id);

      if (updateErr) throw updateErr;

      const { error: emailErr } = await supabase.functions.invoke('send-partner-approval', {
        body: {
          email: app.email,
          firstName: app.first_name,
          lastName: app.last_name,
          referralLink,
          referralCode,
          rewardfulAffiliateId: affiliateId,
          customMessage: customMessage || undefined,
        }
      });

      if (emailErr) {
        console.error('Approval email failed:', emailErr);
        toast.success("Approved! (Email may have failed to send)");
      } else {
        toast.success("Approved & welcome email sent! 🎉");
      }

      setSelectedApp(null);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to approve: " + (err.message || 'Unknown error'));
    }
    setActionLoading(null);
  };

  const handleDecline = async (appId: string) => {
    setActionLoading(appId);
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', appId);
      if (error) throw error;
      toast.success("Application declined.");
      setDeclineModal(null);
      setSelectedApp(null);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to decline");
    }
    setActionLoading(null);
  };

  const handleReconsider = async (appId: string) => {
    setActionLoading(appId);
    try {
      const { error } = await supabase
        .from('partner_applications')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', appId);
      if (error) throw error;
      toast.success("Status reset to pending.");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to update");
    }
    setActionLoading(null);
  };

  const handleNoteSave = async (appId: string, notes: string) => {
    await supabase
      .from('partner_applications')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', appId);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-600',
    };
    return <Badge className={`${styles[status] || styles.inactive} border-0 capitalize`}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AdminTabs />

        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
          Affiliates & Partners
        </h1>

        <Tabs defaultValue="affiliates">
          <TabsList className="mb-6">
            <TabsTrigger value="affiliates" className="gap-2">
              <Users className="h-4 w-4" /> Affiliates
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2">
              <Mail className="h-4 w-4" /> Partner Applications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="affiliates">
            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Total Affiliates", value: affiliates.length },
                    { label: "Total Conversions", value: totalConversions },
                    { label: "Partner Affiliates", value: affiliates.filter(a => a.campaign?.name?.toLowerCase().includes('partner')).length },
                    { label: "Standard Affiliates", value: affiliates.filter(a => !a.campaign?.name?.toLowerCase().includes('partner')).length },
                  ].map(s => (
                    <Card key={s.label} className="border-border/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                  </div>
                </div>

                <Card className="border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name & Email</TableHead>
                          <TableHead>Program</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Leads</TableHead>
                          <TableHead>Conversions</TableHead>
                          <TableHead>Earned</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAffiliates.map(a => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <p className="font-medium text-sm">{a.first_name} {a.last_name}</p>
                              <p className="text-xs text-muted-foreground">{a.email}</p>
                            </TableCell>
                            <TableCell>
                              <Badge className={`border-0 text-xs ${
                                a.campaign?.name?.toLowerCase().includes('partner')
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {a.campaign?.name?.toLowerCase().includes('partner') ? 'Partner 30%' : 'Affiliate $40'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{a.links?.[0]?.token || '—'}</TableCell>
                            <TableCell>{a.leads_count || a.visitors_count || 0}</TableCell>
                            <TableCell>{a.conversions_count || 0}</TableCell>
                            <TableCell>${((a.earnings_balance?.amount_cents || a.commissions_total_cents || 0) / 100).toFixed(2)}</TableCell>
                            <TableCell>{statusBadge(a.state || 'active')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setEmailModal({ name: `${a.first_name} ${a.last_name}`, email: a.email })}>
                                  <Mail className="h-3 w-3" />
                                </Button>
                                <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm"><ExternalLink className="h-3 w-3" /></Button>
                                </a>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAffiliates.length === 0 && (
                          <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No affiliates found</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="applications">
            {loading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {['all', 'pending', 'approved', 'declined'].map(f => (
                    <Button key={f} variant={appFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setAppFilter(f)} className="capitalize">
                      {f}
                    </Button>
                  ))}
                </div>

                <Card className="border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name & Email</TableHead>
                          <TableHead>Website</TableHead>
                          <TableHead>Audience</TableHead>
                          <TableHead>Promotion Plan</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredApps.map(app => (
                          <TableRow key={app.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedApp(app)}>
                            <TableCell>
                              <p className="font-medium text-sm">{app.first_name} {app.last_name}</p>
                              <p className="text-xs text-muted-foreground">{app.email}</p>
                            </TableCell>
                            <TableCell>
                              {app.website ? (
                                <a href={app.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                  Link <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <p className="text-xs max-w-[200px] truncate" title={app.audience_description}>
                                {app.audience_description || '—'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs max-w-[200px] truncate" title={app.promotion_plan}>
                                {app.promotion_plan || '—'}
                              </p>
                            </TableCell>
                            <TableCell className="text-xs">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>{statusBadge(app.status)}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}
                              >
                                Open Application
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Textarea
                                defaultValue={app.notes || ''}
                                placeholder="Admin notes..."
                                className="text-xs min-h-[60px] w-[150px]"
                                onBlur={(e) => handleNoteSave(app.id, e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredApps.length === 0 && (
                          <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No applications found</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Email Modal */}
        <Dialog open={!!emailModal} onOpenChange={() => setEmailModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email {emailModal?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">To: {emailModal?.email}</p>
              </div>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject" />
              <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Your message..." rows={6} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailModal(null)}>Cancel</Button>
              <Button onClick={() => {
                window.open(`mailto:${emailModal?.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);
                setEmailModal(null);
              }}>
                <Mail className="h-4 w-4 mr-2" /> Open in Email Client
              </Button>
            </DialogFooter>
            <p className="text-xs text-muted-foreground text-center">(Opens your email app)</p>
          </DialogContent>
        </Dialog>

        {/* Decline Confirmation Modal */}
        <Dialog open={!!declineModal} onOpenChange={() => setDeclineModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Application?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to decline this partner application?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeclineModal(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => declineModal && handleDecline(declineModal)}
                disabled={actionLoading === declineModal}
              >
                {actionLoading === declineModal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Partner Application Drawer */}
        <PartnerApplicationDrawer
          application={selectedApp}
          open={!!selectedApp}
          onOpenChange={(open) => !open && setSelectedApp(null)}
          onApprove={handleApprove}
          onDecline={handleDecline}
          onReconsider={handleReconsider}
          onNoteSave={handleNoteSave}
          actionLoading={actionLoading}
        />
      </div>
    </DashboardLayout>
  );
}
