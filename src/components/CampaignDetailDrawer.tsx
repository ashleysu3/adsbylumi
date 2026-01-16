import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Eye, 
  Play, 
  PenTool, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  FileText,
  Image,
  Video,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Pencil,
  Check,
  X,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";
import { CreativeFlowModal } from "@/components/creative/CreativeFlowModal";

interface CampaignDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
  onUpdate?: () => void;
}

interface WorkspaceData {
  id: string;
  name: string;
  progress_status: string;
  offer_name: string | null;
  offer_url: string | null;
  creative_json: any;
  selected_copy: any;
  production_checklist: any;
  meta_campaign_status: string | null;
  created_at: string;
  updated_at: string;
}

export function CampaignDetailDrawer({ open, onOpenChange, campaignId, onUpdate }: CampaignDetailDrawerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  
  // Editing states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingOffer, setIsEditingOffer] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOfferName, setEditOfferName] = useState("");
  const [editOfferUrl, setEditOfferUrl] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Creative flow modal
  const [showCreativeModal, setShowCreativeModal] = useState(false);

  useEffect(() => {
    if (open && campaignId) {
      fetchWorkspace();
    }
    // Reset editing states when drawer closes
    if (!open) {
      setIsEditingName(false);
      setIsEditingOffer(false);
    }
  }, [open, campaignId]);

  const fetchWorkspace = async () => {
    if (!campaignId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_workspaces")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (error) throw error;
      setWorkspace(data);
      setEditName(data.name);
      setEditOfferName(data.offer_name || "");
      setEditOfferUrl(data.offer_url || "");
    } catch (error) {
      console.error("Error fetching workspace:", error);
      toast.error("Failed to load campaign details");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!workspace || !editName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ name: editName.trim(), updated_at: new Date().toISOString() })
        .eq("id", workspace.id);

      if (error) throw error;
      
      setWorkspace({ ...workspace, name: editName.trim() });
      setIsEditingName(false);
      toast.success("Campaign name updated");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating name:", error);
      toast.error("Failed to update campaign name");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOffer = async () => {
    if (!workspace) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({ 
          offer_name: editOfferName.trim() || null, 
          offer_url: editOfferUrl.trim() || null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", workspace.id);

      if (error) throw error;
      
      setWorkspace({ 
        ...workspace, 
        offer_name: editOfferName.trim() || null, 
        offer_url: editOfferUrl.trim() || null 
      });
      setIsEditingOffer(false);
      toast.success("Offer details updated");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating offer:", error);
      toast.error("Failed to update offer details");
    } finally {
      setSaving(false);
    }
  };

  const cancelEditName = () => {
    setEditName(workspace?.name || "");
    setIsEditingName(false);
  };

  const cancelEditOffer = () => {
    setEditOfferName(workspace?.offer_name || "");
    setEditOfferUrl(workspace?.offer_url || "");
    setIsEditingOffer(false);
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode; nextStep: string }> = {
      draft: { 
        label: "Draft", 
        color: "bg-gray-100 text-gray-700 border-gray-200",
        icon: <PenTool className="h-4 w-4" />,
        nextStep: "Complete your creative setup"
      },
      creative_in_progress: { 
        label: "Creating", 
        color: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <Sparkles className="h-4 w-4" />,
        nextStep: "Finish selecting your creative angles"
      },
      waiting_for_assets: { 
        label: "Needs Assets", 
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        icon: <Clock className="h-4 w-4" />,
        nextStep: "Upload your video or images"
      },
      ready_to_publish: { 
        label: "Ready", 
        color: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle2 className="h-4 w-4" />,
        nextStep: "Review and launch your campaign"
      },
      publishing_to_meta: { 
        label: "Publishing", 
        color: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
        nextStep: "Campaign is being published..."
      },
      live: { 
        label: "Live", 
        color: "bg-primary/10 text-primary border-primary/20",
        icon: <Play className="h-4 w-4" />,
        nextStep: "Monitor performance in Results"
      },
      completed: { 
        label: "Completed", 
        color: "bg-gray-100 text-gray-600 border-gray-200",
        icon: <CheckCircle2 className="h-4 w-4" />,
        nextStep: "View final results"
      },
    };
    return statusMap[status] || statusMap.draft;
  };

  const getCreativePreview = () => {
    if (!workspace?.creative_json) return null;
    const creative = workspace.creative_json;
    
    // Extract hooks, scripts, headlines from creative_json
    const hooks = creative.hooks || [];
    const scripts = creative.scripts || [];
    const headlines = creative.headlines || [];
    
    return { hooks, scripts, headlines };
  };

  const getCopyPreview = () => {
    if (!workspace?.selected_copy) return null;
    return workspace.selected_copy;
  };

  const handleContinue = () => {
    if (!workspace) return;
    
    const status = workspace.progress_status;
    
    if (status === 'live' || status === 'completed') {
      navigate('/data');
    } else if (status === 'ready_to_publish' || status === 'publishing_to_meta') {
      navigate(`/campaigns/build?workspace=${workspace.id}`);
    } else {
      // For draft, creative_in_progress, waiting_for_assets - go to create flow
      navigate(`/create?workspace=${workspace.id}`);
    }
    
    onOpenChange(false);
  };

  const statusInfo = workspace ? getStatusInfo(workspace.progress_status) : null;
  const creativePreview = getCreativePreview();
  const copyPreview = getCopyPreview();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-base font-display"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') cancelEditName();
                  }}
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={handleSaveName}
                  disabled={saving}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={cancelEditName}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <SheetTitle className="text-lg font-display truncate">
                  {loading ? <Skeleton className="h-6 w-40" /> : workspace?.name}
                </SheetTitle>
                {!loading && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
            {statusInfo && !isEditingName && (
              <Badge variant="outline" className={`gap-1 flex-shrink-0 ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            )}
          </div>
          
          {/* Offer Section */}
          {isEditingOffer ? (
            <div className="space-y-2 pt-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Offer Name</label>
                <Input
                  value={editOfferName}
                  onChange={(e) => setEditOfferName(e.target.value)}
                  placeholder="Enter offer name..."
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Offer URL</label>
                <Input
                  value={editOfferUrl}
                  onChange={(e) => setEditOfferUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={handleSaveOffer}
                  disabled={saving}
                >
                  <Check className="h-3 w-3" />
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs"
                  onClick={cancelEditOffer}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {workspace?.offer_name ? (
                <p className="text-sm text-muted-foreground">{workspace.offer_name}</p>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">No offer linked</p>
              )}
              {!loading && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingOffer(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex-1 space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : workspace ? (
          <ScrollArea className="flex-1 py-4">
            <div className="space-y-4 pr-4">
              {/* Next Step Card */}
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Next Step</p>
                      <p className="text-sm text-muted-foreground">{statusInfo?.nextStep}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs for Creative / Copy / Details */}
              <Tabs defaultValue="creative" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="creative" className="text-xs">Creative</TabsTrigger>
                  <TabsTrigger value="copy" className="text-xs">Copy</TabsTrigger>
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                </TabsList>

                <TabsContent value="creative" className="mt-4 space-y-3">
                  {creativePreview ? (
                    <>
                      {creativePreview.hooks?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Video className="h-3 w-3" /> Hooks
                          </p>
                          <div className="space-y-2">
                            {creativePreview.hooks.slice(0, 3).map((hook: any, i: number) => (
                              <Card key={i} className="bg-muted/30">
                                <CardContent className="p-3">
                                  <p className="text-sm">{typeof hook === 'string' ? hook : hook.text || hook.content || 'Hook ' + (i + 1)}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      {creativePreview.scripts?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Scripts
                          </p>
                          <div className="space-y-2">
                            {creativePreview.scripts.slice(0, 2).map((script: any, i: number) => (
                              <Card key={i} className="bg-muted/30">
                                <CardContent className="p-3">
                                  <p className="text-sm line-clamp-3">{typeof script === 'string' ? script : script.content || script.text || 'Script ' + (i + 1)}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No creative generated yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Continue setup to generate creative</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="copy" className="mt-4 space-y-3">
                  {copyPreview ? (
                    <>
                      {copyPreview.headline && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Headline</p>
                          <p className="text-sm font-medium">{copyPreview.headline}</p>
                        </div>
                      )}
                      {copyPreview.primaryText && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Primary Text</p>
                          <p className="text-sm">{copyPreview.primaryText}</p>
                        </div>
                      )}
                      {copyPreview.description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                          <p className="text-sm text-muted-foreground">{copyPreview.description}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No copy selected yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Continue setup to select copy</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="details" className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm">{new Date(workspace.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Updated</p>
                      <p className="text-sm">{new Date(workspace.updated_at).toLocaleDateString()}</p>
                    </div>
                    {workspace.offer_url && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Offer URL</p>
                        <a 
                          href={workspace.offer_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {workspace.offer_url.slice(0, 40)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {workspace.meta_campaign_status && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Meta Status</p>
                        <p className="text-sm capitalize">{workspace.meta_campaign_status}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        ) : null}

        {/* Footer Actions */}
        <div className="pt-4 border-t mt-auto space-y-2">
          <Button 
            onClick={() => setShowCreativeModal(true)} 
            className="w-full gap-2"
            variant="outline"
          >
            <Lightbulb className="h-4 w-4" />
            Generate Angles & Ideas
          </Button>
          <Button 
            onClick={handleContinue} 
            className="w-full gap-2"
            variant="lumi"
          >
            {workspace?.progress_status === 'live' || workspace?.progress_status === 'completed' ? (
              <>
                <Eye className="h-4 w-4" />
                View Results
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </SheetContent>

      {/* Creative Flow Modal */}
      <CreativeFlowModal
        open={showCreativeModal}
        onOpenChange={setShowCreativeModal}
        workspaceId={campaignId}
        onComplete={() => {
          onUpdate?.();
          fetchWorkspace();
        }}
      />
    </Sheet>
  );
}
