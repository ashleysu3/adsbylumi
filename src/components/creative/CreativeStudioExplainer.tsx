import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Layers, FileText, Rocket } from "lucide-react";

const STORAGE_KEY = "creative-studio-explainer-dismissed";

interface CreativeStudioExplainerProps {
  open: boolean;
  onClose: () => void;
}

export function CreativeStudioExplainer({ open, onClose }: CreativeStudioExplainerProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onClose();
  };

  const steps = [
    {
      icon: Layers,
      title: "1. Pick Your Angles",
      description: "Choose 2-4 messaging angles that resonate with your audience. Each angle is a unique way to position your offer."
    },
    {
      icon: Sparkles,
      title: "2. Generate Creative",
      description: "For each angle, we'll generate a mix of creative concepts — talking head scripts, b-roll ideas, and static graphics."
    },
    {
      icon: FileText,
      title: "3. Generate Copy",
      description: "Each angle gets 3-5 variations of headlines, descriptions, and primary copy. This copy is shared across all creatives in that angle."
    },
    {
      icon: Rocket,
      title: "4. Build & Launch",
      description: "Upload your assets, preview how ads will look, and push everything to your campaign when ready."
    }
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome to Creative Studio
          </DialogTitle>
          <DialogDescription>
            Here's how to create scroll-stopping ads in 4 simple steps
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div 
                key={index}
                className="flex gap-4 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{step.title}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="dont-show" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label 
              htmlFor="dont-show" 
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              I've got it. Don't show me this again.
            </label>
          </div>
          <Button onClick={handleClose}>
            Let's Go!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCreativeStudioExplainer() {
  const [showExplainer, setShowExplainer] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== "true";
  });

  const closeExplainer = () => setShowExplainer(false);

  return { showExplainer, closeExplainer };
}
