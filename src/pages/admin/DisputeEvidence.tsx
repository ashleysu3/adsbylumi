import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Loader2, Shield, Copy, Printer, User, CreditCard,
  Calendar, FileText, AlertTriangle, CheckCircle, XCircle
} from "lucide-react";
import { toast } from "sonner";

interface StripeData {
  customer: { id: string; email: string; name: string; created: string };
  subscriptions: any[];
  charges: any[];
  invoices: any[];
  disputes: any[];
}

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string | null;
  policy_acknowledged_at: string | null;
  is_beta_user: boolean;
}

interface SubData {
  tier: string;
  status: string;
  created_at: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

interface CancelRequest {
  id: string;
  created_at: string;
  reason: string;
  stripe_subscription_id: string | null;
  tier_at_cancellation: string | null;
  period_end: string | null;
}

export default function DisputeEvidence() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subData, setSubData] = useState<SubData | null>(null);
  const [stripeData, setStripeData] = useState<StripeData | null>(null);
  const [cancelRequests, setCancelRequests] = useState<CancelRequest[]>([]);
  const [supportNotes, setSupportNotes] = useState("");
  const [disputeSummary, setDisputeSummary] = useState("");
  const summaryRef = useRef<HTMLTextAreaElement>(null);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const formatCurrency = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (!adminSecret.trim()) { toast.error("Enter admin secret first."); return; }

    setLoading(true);
    setProfile(null);
    setSubData(null);
    setStripeData(null);
    setCancelRequests([]);
    setDisputeSummary("");

    try {
      // Search profiles by email or name
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, policy_acknowledged_at, is_beta_user")
        .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(1);

      if (!profiles || profiles.length === 0) {
        toast.error("No user found matching that query.");
        setLoading(false);
        return;
      }

      const p = profiles[0] as ProfileData;
      setProfile(p);

      // Fetch subscription, cancellation requests, and Stripe data in parallel
      const [subResult, cancelResult, stripeResult] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("user_id", p.id).limit(1).single(),
        (supabase.from("cancellation_requests" as any) as any).select("*").eq("user_id", p.id).order("created_at", { ascending: false }),
        supabase.functions.invoke("stripe-admin", {
          headers: { "x-admin-secret": adminSecret },
          body: { action: "get_dispute_evidence", email: p.email },
        }),
      ]);

      if (subResult.data) setSubData(subResult.data as unknown as SubData);
      if (cancelResult.data) setCancelRequests(cancelResult.data || []);
      if (stripeResult.data && !stripeResult.data.error) {
        setStripeData(stripeResult.data as StripeData);
      } else if (stripeResult.data?.error) {
        toast.error(`Stripe: ${stripeResult.data.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = () => {
    if (!profile) return;

    const lines: string[] = [];
    lines.push("═══════════════════════════════════════");
    lines.push("       DISPUTE EVIDENCE SUMMARY");
    lines.push("       Your Ad Assistant (LUMI)");
    lines.push(`       Generated: ${new Date().toLocaleDateString()}`);
    lines.push("═══════════════════════════════════════");
    lines.push("");

    // Account info
    lines.push("1. ACCOUNT INFORMATION");
    lines.push("───────────────────────────────────────");
    lines.push(`Name:            ${profile.full_name || "Not provided"}`);
    lines.push(`Email:           ${profile.email}`);
    lines.push(`Signup Date:     ${formatDate(profile.created_at)}`);
    lines.push(`Plan:            ${subData?.tier?.toUpperCase() || "N/A"}`);
    lines.push(`Status:          ${subData?.status || "N/A"}`);
    lines.push(`Founding Member: ${profile.is_beta_user ? "Yes" : "No"}`);
    lines.push("");

    // Billing history
    lines.push("2. BILLING HISTORY (ALL CHARGES)");
    lines.push("───────────────────────────────────────");
    if (stripeData?.charges?.length) {
      stripeData.charges.forEach((c) => {
        const refundNote = c.refunded ? ` [REFUNDED: ${formatCurrency(c.amount_refunded, c.currency)}]` : "";
        const disputeNote = c.disputed ? " [DISPUTED]" : "";
        lines.push(`${formatDate(c.created)}  ${formatCurrency(c.amount, c.currency)}  ${c.status.toUpperCase()}${refundNote}${disputeNote}`);
      });
    } else {
      lines.push("No charges on record.");
    }
    lines.push("");

    // Subscription log
    lines.push("3. SUBSCRIPTION STATUS LOG");
    lines.push("───────────────────────────────────────");
    if (stripeData?.subscriptions?.length) {
      stripeData.subscriptions.forEach((s: any) => {
        lines.push(`Subscription: ${s.id}`);
        lines.push(`  Created:     ${formatDate(s.created)}`);
        lines.push(`  Status:      ${s.status.toUpperCase()}`);
        lines.push(`  Amount:      ${s.amount ? formatCurrency(s.amount) : "N/A"}/${s.interval || "month"}`);
        if (s.canceled_at) lines.push(`  Cancelled:   ${formatDate(s.canceled_at)}`);
        if (s.ended_at) lines.push(`  Ended:       ${formatDate(s.ended_at)}`);
        lines.push("");
      });
    } else {
      lines.push("No subscription records found.");
    }
    lines.push("");

    // Cancellation requests
    lines.push("4. CANCELLATION REQUEST LOG");
    lines.push("───────────────────────────────────────");
    if (cancelRequests.length > 0) {
      cancelRequests.forEach((cr) => {
        lines.push(`Date:      ${formatDate(cr.created_at)}`);
        lines.push(`Reason:    ${cr.reason}`);
        lines.push(`Plan:      ${cr.tier_at_cancellation || "N/A"}`);
        lines.push(`Access Until: ${formatDate(cr.period_end)}`);
        lines.push("");
      });
    } else {
      lines.push("No cancellation request on record.");
    }
    lines.push("");

    // Policy acknowledgment
    lines.push("5. POLICY ACKNOWLEDGMENT");
    lines.push("───────────────────────────────────────");
    if (profile.policy_acknowledged_at) {
      lines.push(`Acknowledged at: ${formatDate(profile.policy_acknowledged_at)}`);
      lines.push("The customer acknowledged the cancellation policy and billing terms.");
    } else {
      lines.push("No policy acknowledgment on record.");
    }
    lines.push("");

    // Support notes
    lines.push("6. SUPPORT CONTACT LOG");
    lines.push("───────────────────────────────────────");
    lines.push(supportNotes.trim() || "No support interactions noted.");
    lines.push("");

    // Active disputes
    if (stripeData?.disputes?.length) {
      lines.push("7. ACTIVE DISPUTES");
      lines.push("───────────────────────────────────────");
      stripeData.disputes.forEach((d) => {
        lines.push(`Dispute: ${d.id}`);
        lines.push(`  Amount:  ${formatCurrency(d.amount, d.currency)}`);
        lines.push(`  Reason:  ${d.reason}`);
        lines.push(`  Status:  ${d.status}`);
        lines.push(`  Created: ${formatDate(d.created)}`);
        lines.push("");
      });
    }

    lines.push("═══════════════════════════════════════");
    lines.push("End of Dispute Evidence Summary");

    const summary = lines.join("\n");
    setDisputeSummary(summary);
    toast.success("Dispute summary generated.");
  };

  const copySummary = () => {
    navigator.clipboard.writeText(disputeSummary);
    toast.success("Copied to clipboard!");
  };

  const printSummary = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;padding:40px;">${disputeSummary}</pre>`);
    w.document.close();
    w.print();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient-lumi">Admin Dashboard</span>
          </h1>
        </div>

        <AdminTabs />

        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Dispute Evidence Tool
            </CardTitle>
            <CardDescription>
              Search a user to compile billing evidence for Stripe dispute rebuttals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Admin Secret</Label>
                <Input
                  type="password"
                  placeholder="Enter STRIPE_ADMIN_SECRET"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Search by email or name</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="user@example.com"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {profile && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Account Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Account Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{profile.full_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{profile.email}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Signup</span><span>{formatDate(profile.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><Badge variant="secondary" className="capitalize">{subData?.tier || "None"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={subData?.status === "active" ? "default" : "secondary"}>{subData?.status || "—"}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Founding Member</span><span>{profile.is_beta_user ? "✅ Yes" : "No"}</span></div>
              </CardContent>
            </Card>

            {/* Policy Acknowledgment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Policy Acknowledgment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.policy_acknowledged_at ? (
                  <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Acknowledged on {formatDate(profile.policy_acknowledged_at)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>No policy acknowledgment on record</span>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="space-y-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Cancellation Requests
                  </CardTitle>
                  {cancelRequests.length > 0 ? (
                    cancelRequests.map((cr) => (
                      <div key={cr.id} className="p-3 rounded-lg bg-muted text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{formatDate(cr.created_at)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><Badge variant="secondary">{cr.reason}</Badge></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="capitalize">{cr.tier_at_cancellation || "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Access until</span><span>{formatDate(cr.period_end)}</span></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No cancellation request on record.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Billing History — All Charges
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stripeData?.charges?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Amount</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Refunded</th>
                          <th className="pb-2 font-medium text-muted-foreground">Disputed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stripeData.charges.map((c: any) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">{formatDate(c.created)}</td>
                            <td className="py-2 pr-4 font-medium">{formatCurrency(c.amount, c.currency)}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={c.status === "succeeded" ? "default" : "secondary"} className="text-xs">
                                {c.status}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4">
                              {c.refunded ? <span className="text-destructive">{formatCurrency(c.amount_refunded, c.currency)}</span> : "—"}
                            </td>
                            <td className="py-2">
                              {c.disputed ? <Badge variant="destructive" className="text-xs">Disputed</Badge> : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No charges found{!stripeData ? " (Stripe data not loaded)" : ""}.</p>
                )}
              </CardContent>
            </Card>

            {/* Subscription Log */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Subscription Status Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stripeData?.subscriptions?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">ID</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Created</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Amount</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Cancelled</th>
                          <th className="pb-2 font-medium text-muted-foreground">Ended</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stripeData.subscriptions.map((s: any) => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">{s.id.slice(0, 20)}…</td>
                            <td className="py-2 pr-4">{formatDate(s.created)}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs capitalize">{s.status}</Badge>
                            </td>
                            <td className="py-2 pr-4">{s.amount ? formatCurrency(s.amount) : "—"}/{s.interval || "mo"}</td>
                            <td className="py-2 pr-4">{formatDate(s.canceled_at)}</td>
                            <td className="py-2">{formatDate(s.ended_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No subscription records found.</p>
                )}
              </CardContent>
            </Card>

            {/* Support Notes */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Support Contact Log</CardTitle>
                <CardDescription>Manually note any support interactions for this user</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="E.g., User emailed on Jan 15 asking about billing. Replied same day with invoice link..."
                  value={supportNotes}
                  onChange={(e) => setSupportNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            {/* Generate Summary */}
            <Card className="lg:col-span-2 border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Dispute Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={generateSummary} variant="lumi" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Generate Dispute Summary
                </Button>

                {disputeSummary && (
                  <>
                    <Textarea
                      ref={summaryRef}
                      value={disputeSummary}
                      onChange={(e) => setDisputeSummary(e.target.value)}
                      className="min-h-[400px] font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button onClick={copySummary} variant="outline" size="sm" className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy to Clipboard
                      </Button>
                      <Button onClick={printSummary} variant="outline" size="sm" className="gap-2">
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
