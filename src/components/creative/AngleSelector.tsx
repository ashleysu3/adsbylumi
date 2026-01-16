import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreativeAngle {
  id: string;
  name: string;
  description: string;
}

interface AngleSelectorProps {
  angles: CreativeAngle[];
  selectedAngles: string[];
  onSelectionChange: (selected: string[]) => void;
  onContinue: () => void;
  isGenerating?: boolean;
}

export function AngleSelector({
  angles,
  selectedAngles,
  onSelectionChange,
  onContinue,
  isGenerating
}: AngleSelectorProps) {
  const toggleAngle = (angleId: string) => {
    if (selectedAngles.includes(angleId)) {
      onSelectionChange(selectedAngles.filter(id => id !== angleId));
    } else if (selectedAngles.length < 5) {
      onSelectionChange([...selectedAngles, angleId]);
    }
  };

  const canContinue = selectedAngles.length >= 1 && selectedAngles.length <= 5;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center space-y-3 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-display font-bold">Choose Your Creative Angles</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto px-2">
          Select up to 5 angles. Each angle becomes a set of creative ideas.
        </p>
        {/* Visual progress indicator with animations */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((slot) => {
            const isFilled = slot <= selectedAngles.length;
            const isJustFilled = slot === selectedAngles.length;
            return (
              <div
                key={slot}
                className={cn(
                  "w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ease-out",
                  isFilled ? "bg-primary" : "bg-muted",
                  isJustFilled && "animate-[bounce_0.4s_ease-out]",
                  isFilled && "scale-110"
                )}
                style={{
                  transitionDelay: isFilled ? `${(slot - 1) * 50}ms` : '0ms'
                }}
                title={`Slot ${slot}`}
              />
            );
          })}
          <span className={cn(
            "ml-2 text-xs sm:text-sm transition-colors duration-200",
            selectedAngles.length >= 1 ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {selectedAngles.length === 0 
              ? "Select at least 1"
              : selectedAngles.length === 5 
              ? "Max" 
              : `${selectedAngles.length}/5`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {angles.map((angle) => {
          const isSelected = selectedAngles.includes(angle.id);
          const isDisabled = !isSelected && selectedAngles.length >= 5;

          return (
            <Card
              key={angle.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]",
                isSelected && "ring-2 ring-primary bg-primary/5",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !isDisabled && toggleAngle(angle.id)}
            >
              <CardHeader className="pb-2 p-3 sm:p-4 sm:pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm sm:text-base font-semibold leading-tight">
                    {angle.name}
                  </CardTitle>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isDisabled && toggleAngle(angle.id)}
                    disabled={isDisabled}
                    className="mt-0.5 h-5 w-5"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <CardDescription className="text-xs sm:text-sm line-clamp-3">
                  {angle.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-2 sm:pt-4 sticky bottom-4 z-10">
        <Button
          onClick={onContinue}
          disabled={!canContinue || isGenerating}
          size="lg"
          className="min-w-[180px] sm:min-w-[200px] min-h-[44px] shadow-lg"
        >
          {isGenerating ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
              Creating...
            </>
          ) : (
            <>
              Generate Ideas
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
