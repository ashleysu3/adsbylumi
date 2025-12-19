import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
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
}

export function AngleCopyNav({
  angles,
  activeAngleId,
  onAngleChange,
  selections = {},
  angleCopy = {},
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
    
    const hasSelections = angleSelections && (
      (angleSelections.headlines?.length || 0) > 0 ||
      (angleSelections.descriptions?.length || 0) > 0 ||
      (angleSelections.primary_copy?.length || 0) > 0
    );

    return { hasCopy, hasSelections };
  };

  const getSelectionCount = (angleId: string) => {
    const angleSelections = selections[angleId];
    if (!angleSelections) return 0;
    return (
      (angleSelections.headlines?.length || 0) +
      (angleSelections.descriptions?.length || 0) +
      (angleSelections.primary_copy?.length || 0)
    );
  };

  return (
    <div className="space-y-4">
      {/* Contextual header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>
          Review copy for each creative angle. Select your favorites to use in your campaign.
        </span>
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

        <div className="flex-1 flex gap-2 justify-between">
          {angles.map((angle, index) => {
            const isActive = angle.id === activeAngleId;
            const { hasCopy, hasSelections } = getAngleStatus(angle.id);
            const selectionCount = getSelectionCount(angle.id);

            return (
              <button
                key={angle.id}
                onClick={() => onAngleChange(angle.id)}
                className={cn(
                  "relative flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all",
                  "border hover:border-primary/50 min-w-0",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : hasSelections
                    ? "bg-primary/10 border-primary/30 text-foreground"
                    : hasCopy
                    ? "bg-muted border-border text-foreground"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                <span className="text-xs opacity-60">{index + 1}.</span>
                <span className="truncate">{angle.name}</span>
                {hasSelections && (
                  <Badge
                    variant={isActive ? "secondary" : "default"}
                    className="h-5 px-1.5 text-xs gap-0.5 shrink-0"
                  >
                    <Check className="h-3 w-3" />
                    {selectionCount}
                  </Badge>
                )}
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
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              Angle {currentIndex + 1} of {angles.length}
            </Badge>
            {getAngleStatus(activeAngleId).hasSelections && (
              <Badge className="text-xs gap-1 bg-primary">
                <Check className="h-3 w-3" />
                Selections made
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
