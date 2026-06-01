import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Library, ChevronDown, Upload, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

const STORAGE_KEY = "lumi_production_wizard_seen_v1";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tip?: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to your Production Checklist",
    body:
      "This is where your angles, copy, and creative briefs come together. Lumi already organized everything into the angles you picked — your job is to film or design the creative and drop it in.",
    tip: "Take a quick tour (4 steps) so nothing feels overwhelming.",
  },
  {
    icon: ChevronDown,
    title: "Open any card for the full brief",
    body:
      "Click a creative card to expand it. You'll see the hook, the talking-head script, the b-roll suggestions, on-screen text overlays, headlines, and primary copy — everything you need to shoot or design that ad.",
  },
  {
    icon: Upload,
    title: "Drop your creative into the upload box",
    body:
      "Once you've made the video or image, drag it into the upload box on that card (or click to browse). Lumi automatically pairs it with the right copy and angle.",
    tip: "Videos must be 9:16 vertical. Files up to 250MB.",
  },
  {
    icon: Download,
    title: "Export or save what you don't need yet",
    body:
      "Use ‘Export Production Checklist’ to download a CSV for yourself, your editor, or your client. Use ‘Move to Concept Library’ to stash cards you want to come back to later without losing them.",
  },
];

export function ProductionChecklistWizard({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, [enabled]);

  const close = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 flex items-center justify-center text-white">
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        {current.tip && (
          <div className="rounded-md bg-muted/60 border px-3 py-2 text-xs text-muted-foreground">
            💡 {current.tip}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="text-muted-foreground"
          >
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              variant="lumi"
              onClick={() => (isLast ? close() : setStep(step + 1))}
            >
              {isLast ? "Got it" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
