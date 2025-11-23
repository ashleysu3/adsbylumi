import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  DollarSign, 
  Target, 
  Image, 
  Users, 
  Zap,
  CheckCircle2,
  Circle
} from "lucide-react";

interface CampaignSummaryProps {
  workspace: any;
  answers: any;
  stage: string;
}

export function CampaignSummary({ workspace, answers, stage }: CampaignSummaryProps) {
  const hasAnswer = (key: string) => answers && answers[key] !== undefined && answers[key] !== null;

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-lg">Campaign Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Offer Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" />
            <span>Offer</span>
          </div>
          <div className="ml-6 text-sm">
            <p className="font-medium">{workspace.offer_name || 'Untitled Offer'}</p>
            {workspace.offer_description && (
              <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
                {workspace.offer_description}
              </p>
            )}
            {workspace.offer_price && (
              <p className="text-xs text-muted-foreground mt-1">
                Price: {workspace.offer_price}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Creative Assets */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Image className="h-4 w-4 text-primary" />
            <span>Creative Assets</span>
          </div>
          <div className="ml-6 space-y-2">
            {workspace.production_items?.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Concepts:</span>
                  <span className="font-medium">{workspace.production_items.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Approved:</span>
                  <span className="font-medium">
                    {workspace.production_items.filter((i: any) => i.status === 'approved').length}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No assets uploaded yet</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Budget */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {hasAnswer('budget') ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <DollarSign className="h-4 w-4 text-primary" />
            <span>Budget</span>
          </div>
          {hasAnswer('budget') && (
            <div className="ml-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="secondary" className="text-xs">
                  {answers.budgetType || 'Daily'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">${answers.budget}</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Dates */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {hasAnswer('startDate') ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <Calendar className="h-4 w-4 text-primary" />
            <span>Schedule</span>
          </div>
          {hasAnswer('startDate') && (
            <div className="ml-6 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Start:</span>
                <span className="font-medium text-xs">
                  {new Date(answers.startDate).toLocaleDateString()}
                </span>
              </div>
              {answers.endDate ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">End:</span>
                  <span className="font-medium text-xs">
                    {new Date(answers.endDate).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <Badge variant="secondary" className="text-xs">Continuous</Badge>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-primary" />
            <span>Settings</span>
          </div>
          <div className="ml-6 space-y-2">
            {hasAnswer('metaAdvantage') && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Advantage+:</span>
                <Badge variant={answers.metaAdvantage ? "default" : "secondary"} className="text-xs">
                  {answers.metaAdvantage ? 'ON' : 'OFF'}
                </Badge>
              </div>
            )}
            {hasAnswer('placements') && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Placements:</span>
                <Badge variant="secondary" className="text-xs">
                  {answers.placements}
                </Badge>
              </div>
            )}
            {hasAnswer('optimizationEvent') && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Goal:</span>
                <Badge variant="secondary" className="text-xs">
                  {answers.optimizationEvent}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {hasAnswer('warmRetargeting') && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                <span>Audience</span>
              </div>
              <div className="ml-6 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Warm Retargeting:</span>
                  <Badge variant={answers.warmRetargeting ? "default" : "secondary"} className="text-xs">
                    {answers.warmRetargeting ? 'YES' : 'NO'}
                  </Badge>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Campaign Name */}
        {hasAnswer('campaignName') && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Campaign Name</p>
              <p className="text-sm font-medium line-clamp-2">{answers.campaignName}</p>
            </div>
          </>
        )}

        {/* Progress Indicator */}
        {stage !== 'success' && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Progress</span>
              <span>
                {Object.keys(answers).length}/8 questions
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${(Object.keys(answers).length / 8) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
