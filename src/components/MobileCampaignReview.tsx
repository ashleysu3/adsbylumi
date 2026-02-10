import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  Rocket, 
  Calendar, 
  DollarSign, 
  Target, 
  Image as ImageIcon,
  Zap,
  AlertCircle,
  Play,
  Pause,
  Pencil,
  Check,
  X,
  ChevronRight
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MobileCampaignReviewProps {
  workspace: any;
  answers: any;
  onBack: () => void;
  onPublish: (launchStatus: 'active' | 'paused') => void;
  onEditSection?: (section: string) => void;
}

export function MobileCampaignReview({ 
  workspace, 
  answers, 
  onBack, 
  onPublish,
  onEditSection 
}: MobileCampaignReviewProps) {
  const [launchAsActive, setLaunchAsActive] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Detect social growth campaign
  const isSocialGrowth = !!(workspace?.creative_json as any)?.socialGrowth;
  const selectedPosts = isSocialGrowth ? ((workspace?.creative_json as any)?.selectedPosts || []) : [];

  // Get approved concepts
  const approvedConcepts = workspace.production_items?.filter((item: any) => item.status === 'approved') || [];
  const readyConcepts = approvedConcepts.filter((item: any) => {
    const hasAsset = item.linkedAsset?.url || item.uploaded_asset_id;
    const hasCopy = item.finalCopy?.headline || item.final_copy?.headline;
    return hasAsset && hasCopy;
  });

  // Check requirements
  const brand = workspace.brands;
  const hasMetaAccount = !!brand?.meta_account_id;
  const hasFacebookPage = !!brand?.page_id;
  const isMetaReady = hasMetaAccount && hasFacebookPage;
  const canPublish = isSocialGrowth
    ? (selectedPosts.length >= 1 && answers.budget && answers.startDate && isMetaReady)
    : (readyConcepts.length >= 1 && answers.budget && answers.startDate && isMetaReady);

  const handleEditStart = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValue(String(currentValue || ""));
  };

  const handleEditSave = () => {
    // In a real implementation, you'd update the answers here
    setEditingField(null);
    setEditValue("");
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="touch-target">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Review Campaign</h1>
          <p className="text-xs text-muted-foreground">Double-check before publishing</p>
        </div>
      </div>

      {/* Meta Connection Warning */}
      {!isMetaReady && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {!hasMetaAccount ? "Connect Meta Ad Account to publish. " : ""}
            {!hasFacebookPage ? "Select a Facebook Page." : ""}
          </AlertDescription>
        </Alert>
      )}

      {/* Review Cards */}
      <div className="space-y-3">
        {/* Offer Card */}
        <ReviewCard
          icon={<Target className="h-4 w-4" />}
          title="Offer"
          onEdit={() => onEditSection?.("offer")}
        >
          <div className="space-y-1">
            <p className="font-medium text-sm">{workspace.offer_name || "Not set"}</p>
            {workspace.offer_price && (
              <p className="text-xs text-muted-foreground">{workspace.offer_price}</p>
            )}
            {workspace.offer_url && (
              <p className="text-xs text-muted-foreground truncate">{workspace.offer_url}</p>
            )}
          </div>
        </ReviewCard>

        {/* Budget Card */}
        <ReviewCard
          icon={<DollarSign className="h-4 w-4" />}
          title="Budget"
          editing={editingField === "budget"}
          onEdit={() => handleEditStart("budget", answers.budget)}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        >
          {editingField === "budget" ? (
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-10 text-lg"
              autoFocus
            />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">${answers.budget || 0}</span>
              <span className="text-muted-foreground text-sm">/day</span>
            </div>
          )}
        </ReviewCard>

        {/* Schedule Card */}
        <ReviewCard
          icon={<Calendar className="h-4 w-4" />}
          title="Schedule"
          onEdit={() => onEditSection?.("schedule")}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="font-medium text-sm">
                {answers.startDate 
                  ? new Date(answers.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End</p>
              <p className="font-medium text-sm">
                {answers.endDate 
                  ? new Date(answers.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : "Continuous"}
              </p>
            </div>
          </div>
        </ReviewCard>

        {/* Settings Card */}
        <ReviewCard
          icon={<Zap className="h-4 w-4" />}
          title="Settings"
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advantage+</span>
              <Badge variant={answers.metaAdvantage ? "default" : "secondary"} className="text-xs">
                {answers.metaAdvantage ? "ON" : "OFF"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Placements</span>
              <span className="font-medium text-xs">{answers.placements || "Auto"}</span>
            </div>
          </div>
        </ReviewCard>

        {/* Creative Card */}
        {isSocialGrowth ? (
          <ReviewCard
            icon={<ImageIcon className="h-4 w-4" />}
            title={`Instagram Posts (${selectedPosts.length})`}
          >
            <div className="space-y-2">
              {selectedPosts.slice(0, 3).map((post: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="line-clamp-2">{post.caption || `Post ${index + 1}`}</span>
                </div>
              ))}
              {selectedPosts.length > 3 && (
                <p className="text-xs text-muted-foreground">+{selectedPosts.length - 3} more</p>
              )}
            </div>
          </ReviewCard>
        ) : (
          <ReviewCard
            icon={<ImageIcon className="h-4 w-4" />}
            title={`Creative (${readyConcepts.length} ready)`}
            onEdit={() => onEditSection?.("creative")}
          >
            {readyConcepts.length > 0 ? (
              <div className="space-y-2">
                {readyConcepts.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="truncate">{item.concept?.title || `Creative ${index + 1}`}</span>
                  </div>
                ))}
                {readyConcepts.length > 3 && (
                  <p className="text-xs text-muted-foreground">+{readyConcepts.length - 3} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No creative ready</p>
            )}
          </ReviewCard>
        )}

        {/* Launch Status */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {launchAsActive ? (
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Play className="h-5 w-5 text-green-500" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Pause className="h-5 w-5 text-amber-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {launchAsActive ? "Launch Active" : "Launch Paused"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {launchAsActive 
                      ? "Goes live after Meta approval" 
                      : "Activate later from dashboard"}
                  </p>
                </div>
              </div>
              <Switch
                checked={launchAsActive}
                onCheckedChange={setLaunchAsActive}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Publish Button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t safe-area-bottom">
        <Button
          onClick={() => onPublish(launchAsActive ? 'active' : 'paused')}
          disabled={!canPublish}
          className="w-full h-14 text-base font-semibold gap-2 bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 hover:opacity-90"
        >
          <Rocket className="h-5 w-5" />
          Publish to Meta
        </Button>
        {!canPublish && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            {!isMetaReady ? "Connect Meta first" : 
             isSocialGrowth ? (selectedPosts.length < 1 ? "Need at least 1 post" : !answers.budget ? "Set a budget" : "Set a start date") :
             readyConcepts.length < 1 ? "Need at least 1 creative" :
             !answers.budget ? "Set a budget" : 
             !answers.startDate ? "Set a start date" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// Review Card Component
interface ReviewCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  editing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

function ReviewCard({ 
  icon, 
  title, 
  children, 
  editing,
  onEdit,
  onSave,
  onCancel
}: ReviewCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
              <span className="font-medium text-sm">{title}</span>
            </div>
            {children}
          </div>
          
          {editing ? (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSave}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : onEdit ? (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
