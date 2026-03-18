import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, XCircle } from "lucide-react";

interface CancellationRequest {
  id: string;
  user_id: string;
  created_at: string;
  reason: string;
  stripe_subscription_id: string | null;
  user_email: string | null;
  user_name: string | null;
  tier_at_cancellation: string | null;
  period_end: string | null;
}

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  not_using: "Not using it",
  missing_features: "Missing features",
  switching_tools: "Switching tools",
  other: "Other",
};

export default function AdminCancellations() {
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data, error } = await (supabase.from("cancellation_requests" as any) as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching cancellation requests:", error);
      } else {
        setRequests(data || []);
      }
      setLoading(false);
    };
    fetchRequests();
  }, []);

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
              <XCircle className="h-5 w-5 text-destructive" />
              Cancellation Requests
            </CardTitle>
            <CardDescription>
              Users who cancelled their subscription, including their reason
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No cancellation requests yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">User</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Reason</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Plan</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Cancelled</th>
                      <th className="pb-2 font-medium text-muted-foreground">Access Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-medium">{req.user_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{req.user_email || "—"}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary">
                            {REASON_LABELS[req.reason] || req.reason}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 capitalize">
                          {req.tier_at_cancellation || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {req.period_end
                            ? new Date(req.period_end).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
