import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, FileText, Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopySelections {
  headlines: number[];
  descriptions: number[];
  primary_copy: number[];
}

interface AngleData {
  id: string;
  name: string;
  description?: string;
  hook?: string;
}

interface AngleCopyNavProps {
  angles: AngleData[];
  activeAngleId: string;
  onAngleChange: (angleId: string) => void;
  selections?: Record<string, CopySelections>;
  angleCopy?: Record<string, any>;
  creativeSelections?: Record<string, string[]>; // angleId -> array of creative cell ids in production
  currentTab?: "copy" | "ideas";
}

export function AngleCopyNav({
  angles,
  activeAngleId,
  onAngleChange,
  selections = {},
  angleCopy = {},
  creativeSelections = {},
  currentTab = "copy",
}: AngleCopyNavProps) {
  const currentIndex = angles.findIndex((a) => a.id === activeAngleId);
  const currentAngle = angles[currentIndex];

  const handlePrev = () => {
    if (currentIndex > 0) {
      onAngleChange(angles[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < angles.length - 1) {
      onAngleChange(angles[currentIndex + 1].id);
    }
  };

  const getAngleStatus = (angleId: string) => {
    const angleSelections = selections[angleId];
    const hasCopy = angleCopy[angleId] && (
      angleCopy[angleId].headlines?.length > 0 ||
      angleCopy[angleId].descriptions?.length > 0 ||
      angleCopy[angleId].primary_copy?.length > 0
    );
    
    const hasCopySelections = angleSelections && (
      (angleSelections.headlines?.length || 0) > 0 ||
      (angleSelections.descriptions?.length || 0) > 0 ||
      (angleSelections.primary_copy?.length || 0) > 0
    );

    const hasCreativeSelections = (creativeSelections[angleId]?.length || 0) > 0;

    return { hasCopy, hasCopySelections, hasCreativeSelections };
  };

  const getCopySelectionCount = (angleId: string) => {
    const angleSelections = selections[angleId];
    if (!angleSelections) return 0;
    return (
      (angleSelections.headlines?.length || 0) +
      (angleSelections.descriptions?.length || 0) +
      (angleSelections.primary_copy?.length || 0)
    );
  };

  const getCreativeSelectionCount = (angleId: string) => {
    return creativeSelections[angleId]?.length || 0;
  };

  // Determine guidance text based on current state
  const getGuidanceText = () => {
    const { hasCopySelections, hasCreativeSelections } = getAngleStatus(activeAngleId);
    
    if (!hasCopySelections && currentTab === "copy") {
      return "Select your favorite copy variations for this angle";
    }
    if (hasCopySelections && !hasCreativeSelections && currentTab === "ideas") {
      return "Now pick creative concepts to add to production";
    }
    if (hasCopySelections && hasCreativeSelections) {
      return "This angle is ready for production";
    }
    if (currentTab === "ideas") {
      return "Select creative concepts to add to your production checklist";
    }
    return "Review copy for each angle. Select your favorites to use in your campaign.";
  };

  // Count completed angles
  const completedAnglesCount = angles.filter(a => {
    const { hasCopySelections, hasCreativeSelections } = getAngleStatus(a.id);
    return hasCopySelections && hasCreativeSelections;
  }).length;

  return (
    <div className="space-y-4 w-full">
      {/* Contextual header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{getGuidanceText()}</span>
        </div>
        {completedAnglesCount > 0 && (
          <Badge variant="outline" className="text-xs gap-1">
            <Check className="h-3 w-3" />
            {completedAnglesCount} of {angles.length} complete
          </Badge>
        )}
      </div>

      {/* Navigation row */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="shrink-0 h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 flex gap-2 justify-between overflow-x-auto">
          {angles.map((angle, index) => {
            const isActive = angle.id === activeAngleId;
            const { hasCopy, hasCopySelections, hasCreativeSelections } = getAngleStatus(angle.id);
            const isComplete = hasCopySelections && hasCreativeSelections;

            return (
              <button
                key={angle.id}
                onClick={() => onAngleChange(angle.id)}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                  "border hover:border-primary/50 min-w-[100px]",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : isComplete
                    ? "bg-green-500/10 border-green-500/30 text-foreground"
                    : hasCopySelections || hasCreativeSelections
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : hasCopy
                    ? "bg-muted border-border text-foreground"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs opacity-60">{index + 1}.</span>
                  <span className="truncate max-w-[80px]">{angle.name}</span>
                </div>
                
                {/* Dual status badges */}
                <div className="flex items-center gap-1 mt-0.5">
                  {hasCopySelections ? (
                    <Badge
                      variant={isActive ? "secondary" : "default"}
                      className={cn(
                        "h-4 px-1 text-[10px] gap-0.5 shrink-0",
                        !isActive && "bg-primary/80"
                      )}
                    >
                      <FileText className="h-2.5 w-2.5" />
                      <Check className="h-2.5 w-2.5" />
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[10px] gap-0.5 shrink-0 opacity-40"
                    >
                      <FileText className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                  {hasCreativeSelections ? (
                    <Badge
                      variant={isActive ? "secondary" : "default"}
                      className={cn(
                        "h-4 px-1 text-[10px] gap-0.5 shrink-0",
                        !isActive && "bg-primary/80"
                      )}
                    >
                      <Lightbulb className="h-2.5 w-2.5" />
                      <Check className="h-2.5 w-2.5" />
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[10px] gap-0.5 shrink-0 opacity-40"
                    >
                      <Lightbulb className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={currentIndex >= angles.length - 1}
          className="shrink-0 h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Current angle indicator and description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              Angle {currentIndex + 1} of {angles.length}
            </Badge>
            {getAngleStatus(activeAngleId).hasCopySelections && (
              <Badge className="text-xs gap-1 bg-primary/80">
                <FileText className="h-3 w-3" />
                Copy selected ({getCopySelectionCount(activeAngleId)})
              </Badge>
            )}
            {getAngleStatus(activeAngleId).hasCreativeSelections && (
              <Badge className="text-xs gap-1 bg-primary/80">
                <Lightbulb className="h-3 w-3" />
                Creative selected ({getCreativeSelectionCount(activeAngleId)})
              </Badge>
            )}
            {getAngleStatus(activeAngleId).hasCopySelections && 
             getAngleStatus(activeAngleId).hasCreativeSelections && (
              <Badge className="text-xs gap-1 bg-green-600">
                <Check className="h-3 w-3" />
                Complete
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-base truncate">{currentAngle?.name}</h3>
          {(currentAngle?.description || currentAngle?.hook) && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {currentAngle?.description || currentAngle?.hook}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
