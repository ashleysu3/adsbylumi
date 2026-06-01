import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ExternalLink, DollarSign, CheckCircle2, Mail, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RewardfulPayout {
  id: string;
  currency: string;
  amount: number; // in minor units (cents)
  state: "pending" | "due" | "processing" | "paid";
  created_at: string;
  paid_at?: string | null;
  affiliate?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    paypal_email?: string | null;
    wise_email?: string | null;
    stripe_account_id?: string | null;
  };
  commissions?: Array<{ id: string; amount: number; currency: string }>;
  partner_record?: {
    id: string;
    partner_display_name?: string;
    partner_email?: string;
    email?: string;
  } | null;
}

const fmt = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);

const stateColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  due: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  processing: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export default function AdminPayouts() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<RewardfulPayout[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("due");
  const [confirmPay, setConfirmPay] = useState<RewardfulPayout | null>(null);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-get-payouts");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPayouts((data?.payouts || []) as RewardfulPayout[]);
    } catch (e: any) {
      toast.error(e.message || "Could not load payouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter((p) => {
      if (activeTab !== "all" && p.state !== activeTab) return false;
      if (!q) return true;
      const aff = p.affiliate;
      return [aff?.email, aff?.first_name, aff?.last_name, aff?.paypal_email, aff?.wise_email, p.partner_record?.partner_display_name]
        .filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [payouts, search, activeTab]);

  const totals = useMemo(() => {
    const byState = (s: string) => payouts.filter((p) => p.state === s).reduce((acc, p) => acc + (p.amount || 0), 0);
    return {
      due: byState("due"),
      pending: byState("pending"),
      processing: byState("processing"),
      paidYtd: payouts.filter((p) => p.state === "paid" && new Date(p.paid_at || p.created_at).getFullYear() === new Date().getFullYear())
        .reduce((acc, p) => acc + (p.amount || 0), 0),
      counts: {
        due: payouts.filter((p) => p.state === "due").length,
        pending: payouts.filter((p) => p.state === "pending").length,
        processing: payouts.filter((p) => p.state === "processing").length,
        paid: payouts.filter((p) => p.state === "paid").length,
      },
    };
  }, [payouts]);

  const markPaid = async (payout: RewardfulPayout) => {
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-mark-payout-paid", { body: { payout_id: payout.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Marked as paid in Rewardful");
      setConfirmPay(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to mark paid");
    } finally {
      setPaying(false);
    }
  };

  const payoutDestination = (p: RewardfulPayout) => {
    if (p.affiliate?.paypal_email) return { label: "PayPal", value: p.affiliate.paypal_email };
    if (p.affiliate?.wise_email) return { label: "Wise", value: p.affiliate.wise_email };
    if (p.affiliate?.stripe_account_id) return { label: "Stripe", value: p.affiliate.stripe_account_id };
    return { label: "Not set", value: "" };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" />Partner payouts</h1>
            <p className="text-sm text-muted-foreground">Synced live from Rewardful. Mark a payout as paid here once you've sent the funds.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer">
                Open Rewardful <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </div>

        <AdminTabs />

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Due now", value: fmt(totals.due), count: totals.counts.due, tone: "text-orange-600" },
            { label: "Pending", value: fmt(totals.pending), count: totals.counts.pending, tone: "text-amber-600" },
            { label: "Processing", value: fmt(totals.processing), count: totals.counts.processing, tone: "text-blue-600" },
            { label: "Paid this year", value: fmt(totals.paidYtd), count: totals.counts.paid, tone: "text-emerald-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.tone}`}>{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.count} payout{s.count === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">Payouts</CardTitle>
                <CardDescription>Rewardful bundles a partner's payable commissions into payouts. "Due" means it's time to pay.</CardDescription>
              </div>
              <Input
                placeholder="Search by name, email, PayPal…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-72"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="due">Due ({totals.counts.due})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({totals.counts.pending})</TabsTrigger>
                <TabsTrigger value="processing">Processing ({totals.counts.processing})</TabsTrigger>
                <TabsTrigger value="paid">Paid ({totals.counts.paid})</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4 space-y-2">
                {loading && (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                )}
                {!loading && filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">No payouts in this view.</p>
                )}
                {!loading && filtered.map((p) => {
                  const dest = payoutDestination(p);
                  const name = [p.affiliate?.first_name, p.affiliate?.last_name].filter(Boolean).join(" ")
                    || p.partner_record?.partner_display_name
                    || p.affiliate?.email || "—";
                  return (
                    <div key={p.id} className="border rounded-lg p-4 grid md:grid-cols-[1fr_auto] gap-3 items-start">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{name}</span>
                          <Badge variant="outline" className={stateColor[p.state] || ""}>{p.state}</Badge>
                          {p.partner_record && <Badge variant="secondary" className="text-[10px]">Linked partner</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                          {p.affiliate?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{p.affiliate.email}</span>}
                          <span>{p.commissions?.length || 0} commission{(p.commissions?.length || 0) === 1 ? "" : "s"}</span>
                          <span>Created {new Date(p.created_at).toLocaleDateString()}</span>
                          {p.paid_at && <span>Paid {new Date(p.paid_at).toLocaleDateString()}</span>}
                        </div>
                        <div className="text-xs flex items-center gap-1 flex-wrap">
                          <span className="text-muted-foreground">Send to:</span>
                          {dest.value ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded">{dest.label} — {dest.value}</code>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <AlertCircle className="h-3 w-3" /> No payout method on file in Rewardful
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:justify-end">
                        <div className="text-right">
                          <p className="text-lg font-bold">{fmt(p.amount, p.currency)}</p>
                          <p className="text-[10px] text-muted-foreground">{p.currency}</p>
                        </div>
                        {p.state !== "paid" && (
                          <Button
                            size="sm"
                            onClick={() => setConfirmPay(p)}
                            disabled={!dest.value}
                            title={!dest.value ? "Partner has no payout method set in Rewardful" : undefined}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />Mark paid
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmPay} onOpenChange={(o) => !o && setConfirmPay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this payout as paid?</AlertDialogTitle>
            <AlertDialogDescription>
              This records the payout (and all its commissions) as paid in Rewardful. Only do this <strong>after</strong> you've actually sent the funds.
              {confirmPay && (
                <div className="mt-3 p-3 rounded border bg-muted/40 text-foreground text-sm space-y-1">
                  <div><strong>Partner:</strong> {[confirmPay.affiliate?.first_name, confirmPay.affiliate?.last_name].filter(Boolean).join(" ") || confirmPay.affiliate?.email}</div>
                  <div><strong>Amount:</strong> {fmt(confirmPay.amount, confirmPay.currency)}</div>
                  <div><strong>Send via:</strong> {payoutDestination(confirmPay).label} — {payoutDestination(confirmPay).value || "—"}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPay && markPaid(confirmPay)} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yes, mark as paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
