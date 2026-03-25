import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight, Lock, Pin, Plus, Loader2, Wand2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface CreativeAngle {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

interface AngleSelectorProps {
  angles: CreativeAngle[];
  selectedAngles: string[];
  onSelectionChange: (selected: string[]) => void;
  onContinue: () => void;
  isGenerating?: boolean;
  onAddCustomAngle?: (angle: CreativeAngle) => void;
  onRegenerateAngle?: (angleId: string) => void;
  regeneratingAngleId?: string | null;
  brandName?: string;
  offerData?: { name?: string; description?: string; price?: string };
}

export function AngleSelector({
  angles,
  selectedAngles,
  onSelectionChange,
  onContinue,
  isGenerating,
  onAddCustomAngle,
  onRegenerateAngle,
  regeneratingAngleId,
  brandName,
  offerData
}: AngleSelectorProps) {
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [originalInput, setOriginalInput] = useState("");

  const toggleAngle = (angleId: string) => {
    const angle = angles.find(a => a.id === angleId);
    if (angle?.isDefault) return;
    
    if (selectedAngles.includes(angleId)) {
      onSelectionChange(selectedAngles.filter(id => id !== angleId));
    } else if (selectedAngles.length < 5) {
      onSelectionChange([...selectedAngles, angleId]);
    }
  };

  // Generate a descriptive slug ID from an angle name to keep keys stable and readable
  const toSlugId = (name: string): string => {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40);
    // Ensure uniqueness against existing angles
    const existingIds = new Set(angles.map(a => a.id));
    if (!existingIds.has(base) && base.length > 0) return base;
    // Append a short suffix for uniqueness
    const suffix = Date.now().toString(36).slice(-4);
    return `${base || 'custom'}_${suffix}`;
  };

  const handleCustomSubmit = async (inputText: string, clarification?: string) => {
    setCustomLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-custom-angle", {
        body: {
          userInput: inputText,
          clarificationAnswer: clarification || undefined,
          brandName,
          offerData,
          existingAngles: angles,
        },
      });
      if (error) throw error;

      if (data.needsClarification) {
        setClarificationQuestion(data.question);
        setOriginalInput(inputText);
        setClarificationAnswer("");
      } else if (data.angle) {
        const newAngle: CreativeAngle = {
          id: toSlugId(data.angle.name),
          name: data.angle.name,
          description: data.angle.description,
          isCustom: true,
        };
        onAddCustomAngle?.(newAngle);
        // Auto-select the new angle if under limit
        if (selectedAngles.length < 5) {
          onSelectionChange([...selectedAngles, newAngle.id]);
        }
        resetCustomDialog();
        toast.success(`"${newAngle.name}" added!`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to create angle");
    } finally {
      setCustomLoading(false);
    }
  };

  const resetCustomDialog = () => {
    setShowCustomDialog(false);
    setCustomInput("");
    setClarificationQuestion(null);
    setClarificationAnswer("");
    setOriginalInput("");
  };

  const canContinue = selectedAngles.length >= 1 && selectedAngles.length <= 5;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center space-y-3 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-display font-bold">Choose Your Creative Angles</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto px-2">
          Select up to 5 angles. Each angle becomes a set of creative ideas.
        </p>
        {/* Visual progress indicator */}
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
                style={{ transitionDelay: isFilled ? `${(slot - 1) * 50}ms` : '0ms' }}
                title={`Slot ${slot}`}
              />
            );
          })}
          <span className={cn(
            "ml-2 text-xs sm:text-sm transition-colors duration-200",
            selectedAngles.length >= 1 ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {selectedAngles.length === 0 ? "Select at least 1" : selectedAngles.length === 5 ? "Max" : `${selectedAngles.length}/5`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {angles.map((angle) => {
          const isSelected = selectedAngles.includes(angle.id);
          const isDefault = angle.isDefault === true;
          const isDisabled = isDefault || (!isSelected && selectedAngles.length >= 5);
          const isThisRegenerating = regeneratingAngleId === angle.id;

          return (
            <Card
              key={angle.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] border-2 group relative",
                isDefault && "border-primary/30 border-dashed bg-primary/5 cursor-default",
                !isDefault && isSelected && "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md",
                !isDefault && !isSelected && !isDisabled && "border-transparent hover:border-primary/40",
                !isDefault && isDisabled && "opacity-50 cursor-not-allowed border-muted"
              )}
              onClick={() => !isDefault && !isDisabled && toggleAngle(angle.id)}
            >
              <CardHeader className="pb-2 p-3 sm:p-4 sm:pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isDefault && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <CardTitle className="text-sm sm:text-base font-bold leading-tight">
                      {angle.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDefault && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Always included</Badge>
                    )}
                    {angle.isCustom && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-primary/40 text-primary">Custom</Badge>
                    )}
                    {isDefault ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => !isDisabled && toggleAngle(angle.id)}
                        disabled={isDisabled}
                        className="mt-0.5 h-5 w-5"
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <CardDescription className="text-xs sm:text-sm">{angle.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Your Own card */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 bg-muted/20",
            selectedAngles.length >= 5 && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => selectedAngles.length < 5 && setShowCustomDialog(true)}
        >
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[120px] p-4 gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-center">Add Your Own</p>
            <p className="text-xs text-muted-foreground text-center">Describe your angle idea</p>
          </CardContent>
        </Card>
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

      {/* Custom Angle Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={(open) => { if (!open) resetCustomDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              {clarificationQuestion ? "One more thing..." : "Add Your Own Angle"}
            </DialogTitle>
            <DialogDescription>
              {clarificationQuestion
                ? "Lumi needs a little more info to craft this angle for you."
                : "Describe a creative angle you'd like to try. Lumi will shape it into a proper format."}
            </DialogDescription>
          </DialogHeader>

          {clarificationQuestion ? (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm font-medium">{clarificationQuestion}</p>
              </div>
              <Input
                placeholder="Your answer..."
                value={clarificationAnswer}
                onChange={(e) => setClarificationAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clarificationAnswer.trim()) {
                    handleCustomSubmit(originalInput, clarificationAnswer);
                  }
                }}
                disabled={customLoading}
                autoFocus
              />
            </div>
          ) : (
            <Input
              placeholder={"e.g. \"Focus on the time they'll save\" or \"Use social proof\""}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customInput.trim()) {
                  handleCustomSubmit(customInput);
                }
              }}
              disabled={customLoading}
              autoFocus
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetCustomDialog} disabled={customLoading}>Cancel</Button>
            <Button
              onClick={() => {
                if (clarificationQuestion) {
                  handleCustomSubmit(originalInput, clarificationAnswer);
                } else {
                  handleCustomSubmit(customInput);
                }
              }}
              disabled={customLoading || (clarificationQuestion ? !clarificationAnswer.trim() : !customInput.trim())}
            >
              {customLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Create Angle</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
