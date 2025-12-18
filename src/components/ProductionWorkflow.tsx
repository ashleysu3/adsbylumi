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
import { CheckCircle2, ArrowRight, Sparkle } from "lucide-react";
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
    // Find the most recently uploaded asset for this concept
    const latestAsset = workspace.user_uploaded_assets?.find(
      (asset: any) => asset.linked_concept_id === item.concept_id
    );
    
    if (latestAsset) {
      // Update production item with full asset object (not just ID)
      // This is required by build-meta-campaign to upload to Meta
      const productionItems = workspace.production_items || [];
      const updatedItems = productionItems.map((pi: any) =>
        pi.id === item.id ? { 
          ...pi, 
          uploaded_asset_id: latestAsset.id,
          linkedAsset: {
            id: latestAsset.id,
            url: latestAsset.file_url,
            storagePath: latestAsset.storage_path,
            type: latestAsset.file_type,
            fileName: latestAsset.file_name
          }
        } : pi
      );
      
      await supabase
        .from("campaign_workspaces")
        .update({ production_items: updatedItems })
        .eq("id", workspace.id);
      
      setUpdatedItem({ 
        ...updatedItem, 
        uploaded_asset_id: latestAsset.id,
        linkedAsset: {
          id: latestAsset.id,
          url: latestAsset.file_url,
          storagePath: latestAsset.storage_path,
          type: latestAsset.file_type,
          fileName: latestAsset.file_name
        }
      });
    }
    
    handleNext("copy");
    onUpdate();
  };

  const handleCopyApprove = async (copy: any) => {
    // Update status to "approved" and save final copy with consistent field names
    // Field names must match what build-meta-campaign expects: headline, primaryText, description, cta
    const productionItems = workspace.production_items || [];
    const updatedItems = productionItems.map((pi: any) =>
      pi.id === item.id
        ? { 
            ...pi, 
            status: "approved", 
            copy_finalized: true, 
            finalCopy: {
              headline: copy.headline,
              primaryText: copy.primary_text || copy.primaryText,
              description: copy.description,
              cta: copy.call_to_action || copy.cta
            }
          }
        : pi
    );

    await supabase
      .from("campaign_workspaces")
      .update({ production_items: updatedItems })
      .eq("id", workspace.id);

    // Check if we now have 3+ approved concepts to auto-update status
    const approvedCount = updatedItems.filter((i: any) => i.status === "approved").length;
    if (approvedCount >= 3 && workspace.progress_status !== "ready_to_publish") {
      await supabase
        .from("campaign_workspaces")
        .update({ progress_status: "ready_to_publish" })
        .eq("id", workspace.id);
      toast.success("🎉 You have 3+ approved concepts! Ready to build your campaign!");
    } else {
      toast.success("Concept approved and ready for campaign!");
    }
    
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
                <h2 className="text-2xl font-bold mb-2">{item.concept?.title || (item as any).hook || "Untitled Concept"}</h2>
                <div className="flex items-center gap-2">
                  {item.stage && (
                    <Badge variant="outline">{stageLabels[item.stage.toLowerCase()] || item.stage}</Badge>
                  )}
                  {(item as any).angleName && (
                    <Badge variant="outline">{(item as any).angleName}</Badge>
                  )}
                  <Badge variant="secondary" className="capitalize">
                    {(item.format || "").replace(/_/g, " ") || "Unknown format"}
                  </Badge>
                </div>
              </div>

              {/* Creative Direction (from creative dashboard) */}
              {((item as any).guidance || (item as any).notes || item.concept?.guidance || item.concept?.notes) && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                    <Sparkle className="h-4 w-4 animate-sparkle-pulse" />
                    Creative Direction
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {(item as any).guidance || (item as any).notes || item.concept?.guidance || item.concept?.notes}
                  </p>
                </Card>
              )}

              {/* Only show Concept Preview if there's actual concept data */}
              {item.concept && (
                item.concept.psychology_trigger ||
                item.concept.script ||
                item.concept.overlay_text ||
                item.concept.broll_instructions ||
                item.concept.static_layout ||
                item.concept.production_notes ||
                item.concept.why_it_works
              ) && (
                <Card className="p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Concept Preview</h3>
                  
                  {/* Show Psychology Trigger (all formats) */}
                  {item.concept?.psychology_trigger && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Psychology Trigger</p>
                      <p className="text-sm mt-1">{item.concept.psychology_trigger}</p>
                    </div>
                  )}

                  {/* Talking Head Format */}
                  {item.format === "talking_head" && (
                    <>
                      {item.concept?.script && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Script</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{item.concept.script}</p>
                        </div>
                      )}
                      {item.concept?.overlay_text && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Overlay Text</p>
                          <div className="space-y-1 mt-1">
                            {item.concept.overlay_text.map((text: string, i: number) => (
                              <p key={i} className="text-sm text-muted-foreground">• {text}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* B Roll Format */}
                  {item.format === "broll" && (
                    <>
                      {item.concept?.broll_instructions && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">B-Roll Shot List</p>
                          <div className="space-y-2 mt-2">
                            {item.concept.broll_instructions.map((instruction: string, i: number) => (
                              <div key={i} className="p-3 bg-muted/50 rounded-md">
                                <p className="text-sm">{instruction}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Static/Graphic Format */}
                  {(item.format === "static" || item.format === "graphic") && (
                    <>
                      {item.concept?.static_layout && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Static Layout</p>
                          <div className="space-y-2 mt-2">
                            {item.concept.static_layout.headline && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Headline</p>
                                <p className="text-sm">{item.concept.static_layout.headline}</p>
                              </div>
                            )}
                            {item.concept.static_layout.subheadline && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Subheadline</p>
                                <p className="text-sm">{item.concept.static_layout.subheadline}</p>
                              </div>
                            )}
                            {item.concept.static_layout.background_visual && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Visual Direction</p>
                                <p className="text-sm">{item.concept.static_layout.background_visual}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {item.concept?.overlay_text && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Overlay Text</p>
                          <div className="space-y-1 mt-1">
                            {item.concept.overlay_text.map((text: string, i: number) => (
                              <p key={i} className="text-sm text-muted-foreground">• {text}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Production Notes (all formats) */}
                  {item.concept?.production_notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Production Notes</p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{item.concept.production_notes}</p>
                    </div>
                  )}

                  {/* Why It Works (all formats) */}
                  {item.concept?.why_it_works && (
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-sm font-medium text-primary mb-1">Why This Works</p>
                      <p className="text-sm text-muted-foreground">{item.concept.why_it_works}</p>
                    </div>
                  )}
                </Card>
              )}

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
                  concept={{ ...(item.concept || {}), format: item.format }}
                  onComplete={handleCreateComplete}
                  onBack={() => handleNext("review")}
                />
              ) : (
                <DesignGuide
                  concept={{ ...(item.concept || {}), format: item.format }}
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

              <DragDropUploader workspace={workspace} onUpdate={onUpdate} productionItem={item} />

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
