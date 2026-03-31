import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, ChevronDown, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CopyFeedback {
  quickSelections: string[];
  additionalNotes: string;
  timestamp: string;
}

interface CopyRegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate: (feedback: CopyFeedback | null) => void;
  onSkip: () => void;
  isGenerating: boolean;
  angleCount?: number;
  title?: string;
  description?: string;
}

const QUICK_SELECT_OPTIONS = [
  {
    id: "too_generic",
    label: "Copy feels too generic",
    description: "Need more specific, unique messaging"
  },
  {
    id: "wrong_tone",
    label: "Tone doesn't match brand",
    description: "Adjust voice to better fit brand personality"
  },
  {
    id: "more_urgency",
    label: "Need more urgency",
    description: "Add scarcity or time-sensitive language"
  },
  {
    id: "focus_benefits",
    label: "Focus more on benefits",
    description: "Emphasize outcomes over features"
  },
  {
    id: "shorter_copy",
    label: "Make it shorter",
    description: "Tighter, punchier messaging"
  },
  {
    id: "more_emotional",
    label: "Make it more emotional",
    description: "Connect with pain points and desires"
  }
];

export function CopyRegenerateDialog({
  open,
  onOpenChange,
  onRegenerate,
  onSkip,
  isGenerating,
  angleCount = 1
}: CopyRegenerateDialogProps) {
  const [expanded, setExpanded] = useState(true);
  const [quickSelections, setQuickSelections] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const toggleSelection = (id: string) => {
    setQuickSelections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleRegenerate = () => {
    const hasContext = quickSelections.length > 0 || additionalNotes.trim();
    if (hasContext) {
      onRegenerate({
        quickSelections,
        additionalNotes: additionalNotes.trim(),
        timestamp: new Date().toISOString()
      });
    } else {
      onRegenerate(null);
    }
    // Reset state after regenerating
    setQuickSelections([]);
    setAdditionalNotes("");
  };

  const handleSkip = () => {
    onSkip();
    setQuickSelections([]);
    setAdditionalNotes("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setQuickSelections([]);
      setAdditionalNotes("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Regenerate Ad Copy
          </DialogTitle>
          <DialogDescription>
            Help Lumi create better copy for your {angleCount} angle{angleCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-4 py-3 h-auto bg-muted/50 hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">What should Lumi improve?</span>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    expanded && "rotate-180"
                  )} 
                />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Quick select any that apply:</p>
                <div className="grid gap-2">
                  {QUICK_SELECT_OPTIONS.map(option => (
                    <label
                      key={option.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        quickSelections.includes(option.id) 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <Checkbox
                        checked={quickSelections.includes(option.id)}
                        onCheckedChange={() => toggleSelection(option.id)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Anything else Lumi should know?
                </label>
                <Textarea
                  placeholder="E.g., 'Focus on the time-saving aspect' or 'Use more conversational language'"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              disabled={isGenerating}
            >
              Skip & Regenerate
            </Button>
            <Button 
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Regenerate Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
