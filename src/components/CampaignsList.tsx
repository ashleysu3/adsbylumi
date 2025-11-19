import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  progress_status: string;
  offer_name: string | null;
  created_at: string;
  updated_at: string;
}

interface CampaignsListProps {
  brandId: string;
}

export function CampaignsList({ brandId }: CampaignsListProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetchCampaigns();
  }, [brandId]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("id, name, progress_status, offer_name, created_at, updated_at")
        .eq("brand_id", brandId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-secondary",
      creative_in_progress: "bg-blue-500",
      waiting_for_assets: "bg-yellow-500",
      ready_to_publish: "bg-green-500",
      publishing_to_meta: "bg-purple-500",
      live: "bg-primary",
      completed: "bg-gray-500",
    };
    return colors[status] || "bg-secondary";
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>My Campaigns</CardTitle>
            <CardDescription>Active and draft campaign workspaces</CardDescription>
          </div>
          <Button onClick={() => navigate("/planning")}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <Button onClick={() => navigate("/planning")}>
              Create Your First Campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Card
                key={campaign.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/workspace/${campaign.id}`)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{campaign.name}</h4>
                        <Badge className={getStatusColor(campaign.progress_status)}>
                          {getStatusLabel(campaign.progress_status)}
                        </Badge>
                      </div>
                      {campaign.offer_name && (
                        <p className="text-sm text-muted-foreground">
                          {campaign.offer_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated {new Date(campaign.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}