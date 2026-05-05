import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, Loader2, CreditCard, ReceiptText, XCircle, RotateCcw,
  Tag, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface StripeCustomer {
  customer: { id: string; email: string; name: string | null; created: number };
  subscriptions: Array<{
    id: string; status: string; current_period_end: string; plan: string; product: string;
  }>;
  recent_invoices: Array<{
    id: string; status: string; amount_due: number; currency: string; created: string; hosted_invoice_url: string | null;
  }>;
}

export default function AdminStripe() {
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState<StripeCustomer | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Action inputs
  const [couponId, setCouponId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const callStripeAdmin = useCallback(async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("stripe-admin", { body });
    if (error) throw new Error(error.message || "Request failed");
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const lookupCustomer = async () => {
    if (!email.trim()) { toast.error("Enter a customer email."); return; }
    setLoading(true);
    setCustomer(null);
    try {
      const data = await callStripeAdmin({ action: "get_customer", email: email.trim() });
      setCustomer(data);
      toast.success("Customer found.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: string, params?: Record<string, any>) => {
    setActionLoading(action);
    try {
      const body: Record<string, any> = { action, email: customer!.customer.email };
      if (params) body.params = params;
      await callStripeAdmin(body);
      toast.success(`${action.replace(/_/g, " ")} completed.`);
      // Refresh customer data
      const refreshed = await callStripeAdmin({ action: "get_customer", email: customer!.customer.email });
      setCustomer(refreshed);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const activeSub = customer?.subscriptions?.find(s => s.status === "active");

  return (
    <DashboardLayout>
      <AdminTabs />
      <div className="space-y-6 max-w-3xl">

        {/* Customer Lookup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4" /> Customer Lookup</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="customer@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupCustomer()}
            />
            <Button onClick={lookupCustomer} disabled={loading || !secretLocked}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look Up"}
            </Button>
          </CardContent>
        </Card>

        {/* Customer Info */}
        {customer && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> {customer.customer.name || "No Name"}</CardTitle>
                <CardDescription>{customer.customer.email} · <span className="font-mono text-xs">{customer.customer.id}</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeSub ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground">Active</Badge>
                      <span className="text-sm text-muted-foreground">Renews {new Date(activeSub.current_period_end).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">Price: {activeSub.plan} · Product: {activeSub.product}</p>
                  </div>
                ) : (
                  <Badge variant="secondary">No active subscription</Badge>
                )}

                {customer.subscriptions.filter(s => s.status !== "active").map(s => (
                  <div key={s.id} className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-1">{s.status}</Badge> {s.id}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
                <CardDescription>All actions apply to the loaded customer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Apply Coupon */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><Tag className="h-3 w-3" /> Apply Coupon</Label>
                  <div className="flex gap-2">
                    <Input placeholder="coupon_id" value={couponId} onChange={e => setCouponId(e.target.value)} className="max-w-[240px]" />
                    <Button size="sm" disabled={!couponId || actionLoading === "apply_coupon" || !activeSub} onClick={() => runAction("apply_coupon", { coupon_id: couponId })}>
                      {actionLoading === "apply_coupon" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Update Price */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><DollarSign className="h-3 w-3" /> Update Subscription Price</Label>
                  <div className="flex gap-2">
                    <Input placeholder="price_xxxxxxx" value={priceId} onChange={e => setPriceId(e.target.value)} className="max-w-[240px]" />
                    <Button size="sm" disabled={!priceId || actionLoading === "update_subscription_price" || !activeSub} onClick={() => runAction("update_subscription_price", { price_id: priceId })}>
                      {actionLoading === "update_subscription_price" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Resend Receipt */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1"><ReceiptText className="h-3 w-3" /> Resend Latest Receipt</Label>
                  <Button size="sm" variant="outline" disabled={actionLoading === "resend_receipt"} onClick={() => runAction("resend_receipt")}>
                    {actionLoading === "resend_receipt" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend"}
                  </Button>
                </div>

                <Separator />

                {/* Cancel */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancel Subscription</Label>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={!activeSub || actionLoading === "cancel_subscription"}>
                        {actionLoading === "cancel_subscription" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                        <AlertDialogDescription>This will cancel at the end of the current billing period.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={() => runAction("cancel_subscription")}>Confirm Cancel</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <Separator />

                {/* Refund */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Refund</Label>
                  <div className="flex gap-2 items-end">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Amount in $ (blank = full)</span>
                      <Input placeholder="e.g. 49.99" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} className="max-w-[140px]" type="number" min="0" step="0.01" />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={actionLoading === "refund"}>
                          {actionLoading === "refund" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refund"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Process refund?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {refundAmount ? `Refund $${refundAmount} to this customer.` : "Issue a full refund for the latest payment."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Back</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                            const params: Record<string, any> = {};
                            if (refundAmount) params.amount = Math.round(parseFloat(refundAmount) * 100);
                            runAction("refund", Object.keys(params).length ? params : undefined);
                          }}>Confirm Refund</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Invoices */}
            {customer.recent_invoices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {customer.recent_invoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                        <div>
                          <span className="font-mono text-xs">{inv.id}</span>
                          <span className="ml-2 text-muted-foreground">{new Date(inv.created).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge>
                          <span className="font-medium">${(inv.amount_due / 100).toFixed(2)} {inv.currency.toUpperCase()}</span>
                          {inv.hosted_invoice_url && (
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
