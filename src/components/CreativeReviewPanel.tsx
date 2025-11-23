import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Video,
  Image as ImageIcon,
  Layers,
  Heart,
  Upload,
  Sparkles
} from "lucide-react";

interface CreativeReviewPanelProps {
  workspace: any;
  onFinalize: () => void;
}

export function CreativeReviewPanel({ workspace, onFinalize }: CreativeReviewPanelProps) {
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || {};
  const lovedConcepts = workspace.loved_concepts || [];
  const uploads = workspace.user_uploaded_assets || [];
  
  // Get all concepts
  const allConcepts = [
    ...(creativeMix.tofu || []).map((c: any, i: number) => ({ ...c, id: `tofu-${i}`, stage: 'TOFU' })),
    ...(creativeMix.mofu || []).map((c: any, i: number) => ({ ...c, id: `mofu-${i}`, stage: 'MOFU' })),
    ...(creativeMix.bofu || []).map((c: any, i: number) => ({ ...c, id: `bofu-${i}`, stage: 'BOFU' })),
  ];
  
  const lovedConceptsData = allConcepts.filter(c => lovedConcepts.includes(c.id));
  
  // Count by stage
  const lovedByStage = {
    tofu: lovedConceptsData.filter(c => c.stage === 'TOFU').length,
    mofu: lovedConceptsData.filter(c => c.stage === 'MOFU').length,
    bofu: lovedConceptsData.filter(c => c.stage === 'BOFU').length,
  };
  
  // Count by format
  const formatCounts = lovedConceptsData.reduce((acc: any, concept) => {
    const format = concept.format || 'other';
    acc[format] = (acc[format] || 0) + 1;
    return acc;
  }, {});
  
  // Generate simple to-do list
  const todoList: Array<{text: string; icon: any; count: number}> = [];
  
  if (formatCounts.talking_head) {
    todoList.push({
      text: `Record ${formatCounts.talking_head} talking head video${formatCounts.talking_head > 1 ? 's' : ''}`,
      icon: Video,
      count: formatCounts.talking_head
    });
  }
  if (formatCounts.b_roll) {
    todoList.push({
      text: `Record ${formatCounts.b_roll} B-roll sequence${formatCounts.b_roll > 1 ? 's' : ''}`,
      icon: Video,
      count: formatCounts.b_roll
    });
  }
  if (formatCounts.carousel) {
    todoList.push({
      text: `Design ${formatCounts.carousel} carousel${formatCounts.carousel > 1 ? 's' : ''}`,
      icon: Layers,
      count: formatCounts.carousel
    });
  }
  if (formatCounts.static) {
    todoList.push({
      text: `Design ${formatCounts.static} static graphic${formatCounts.static > 1 ? 's' : ''}`,
      icon: ImageIcon,
      count: formatCounts.static
    });
  }
  
  // Calculate progress
  const totalNeeded = todoList.reduce((sum, item) => sum + item.count, 0);
  const progress = totalNeeded > 0 ? Math.round((uploads.length / totalNeeded) * 100) : 0;
  
  // Validation
  const hasLovedConcepts = lovedConcepts.length > 0;
  const hasReasonableProgress = progress >= 30; // More lenient threshold
  const isReadyToFinalize = hasLovedConcepts && hasReasonableProgress;
  
  const warnings = [];
  if (!hasLovedConcepts) warnings.push("No creative ideas loved yet - click ❤️ Love It on concepts you want to use");
  if (!hasReasonableProgress && hasLovedConcepts) warnings.push(`Only ${uploads.length} of ${totalNeeded} assets uploaded`);

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-background/50 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="truncate">Your Creative Selection</span>
        </h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="pl-4 pr-4 py-4 space-y-4">
          
          {/* Loved Creative Count */}
          <Card className={lovedConcepts.length > 0 ? "border-pink-500/30 bg-pink-500/5" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className={`h-4 w-4 ${lovedConcepts.length > 0 ? 'fill-pink-500 text-pink-500' : ''}`} />
                Loved Creative Ideas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lovedConcepts.length > 0 ? (
                <>
                  <div className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                    {lovedConcepts.length}
                  </div>
                  <div className="space-y-1 text-sm">
                    {lovedByStage.tofu > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">TOFU (Awareness)</span>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                          {lovedByStage.tofu}
                        </Badge>
                      </div>
                    )}
                    {lovedByStage.mofu > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">MOFU (Consideration)</span>
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                          {lovedByStage.mofu}
                        </Badge>
                      </div>
                    )}
                    {lovedByStage.bofu > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">BOFU (Decision)</span>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                          {lovedByStage.bofu}
                        </Badge>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Click ❤️ Love It on creative ideas you want to use
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* What You Need to Create */}
          {todoList.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">📋 What You Need to Create</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {todoList.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
                  >
                    <div className="p-1.5 rounded bg-primary/10 flex-shrink-0">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm flex-1 break-words leading-tight pt-0.5">{item.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {/* Upload Progress */}
          {totalNeeded > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Uploads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-2xl font-bold">
                  <span>{uploads.length}</span>
                  <span className="text-muted-foreground text-lg">/ {totalNeeded}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        progress >= 50 ? 'bg-green-500' : 
                        progress >= 30 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                
                {uploads.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Recent uploads:</p>
                    <div className="space-y-1">
                      {uploads.slice(-3).reverse().map((asset: any) => (
                        <div key={asset.id} className="text-xs truncate flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                          <span className="truncate">{asset.file_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              <AlertDescription className="text-xs break-words">
                <ul className="space-y-1 mt-1">
                  {warnings.map((warning, i) => (
                    <li key={i} className="text-yellow-700 dark:text-yellow-400 break-words">
                      {warning}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Continue Button */}
          <Card className={isReadyToFinalize ? "border-green-500/50 bg-green-500/5" : "border-border/50"}>
            <CardContent className="pt-6 space-y-3">
              {isReadyToFinalize ? (
                <>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <p className="font-medium text-sm">Ready to Build!</p>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">
                    You've selected {lovedConcepts.length} creative idea{lovedConcepts.length !== 1 ? 's' : ''} 
                    {' '}and uploaded {uploads.length} asset{uploads.length !== 1 ? 's' : ''}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Almost There...</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {!hasLovedConcepts 
                      ? "Love some creative ideas to continue" 
                      : `Upload ${Math.ceil(totalNeeded * 0.3) - uploads.length} more asset${Math.ceil(totalNeeded * 0.3) - uploads.length !== 1 ? 's' : ''} to continue`
                    }
                  </p>
                </>
              )}
              
              <Button 
                onClick={onFinalize}
                disabled={!isReadyToFinalize}
                className="w-full gap-2 text-sm"
              >
                <span className="truncate">Continue to Campaign Builder</span>
                <ArrowRight className="h-4 w-4 flex-shrink-0" />
              </Button>
            </CardContent>
          </Card>
          
        </div>
      </ScrollArea>
    </div>
  );
}