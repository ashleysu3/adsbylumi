import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Rocket, 
  Calendar, 
  DollarSign, 
  Target, 
  Image,
  Zap,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CampaignReviewProps {
  workspace: any;
  answers: any;
  onBack: () => void;
  onPublish: () => void;
}

export function CampaignReview({ workspace, answers, onBack, onPublish }: CampaignReviewProps) {
  const approvedConcepts = workspace.production_items?.filter((item: any) => item.status === 'approved') || [];
  const canPublish = approvedConcepts.length >= 3 && answers.budget && answers.startDate;

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
          {/* Warnings */}
          {!canPublish && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {approvedConcepts.length < 3 && "You need at least 3 approved concepts to publish. "}
                {!answers.budget && "Budget is required. "}
                {!answers.startDate && "Start date is required."}
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
                <span className="text-muted-foreground">Warm Retargeting:</span>
                <Badge variant={answers.warmRetargeting ? "default" : "secondary"}>
                  {answers.warmRetargeting ? 'YES' : 'NO'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Creative Assets */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Creative Concepts</h3>
            </div>
            <div className="space-y-2">
              {approvedConcepts.length > 0 ? (
                approvedConcepts.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.concept?.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.concept?.hook}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.concept?.stage || 'TOFU'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No approved concepts</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Chat
        </Button>
        <Button 
          onClick={onPublish} 
          disabled={!canPublish}
          size="lg"
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          Publish to Meta
        </Button>
      </div>
    </div>
  );
}
