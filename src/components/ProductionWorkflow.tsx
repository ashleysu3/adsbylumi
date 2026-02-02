import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecordingGuide } from "./RecordingGuide";
import { DesignGuide } from "./DesignGuide";
import { DragDropUploader } from "./DragDropUploader";
import { CheckCircle2, ArrowRight, Sparkle, Copy, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionWorkflowProps {
  item: any;
  workspace: any;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

// Simplified workflow: review -> create -> upload -> done (no copy step)
type Step = "review" | "create" | "upload" | "done";

const steps: Step[] = ["review", "create", "upload", "done"];

// Hook technique labels for user-friendly display
const hookTechniqueLabels: Record<string, string> = {
  mid_sentence: "Mid-Sentence Start",
  confession: "Confession Hook",
  controversial: "Controversial Take",
  specific_number: "Specific Number",
  pattern_interrupt: "Pattern Interrupt",
};

// Helper to determine the correct step based on item status
function getStepForStatus(status: string): Step {
  switch (status) {
    case "in_progress":
      return "create";
    case "recorded":
      return "upload";
    case "uploaded":
    case "approved":
      return "done";
    default:
      return "review";
  }
}

export function ProductionWorkflow({ item, workspace, open, onClose, onUpdate }: ProductionWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<Step>(() => getStepForStatus(item?.status));
  const [updatedItem, setUpdatedItem] = useState(item);

  // When switching between cards, reset local state to the selected item
  useEffect(() => {
    if (!item?.id) return;
    setUpdatedItem(item);
    setCurrentStep(getStepForStatus(item.status));
  }, [item?.id]);

  // When the parent refreshes the same item, merge new fields without blowing away local additions
  useEffect(() => {
    if (!item?.id) return;
    setUpdatedItem((prev: any) => {
      if (!prev) return item;
      if (prev.id !== item.id) return prev;
      return { ...prev, ...item };
    });
  }, [item]);

  // Update step when item status changes (e.g., after marking as recorded)
  useEffect(() => {
    if (!updatedItem?.status) return;

    const correctStep = getStepForStatus(updatedItem.status);
    if (correctStep !== currentStep && steps.indexOf(correctStep) > steps.indexOf(currentStep)) {
      setCurrentStep(correctStep);
    }
  }, [updatedItem?.status, currentStep]);

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const isVideoFormat = ["talking_head", "broll"].includes(item.format);

  // Some legacy items may not have concept_id; fall back to item.id so uploads can still link reliably
  const conceptLinkId =
    updatedItem?.concept_id || (updatedItem as any)?.conceptId || updatedItem?.id ||
    item?.concept_id || (item as any)?.conceptId || item?.id;

  const linkedUpload =
    updatedItem?.linkedAsset ||
    (workspace.user_uploaded_assets || []).slice().reverse().find((a: any) => a.linked_concept_id === conceptLinkId);

  const canContinueToApprove = !!linkedUpload;

  const handleNext = async (step: Step) => {
    // Immediately move the UI forward for a smoother feel
    setCurrentStep(step);

    // If they start creating, mark the item as in progress so the card updates too
    if (step === "create" && (updatedItem?.status === "pending" || updatedItem?.status === "ready")) {
      try {
        const productionItems = workspace.production_items || [];
        const updatedItems = productionItems.map((pi: any) =>
          pi.id === item.id ? { ...pi, status: "in_progress" } : pi
        );

        const { error } = await supabase
          .from("campaign_workspaces")
          .update({ production_items: updatedItems })
          .eq("id", workspace.id);

        if (error) throw error;

        setUpdatedItem((prev: any) => ({ ...prev, status: "in_progress" }));
        onUpdate();
      } catch (e) {
        console.error("Failed to mark in progress", e);
      }
    }
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
    try {
      if (!conceptLinkId) {
        toast.error("This concept is missing an ID. Please close and reopen the card.");
        return;
      }

      // Re-fetch to make sure we include the very latest upload (users often click through fast)
      const { data: fresh, error: fetchError } = await supabase
        .from("campaign_workspaces")
        .select("production_items, user_uploaded_assets, creative_json")
        .eq("id", workspace.id)
        .single();

      if (fetchError) throw fetchError;

      const assets = (fresh?.user_uploaded_assets || workspace.user_uploaded_assets || []) as any[];
      const latestAsset = [...assets].reverse().find((asset: any) => asset.linked_concept_id === conceptLinkId);

      if (!latestAsset) {
        toast.error("Upload a file for this concept before continuing.");
        return;
      }

      // Get the angle copy for this item (copy is now stored at angle level)
      const creativeJson = fresh?.creative_json as any;
      const angleCopy = creativeJson?.angle_copy || {};
      const itemAngleId = (updatedItem as any)?.angleId || item?.angleId;
      const thisAngleCopy = itemAngleId ? angleCopy[itemAngleId] : null;

      // Auto-assign first copy variation from the angle
      const finalCopy = thisAngleCopy ? {
        headline: thisAngleCopy.headlines?.[0]?.text || '',
        description: thisAngleCopy.descriptions?.[0]?.text || '',
        primaryText: thisAngleCopy.primary_copy?.[0]?.text || '',
        cta: 'LEARN_MORE'
      } : null;

      // Update production item with status "approved" and asset info
      const productionItems = (fresh?.production_items || workspace.production_items || []) as any[];
      const updatedItems = productionItems.map((pi: any) =>
        pi.id === item.id
          ? {
              ...pi,
              status: "approved",
              uploaded_asset_id: latestAsset.id,
              linkedAsset: {
                id: latestAsset.id,
                url: latestAsset.file_url,
                storagePath: latestAsset.storage_path,
                type: latestAsset.file_type,
                fileName: latestAsset.file_name,
              },
              copy_finalized: true,
              finalCopy,
            }
          : pi
      );

      const { error: updateError } = await supabase
        .from("campaign_workspaces")
        .update({ production_items: updatedItems })
        .eq("id", workspace.id);

      if (updateError) throw updateError;

      setUpdatedItem((prev: any) => ({
        ...prev,
        status: "approved",
        uploaded_asset_id: latestAsset.id,
        linkedAsset: {
          id: latestAsset.id,
          url: latestAsset.file_url,
          storagePath: latestAsset.storage_path,
          type: latestAsset.file_type,
          fileName: latestAsset.file_name,
        },
        copy_finalized: true,
        finalCopy,
      }));

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
    } catch (error) {
      console.error("Upload finalize error:", error);
      toast.error("Couldn't finalize the upload. Please try again.");
    }
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
            <DialogTitle className="sr-only">Production workflow</DialogTitle>
            {/* Progress Bar */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Production Progress</span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators - Simplified: 4 steps instead of 5 */}
          <div className="flex items-center justify-between mb-6">
            {[
              { key: "review", label: "Review" },
              { key: "create", label: "Create" },
              { key: "upload", label: "Upload" },
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
                {index < 3 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
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
                  {/* Hook Technique Badge & Delivery Style */}
                  {(item.hook_technique || item.concept?.hook_technique || item.delivery_style || item.concept?.delivery_style) && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {(item.hook_technique || item.concept?.hook_technique) && (
                        <Badge variant="outline" className="gap-1 bg-primary/5 border-primary/20">
                          <Lightbulb className="h-3 w-3" />
                          {hookTechniqueLabels[item.hook_technique || item.concept?.hook_technique] || "Pattern Interrupt"}
                        </Badge>
                      )}
                      {(item.delivery_style || item.concept?.delivery_style) && (
                        <span className="text-xs text-muted-foreground italic">
                          💡 {item.delivery_style || item.concept?.delivery_style}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Multi-Hook System - NEW */}
                  {(item.verbal_hook || item.written_hook || item.visual_hook || 
                    item.concept?.verbal_hook || item.concept?.written_hook || item.concept?.visual_hook) && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">🎯 Three-Hook System</p>
                      
                      {/* Verbal Hook */}
                      {(item.verbal_hook || item.concept?.verbal_hook) && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">🗣️ VERBAL HOOK (What you SAY)</p>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            "{item.verbal_hook || item.concept?.verbal_hook}"
                          </p>
                        </div>
                      )}
                      
                      {/* Written Hook */}
                      {(item.written_hook || item.concept?.written_hook) && (
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                          <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">✍️ WRITTEN HOOK (Text on screen)</p>
                          <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            "{item.written_hook || item.concept?.written_hook}"
                          </p>
                        </div>
                      )}
                      
                      {/* Visual Hook */}
                      {(item.visual_hook || item.concept?.visual_hook) && (
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                          <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">👁️ VISUAL HOOK (What viewers SEE)</p>
                          <p className="text-sm text-green-900 dark:text-green-100">
                            {item.visual_hook || item.concept?.visual_hook}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visual Hook Options - Pick Your Setting */}
                  {(item.visual_hook_options?.length > 0 || item.concept?.visual_hook_options?.length > 0) && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">🎬 Choose Your Setting (Pick one that works for you)</p>
                      <div className="flex flex-wrap gap-2">
                        {(item.visual_hook_options || item.concept?.visual_hook_options || []).map((option: string, i: number) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className="py-1.5 px-3 text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/40 transition-colors"
                          >
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caption Reminder */}
                  {(item.caption_reminder || item.concept?.caption_reminder) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <span className="text-base">🔇</span>
                        85% of users watch without sound — captions are essential!
                      </p>
                    </div>
                  )}
                  
                  {/* Line-by-Line Script with Copy Button */}
                  {(item.script_lines?.length > 0 || item.concept?.script_lines?.length > 0) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">📜 Your Script (Read these lines to camera)</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const lines = item.script_lines || item.concept?.script_lines || [];
                            navigator.clipboard.writeText(lines.join('\n\n'));
                            toast.success("Script copied to clipboard!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Copy Script
                        </Button>
                      </div>
                      <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                        {(item.script_lines || item.concept?.script_lines || []).map((line: string, i: number) => (
                          <div key={i} className="flex gap-2 items-start">
                            <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                              {i + 1}
                            </span>
                            <p className="text-sm">{line}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                      {/* Text Overlays */}
                      {(item.text_overlays?.length > 0 || item.concept?.text_overlays?.length > 0) && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">📝 Text Overlays / Titles</p>
                          <div className="space-y-2">
                            {(item.text_overlays || item.concept?.text_overlays || []).map((overlay: any, i: number) => (
                              <div key={i} className={cn(
                                "p-3 bg-muted/50 rounded-md border-l-2",
                                overlay.type === "hook" && "border-blue-500",
                                overlay.type === "transition" && "border-purple-500",
                                overlay.type === "insight" && "border-green-500",
                                overlay.type === "cta" && "border-orange-500",
                                !overlay.type && "border-primary/50"
                              )}>
                                <div className="flex items-center gap-2 mb-1">
                                  {overlay.type && (
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      {overlay.type}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium">"{overlay.text || overlay}"</p>
                                {overlay.timing && (
                                  <p className="text-xs text-muted-foreground mt-1">⏱️ {overlay.timing}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Legacy script field fallback */}
                      {item.concept?.script && !item.script_lines?.length && !item.concept?.script_lines?.length && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Script</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{item.concept.script}</p>
                        </div>
                      )}
                      
                      {/* Legacy overlay_text fallback */}
                      {item.concept?.overlay_text && !item.text_overlays?.length && !item.concept?.text_overlays?.length && (
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

                  {/* Carousel Format */}
                  {item.format === "carousel" && (
                    <>
                      {item.concept?.slides && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Carousel Slides</p>
                          <div className="space-y-3 mt-2">
                            {item.concept.slides.map((slide: any, i: number) => (
                              <div key={i} className="p-3 bg-muted/50 rounded-md">
                                <p className="text-xs font-medium text-primary mb-1">Slide {i + 1}</p>
                                {slide.headline && <p className="text-sm font-medium">{slide.headline}</p>}
                                {slide.body && <p className="text-sm text-muted-foreground">{slide.body}</p>}
                                {slide.visual_direction && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">{slide.visual_direction}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.concept?.static_layout && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Layout Direction</p>
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

              <DragDropUploader
                workspace={workspace}
                onUpdate={onUpdate}
                productionItem={{ ...item, concept_id: conceptLinkId }}
              />

              <div className="flex gap-3 justify-between pt-4">
                <Button variant="outline" onClick={() => handleNext("create")}>
                  ← Back
                </Button>
                <div className="flex flex-col items-end gap-2">
                  <Button onClick={handleUploadComplete} disabled={!canContinueToApprove}>
                    Approve & Finish →
                  </Button>
                  {!canContinueToApprove && (
                    <p className="text-xs text-muted-foreground">Upload at least 1 file above to continue.</p>
                  )}
                </div>
              </div>
            </div>
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
