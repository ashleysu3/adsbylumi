import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecordingGuide } from "./RecordingGuide";
import { DesignGuide } from "./DesignGuide";
import { CopyEditor } from "./CopyEditor";
import { DragDropUploader } from "./DragDropUploader";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionWorkflowProps {
  item: any;
  workspace: any;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

type Step = "review" | "create" | "upload" | "copy" | "done";

const steps: Step[] = ["review", "create", "upload", "copy", "done"];

export function ProductionWorkflow({ item, workspace, open, onClose, onUpdate }: ProductionWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<Step>("review");
  const [updatedItem, setUpdatedItem] = useState(item);

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const isVideoFormat = ["talking_head", "broll"].includes(item.format);

  const handleNext = (step: Step) => {
    setCurrentStep(step);
  };

  const handleCreateComplete = async () => {
    // Update status to "recorded"
    const productionItems = workspace.production_items || [];
    const updatedItems = productionItems.map((pi: any) =>
      pi.id === item.id ? { ...pi, status: "recorded" } : pi
    );

    await supabase
      .from("campaign_workspaces")
      .update({ production_items: updatedItems })
      .eq("id", workspace.id);

    setUpdatedItem({ ...updatedItem, status: "recorded" });
    handleNext("upload");
    onUpdate();
  };

  const handleUploadComplete = async () => {
    handleNext("copy");
  };

  const handleCopyApprove = async (copy: any) => {
    // Update status to "approved" and save final copy
    const productionItems = workspace.production_items || [];
    const updatedItems = productionItems.map((pi: any) =>
      pi.id === item.id
        ? { ...pi, status: "approved", copy_finalized: true, final_copy: copy }
        : pi
    );

    await supabase
      .from("campaign_workspaces")
      .update({ production_items: updatedItems })
      .eq("id", workspace.id);

    toast.success("Concept approved and ready for campaign!");
    handleNext("done");
    onUpdate();
  };

  const handleFinish = () => {
    onClose();
    onUpdate();
  };

  const stageLabels: Record<string, string> = {
    tofu: "TOFU - Awareness",
    mofu: "MOFU - Consideration",
    bofu: "BOFU - Conversion",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {/* Progress Bar */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Production Progress</span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-6">
            {[
              { key: "review", label: "Review" },
              { key: "create", label: "Create" },
              { key: "upload", label: "Upload" },
              { key: "copy", label: "Copy" },
              { key: "done", label: "Done" },
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    steps.indexOf(currentStep) >= index
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {steps.indexOf(currentStep) > index ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`ml-2 text-sm ${
                    steps.indexOf(currentStep) >= index ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {index < 4 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="py-4">
          {currentStep === "review" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">{item.concept?.title || "Untitled Concept"}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stageLabels[item.stage.toLowerCase()] || item.stage}</Badge>
                  <Badge variant="secondary" className="capitalize">
                    {item.format.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Concept Preview</h3>
                {item.concept?.hook && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hook</p>
                    <p className="text-sm mt-1">{item.concept.hook}</p>
                  </div>
                )}
                {item.concept?.script && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Script</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{item.concept.script}</p>
                  </div>
                )}
                {item.concept?.primary_copy && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Primary Copy</p>
                    <p className="text-sm mt-1">{item.concept.primary_copy}</p>
                  </div>
                )}
              </Card>

              {item.production_notes && (
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-2">Your Production Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.production_notes}</p>
                </Card>
              )}

              <Button onClick={() => handleNext("create")} className="w-full" size="lg">
                Ready to {isVideoFormat ? "Record" : "Design"} →
              </Button>
            </div>
          )}

          {currentStep === "create" && (
            <>
              {isVideoFormat ? (
                <RecordingGuide
                  concept={item.concept}
                  onComplete={handleCreateComplete}
                  onBack={() => handleNext("review")}
                />
              ) : (
                <DesignGuide
                  concept={item.concept}
                  onComplete={handleCreateComplete}
                  onBack={() => handleNext("review")}
                />
              )}
            </>
          )}

          {currentStep === "upload" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Upload Your Creative</h2>
                <p className="text-muted-foreground">
                  Upload the {isVideoFormat ? "video" : "image"} you created for this concept
                </p>
              </div>

              <DragDropUploader workspace={workspace} onUpdate={onUpdate} />

              <div className="flex gap-3 justify-between pt-4">
                <Button variant="outline" onClick={() => handleNext("create")}>
                  ← Back
                </Button>
                <Button onClick={handleUploadComplete}>Continue to Copy Review →</Button>
              </div>
            </div>
          )}

          {currentStep === "copy" && (
            <CopyEditor
              concept={updatedItem.concept}
              uploadedAsset={workspace.user_uploaded_assets?.find(
                (asset: any) => asset.linked_concept_id === item.concept_id || 
                                asset.id === updatedItem.uploaded_asset_id
              )}
              workspace={workspace}
              initialCopy={updatedItem.final_copy}
              onApprove={handleCopyApprove}
              onBack={() => handleNext("upload")}
            />
          )}

          {currentStep === "done" && (
            <div className="space-y-6 text-center py-8">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Concept Ready for Campaign! 🎉</h2>
                <p className="text-muted-foreground">
                  This concept is now ready to be pushed to Meta Ads Manager when you build your campaign.
                </p>
              </div>

              <Card className="p-6 text-left bg-muted/30">
                <h3 className="font-semibold mb-2">What's Next?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Work on your next concept to build out your campaign</li>
                  <li>• Once you have 3+ concepts ready, go to Campaign Builder</li>
                  <li>• Review all your concepts and push them live to Meta</li>
                </ul>
              </Card>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleFinish}>
                  Back to Dashboard
                </Button>
                <Button onClick={handleFinish}>Next Concept →</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
