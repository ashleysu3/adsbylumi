import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Inbox, ExternalLink, Search, Link2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PartnerApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  website?: string | null;
  audience_description?: string | null;
  promotion_plan?: string | null;
  how_will_you_share?: string | null;
  status: string;
  application_type: string;
  rewardful_affiliate_id?: string | null;
  created_at: string;
}

interface PartnerLite { id: string; partner_application_id: string | null; email: string | null; partner_email: string | null; partner_display_name: string | null; partner_trial_code: string | null }

export default function AdminPartnerApplications() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [partners, setPartners] = useState<PartnerLite[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("pending");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const [appsRes, partnersRes] = await Promise.all([
          supabase.functions.invoke("admin-get-affiliates", {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          }),
          supabase.from("partner_access_tokens").select("id, partner_application_id, email, partner_email, partner_display_name, partner_trial_code"),
        ]);
        const all: PartnerApplication[] = ((appsRes as any)?.data?.applications || []).filter((a: PartnerApplication) => a.application_type === "partner");
        setApplications(all);
        setPartners((partnersRes.data || []) as any);
      } catch (e: any) {
        toast.error(e.message || "Failed to load applications");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const partnerForApp = useMemo(() => {
    const byAppId = new Map<string, PartnerLite>();
    const byEmail = new Map<string, PartnerLite>();
    partners.forEach((p) => {
      if (p.partner_application_id) byAppId.set(p.partner_application_id, p);
      const e = (p.partner_email || p.email || "").toLowerCase();
      if (e) byEmail.set(e, p);
    });
    return (app: PartnerApplication) => byAppId.get(app.id) || byEmail.get(app.email.toLowerCase()) || null;
  }, [partners]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications
      .filter((a) => {
        if (tab === "pending") return a.status === "pending";
        if (tab === "approved") return a.status === "approved";
        if (tab === "declined") return a.status === "declined" || a.status === "rejected";
        return true;
      })
      .filter((a) => !q || `${a.first_name} ${a.last_name} ${a.email} ${a.audience_description || ""}`.toLowerCase().includes(q));
  }, [applications, search, tab]);

  const counts = useMemo(() => ({
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    declined: applications.filter((a) => a.status === "declined" || a.status === "rejected").length,
    all: applications.length,
  }), [applications]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <AdminTabs />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="h-6 w-6" /> Partner Applications</h1>
            <p className="text-muted-foreground text-sm">Review incoming applications and open them as Partner Files.</p>
          </div>
          <div className="relative w-72">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, audience..." className="pl-8" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inbox</CardTitle>
            <CardDescription>Once you approve an application, it becomes a Partner File. Use the tabs to see history.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="pending">Pending {counts.pending > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800 border-0">{counts.pending}</Badge>}</TabsTrigger>
                <TabsTrigger value="approved">Approved <Badge variant="outline" className="ml-2">{counts.approved}</Badge></TabsTrigger>
                <TabsTrigger value="declined">Declined <Badge variant="outline" className="ml-2">{counts.declined}</Badge></TabsTrigger>
                <TabsTrigger value="all">All <Badge variant="outline" className="ml-2">{counts.all}</Badge></TabsTrigger>
              </TabsList>
              <TabsContent value={tab} className="mt-4 space-y-2">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No applications here.</p>
                ) : (
                  filtered.map((app) => {
                    const linkedPartner = partnerForApp(app);
                    const isApproved = app.status === "approved";
                    return (
                      <div
                        key={app.id}
                        className="flex items-start justify-between gap-3 p-3 rounded border hover:bg-muted/40 cursor-pointer"
                        onClick={() => {
                          if (linkedPartner) {
                            navigate(`/admin/partners?app=${app.id}`);
                          } else {
                            navigate(`/admin/partners?app=${app.id}`);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{app.first_name} {app.last_name}</span>
                            <Badge variant="outline" className="capitalize text-xs">{app.status}</Badge>
                            {linkedPartner && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                Partner file
                                {linkedPartner.partner_trial_code ? ` · ${linkedPartner.partner_trial_code}` : ""}
                              </Badge>
                            )}
                            {isApproved && !linkedPartner && (
                              <Badge variant="outline" className="text-xs"><Link2 className="h-3 w-3 mr-1" />Awaiting file</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{app.email}</p>
                          {app.website && (
                            <a
                              href={app.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              {app.website} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {app.audience_description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{app.audience_description}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right">
                          {new Date(app.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
