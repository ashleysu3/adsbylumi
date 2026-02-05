import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Rocket, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LumiLoader } from "./LumiLoader";
import { LumiSuccess } from "./LumiSuccess";
import { SparkleIcon } from "./SparkleIcon";

interface MetaCampaignBuilderProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

export function MetaCampaignBuilder({ workspace, onUpdate }: MetaCampaignBuilderProps) {
  const [publishing, setPublishing] = useState(false);
  const [answers, setAnswers] = useState({
    budget: workspace.final_answers?.budget || "",
    budgetType: workspace.final_answers?.budgetType || "daily",
    advantagePlus: workspace.final_answers?.advantagePlus !== false,
    variations: workspace.final_answers?.variations !== false,
    warmRetargeting: workspace.final_answers?.warmRetargeting !== false,
    autoNaming: workspace.final_answers?.autoNaming !== false,
  });

  const [step, setStep] = useState(1);
  const totalSteps = 6;

  const updateAnswer = (key: string, value: any) => {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    onUpdate({ final_answers: updated });
  };

  const handlePublish = async () => {
    setPublishing(true);
    
    try {
      // This would call an edge function to create the campaign in Meta
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate API call
      
      await onUpdate({
        progress_status: "live",
        meta_campaign_status: "active",
        meta_campaign_ids: {
          campaign_id: "camp_" + Math.random().toString(36).substr(2, 9),
          adset_id: "adset_" + Math.random().toString(36).substr(2, 9),
          ad_ids: ["ad_" + Math.random().toString(36).substr(2, 9)],
        }
      });
      
      toast.success("Campaign published to Meta Ads Manager!");
      setStep(totalSteps + 1); // Show success screen
    } catch (error) {
      console.error("Publishing error:", error);
      toast.error("Failed to publish campaign");
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = answers.budget && parseFloat(answers.budget) > 0;

  if (step > totalSteps) {
    return (
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="pt-6">
          <div className="text-center py-12 relative">
            {/* Success glow background */}
            <div className="absolute inset-0 bg-glow/10 blur-3xl" />
            
            <div className="relative">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-glow/40 blur-xl rounded-full animate-pulse" />
                  <SparkleIcon size="xl" state="talking" glow />
                </div>
              </div>
              
              <h3 className="text-2xl font-display font-bold mb-2">Your campaign is live! ✨</h3>
              <p className="text-muted-foreground mb-6">
                Nice work — Lumi will keep an eye on things and let you know what's working.
              </p>
              
              <Card className="max-w-sm mx-auto bg-muted/50 rounded-xl">
                <CardContent className="py-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Campaign ID:</span>
                    <span className="font-medium">{workspace.meta_campaign_ids?.campaign_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-green-600">Active</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Final Campaign Setup</CardTitle>
          <CardDescription>
            Answer a few quick questions to configure your campaign for Meta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Progress */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 flex-1 rounded ${
                    idx < step ? "bg-primary" : "bg-secondary"
                  }`}
                />
              ))}
            </div>

            {/* Step 1: Budget */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">What's your budget?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Based on your goal, we recommend $15-25 per day for optimal results
                  </p>
                </div>
                
                <div className="space-y-4">
                  <RadioGroup
                    value={answers.budgetType}
                    onValueChange={(value) => updateAnswer("budgetType", value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="daily" id="daily" />
                      <Label htmlFor="daily">Daily Budget</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="lifetime" id="lifetime" />
                      <Label htmlFor="lifetime">Lifetime Budget</Label>
                    </div>
                  </RadioGroup>

                  <div>
                    <Label htmlFor="budget">Amount (USD)</Label>
                    <Input
                      id="budget"
                      type="number"
                      min="5"
                      step="1"
                      placeholder="20"
                      value={answers.budget}
                      onChange={(e) => updateAnswer("budget", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!answers.budget}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Advantage+ */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Enable Advantage+ Creative?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Meta will automatically optimize your creative elements for better performance
                  </p>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="advantagePlus"
                    checked={answers.advantagePlus}
                    onCheckedChange={(checked) => updateAnswer("advantagePlus", checked)}
                  />
                  <div>
                    <Label htmlFor="advantagePlus" className="text-sm font-medium">
                      Yes, optimize my creative (Recommended)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allows Meta to test variations of text, images, and videos
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Variations */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Generate creative variations?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Meta can automatically create additional versions of your ads to test what works best
                  </p>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="variations"
                    checked={answers.variations}
                    onCheckedChange={(checked) => updateAnswer("variations", checked)}
                  />
                  <div>
                    <Label htmlFor="variations" className="text-sm font-medium">
                      Yes, create variations (Recommended)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Meta will test different combinations to find winners
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(4)}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Warm Retargeting */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Run warm retargeting?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Show ads to people who've already engaged with your content in the past 30 days
                  </p>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="warmRetargeting"
                    checked={answers.warmRetargeting}
                    onCheckedChange={(checked) => updateAnswer("warmRetargeting", checked)}
                  />
                  <div>
                    <Label htmlFor="warmRetargeting" className="text-sm font-medium">
                      Yes, retarget engaged audience (Recommended)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Higher conversion rates from warm traffic
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(5)}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Auto Naming */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Auto-name your campaigns?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We'll create clear, organized names for your campaigns, ad sets, and ads
                  </p>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="autoNaming"
                    checked={answers.autoNaming}
                    onCheckedChange={(checked) => updateAnswer("autoNaming", checked)}
                  />
                  <div>
                    <Label htmlFor="autoNaming" className="text-sm font-medium">
                      Yes, name everything for me (Recommended)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Keeps your Ads Manager organized
                    </p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(4)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(6)}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Review & Publish */}
            {step === 6 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Review & Publish</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Everything looks good? Let's launch your campaign!
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Campaign Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Budget:</span>
                      <span className="font-medium">${answers.budget} {answers.budgetType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Advantage+ Creative:</span>
                      <span>{answers.advantagePlus ? "✓ Enabled" : "✗ Disabled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creative Variations:</span>
                      <span>{answers.variations ? "✓ Enabled" : "✗ Disabled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Warm Retargeting:</span>
                      <span>{answers.warmRetargeting ? "✓ Enabled" : "✗ Disabled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Auto-naming:</span>
                      <span>{answers.autoNaming ? "✓ Enabled" : "✗ Disabled"}</span>
                    </div>
                  </CardContent>
                </Card>

                {!canPublish && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Please set a budget before publishing
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(5)} disabled={publishing}>
                    Back
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={!canPublish || publishing}
                    variant="lumi"
                  >
                    {publishing ? (
                      <>
                        <SparkleIcon size="xs" state="loading" className="mr-2" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Publish to Meta
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}