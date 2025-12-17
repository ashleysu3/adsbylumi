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

  const canContinue = selectedAngles.length >= 3 && selectedAngles.length <= 5;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-bold">Choose Your Creative Angles</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Select 3–5 angles that feel right for this campaign. Each angle will become a set of creative ideas you can choose from.
        </p>
        <p className="text-sm text-muted-foreground">
          {selectedAngles.length} of 3–5 selected
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {angles.map((angle) => {
          const isSelected = selectedAngles.includes(angle.id);
          const isDisabled = !isSelected && selectedAngles.length >= 5;

          return (
            <Card
              key={angle.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected && "ring-2 ring-primary bg-primary/5",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !isDisabled && toggleAngle(angle.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">
                    {angle.name}
                  </CardTitle>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isDisabled && toggleAngle(angle.id)}
                    disabled={isDisabled}
                    className="mt-0.5"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {angle.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={onContinue}
          disabled={!canContinue || isGenerating}
          size="lg"
          className="min-w-[200px]"
        >
          {isGenerating ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
              Creating ideas...
            </>
          ) : (
            <>
              Generate Creative Ideas
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
