import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowRight, Plus, MoreVertical, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  progress_status: string;
  offer_name: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
}

interface CampaignsListProps {
  brandId: string;
}

export function CampaignsList({ brandId }: CampaignsListProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [campaignToArchive, setCampaignToArchive] = useState<Campaign | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, [brandId, showArchived]);

  const fetchCampaigns = async () => {
    try {
      let query = supabase
        .from("campaign_workspaces")
        .select("id, name, progress_status, offer_name, created_at, updated_at, archived, archived_at")
        .eq("brand_id", brandId);

      if (!showArchived) {
        query = query.eq("archived", false);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveCampaign = async () => {
    if (!campaignToArchive) return;

    try {
      const isArchiving = !campaignToArchive.archived;
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({
          archived: isArchiving,
          archived_at: isArchiving ? new Date().toISOString() : null,
        })
        .eq("id", campaignToArchive.id);

      if (error) throw error;

      toast.success(isArchiving ? "Campaign archived" : "Campaign restored");
      fetchCampaigns();
    } catch (error: any) {
      console.error("Error archiving campaign:", error);
      toast.error(error.message || "Failed to update campaign");
    } finally {
      setArchiveDialogOpen(false);
      setCampaignToArchive(null);
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm cursor-pointer">
                Show Archived
              </Label>
            </div>
            <Button onClick={() => navigate("/planning")}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
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
                className={`hover:border-primary/50 transition-colors ${campaign.archived ? 'opacity-60' : ''}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/workspace/${campaign.id}`)}
                    >
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h4 className="font-semibold">{campaign.name}</h4>
                        {campaign.archived && (
                          <Badge variant="outline">Archived</Badge>
                        )}
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
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToArchive(campaign);
                              setArchiveDialogOpen(true);
                            }}
                          >
                            {campaign.archived ? (
                              <>
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                Restore Campaign
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive Campaign
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => navigate(`/workspace/${campaign.id}`)}
                      >
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {campaignToArchive?.archived ? "Restore Campaign" : "Archive Campaign"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToArchive?.archived
                ? `Are you sure you want to restore "${campaignToArchive?.name}"?`
                : `Are you sure you want to archive "${campaignToArchive?.name}"? You can restore it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveCampaign}>
              {campaignToArchive?.archived ? "Restore" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}