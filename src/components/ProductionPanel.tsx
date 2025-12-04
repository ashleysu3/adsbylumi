import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Heart, 
  CheckCircle2, 
  Upload, 
  AlertTriangle, 
  ArrowRight,
  Target,
  Zap,
  TrendingUp,
  Video,
  Image as ImageIcon,
  Layers,
  FileText
} from "lucide-react";

interface ProductionPanelProps {
  workspace: any;
  onFinalize: () => void;
  onUpdate?: (updates: any) => void;
}

export function ProductionPanel({ workspace, onFinalize, onUpdate }: ProductionPanelProps) {
  const creative = workspace.creative_json || {};
  const creativeMix = creative.creative_mix || {};
  const lovedConcepts = workspace.loved_concepts || [];
  const uploads = workspace.user_uploaded_assets || [];

  // Aggregate all concepts - support both old and new structure
  const allConcepts = [
    ...(creativeMix.grow || creativeMix.tofu || []),
    ...(creativeMix.nurture || creativeMix.mofu || []),
    ...(creativeMix.convert || creativeMix.bofu || [])
  ];

  // Count loved by stage - support both structures
  const lovedByStage = {
    grow: lovedConcepts.filter((id: string) => 
      (creativeMix.grow || creativeMix.tofu)?.some((c: any) => c.id === id)
    ).length,
    nurture: lovedConcepts.filter((id: string) => 
      (creativeMix.nurture || creativeMix.mofu)?.some((c: any) => c.id === id)
    ).length,
    convert: lovedConcepts.filter((id: string) => 
      (creativeMix.convert || creativeMix.bofu)?.some((c: any) => c.id === id)
    ).length,
  };

  // Count loved by format
  const lovedConceptDetails = allConcepts.filter((c: any) => lovedConcepts.includes(c.id));
  const lovedByFormat = {
    talking_head: lovedConceptDetails.filter((c: any) => c.format === 'talking_head' || c.script).length,
    b_roll: lovedConceptDetails.filter((c: any) => c.format === 'b_roll' || c.broll_instructions).length,
    carousel: lovedConceptDetails.filter((c: any) => c.format === 'carousel').length,
    static: lovedConceptDetails.filter((c: any) => c.format === 'static').length,
  };

  // Build todo list based on required assets
  const todoList: string[] = [];
  if (lovedByFormat.talking_head > 0) {
    todoList.push(`Record ${lovedByFormat.talking_head} Talking Head video${lovedByFormat.talking_head > 1 ? 's' : ''}`);
  }
  if (lovedByFormat.b_roll > 0) {
    todoList.push(`Capture ${lovedByFormat.b_roll} B-roll footage set${lovedByFormat.b_roll > 1 ? 's' : ''}`);
  }
  if (lovedByFormat.carousel > 0) {
    todoList.push(`Design ${lovedByFormat.carousel} carousel${lovedByFormat.carousel > 1 ? 's' : ''}`);
  }
  if (lovedByFormat.static > 0) {
    todoList.push(`Create ${lovedByFormat.static} static graphic${lovedByFormat.static > 1 ? 's' : ''}`);
  }

  const totalNeeded = Object.values(lovedByFormat).reduce((sum, count) => sum + count, 0);
  const uploadProgress = totalNeeded > 0 ? Math.round((uploads.length / totalNeeded) * 100) : 0;
  const hasLovedConcepts = lovedConcepts.length > 0;
  const hasReasonableProgress = uploads.length >= Math.ceil(totalNeeded * 0.5);
  const isReadyToFinalize = hasLovedConcepts && (hasReasonableProgress || uploads.length >= 3);

  // Warnings
  const warnings: string[] = [];
  if (lovedConcepts.length === 0) warnings.push("No creative concepts selected yet");
  if (lovedConcepts.length < 3) warnings.push("Select at least 3-5 concepts for best results");
  if (!hasReasonableProgress && hasLovedConcepts) warnings.push(`Only ${uploads.length} of ${totalNeeded} assets uploaded`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Loved Creative Ideas */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
            Loved Creative Ideas
          </CardTitle>
          <CardDescription>
            {lovedConcepts.length} concept{lovedConcepts.length !== 1 ? 's' : ''} selected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-4xl font-bold text-center py-4">
            {lovedConcepts.length}
          </div>
          
          {lovedConcepts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">By Journey Stage:</p>
              <div className="flex flex-wrap gap-2">
                {lovedByStage.grow > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Target className="h-3 w-3" />
                    Grow: {lovedByStage.grow}
                  </Badge>
                )}
                {lovedByStage.nurture > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    Nurture: {lovedByStage.nurture}
                  </Badge>
                )}
                {lovedByStage.convert > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Convert: {lovedByStage.convert}
                  </Badge>
                )}
              </div>
              
              <p className="text-sm font-medium text-muted-foreground mt-4">By Format:</p>
              <div className="flex flex-wrap gap-2">
                {lovedByFormat.talking_head > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Video className="h-3 w-3" />
                    Scripts: {lovedByFormat.talking_head}
                  </Badge>
                )}
                {lovedByFormat.b_roll > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Video className="h-3 w-3" />
                    B-roll: {lovedByFormat.b_roll}
                  </Badge>
                )}
                {lovedByFormat.carousel > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Layers className="h-3 w-3" />
                    Carousels: {lovedByFormat.carousel}
                  </Badge>
                )}
                {lovedByFormat.static > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Static: {lovedByFormat.static}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What You Need to Create */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            What You Need to Create
          </CardTitle>
          <CardDescription>
            {todoList.length} production task{todoList.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todoList.length > 0 ? (
            <ul className="space-y-2">
              {todoList.map((task, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="break-words">{task}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select loved concepts in the Creative dashboard to see what needs to be created.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upload Progress */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Progress
          </CardTitle>
          <CardDescription>
            {uploads.length} of {totalNeeded} assets uploaded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>

          {uploads.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Recent Uploads:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {uploads.slice(-5).reverse().map((upload: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                    <Upload className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="truncate flex-1">{upload.file_name || `Asset ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warnings and Next Steps - Full Width */}
      <div className="lg:col-span-3 space-y-4">
        {warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((warning, idx) => (
                  <li key={idx} className="break-words">{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ready to Launch?</CardTitle>
            <CardDescription>
              {isReadyToFinalize 
                ? "You've selected creative concepts and uploaded assets. Continue to finalize your campaign."
                : "Complete the checklist above before proceeding to the campaign builder."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={onFinalize}
              disabled={!isReadyToFinalize}
              size="lg"
              className="w-full sm:w-auto gap-2"
            >
              <span className="whitespace-nowrap">Continue to Campaign Builder</span>
              <ArrowRight className="h-4 w-4 flex-shrink-0" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
