import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Tag, Copy, RefreshCw, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";

const FUNCTION_URL = `https://sqwjbndgighjtifijgws.supabase.co/functions/v1/stripe-admin`;

interface PromotionCode {
  id: string;
  code: string;
  active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
  expires_at: string | null;
}

interface Coupon {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  redeem_by: string | null;
  valid: boolean;
  created: string;
  promotion_codes: PromotionCode[];
}

export default function AdminCoupons() {
  const [adminSecret, setAdminSecret] = useState(() => sessionStorage.getItem("stripe_admin_secret") || "");
  const [secretLocked, setSecretLocked] = useState(() => !!sessionStorage.getItem("stripe_admin_secret"));
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Create form
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [durationMonths, setDurationMonths] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [redeemBy, setRedeemBy] = useState("");

  const lockSecret = () => {
    if (!adminSecret.trim()) { toast.error("Enter your admin secret first."); return; }
    sessionStorage.setItem("stripe_admin_secret", adminSecret.trim());
    setSecretLocked(true);
    toast.success("Admin secret saved for this session.");
  };

  const callApi = useCallback(async (body: Record<string, any>) => {
    const secret = sessionStorage.getItem("stripe_admin_secret");
    if (!secret) { toast.error("Admin secret not set."); return null; }
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }, []);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callApi({ action: "list_coupons", params: { limit: 100 } });
      setCoupons(data?.coupons || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  useEffect(() => {
    if (secretLocked) loadCoupons();
  }, [secretLocked, loadCoupons]);

  const resetForm = () => {
    setName(""); setPercentOff(""); setAmountOff(""); setDuration("once");
    setDurationMonths(""); setPromoCode(""); setMaxRedemptions(""); setRedeemBy("");
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    if (discountType === "percent" && !percentOff) { toast.error("Enter a percent off."); return; }
    if (discountType === "amount" && !amountOff) { toast.error("Enter an amount off."); return; }
    if (duration === "repeating" && !durationMonths) { toast.error("Enter duration in months."); return; }

    setCreating(true);
    try {
      const params: any = { name: name.trim(), duration };
      if (discountType === "percent") params.percent_off = Number(percentOff);
      else { params.amount_off = Math.round(Number(amountOff) * 100); params.currency = "usd"; }
      if (duration === "repeating") params.duration_in_months = Number(durationMonths);
      if (promoCode.trim()) params.promo_code = promoCode.trim().toUpperCase();
      if (maxRedemptions) params.max_redemptions = Number(maxRedemptions);
      if (redeemBy) params.redeem_by = redeemBy;

      const data = await callApi({ action: "create_coupon", params });
      toast.success(
        data?.promotion_code
          ? `Coupon created with promo code "${data.promotion_code.code}"`
          : "Coupon created"
      );
      resetForm();
      await loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (couponId: string) => {
    try {
      await callApi({ action: "delete_coupon", params: { coupon_id: couponId } });
      toast.success("Coupon deleted");
      await loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const togglePromoCode = async (promoId: string, active: boolean) => {
    try {
      await callApi({ action: "toggle_promotion_code", params: { promotion_code_id: promoId, active } });
      toast.success(active ? "Promo code activated" : "Promo code deactivated");
      await loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied "${code}"`);
  };

  const formatDiscount = (c: Coupon) => {
    if (c.percent_off) return `${c.percent_off}% off`;
    if (c.amount_off) return `$${(c.amount_off / 100).toFixed(2)} off`;
    return "—";
  };

  const formatDuration = (c: Coupon) => {
    if (c.duration === "once") return "Once";
    if (c.duration === "forever") return "Forever";
    return `${c.duration_in_months} month${c.duration_in_months === 1 ? "" : "s"}`;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage Stripe coupons. Promo codes work automatically at checkout.
          </p>
        </div>

        <AdminTabs />

        {!secretLocked && (
          <Card className="mb-6 border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" /> Admin Secret Required
              </CardTitle>
              <CardDescription>
                Enter your Stripe admin secret to manage coupons. Stored in session only.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                type="password"
                placeholder="STRIPE_ADMIN_SECRET"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lockSecret()}
              />
              <Button onClick={lockSecret}><Lock className="h-4 w-4 mr-2" />Unlock</Button>
            </CardContent>
          </Card>
        )}

        {secretLocked && (
          <>
            {/* Create coupon */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" /> Create New Coupon
                </CardTitle>
                <CardDescription>
                  Create a Stripe coupon. Optionally attach a customer-facing promo code (e.g. "LAUNCH50") that users can enter at checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Internal Name *</Label>
                    <Input
                      placeholder="e.g. Launch 50% Off"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Customer-Facing Promo Code (optional)</Label>
                    <Input
                      placeholder="e.g. LAUNCH50"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      maxLength={50}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Discount Type</Label>
                    <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage off</SelectItem>
                        <SelectItem value="amount">Fixed amount off (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {discountType === "percent" ? (
                    <div>
                      <Label className="text-xs">Percent Off (1–100)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="50"
                        value={percentOff}
                        onChange={(e) => setPercentOff(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Amount Off (USD)</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        placeholder="20.00"
                        value={amountOff}
                        onChange={(e) => setAmountOff(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Duration</Label>
                    <Select value={duration} onValueChange={(v: any) => setDuration(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Once</SelectItem>
                        <SelectItem value="repeating">Repeating</SelectItem>
                        <SelectItem value="forever">Forever</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {duration === "repeating" && (
                  <div className="max-w-xs">
                    <Label className="text-xs">Duration in Months</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="3"
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Max Redemptions (optional)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Unlimited if blank"
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expires On (optional)</Label>
                    <Input
                      type="date"
                      value={redeemBy}
                      onChange={(e) => setRedeemBy(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />
                <div className="flex justify-end">
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Coupon
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* List coupons */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-4 w-4" /> Existing Coupons
                  </CardTitle>
                  <CardDescription>
                    Customers enter promo codes at checkout. Promo codes are enabled in checkout already.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={loadCoupons} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent>
                {loading && coupons.length === 0 && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loading && coupons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No coupons yet. Create one above.
                  </p>
                )}
                <div className="space-y-3">
                  {coupons.map((c) => (
                    <div key={c.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{c.name || c.id}</h3>
                            <Badge variant={c.valid ? "default" : "secondary"}>
                              {c.valid ? "Valid" : "Expired"}
                            </Badge>
                            <Badge variant="outline">{formatDiscount(c)}</Badge>
                            <Badge variant="outline">{formatDuration(c)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{c.id}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Redeemed {c.times_redeemed}
                            {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                            {c.redeem_by ? ` · Expires ${new Date(c.redeem_by).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{c.name || c.id}" will be deleted from Stripe. Existing subscriptions using it keep their discount.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(c.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {c.promotion_codes.length > 0 && (
                        <div className="space-y-2 pl-3 border-l-2 border-muted">
                          <p className="text-xs font-medium text-muted-foreground">Promo Codes:</p>
                          {c.promotion_codes.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{p.code}</code>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyCode(p.code)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Badge variant={p.active ? "default" : "secondary"} className="text-xs">
                                  {p.active ? "Active" : "Inactive"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  Used {p.times_redeemed}{p.max_redemptions ? ` / ${p.max_redemptions}` : ""}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => togglePromoCode(p.id, !p.active)}
                              >
                                {p.active ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
