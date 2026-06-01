import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, MousePointer, Send } from "lucide-react";

export default function AdminUpdatesResults() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [sends, setSends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([
          supabase.from("newsletter_campaigns").select("*").eq("id", campaignId).maybeSingle(),
          supabase.from("newsletter_sends").select("*").eq("campaign_id", campaignId).order("sent_at", { ascending: false }),
        ]);
        setCampaign(c.data);
        setSends(s.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  const total = sends.length;
  const opened = sends.filter((s) => s.opened_at).length;
  const clicked = sends.filter((s) => s.clicked_at).length;
  const userSends = sends.filter((s) => s.variant === "user");
  const partnerSends = sends.filter((s) => s.variant === "partner");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/updates")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-3xl font-bold">{campaign?.month_label || "Campaign"} · Results</h1>
        <AdminTabs />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><Stat icon={<Send />} label="Sent" value={total} /></CardContent></Card>
          <Card><CardContent className="pt-6"><Stat icon={<Eye />} label="Opens" value={opened} sub={total ? `${Math.round((opened/total)*100)}%` : ""} /></CardContent></Card>
          <Card><CardContent className="pt-6"><Stat icon={<MousePointer />} label="Clicks" value={clicked} sub={total ? `${Math.round((clicked/total)*100)}%` : ""} /></CardContent></Card>
          <Card><CardContent className="pt-6"><Stat label="Users / Partners" value={`${userSends.length} / ${partnerSends.length}`} /></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recipients</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left py-2">Email</th><th>Variant</th><th>Sent</th><th>Opened</th><th>Clicks</th><th>Resent</th></tr>
                </thead>
                <tbody>
                  {sends.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="py-2">{s.recipient_email}</td>
                      <td className="text-center"><Badge variant="outline">{s.variant}</Badge></td>
                      <td className="text-center text-xs">{new Date(s.sent_at).toLocaleDateString()}</td>
                      <td className="text-center">{s.opened_at ? "✓" : "—"}</td>
                      <td className="text-center">{s.click_count || 0}</td>
                      <td className="text-center">{s.resent_at ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Stat({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: any; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon && <div className="text-primary">{icon}</div>}
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}{sub && ` · ${sub}`}</div>
      </div>
    </div>
  );
}
