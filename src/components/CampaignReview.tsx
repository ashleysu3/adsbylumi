import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Instagram as InstagramIcon } from "lucide-react";
import { 
  ArrowLeft, 
  Rocket, 
  Calendar, 
  DollarSign, 
  Target, 
  Image,
  Zap,
  AlertCircle,
  Eye,
  AlertTriangle,
  Play,
  Pause,
  Upload,
  FileText,
  CheckCircle2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdPreview } from "./AdPreview";
import { PreBuildCopySummary } from "./PreBuildCopySummary";
import { PixelPreflightCheck } from "./PixelPreflightCheck";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getReadinessSummary, isItemReadyForCampaign } from "@/lib/sync-production-assets";

interface CampaignReviewProps {
  workspace: any;
  answers: any;
  onBack: () => void;
  onPublish: (launchStatus: 'active' | 'paused') => void;
}

export function CampaignReview({ workspace, answers, onBack, onPublish }: CampaignReviewProps) {
  const [showPreviews, setShowPreviews] = useState(true);
  const [confirmRepublish, setConfirmRepublish] = useState(false);
  const [launchAsActive, setLaunchAsActive] = useState(false);
  const [saveToBench, setSaveToBench] = useState(false);
  const [pixelStatus, setPixelStatus] = useState<'ready' | 'warning' | 'error' | null>(null);
  
  // Detect social growth campaign (uses Instagram posts, no creative concepts needed)
  const isSocialGrowth = !!(workspace?.creative_json as any)?.socialGrowth;
  const selectedPosts = isSocialGrowth ? ((workspace?.creative_json as any)?.selectedPosts || []) : [];
  const additionalPosts = answers?.additionalPosts || [];
  
  // Check if campaign was already published
  const existingCampaignIds = workspace.meta_campaign_ids;
  const isAlreadyPublished = existingCampaignIds?.campaign_id;
  
  // Check Meta connection status
  const brand = workspace.brands;
  const hasMetaAccount = !!brand?.meta_account_id;
  const hasFacebookPage = !!brand?.page_id;
  const isMetaReady = hasMetaAccount && hasFacebookPage;
  
  // Get approved concepts that have both linkedAsset AND finalCopy or angle copy
  const creativeJson = workspace.creative_json;
  const copySelections = creativeJson?.copy_selections || {};
  const angleCopy = creativeJson?.angleCopy || {};
  
  const approvedConcepts = workspace.production_items?.filter((item: any) => item.status === 'approved') || [];
  const readyConcepts = approvedConcepts.filter((item: any) => {
    const hasAsset = item.linkedAsset?.url || item.uploaded_asset_id;
    const hasCopy = item.finalCopy?.headline || item.final_copy?.headline;
    // Also check if angle has copy generated
    const hasAngleCopy = item.angle && angleCopy[item.angle] && (
      angleCopy[item.angle].headlines?.length > 0 ||
      angleCopy[item.angle].descriptions?.length > 0 ||
      angleCopy[item.angle].primary_copy?.length > 0
    );
    return hasAsset && (hasCopy || hasAngleCopy);
  });
  
  // Concepts that are approved but missing asset or copy
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
  
  // For social growth: just need posts, budget, start date, and Meta connection
  // For standard: need at least 1 ready concept, budget, start date, AND Meta fully connected
  const canPublish = isSocialGrowth 
    ? (selectedPosts.length >= 1 && answers.budget && answers.startDate && isMetaReady)
    : (readyConcepts.length >= 1 && answers.budget && answers.startDate && isMetaReady);
  
  // For republish, need confirmation
  const canProceed = canPublish && (!isAlreadyPublished || confirmRepublish);

  // Get brand info for preview
  const brandName = workspace.brand?.name || "Your Brand";
  const websiteUrl = workspace.offer_url;

  const handlePublishClick = () => {
    if (isAlreadyPublished && !confirmRepublish) {
      setConfirmRepublish(true);
      return;
    }
    onPublish(launchAsActive ? 'active' : 'paused');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Review Your Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pixel & Event Tracking Pre-flight Check — skip for social growth campaigns */}
          {isMetaReady && !isSocialGrowth && (
            <PixelPreflightCheck
              brandId={brand?.id}
              landingPageUrl={workspace.offer_url}
              campaignGoal={workspace.campaign_templates?.objective === 'OUTCOME_LEADS' ? 'leads' : 'sales'}
              onStatusChange={setPixelStatus}
            />
          )}

          {/* Meta Connection Warning */}
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => window.location.href = '/dashboard'}
                >
                  Go to Brand Settings
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Already Published Warning */}
          {isAlreadyPublished && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-600">Campaign Already Published</AlertTitle>
              <AlertDescription className="text-amber-600/90">
                This workspace already has a published campaign (ID: {existingCampaignIds.campaign_id}). 
                Publishing again will create a <strong>duplicate campaign</strong> in your Meta Ads account.
                {confirmRepublish && (
                  <span className="block mt-2 font-medium">
                    ✓ You've confirmed you want to create a new campaign. Click "Publish to Meta" to proceed.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Warnings */}
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
          
          {/* Incomplete concepts warning */}
          {incompleteConcepts.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {incompleteConcepts.length} approved concept(s) are missing assets or copy and won't be included.
              </AlertDescription>
            </Alert>
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

          {/* Budget & Schedule */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Budget</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="secondary">{answers.budgetType || 'Daily'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">${answers.budget}/day</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Schedule</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start:</span>
                  <span className="font-medium">
                    {answers.startDate ? new Date(answers.startDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End:</span>
                  <span className="font-medium">
                    {answers.endDate ? new Date(answers.endDate).toLocaleDateString() : 'Continuous'}
                  </span>
                </div>
              </div>
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
                <span className="font-medium text-xs truncate max-w-[200px]">
                  {answers.campaignName || 'Auto-generated'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advantage+:</span>
                <Badge variant={answers.metaAdvantage ? "default" : "secondary"}>
                  {answers.metaAdvantage ? 'ON' : 'OFF'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Placements:</span>
                <Badge variant="secondary">{answers.placements || 'Advantage+'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Optimization:</span>
                <Badge variant="secondary">{answers.optimizationEvent || 'Auto'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Launch Status:</span>
                <Badge variant={launchAsActive ? "default" : "secondary"}>
                  {launchAsActive ? 'Active (Live)' : 'Paused'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Destination Toggle: Go Live vs Save to Bench */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {saveToBench ? (
                <Pause className="h-4 w-4 text-blue-500" />
              ) : (
                <Rocket className="h-4 w-4 text-primary" />
              )}
              <h3 className="text-sm font-semibold">Destination</h3>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="bench-toggle" className="font-medium">
                    Save to Bench (for later rotation)
                  </Label>
                  <p className="text-xs text-muted-foreground max-w-md">
                    {saveToBench 
                      ? "Creative will be saved to your bench — ready for auto-rotation when fatigue is detected."
                      : "Creative will be uploaded to Meta and go through the normal campaign build."
                    }
                  </p>
                </div>
                <Switch
                  id="bench-toggle"
                  checked={saveToBench}
                  onCheckedChange={setSaveToBench}
                />
              </div>
              {saveToBench && (
                <div className="mt-3 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Pause className="h-3 w-3" />
                    Creative will be saved to your bench for future use
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Launch Status Toggle — only show if NOT saving to bench */}
          {!saveToBench && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {launchAsActive ? (
                  <Play className="h-4 w-4 text-green-500" />
                ) : (
                  <Pause className="h-4 w-4 text-amber-500" />
                )}
                <h3 className="text-sm font-semibold">Launch Status</h3>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="launch-status" className="font-medium">
                      Launch campaign as Active (Live)
                    </Label>
                    <p className="text-xs text-muted-foreground max-w-md">
                      {launchAsActive 
                        ? "Your ads will start delivering immediately after Meta approves them (usually 15-30 minutes)."
                        : "Your campaign will be created in Paused status. You can activate it later."
                      }
                    </p>
                  </div>
                  <Switch
                    id="launch-status"
                    checked={launchAsActive}
                    onCheckedChange={setLaunchAsActive}
                  />
                </div>
                {launchAsActive && (
                  <div className="mt-3 p-2 rounded bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Ads will go live after Meta's review (~15-30 min)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Creative Assets — Social Growth shows selected posts, standard shows concepts */}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Creative Concepts</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowPreviews(!showPreviews)}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  {showPreviews ? 'Hide Previews' : 'Show Previews'}
                </Button>
              </div>
              
              {/* Readiness Summary */}
              {(() => {
                const summary = getReadinessSummary(workspace.production_items || [], angleCopy);
                return (
                  <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-bold">{readyConcepts.length}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Ready</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-600">
                        <Upload className="h-4 w-4" />
                        <span className="font-bold">{summary.uploaded}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">With Assets</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-purple-600">
                        <Target className="h-4 w-4" />
                        <span className="font-bold">{summary.total}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                );
              })()}
              
              <div className="space-y-2">
                {readyConcepts.length > 0 ? (
                  readyConcepts.map((item: any, index: number) => {
                    const { hasAsset, hasCopy } = isItemReadyForCampaign(item, angleCopy);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-green-500/20">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.concept?.title || (item as any).hook || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.concept?.hook || (item as any).guidance}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="default" className="text-xs bg-green-500/10 text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {item.concept?.stage === 'tofu' ? 'Grow' : 
                           item.concept?.stage === 'mofu' ? 'Nurture' : 
                           item.concept?.stage === 'bofu' ? 'Convert' : 
                           item.stage || 'Grow'}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-sm font-medium text-amber-600 mb-2">No concepts ready for campaign</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      To publish, concepts need:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                      <li className="flex items-center gap-2">
                        <Upload className="h-3 w-3" /> Uploaded creative asset (video/image)
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="h-3 w-3" /> Ad copy (headline, description, primary text)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> Status set to "Approved"
                      </li>
                    </ul>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.href = `/production?workspace=${workspace.id}`}
                      className="w-full"
                    >
                      Go to Production
                    </Button>
                  </div>
                )}
                
                {/* Show incomplete concepts */}
                {incompleteConcepts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Not ready ({incompleteConcepts.length}):
                    </p>
                    {incompleteConcepts.slice(0, 3).map((item: any, index: number) => {
                      const { hasAsset, hasCopy, reason } = isItemReadyForCampaign(item, angleCopy);
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-dashed">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {item.concept?.title || (item as any).hook || 'Untitled'}
                            </p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {!hasAsset && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                                  Needs Asset
                                </Badge>
                              )}
                              {hasAsset && !hasCopy && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                                  Needs Copy
                                </Badge>
                              )}
                              {hasAsset && hasCopy && item.status !== 'approved' && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                                  Needs Approval
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {incompleteConcepts.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{incompleteConcepts.length - 3} more...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Existing Posts */}
      {additionalPosts.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <InstagramIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                Additional Instagram Posts ({additionalPosts.length})
              </h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {additionalPosts.map((post: any) => (
                <div key={post.id} className="relative aspect-square rounded-lg overflow-hidden border">
                  <img
                    src={post.thumbnail_url || post.media_url}
                    alt={post.caption?.slice(0, 30) || "Post"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              These posts will be added as extra ads alongside your generated creatives.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pre-Build Copy Summary — skip for social growth */}
      {!isSocialGrowth && (
        <PreBuildCopySummary 
          creativeJson={creativeJson}
          productionItems={workspace.production_items}
        />
      )}

      {/* Ad Previews */}
      {showPreviews && readyConcepts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Ad Previews
          </h2>
          <p className="text-sm text-muted-foreground">
            See how your ads will appear on Facebook and Instagram
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {readyConcepts.map((item: any, index: number) => (
              <AdPreview 
                key={index}
                concept={item}
                brandName={brandName}
                websiteUrl={websiteUrl}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Chat
        </Button>
        <div className="flex gap-2">
          {isAlreadyPublished && !confirmRepublish && (
            <Button 
              variant="outline"
              onClick={() => setConfirmRepublish(true)}
              className="gap-2"
            >
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
