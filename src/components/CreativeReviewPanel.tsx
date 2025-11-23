import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Upload,
  ArrowRight,
  Video,
  Image as ImageIcon,
  Layers,
  FileText
} from "lucide-react";

interface CreativeReviewPanelProps {
  workspace: any;
  onFinalize: () => void;
}

const formatIcons = {
  talking_head: Video,
  b_roll: Video,
  carousel: Layers,
  static: ImageIcon,
  script: FileText,
};

export function CreativeReviewPanel({ workspace, onFinalize }: CreativeReviewPanelProps) {
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || {};
  const checklist = workspace.production_checklist || [];
  const uploads = workspace.user_uploaded_assets || [];
  
  // Get selected concepts from checklist
  const selectedConceptIds = new Set(checklist.map((item: any) => item.concept_id).filter(Boolean));
  
  const allConcepts = [
    ...(creativeMix.tofu || []).map((c: any, i: number) => ({ ...c, id: `tofu-${i}`, stage: 'tofu' })),
    ...(creativeMix.mofu || []).map((c: any, i: number) => ({ ...c, id: `mofu-${i}`, stage: 'mofu' })),
    ...(creativeMix.bofu || []).map((c: any, i: number) => ({ ...c, id: `bofu-${i}`, stage: 'bofu' })),
  ];
  
  const selectedConcepts = allConcepts.filter(c => selectedConceptIds.has(c.id));
  
  const checklistCompleted = checklist.filter((i: any) => i.completed).length;
  const checklistTotal = checklist.length;
  const checklistProgress = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
  
  // Validation
  const hasSelectedConcepts = selectedConcepts.length > 0;
  const hasUploads = uploads.length > 0;
  const isReadyToFinalize = hasSelectedConcepts && hasUploads && checklistProgress >= 50;
  
  const warnings = [];
  if (!hasSelectedConcepts) warnings.push("No creative concepts selected");
  if (!hasUploads) warnings.push("No assets uploaded");
  if (checklistProgress < 50) warnings.push("Less than 50% of checklist completed");

  return (
    <div className="w-80 border-l border-border bg-background/50 backdrop-blur-sm">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm text-muted-foreground">Review & Finalize</h3>
      </div>
      
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-4 space-y-4">
          
          {/* Progress Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Selected Concepts</span>
                  <span className="font-medium">{selectedConcepts.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploaded Assets</span>
                  <span className="font-medium">{uploads.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Checklist</span>
                  <span className="font-medium">{checklistCompleted}/{checklistTotal}</span>
                </div>
              </div>
              
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Overall Progress</span>
                  <span className="text-xs font-medium">{checklistProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Selected Concepts */}
          {selectedConcepts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Selected Concepts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedConcepts.map((concept) => {
                  const Icon = formatIcons[concept.format as keyof typeof formatIcons] || FileText;
                  const linkedAssets = uploads.filter((a: any) => a.linked_concept_id === concept.id);
                  
                  return (
                    <div 
                      key={concept.id} 
                      className="p-2 bg-muted/30 rounded-md space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium flex-1">{concept.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs h-5">
                          {concept.stage.toUpperCase()}
                        </Badge>
                        {linkedAssets.length > 0 && (
                          <Badge variant="default" className="text-xs h-5 gap-1">
                            <Upload className="h-2 w-2" />
                            {linkedAssets.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          
          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <p className="font-medium mb-1">Missing:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Finalize Button */}
          <Card className={isReadyToFinalize ? "border-green-500/50 bg-green-500/5" : ""}>
            <CardContent className="pt-6 space-y-3">
              {isReadyToFinalize ? (
                <>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-medium text-sm">Ready to Build Campaign</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You've selected {selectedConcepts.length} concept{selectedConcepts.length !== 1 ? 's' : ''} 
                    {' '}and uploaded {uploads.length} asset{uploads.length !== 1 ? 's' : ''}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Not Ready Yet</p>
                  <p className="text-xs text-muted-foreground">
                    Complete the steps above to finalize your creative and continue to the Campaign Builder.
                  </p>
                </>
              )}
              
              <Button 
                onClick={onFinalize}
                disabled={!isReadyToFinalize}
                className="w-full gap-2"
              >
                Continue to Campaign Builder
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          
        </div>
      </ScrollArea>
    </div>
  );
}
