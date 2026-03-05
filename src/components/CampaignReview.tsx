import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Instagram as InstagramIcon } from "lucide-react";
import { 
  ArrowLeft, 
  Rocket, 
  Target, 
  Image,
  Zap,
  AlertCircle,
  Eye,
  AlertTriangle,
  Upload,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdPreview } from "./AdPreview";
import { PreBuildCopySummary } from "./PreBuildCopySummary";
import { PixelPreflightCheck } from "./PixelPreflightCheck";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getReadinessSummary, isItemReadyForCampaign } from "@/lib/sync-production-assets";

interface CampaignReviewProps {
  workspace: any;
  answers: any;
  onBack: () => void;
  onPublish: (launchStatus: 'active' | 'paused') => void;
}

export function CampaignReview({ workspace, answers, onBack, onPublish }: CampaignReviewProps) {
  const [confirmRepublish, setConfirmRepublish] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<'ready' | 'warning' | 'error' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const isSocialGrowth = !!(workspace?.creative_json as any)?.socialGrowth;
  const selectedPosts = isSocialGrowth ? ((workspace?.creative_json as any)?.selectedPosts || []) : [];
  const additionalPosts = answers?.additionalPosts || [];
  
  const existingCampaignIds = workspace.meta_campaign_ids;
  const isAlreadyPublished = existingCampaignIds?.campaign_id;
  
  const brand = workspace.brands;
  const hasMetaAccount = !!brand?.meta_account_id;
  const hasFacebookPage = !!brand?.page_id;
  const isMetaReady = hasMetaAccount && hasFacebookPage;
  
  const creativeJson = workspace.creative_json;
  const angleCopy = creativeJson?.angleCopy || {};
  
  const approvedConcepts = workspace.production_items?.filter((item: any) => item.status === 'approved') || [];
  const readyConcepts = approvedConcepts.filter((item: any) => {
    const hasAsset = item.linkedAsset?.url || item.uploaded_asset_id;
    const hasCopy = item.finalCopy?.headline || item.final_copy?.headline;
    const hasAngleCopy = item.angle && angleCopy[item.angle] && (
      angleCopy[item.angle].headlines?.length > 0 ||
      angleCopy[item.angle].descriptions?.length > 0 ||
      angleCopy[item.angle].primary_copy?.length > 0
    );
    return hasAsset && (hasCopy || hasAngleCopy);
  });
  
  const incompleteConcepts = approvedConcepts.filter((item: any) => {
    const hasAsset = item.linkedAsset?.url || item.uploaded_asset_id;
    const hasCopy = item.finalCopy?.headline || item.final_copy?.headline;
    const hasAngleCopy = item.angle && angleCopy[item.angle] && (
      angleCopy[item.angle].headlines?.length > 0 ||
      angleCopy[item.angle].descriptions?.length > 0 ||
      angleCopy[item.angle].primary_copy?.length > 0
    );
    return !hasAsset || (!hasCopy && !hasAngleCopy);
  });
  
  const canPublish = isSocialGrowth 
    ? (selectedPosts.length >= 1 && answers.budget && answers.startDate && isMetaReady)
    : (readyConcepts.length >= 1 && answers.budget && answers.startDate && isMetaReady);
  
  const canProceed = canPublish && (!isAlreadyPublished || confirmRepublish);

  const brandName = workspace.brand?.name || "Your Brand";
  const websiteUrl = workspace.offer_url;

  const launchActive = answers.launchActive ?? true;

  const handlePublishClick = () => {
    if (isAlreadyPublished && !confirmRepublish) {
      setConfirmRepublish(true);
      return;
    }
    onPublish(launchActive ? 'active' : 'paused');
  };

  const creativeCount = isSocialGrowth ? selectedPosts.length : readyConcepts.length;

  return (
    <div className="space-y-6">
      {/* ── Critical Blockers ── */}
      {!isMetaReady && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Meta Connection Incomplete</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {!hasMetaAccount && "No Meta Ad Account connected. "}
              {hasMetaAccount && !hasFacebookPage && "No Facebook Page selected. "}
              To create ads, you need both an Ad Account and a Facebook Page connected.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.href = '/dashboard'}>
              Go to Brand Settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isAlreadyPublished && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Campaign Already Published</AlertTitle>
          <AlertDescription className="text-amber-600/90">
            This workspace already has a published campaign. Publishing again will create a <strong>duplicate campaign</strong>.
            {confirmRepublish && (
              <span className="block mt-2 font-medium">
                ✓ You've confirmed you want to create a new campaign.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isMetaReady && !canPublish && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isSocialGrowth 
              ? (selectedPosts.length < 1 && "You need at least 1 Instagram post selected. ")
              : (readyConcepts.length < 1 && "You need at least 1 approved concept with asset + copy to publish. ")
            }
            {!answers.budget && "Budget is required. "}
            {!answers.startDate && "Start date is required."}
          </AlertDescription>
        </Alert>
      )}

      {incompleteConcepts.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {incompleteConcepts.length} approved concept(s) are missing assets or copy and won't be included.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Compact Summary Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Review Your Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Offer</p>
              <p className="font-medium truncate">{workspace.offer_name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Budget</p>
              <p className="font-medium">{answers.budget ? `$${answers.budget}/day` : '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Schedule</p>
              <p className="font-medium">
                {answers.startDate ? new Date(answers.startDate).toLocaleDateString() : '—'}
                {' → '}
                {answers.endDate ? new Date(answers.endDate).toLocaleDateString() : 'Continuous'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Creatives</p>
              <p className="font-medium">
                {creativeCount} ready
                {incompleteConcepts.length > 0 && (
                  <span className="text-muted-foreground"> ({incompleteConcepts.length} incomplete)</span>
                )}
              </p>
            </div>
          </div>


          <Separator />

          {/* ── Collapsible Full Details ── */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span className="text-sm font-medium">See full details</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
              {/* Pixel Preflight */}
              {isMetaReady && !isSocialGrowth && (
                <PixelPreflightCheck
                  brandId={brand?.id}
                  landingPageUrl={workspace.offer_url}
                  campaignGoal={workspace.campaign_templates?.objective === 'OUTCOME_LEADS' ? 'leads' : 'sales'}
                  onStatusChange={setPixelStatus}
                />
              )}

              {/* Offer Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Offer Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{workspace.offer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-medium">{workspace.offer_price || 'N/A'}</p>
                  </div>
                  {workspace.offer_url && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Landing Page</p>
                      <p className="font-medium text-xs truncate">{workspace.offer_url}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Campaign Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Campaign Settings</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Campaign Name:</span>
                    <span className="font-medium text-xs truncate max-w-[200px]">{answers.campaignName || 'Auto-generated'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Advantage+:</span>
                    <Badge variant={answers.metaAdvantage ? "default" : "secondary"}>{answers.metaAdvantage ? 'ON' : 'OFF'}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placements:</span>
                    <Badge variant="secondary">{answers.placements || 'Advantage+'}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Optimization:</span>
                    <Badge variant="secondary">{answers.optimizationEvent || 'Auto'}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Creative Concepts Detail */}
              {isSocialGrowth ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Instagram Posts ({selectedPosts.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {selectedPosts.map((post: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-green-500/20">
                        {post.thumbnail_url && (
                          <img src={post.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{post.caption || `Post ${index + 1}`}</p>
                          <Badge variant="default" className="text-xs bg-green-500/10 text-green-600 mt-1">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Creative Concepts</h3>
                  </div>
                  <div className="space-y-2">
                    {readyConcepts.length > 0 ? (
                      readyConcepts.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-green-500/20">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.concept?.title || (item as any).hook || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{item.concept?.hook || (item as any).guidance}</p>
                            <Badge variant="default" className="text-xs bg-green-500/10 text-green-600 mt-1">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-sm font-medium text-amber-600 mb-2">No concepts ready for campaign</p>
                        <p className="text-xs text-muted-foreground mb-3">Concepts need an uploaded asset, ad copy, and "Approved" status.</p>
                        <Button variant="outline" size="sm" onClick={() => window.location.href = `/production?workspace=${workspace.id}`} className="w-full">
                          Go to Production
                        </Button>
                      </div>
                    )}

                    {incompleteConcepts.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Not ready ({incompleteConcepts.length}):</p>
                        {incompleteConcepts.slice(0, 3).map((item: any, index: number) => {
                          const { hasAsset, hasCopy } = isItemReadyForCampaign(item, angleCopy);
                          return (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-dashed">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{item.concept?.title || (item as any).hook || 'Untitled'}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {!hasAsset && <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">Needs Asset</Badge>}
                                  {hasAsset && !hasCopy && <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">Needs Copy</Badge>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {incompleteConcepts.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{incompleteConcepts.length - 3} more...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Instagram Posts */}
              {additionalPosts.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <InstagramIcon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Additional Instagram Posts ({additionalPosts.length})</h3>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {additionalPosts.map((post: any) => (
                        <div key={post.id} className="relative aspect-square rounded-lg overflow-hidden border">
                          <img src={post.thumbnail_url || post.media_url} alt={post.caption?.slice(0, 30) || "Post"} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Pre-Build Copy Summary */}
              {!isSocialGrowth && (
                <PreBuildCopySummary creativeJson={creativeJson} productionItems={workspace.production_items} />
              )}

              {/* Ad Previews */}
              {readyConcepts.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      Ad Previews
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {readyConcepts.map((item: any, index: number) => (
                        <AdPreview key={index} concept={item} brandName={brandName} websiteUrl={websiteUrl} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex gap-2">
          {isAlreadyPublished && !confirmRepublish && (
            <Button variant="outline" onClick={() => setConfirmRepublish(true)} className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Create New Campaign Anyway
            </Button>
          )}
          <Button 
            onClick={handlePublishClick} 
            disabled={!canProceed}
            size="lg"
            className="gap-2"
            variant={isAlreadyPublished ? "destructive" : "default"}
          >
            <Rocket className="h-4 w-4" />
            {isAlreadyPublished 
              ? (confirmRepublish ? 'Publish Duplicate Campaign' : 'Campaign Already Published')
              : 'Publish to Meta'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
