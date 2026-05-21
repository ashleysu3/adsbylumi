import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowRight, Plus, MoreVertical, Archive, ArchiveRestore, ImagePlus, Upload, Merge, Radio, FileEdit, RefreshCw, Loader2, Package, PenTool, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { AdsEmptyState } from "./AdsEmptyState";
import { CampaignDetailDrawer } from "./CampaignDetailDrawer";
import { SocialGrowthFlow } from "./SocialGrowthFlow";
import { getStatusLabel } from "@/lib/campaign-status-labels";

// Social template slugs — these use existing posts, not custom creative
const SOCIAL_POST_SLUGS = ["social-traffic", "comment-dm-engagement"];

interface Campaign {
  id: string;
  name: string;
  progress_status: string;
  meta_campaign_status: string | null;
  meta_campaign_ids: any | null;
  offer_name: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
  template_id: string | null;
  template_slug?: string | null;
}

// A workspace is only "really" published to Meta if it has a real campaign ID
const hasRealMetaCampaign = (metaCampaignIds: any): boolean => {
  if (!metaCampaignIds || typeof metaCampaignIds !== 'object') return false;
  const id = metaCampaignIds.campaignId || metaCampaignIds.campaign_id;
  return typeof id === 'string' && /^\d{6,}$/.test(id);
};

interface CampaignsListProps {
  brandId: string;
  addCreativeMode?: boolean;
  onCampaignSelectForCreative?: (campaignId: string) => void;
}

type ViewFilter = "all" | "draft" | "live";

export function CampaignsList({ brandId, addCreativeMode = false, onCampaignSelectForCreative }: CampaignsListProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [campaignToArchive, setCampaignToArchive] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  // Combine mode
  const [combineMode, setCombineMode] = useState(false);
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set());
  const [combineDialogOpen, setCombineDialogOpen] = useState(false);
  const [combining, setCombining] = useState(false);
  // Post picker for social campaigns
  const [postPickerOpen, setPostPickerOpen] = useState(false);
  const [postPickerCampaign, setPostPickerCampaign] = useState<Campaign | null>(null);
  const [postPickerBrand, setPostPickerBrand] = useState<any>(null);
  const [addingPosts, setAddingPosts] = useState(false);
  const [actionDialogCampaign, setActionDialogCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, [brandId, showArchived]);

  const fetchCampaigns = async () => {
    try {
      let query = supabase
        .from("campaign_workspaces")
        .select("id, name, progress_status, meta_campaign_status, meta_campaign_ids, offer_name, created_at, updated_at, archived, archived_at, template_id")
        .eq("brand_id", brandId);

      if (!showArchived) {
        query = query.eq("archived", false);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;

      // Enrich with template slugs
      let enriched = (data || []) as Campaign[];
      if (enriched.length > 0) {
        const templateIds = [...new Set(enriched.filter(c => c.template_id).map(c => c.template_id!))];
        if (templateIds.length > 0) {
          const { data: templates } = await supabase
            .from("campaign_templates")
            .select("id, slug")
            .in("id", templateIds);
          const slugMap = new Map((templates || []).map(t => [t.id, t.slug]));
          enriched = enriched.map(c => ({ ...c, template_slug: c.template_id ? slugMap.get(c.template_id) || null : null }));
        }
      }

      // Filter out campaigns whose offers are archived (unless showing archived)
      if (enriched.length > 0 && !showArchived) {
        const filtered = await Promise.all(
          enriched.map(async (campaign) => {
            if (!campaign.offer_name) return campaign;
            const { data: offer } = await supabase
              .from('offers')
              .select('archived')
              .eq('brand_id', brandId)
              .eq('name', campaign.offer_name)
              .maybeSingle();
            const effectivelyLive = ['live', 'completed', 'publishing_to_meta'].includes(campaign.progress_status) || campaign.meta_campaign_status === 'active';
            if (!offer || !offer.archived || effectivelyLive) {
              return campaign;
            }
            return null;
          })
        );
        setCampaigns(filtered.filter(Boolean) as Campaign[]);
      } else {
        setCampaigns(enriched);
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

  const isSocialCampaign = (campaign: Campaign) => {
    return campaign.template_slug && SOCIAL_POST_SLUGS.includes(campaign.template_slug);
  };

  const isLive = (status: string, metaStatus?: string | null, metaCampaignIds?: any) => {
    const claimsLive = ['live', 'completed', 'publishing_to_meta'].includes(status) || metaStatus === 'active';
    // Only consider it truly live if a real Meta campaign ID is attached
    return claimsLive && hasRealMetaCampaign(metaCampaignIds);
  };
  const isDraft = (status: string, metaStatus?: string | null, metaCampaignIds?: any) => !isLive(status, metaStatus, metaCampaignIds);

  const getStatusDot = (status: string, metaStatus?: string | null, metaCampaignIds?: any) => {
    if (isLive(status, metaStatus, metaCampaignIds)) return 'bg-green-500';
    if (status === 'ready_to_publish') return 'bg-amber-400';
    return 'bg-muted-foreground/40';
  };

  const getStatusLabelForDisplay = (status: string, metaStatus?: string | null, metaCampaignIds?: any) => {
    if (isLive(status, metaStatus, metaCampaignIds)) return 'Running Live ✅';
    return getStatusLabel(status);
  };

  const handleArrowClick = (campaign: Campaign) => {
    if (isSocialCampaign(campaign)) {
      openPostPicker(campaign);
      return;
    }
    if (['draft', 'creative_in_progress', 'waiting_for_assets'].includes(campaign.progress_status)) {
      navigate(`/creative-studio?workspace=${campaign.id}`);
      return;
    }
    if (isLive(campaign.progress_status, campaign.meta_campaign_status, campaign.meta_campaign_ids)) {
      setActionDialogCampaign(campaign);
      return;
    }
    setSelectedCampaignId(campaign.id);
    setDetailDrawerOpen(true);
  };

  const openPostPicker = async (campaign: Campaign) => {
    setPostPickerCampaign(campaign);
    setPostPickerOpen(true);
    // Fetch brand data for Instagram info
    try {
      const { data: brand } = await supabase
        .from('brands')
        .select('id, name, instagram_account_id, instagram_account_name, audience_psychology')
        .eq('id', brandId)
        .single();
      setPostPickerBrand(brand);
    } catch (e) {
      console.error('Error fetching brand for post picker:', e);
    }
  };

  const handlePostsSelected = async (data: { objective: string; selectedPosts: any[] }) => {
    if (!postPickerCampaign || !data.selectedPosts.length) return;
    setAddingPosts(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('add-posts-to-campaign', {
        body: {
          workspaceId: postPickerCampaign.id,
          posts: data.selectedPosts.map(p => ({
            id: p.id,
            media_type: p.media_type,
            caption: p.caption || '',
            instagram_account_id: p.instagram_account_id,
          })),
        },
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.message || 'Failed to add posts');
      toast.success(result.message || `Added ${data.selectedPosts.length} post(s) to your campaign!`);
      setPostPickerOpen(false);
      setPostPickerCampaign(null);
      fetchCampaigns();
    } catch (err: any) {
      console.error('Error adding posts to campaign:', err);
      toast.error(err.message || 'Failed to add posts to campaign');
    } finally {
      setAddingPosts(false);
    }
  };

  const handleCombine = async () => {
    if (selectedForCombine.size < 2) return;
    setCombining(true);

    try {
      const ids = Array.from(selectedForCombine);
      // Fetch full workspaces
      const { data: workspaces, error } = await supabase
        .from("campaign_workspaces")
        .select("id, name, production_items, production_checklist, creative_json, offer_name")
        .in("id", ids);
      if (error) throw error;
      if (!workspaces || workspaces.length < 2) throw new Error("Could not load campaigns");

      // Keep the first (most recently updated from our sorted list) as the target
      const target = workspaces[0];
      const others = workspaces.slice(1);

      // Merge production items
      let mergedItems: any[] = Array.isArray(target.production_items) ? [...(target.production_items as any[])] : [];
      for (const other of others) {
        if (Array.isArray(other.production_items)) {
          mergedItems = [...mergedItems, ...(other.production_items as any[])];
        }
      }

      // Update target with merged items
      const { error: updateError } = await supabase
        .from("campaign_workspaces")
        .update({
          production_items: mergedItems as any,
          name: target.name + " (combined)",
        })
        .eq("id", target.id);
      if (updateError) throw updateError;

      // Archive the others
      const otherIds = others.map(o => o.id);
      const { error: archiveError } = await supabase
        .from("campaign_workspaces")
        .update({ archived: true, archived_at: new Date().toISOString() })
        .in("id", otherIds);
      if (archiveError) throw archiveError;

      toast.success(`Combined ${workspaces.length} campaigns into "${target.name}"`);
      setCombineMode(false);
      setSelectedForCombine(new Set());
      fetchCampaigns();
    } catch (error: any) {
      console.error("Error combining campaigns:", error);
      toast.error(error.message || "Failed to combine campaigns");
    } finally {
      setCombining(false);
      setCombineDialogOpen(false);
    }
  };

  const toggleCombineSelect = (id: string) => {
    setSelectedForCombine(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (viewFilter === "live") return isLive(c.progress_status, c.meta_campaign_status, c.meta_campaign_ids);
    if (viewFilter === "draft") return isDraft(c.progress_status, c.meta_campaign_status, c.meta_campaign_ids);
    return true;
  });

  const liveCount = campaigns.filter(c => isLive(c.progress_status, c.meta_campaign_status, c.meta_campaign_ids)).length;
  const draftCount = campaigns.filter(c => isDraft(c.progress_status, c.meta_campaign_status, c.meta_campaign_ids)).length;

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glow">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">My Campaigns</CardTitle>
            <CardDescription className="text-sm">Your ads in progress and live</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!combineMode && draftCount >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCombineMode(true)}
              >
                <Merge className="h-3.5 w-3.5 mr-1" />
                Combine
              </Button>
            )}
            {combineMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setCombineMode(false); setSelectedForCombine(new Set()); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={selectedForCombine.size < 2}
                  onClick={() => setCombineDialogOpen(true)}
                >
                  <Merge className="h-3.5 w-3.5 mr-1" />
                  Combine {selectedForCombine.size > 0 ? `(${selectedForCombine.size})` : ""}
                </Button>
              </>
            )}
            {!combineMode && (
              <Button onClick={() => navigate("/create")} size="sm" className="h-8">
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">New Campaign</span>
                <span className="sm:hidden">New</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        {campaigns.length > 0 && !combineMode && (
          <div className="flex items-center gap-1 mt-3">
            {([
              { key: "all" as ViewFilter, label: "All", count: campaigns.length },
              { key: "live" as ViewFilter, label: "Live", count: liveCount },
              { key: "draft" as ViewFilter, label: "Drafts", count: draftCount },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  viewFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 ${viewFilter === tab.key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showArchived ? "Hide archived" : "Archived"}
            </button>
          </div>
        )}

        {combineMode && (
          <p className="text-xs text-muted-foreground mt-2">
            Select 2 or more draft campaigns to combine. The first selected will be kept, others will be archived.
          </p>
        )}
      </CardHeader>

      <CardContent className="px-3 md:px-6">
        {filteredCampaigns.length === 0 ? (
          campaigns.length === 0 ? (
            <AdsEmptyState />
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No {viewFilter === "live" ? "live" : viewFilter === "draft" ? "draft" : ""} campaigns
              </p>
            </div>
          )
        ) : (
          <div className="divide-y divide-border">
            {filteredCampaigns.map((campaign) => {
              const social = isSocialCampaign(campaign);
              const live = isLive(campaign.progress_status, campaign.meta_campaign_status, campaign.meta_campaign_ids);

              return (
                <div
                  key={campaign.id}
                  className={`flex items-center gap-3 py-3 px-1 ${campaign.archived ? 'opacity-50' : ''} ${
                    addCreativeMode ? 'cursor-pointer hover:bg-primary/5 rounded-lg' : ''
                  }`}
                  onClick={() => {
                    if (addCreativeMode && onCampaignSelectForCreative) {
                      onCampaignSelectForCreative(campaign.id);
                    }
                  }}
                >
                  {/* Combine checkbox */}
                  {combineMode && isDraft(campaign.progress_status, campaign.meta_campaign_status, campaign.meta_campaign_ids) && (
                    <Checkbox
                      checked={selectedForCombine.has(campaign.id)}
                      onCheckedChange={() => toggleCombineSelect(campaign.id)}
                      className="flex-shrink-0"
                    />
                  )}

                  {/* Status dot */}
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getStatusDot(campaign.progress_status, campaign.meta_campaign_status, campaign.meta_campaign_ids)}`} />

                  {/* Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={(e) => {
                      if (addCreativeMode) return;
                      e.stopPropagation();
                      handleArrowClick(campaign);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{campaign.name}</span>
                      {campaign.archived && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Archived</Badge>
                      )}
                      {addCreativeMode && (
                        <Badge className="bg-primary/20 text-primary border border-primary/30 gap-1 text-[10px]">
                          <ImagePlus className="h-3 w-3" />
                          Add
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {campaign.offer_name && (
                        <span className="text-xs text-muted-foreground truncate max-w-[180px] flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Promoting: {campaign.offer_name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        · {new Date(campaign.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Status pill */}
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    live
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {live && <Radio className="h-3 w-3 inline mr-1" />}
                    {getStatusLabelForDisplay(campaign.progress_status, campaign.meta_campaign_status, campaign.meta_campaign_ids)}
                  </span>

                  {/* Actions */}
                  {!addCreativeMode && !combineMode && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {social ? (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPostPicker(campaign);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add More Posts
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/creative-studio?workspace=${campaign.id}&refreshCreative=true`);
                                }}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh Creative
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/advanced-build?workspace=${campaign.id}`);
                                }}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Advanced Upload
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
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
                                Restore
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
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
                          handleArrowClick(campaign);
                        }}
                      >
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                  {addCreativeMode && (
                    <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Archive dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {campaignToArchive?.archived ? "Restore Campaign" : "Archive Campaign"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToArchive?.archived
                ? `Restore "${campaignToArchive?.name}"?`
                : `Archive "${campaignToArchive?.name}"? You can restore it later.`}
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

      {/* Combine dialog */}
      <AlertDialog open={combineDialogOpen} onOpenChange={setCombineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Combine Campaigns</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge the production checklists from {selectedForCombine.size} campaigns into one.
              The other campaigns will be archived. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCombine} disabled={combining}>
              {combining ? "Combining..." : "Combine"}
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

      {/* Add More Posts Dialog */}
      <Dialog open={postPickerOpen} onOpenChange={(open) => { if (!addingPosts) { setPostPickerOpen(open); if (!open) setPostPickerCampaign(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Posts to {postPickerCampaign?.name}</DialogTitle>
            <DialogDescription>Select existing Instagram posts to add as new ads in this campaign.</DialogDescription>
          </DialogHeader>
          {addingPosts ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Adding posts to your campaign...</p>
            </div>
          ) : postPickerBrand ? (
            <SocialGrowthFlow
              brandId={brandId}
              brandName={postPickerBrand.name || ''}
              instagramAccountId={postPickerBrand.instagram_account_id}
              instagramAccountName={postPickerBrand.instagram_account_name}
              audiencePsychology={postPickerBrand.audience_psychology}
              fixedObjective="traffic"
              headerText="Pick posts to add to your campaign ✨"
              headerSubtext="Select up to 6 posts to add as new ads. They'll go live in your existing campaign with the same settings."
              onComplete={handlePostsSelected}
              onConnectInstagram={() => navigate('/settings')}
              onBack={() => { setPostPickerOpen(false); setPostPickerCampaign(null); }}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Live campaign action dialog */}
      <Dialog open={!!actionDialogCampaign} onOpenChange={(open) => { if (!open) setActionDialogCampaign(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What would you like to do?</DialogTitle>
            <DialogDescription className="truncate">{actionDialogCampaign?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                navigate(`/creative-studio?workspace=${actionDialogCampaign?.id}`);
                setActionDialogCampaign(null);
              }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <PenTool className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold text-sm">Update Creative</span>
              <span className="text-xs text-muted-foreground">Add or swap ad creative</span>
            </button>
            <button
              onClick={() => {
                navigate('/performance');
                setActionDialogCampaign(null);
              }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-all text-center group"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <BarChart2 className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold text-sm">See Results</span>
              <span className="text-xs text-muted-foreground">View performance</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
