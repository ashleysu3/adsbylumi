import { useEffect, useRef } from "react";
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
  Circle,
  PartyPopper,
  Upload,
  AlertCircle
} from "lucide-react";
import confetti from "canvas-confetti";
import { getReadinessSummary } from "@/lib/sync-production-assets";

interface CampaignSummaryProps {
  workspace: any;
  answers: any;
  stage: string;
}

export function CampaignSummary({ workspace, answers, stage }: CampaignSummaryProps) {
  const hasAnswer = (key: string) => answers && answers[key] !== undefined && answers[key] !== null;
  const confettiTriggeredRef = useRef(false);
  
  // Get template info
  const template = workspace.campaign_templates;
  
  // Define all required questions in the campaign builder flow
  const requiredQuestions = [
    'budget',
    'startDate',
    'endDate',
    'metaAdvantage',
    'campaignName',
    'finalUrl',
    'placements',
    'optimizationEvent',
    'warmRetargeting'
  ];
  
  // Calculate progress
  const answeredCount = requiredQuestions.filter(q => hasAnswer(q)).length;
  const totalQuestions = requiredQuestions.length;
  const progressPercentage = Math.round((answeredCount / totalQuestions) * 100);
  
  // Trigger confetti when 100% complete
  useEffect(() => {
    if (progressPercentage === 100 && !confettiTriggeredRef.current && stage !== 'success') {
      confettiTriggeredRef.current = true;
      
      // Fire confetti from multiple angles
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Fire from left side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        // Fire from right side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [progressPercentage, stage]);

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-lg">Campaign Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campaign Type from Template */}
        {template && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                <span>Campaign Type</span>
              </div>
              <div className="ml-6">
                <Badge variant="outline" className="text-xs font-semibold">
                  {template.name}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {template.objective} • {template.audience_type}
                </p>
              </div>
            </div>
            <Separator />
          </>
        )}

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

        {/* Creative Assets - Enhanced Readiness */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Image className="h-4 w-4 text-primary" />
            <span>Creative Assets</span>
          </div>
          <div className="ml-6 space-y-2">
            {workspace.production_items?.length > 0 ? (
              (() => {
                const angleCopy = workspace.creative_json?.angleCopy || {};
                const summary = getReadinessSummary(workspace.production_items, angleCopy);
                
                // Determine readiness status
                let statusBadge;
                if (summary.ready >= 1) {
                  statusBadge = (
                    <Badge className="bg-green-500/10 text-green-600 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  );
                } else if (summary.uploaded > 0) {
                  statusBadge = (
                    <Badge className="bg-amber-500/10 text-amber-600 text-xs">
                      <Upload className="h-3 w-3 mr-1" />
                      Needs Approval
                    </Badge>
                  );
                } else {
                  statusBadge = (
                    <Badge className="bg-red-500/10 text-red-600 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Needs Assets
                    </Badge>
                  );
                }
                
                return (
                  <>
                    <div className="mb-2">
                      {statusBadge}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ready for Ads:</span>
                      <span className="font-medium text-green-600">{summary.ready}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">With Assets:</span>
                      <span className="font-medium">{summary.uploaded}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-medium">{summary.total}</span>
                    </div>
                    {summary.needsAsset > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {summary.needsAsset} need assets
                      </p>
                    )}
                    {summary.needsCopy > 0 && (
                      <p className="text-xs text-amber-600">
                        {summary.needsCopy} need copy
                      </p>
                    )}
                    {summary.needsApproval > 0 && (
                      <p className="text-xs text-amber-600">
                        {summary.needsApproval} need approval
                      </p>
                    )}
                  </>
                );
              })()
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Campaign Setup Progress</span>
                {progressPercentage === 100 && (
                  <PartyPopper className="h-4 w-4 text-primary animate-bounce" />
                )}
              </div>
              <span className="text-sm font-bold text-primary">
                {progressPercentage}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 mb-2">
              <div 
                className={`bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                  progressPercentage === 100 ? 'animate-pulse' : ''
                }`}
                style={{ width: `${progressPercentage}%` }}
              >
                {progressPercentage > 15 && (
                  <span className="text-[10px] font-bold text-primary-foreground">
                    {progressPercentage}%
                  </span>
                )}
              </div>
            </div>
            {progressPercentage === 100 ? (
              <p className="text-xs font-medium text-primary animate-fade-in">
                🎉 All questions answered! Ready to review.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {answeredCount} of {totalQuestions} questions answered
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
