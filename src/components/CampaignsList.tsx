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
import { ArrowRight, Plus, MoreVertical, Archive, ArchiveRestore, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { AdsEmptyState } from "./AdsEmptyState";
import { CampaignDetailDrawer } from "./CampaignDetailDrawer";

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
  addCreativeMode?: boolean;
  onCampaignSelectForCreative?: (campaignId: string) => void;
}

export function CampaignsList({ brandId, addCreativeMode = false, onCampaignSelectForCreative }: CampaignsListProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [campaignToArchive, setCampaignToArchive] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

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

      // Filter campaigns based on offer archive status (if not showing archived)
      if (data && data.length > 0 && !showArchived) {
        const filteredCampaigns = await Promise.all(
          data.map(async (campaign) => {
            if (!campaign.offer_name) return campaign;
            
            // Check if offer is archived
            const { data: offer } = await supabase
              .from('offers')
              .select('archived')
              .eq('brand_id', brandId)
              .eq('name', campaign.offer_name)
              .maybeSingle();
            
            // Show campaign if:
            // 1. Offer doesn't exist in offers table (legacy)
            // 2. Offer is not archived
            // 3. Campaign is live/completed (performance tracking)
            if (!offer || 
                !offer.archived || 
                ['live', 'completed'].includes(campaign.progress_status)) {
              return campaign;
            }
            
            return null;
          })
        );

        setCampaigns(filteredCampaigns.filter(Boolean) as Campaign[]);
      } else {
        setCampaigns(data || []);
      }
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

  const isPublished = (status: string) => {
    return ['live', 'completed'].includes(status);
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  const getNavigationRoute = (campaign: Campaign): string => {
    switch (campaign.progress_status) {
      case 'draft':
      case 'creative_in_progress':
        return `/creative?workspace=${campaign.id}`;
      
      case 'waiting_for_assets':
        return `/production?workspace=${campaign.id}`;
      
      case 'ready_to_publish':
      case 'publishing_to_meta':
        return `/campaigns/build?workspace=${campaign.id}`;
      
      case 'live':
      case 'completed':
        return '/data';
      
      default:
        return `/creative?workspace=${campaign.id}`;
    }
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
    <Card variant="glow">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg md:text-xl">My Campaigns</CardTitle>
            <CardDescription className="text-sm">Active and draft campaign workspaces</CardDescription>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-xs md:text-sm cursor-pointer whitespace-nowrap">
                Archived
              </Label>
            </div>
            <Button onClick={() => navigate("/planning")} size="sm" className="h-9">
              <Plus className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">New Campaign</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 md:px-6">
        {campaigns.length === 0 ? (
          <AdsEmptyState />
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Card
                key={campaign.id}
                variant="glow"
                className={`transition-all duration-300 ${campaign.archived ? 'opacity-60' : ''} ${
                  addCreativeMode 
                    ? 'cursor-pointer border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10' 
                    : ''
                }`}
                onClick={() => {
                  if (addCreativeMode && onCampaignSelectForCreative) {
                    onCampaignSelectForCreative(campaign.id);
                  }
                }}
              >
                <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-4">
                  <div className="flex items-start justify-between gap-2 md:gap-4">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={(e) => {
                        if (!addCreativeMode) {
                          e.stopPropagation();
                          // Direct navigation for in-progress creative campaigns
                          if (['draft', 'creative_in_progress', 'waiting_for_assets'].includes(campaign.progress_status)) {
                            navigate(`/creative-studio?workspace=${campaign.id}`);
                            return;
                          }
                          setSelectedCampaignId(campaign.id);
                          setDetailDrawerOpen(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h4 className="font-semibold text-sm md:text-base truncate">{campaign.name}</h4>
                        {addCreativeMode && (
                          <Badge className="bg-primary/20 text-primary border border-primary/30 gap-1 text-xs">
                            <ImagePlus className="h-3 w-3" />
                            <span className="hidden sm:inline">Select to add creative</span>
                            <span className="sm:hidden">Add</span>
                          </Badge>
                        )}
                        {campaign.archived && (
                          <Badge variant="outline" className="text-xs">Archived</Badge>
                        )}
                        {!isPublished(campaign.progress_status) && !addCreativeMode && (
                          <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 dark:text-yellow-400 text-xs">
                            Draft
                          </Badge>
                        )}
                        <Badge className={`${getStatusColor(campaign.progress_status)} text-xs`}>
                          <span className="hidden sm:inline">{getStatusLabel(campaign.progress_status)}</span>
                          <span className="sm:hidden">{getStatusLabel(campaign.progress_status).split(' ')[0]}</span>
                        </Badge>
                      </div>
                      {campaign.offer_name && (
                        <p className="text-xs md:text-sm text-muted-foreground truncate">
                          {campaign.offer_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated {new Date(campaign.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!addCreativeMode && (
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
                          onClick={(e) => {
                            e.stopPropagation();
                            // Direct navigation for in-progress creative campaigns
                            if (['draft', 'creative_in_progress', 'waiting_for_assets'].includes(campaign.progress_status)) {
                              navigate(`/creative-studio?workspace=${campaign.id}`);
                              return;
                            }
                            setSelectedCampaignId(campaign.id);
                            setDetailDrawerOpen(true);
                          }}
                        >
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                    {addCreativeMode && (
                      <div className="flex items-center">
                        <ArrowRight className="h-5 w-5 text-primary" />
                      </div>
                    )}
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

      {/* Campaign Detail Drawer */}
      <CampaignDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        campaignId={selectedCampaignId}
        onUpdate={fetchCampaigns}
      />
    </Card>
  );
}