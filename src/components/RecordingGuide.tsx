import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Video, Lightbulb } from "lucide-react";
import { useState } from "react";

interface RecordingGuideProps {
  concept: any;
  onComplete: () => void;
  onBack: () => void;
}

export function RecordingGuide({ concept = {}, onComplete, onBack }: RecordingGuideProps) {
  const [checklist, setChecklist] = useState({
    lighting: false,
    camera: false,
    audio: false,
    background: false,
  });

  const allChecked = Object.values(checklist).every((v) => v);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Video className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Recording Checklist</h2>
          <p className="text-muted-foreground">
            {concept.format === "talking_head" ? "Talking Head Video" : "B-Roll Footage"}
          </p>
        </div>
      </div>

      {/* Pre-Recording Checklist */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg">Before You Start</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="lighting"
              checked={checklist.lighting}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, lighting: checked as boolean })
              }
            />
            <Label htmlFor="lighting" className="cursor-pointer">
              Set up ring light or natural lighting
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="camera"
              checked={checklist.camera}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, camera: checked as boolean })
              }
            />
            <Label htmlFor="camera" className="cursor-pointer">
              Position camera at eye level (or as needed for b-roll)
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="audio"
              checked={checklist.audio}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, audio: checked as boolean })
              }
            />
            <Label htmlFor="audio" className="cursor-pointer">
              Test audio with lapel mic or phone microphone
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="background"
              checked={checklist.background}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, background: checked as boolean })
              }
            />
            <Label htmlFor="background" className="cursor-pointer">
              Clear background or set up scene
            </Label>
          </div>
        </div>
      </Card>

      {/* Script or Shot List */}
      {concept.script && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold text-lg">Script to Read</h3>
          <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
            {concept.script}
          </div>
        </Card>
      )}

      {concept.broll_direction && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold text-lg">B-Roll Shot List</h3>
          <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
            {concept.broll_direction}
          </div>
        </Card>
      )}

      {/* Pro Tips */}
      <Card className="p-6 space-y-3 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Pro Tips</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground ml-7">
          <li>• Film 3-5 takes for variety and backup options</li>
          <li>• Keep energy high and authentic - people connect with real emotion</li>
          <li>• Target 45-60 seconds for optimal engagement</li>
          <li>• Film in landscape (16:9) for maximum placement options</li>
          <li>• Add captions later - most users watch without sound</li>
        </ul>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onComplete} disabled={!allChecked}>
          Mark as Recorded →
        </Button>
      </div>
    </div>
  );
}
