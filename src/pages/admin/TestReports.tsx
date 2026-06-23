import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BrandRow = {
  id: string;
  name: string;
  user_id: string;
  owner_email: string | null;
  owner_name: string | null;
};

const WINDOWS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
];

export default function AdminTestReports() {
  const [brandId, setBrandId] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [daysWindow, setDaysWindow] = useState<number>(7);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: brands, isLoading } = useQuery({
    queryKey: ["admin-test-reports-brands"],
    queryFn: async (): Promise<BrandRow[]> => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, user_id, profiles!brands_user_id_fkey(email, full_name)")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        user_id: b.user_id,
        owner_email: b.profiles?.email || null,
        owner_name: b.profiles?.full_name || null,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!brands) return [];
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.owner_email?.toLowerCase().includes(q) ||
        b.owner_name?.toLowerCase().includes(q),
    );
  }, [brands, search]);

  const selectedBrand = brands?.find((b) => b.id === brandId);

  // Default recipient to brand owner when brand is picked and recipient empty.
  const handleBrandChange = (id: string) => {
    setBrandId(id);
    const b = brands?.find((x) => x.id === id);
    if (b?.owner_email && !recipient) setRecipient(b.owner_email);
  };

  const handleSend = async () => {
    if (!brandId) return toast.error("Pick a brand");
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
      return toast.error("Enter a valid recipient email");

    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-reports", {
        body: {
          adminTestMode: true,
          brandId,
          recipientEmail: recipient.trim(),
          daysWindow,
        },
      });
      if (error) throw error;
      setLastResult(data);
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.campaignCount === 0) {
        toast.success("Sent — quiet-window note (no campaigns had delivery in that window)");
      } else {
        toast.success(`Sent ${data?.campaignCount} campaign${data?.campaignCount === 1 ? "" : "s"} to ${data?.sentTo}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
      setLastResult({ error: e?.message || "Send failed" });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Test Ad Reports</h1>
          <p className="text-sm text-muted-foreground">
            Send a real weekly ad report for any brand to any email. Uses the same
            engine and template the live Monday cron uses — no gating, doesn't update
            anyone's "last sent" timestamp.
          </p>
        </div>
        <AdminTabs />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Send test report
            </CardTitle>
            <CardDescription>
              Pick a brand, pick a time window, choose where to send it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                placeholder="Search brands by name or owner email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <Select value={brandId} onValueChange={handleBrandChange} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Loading brands…" : "Choose a brand"} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {filtered.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-medium">{b.name}</span>
                      {b.owner_email && (
                        <span className="text-muted-foreground"> · {b.owner_email}</span>
                      )}
                    </SelectItem>
                  ))}
                  {filtered.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
                  )}
                </SelectContent>
              </Select>
              {selectedBrand?.owner_email && (
                <p className="text-xs text-muted-foreground">
                  Owner: {selectedBrand.owner_name || "—"} ({selectedBrand.owner_email})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Time window</Label>
              <div className="flex flex-wrap gap-2">
                {WINDOWS.map((w) => (
                  <button
                    key={w.days}
                    onClick={() => setDaysWindow(w.days)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      daysWindow === w.days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only campaigns with delivery (spend or reach) in this window are included —
                same rule the live email uses.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient">Send to</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="you@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The email goes only to this address — the brand owner is not emailed unless
                you put their address here.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSend} disabled={sending || !brandId || !recipient}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Send test report
                  </>
                )}
              </Button>
              {selectedBrand && (
                <span className="text-xs text-muted-foreground">
                  → {selectedBrand.name}, last {daysWindow}d
                </span>
              )}
            </div>

            {lastResult && (
              <div
                className={cn(
                  "rounded-md border p-3 text-sm",
                  lastResult.error
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {lastResult.error ? (
                  <>Error: {lastResult.error}</>
                ) : (
                  <>
                    Sent to <strong>{lastResult.sentTo}</strong> · {lastResult.campaignCount}{" "}
                    campaign{lastResult.campaignCount === 1 ? "" : "s"} ·{" "}
                    {lastResult.status === "quiet-window"
                      ? "quiet-window template"
                      : "Big Picture template"}{" "}
                    · window: last {lastResult.daysWindow}d
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
