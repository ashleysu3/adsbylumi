import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, RotateCw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ClientActivityFeedProps {
  workspaceId: string;
  portalName?: string;
}

interface ActivityRow {
  id: string;
  action: string;
  production_item_id: string;
  comment: string | null;
  client_name: string | null;
  created_at: string;
}

const actionConfig: Record<string, { icon: typeof CheckCircle2; label: string; emoji: string }> = {
  approved: { icon: CheckCircle2, label: "Approved", emoji: "✅" },
  changes_requested: { icon: RotateCw, label: "Changes Requested", emoji: "🔄" },
  viewed: { icon: Eye, label: "Viewed", emoji: "👀" },
};

export function ClientActivityFeed({ workspaceId, portalName }: ClientActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [portalId, setPortalId] = useState<string | null>(null);

  const fetchPortalAndActivity = async () => {
    // Find portal for this workspace
    const { data: portals } = await supabase
      .from('client_portals')
      .select('id, portal_name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!portals || portals.length === 0) {
      setPortalId(null);
      return;
    }

    const portal = portals[0];
    setPortalId(portal.id);

    // Fetch activity
    const { data: activityData } = await supabase
      .from('client_portal_activity')
      .select('*')
      .eq('portal_id', portal.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setActivities((activityData as ActivityRow[]) || []);
  };

  useEffect(() => {
    fetchPortalAndActivity();

    // Poll every 30 seconds
    const interval = setInterval(fetchPortalAndActivity, 30000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  if (!portalId) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Client Activity
          {portalName && (
            <Badge variant="outline" className="text-xs font-normal">{portalName}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No activity yet — your client hasn't opened the portal.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activities.map((activity) => {
              const config = actionConfig[activity.action] || actionConfig.viewed;
              return (
                <div key={activity.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                  <span className="text-sm mt-0.5">{config.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-muted-foreground ml-1">
                        · {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </p>
                    {activity.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic bg-muted/50 rounded px-2 py-1">
                        "{activity.comment}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
