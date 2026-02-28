import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageShimmer } from "@/components/GradientShimmer";
import { toast } from "sonner";
import {
  Upload, X, FileVideo, FileImage, ChevronLeft, ChevronRight,
  Sparkles, CheckCircle2, Loader2, Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import lumiLogo from "@/assets/lumi-logo.png";

interface UploadedAsset {
  id: string;
  file: File | null;
  file_url: string;
  file_type: string;
  name: string;
  size: number;
  storage_path?: string;
}

interface CopyVariation {
  primary_text: string;
  headline: string;
  description: string;
  angle?: string;
}

interface SharedCopy {
  variations: CopyVariation[];
  selectedIndices: number[];
  generating: boolean;
}

export default function AdvancedBuild() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [workspace, setWorkspace] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [offer, setOffer] = useState<any>(null);

  // Step 1: Assets
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Step 2: Shared copy for all assets
  const [sharedCopy, setSharedCopy] = useState<SharedCopy>({
    variations: [],
    selectedIndices: [],
    generating: false,
  });

  // Step 3: Publishing
  const [publishing, setPublishing] = useState(false);
  const [saveToBench, setSaveToBench] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      toast.error("No workspace specified");
      navigate("/campaigns");
      return;
    }
    loadWorkspace();
  }, [workspaceId]);

  const loadWorkspace = async () => {
    try {
      const { data: ws, error } = await supabase
        .from("campaign_workspaces")
        .select("*, brands(*)")
        .eq("id", workspaceId!)
        .single();

      if (error || !ws) throw error || new Error("Workspace not found");

      setWorkspace(ws);
      setBrand(ws.brands);

      if (ws.offer_id) {
        const { data: offerData } = await supabase
          .from("offers")
          .select("*")
          .eq("id", ws.offer_id)
          .single();
        setOffer(offerData);
      }

      // Restore saved state
      const answers = ws.campaign_builder_answers as any;
      if (answers?.advancedBuild && answers?.assets) {
        setAssets(answers.assets.map((a: any) => ({ ...a, file: null })));
        if (answers.sharedCopy) {
          setSharedCopy({
            variations: answers.sharedCopy.variations || [],
            selectedIndices: answers.sharedCopy.selectedIndices || [],
            generating: false,
          });
        }
      }
    } catch (error: any) {
      console.error("Error loading workspace:", error);
      toast.error("Failed to load workspace");
      navigate("/campaigns");
    } finally {
      setLoading(false);
    }
  };

  const saveState = async (updatedAssets?: UploadedAsset[], updatedCopy?: SharedCopy) => {
    const a = updatedAssets || assets;
    const c = updatedCopy || sharedCopy;
    try {
      await supabase
        .from("campaign_workspaces")
        .update({
          campaign_builder_answers: {
            advancedBuild: true,
            assets: a.map(({ file, ...rest }) => rest),
            sharedCopy: {
              variations: c.variations,
              selectedIndices: c.selectedIndices,
            },
          } as any,
        })
        .eq("id", workspaceId!);
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    await uploadFiles(Array.from(droppedFiles));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newAssets: UploadedAsset[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${brand.id}/${workspaceId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("creative-assets")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload error for", file.name, uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("creative-assets")
          .getPublicUrl(path);

        newAssets.push({
          id: crypto.randomUUID(),
          file,
          file_url: urlData.publicUrl,
          file_type: file.type,
          name: file.name,
          size: file.size,
          storage_path: path,
        });
      }

      const updated = [...assets, ...newAssets];
      setAssets(updated);
      await saveState(updated);
      toast.success(`${newAssets.length} file(s) uploaded`);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAsset = async (assetId: string) => {
    const updated = assets.filter(a => a.id !== assetId);
    setAssets(updated);
    await saveState(updated);
    toast.success("Asset removed");
  };

  // Step 2: Generate shared copy for all assets
  const generateSharedCopy = async () => {
    setSharedCopy(prev => ({ ...prev, generating: true }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-advanced-copy", {
        body: {
          brandName: brand?.name,
          brandVoice: brand?.brand_voice,
          offerName: offer?.name || workspace?.offer_name,
          offerDescription: offer?.description || workspace?.offer_description,
          offerUrl: offer?.url || workspace?.offer_url,
          offerPrice: offer?.price_point || workspace?.offer_price,
          productPsychology: offer?.product_psychology,
          audiencePsychology: offer?.offer_audience_psychology || brand?.audience_psychology,
          brandEmojis: brand?.brand_emojis,
          bulletEmoji: brand?.bullet_emoji,
          useEmojis: brand?.use_emojis,
          copyPerspective: brand?.copy_perspective,
          neverUseWords: brand?.never_use_words,
          messagingGuidelines: offer?.messaging_guidelines,
        },
      });

      if (error) throw error;

      const variations: CopyVariation[] = data.variations || [];
      const updated: SharedCopy = {
        variations,
        selectedIndices: variations.map((_, i) => i), // Select all by default
        generating: false,
      };
      setSharedCopy(updated);
      await saveState(undefined, updated);
      toast.success(`Generated ${variations.length} copy variations for your campaign`);
    } catch (error: any) {
      console.error("Copy generation error:", error);
      toast.error("Failed to generate copy");
      setSharedCopy(prev => ({ ...prev, generating: false }));
    }
  };

  const toggleVariationSelection = (index: number) => {
    setSharedCopy(prev => {
      const selected = prev.selectedIndices.includes(index)
        ? prev.selectedIndices.filter(i => i !== index)
        : [...prev.selectedIndices, index];
      return { ...prev, selectedIndices: selected };
    });
  };

  const updateCopyField = (variationIndex: number, field: keyof CopyVariation, value: string) => {
    setSharedCopy(prev => {
      const variations = [...prev.variations];
      variations[variationIndex] = { ...variations[variationIndex], [field]: value };
      return { ...prev, variations };
    });
  };

  // Step 3: Publish
  const handlePublish = async () => {
    setPublishing(true);
    try {
      await saveState();

      const approvedVariations = sharedCopy.selectedIndices.map(i => sharedCopy.variations[i]);

      if (saveToBench) {
        for (const asset of assets) {
          await supabase.from("creative_bench").insert({
            workspace_id: workspaceId!,
            brand_id: brand.id,
            production_item_id: asset.id,
            status: "bench",
            auto_rotate_approved: true,
            performance_snapshot: {
              asset_name: asset.name,
              asset_url: asset.file_url,
              asset_type: asset.file_type,
              copy_variations: approvedVariations,
            } as any,
          });
        }

        await supabase
          .from("campaign_workspaces")
          .update({
            progress_status: "bench_saved",
            user_uploaded_assets: assets.map(({ file, ...rest }) => rest) as any,
            selected_copy: { shared_variations: approvedVariations } as any,
          } as any)
          .eq("id", workspaceId!);

        toast.success(`${assets.length} creative saved to bench!`);
        navigate("/campaigns");
      } else {
        const isExistingCampaign = workspace?.meta_campaign_ids && 
          (Array.isArray(workspace.meta_campaign_ids) ? workspace.meta_campaign_ids.length > 0 : Object.keys(workspace.meta_campaign_ids).length > 0);

        await supabase
          .from("campaign_workspaces")
          .update({
            progress_status: isExistingCampaign ? "creative_added" : "ready_to_publish",
            user_uploaded_assets: assets.map(({ file, ...rest }) => rest) as any,
            selected_copy: { shared_variations: approvedVariations } as any,
          })
          .eq("id", workspaceId!);

        if (isExistingCampaign) {
          toast.success(`${assets.length} new creative added to your campaign!`);
          navigate("/campaigns");
        } else {
          toast.success("Campaign ready! Heading to build...");
          navigate(`/campaigns/build?workspace=${workspaceId}`);
        }
      }
    } catch (error: any) {
      console.error("Publish error:", error);
      toast.error("Failed to save campaign");
    } finally {
      setPublishing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const angleLabels: Record<string, string> = {
    "problem-solution": "🎯 Problem → Solution",
    "social-proof": "⭐ Social Proof",
    "curiosity": "🔮 Curiosity",
    "transformation": "✨ Transformation",
    "direct-benefit": "💪 Direct Benefit",
  };

  const isExistingCampaign = workspace?.meta_campaign_ids && 
    (Array.isArray(workspace.meta_campaign_ids) ? workspace.meta_campaign_ids.length > 0 : Object.keys(workspace.meta_campaign_ids).length > 0);
  const canProceedToStep2 = assets.length > 0;
  const canProceedToStep3 = sharedCopy.variations.length > 0 && sharedCopy.selectedIndices.length > 0;
  const approvedCount = sharedCopy.selectedIndices.length;
  const publishLabel = saveToBench ? "Save to Bench" : isExistingCampaign ? "Add Creative" : "Build Campaign";

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Advanced Build</h1>
            <p className="text-sm text-muted-foreground">
              {workspace?.name || "Upload creative & copy"}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  currentStep >= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step ? <CheckCircle2 className="h-4 w-4" /> : step}
              </div>
              <span className={cn(
                "text-sm hidden sm:inline",
                currentStep >= step ? "font-medium" : "text-muted-foreground"
              )}>
                {step === 1 ? "Upload" : step === 2 ? "Copy" : "Review"}
              </span>
              {step < 3 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Upload */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload Your Creative</CardTitle>
                  <CardDescription>
                    Upload finished videos and images. Each will become its own ad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                      isDragging 
                        ? 'border-primary bg-primary/5 scale-[1.02]' 
                        : 'border-border hover:border-primary/50'
                    } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {uploading ? (
                      <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin mb-3" />
                    ) : (
                      <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    )}
                    <p className="text-sm font-medium">
                      {uploading ? "Uploading..." : isDragging ? "Drop files here" : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      MP4, JPG, PNG — Max 50MB per file
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="video/*,image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploading}
                    />
                  </div>

                  {assets.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {assets.length} asset{assets.length !== 1 ? "s" : ""} uploaded
                      </p>
                      {assets.map((asset) => (
                        <div key={asset.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          {asset.file_type.startsWith("video/") ? (
                            <FileVideo className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          ) : (
                            <FileImage className="h-5 w-5 text-green-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(asset.size)}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeAsset(asset.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => setCurrentStep(2)}
                  disabled={!canProceedToStep2}
                >
                  Continue to Copy <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Shared Copy */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
                <img src={lumiLogo} alt="Lumi" className="h-8 w-8 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">Let me write your ad copy ✨</p>
                  <p className="text-muted-foreground">
                    I'll generate 5 psychology-driven copy variations based on your offer and brand voice. 
                    Each of your {assets.length} creative{assets.length !== 1 ? "s" : ""} will be deployed as its own ad — all sharing the same approved copy variations.
                  </p>
                </div>
              </div>

              {/* Generate button — show when no variations yet */}
              {sharedCopy.variations.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Wand2 className="h-10 w-10 mx-auto text-primary/50 mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Ready to generate copy using your offer psychology, brand voice, and proven frameworks?
                    </p>
                    <Button
                      variant="lumi"
                      size="lg"
                      onClick={generateSharedCopy}
                      disabled={sharedCopy.generating}
                    >
                      {sharedCopy.generating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Writing your copy...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Let Lumi Write Copy
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Variations list with checkboxes */}
              {sharedCopy.variations.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {approvedCount} of {sharedCopy.variations.length} variations approved
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateSharedCopy}
                      disabled={sharedCopy.generating}
                    >
                      {sharedCopy.generating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3 mr-1" />
                      )}
                      Regenerate
                    </Button>
                  </div>

                  {sharedCopy.variations.map((variation, i) => {
                    const isSelected = sharedCopy.selectedIndices.includes(i);
                    return (
                      <Card
                        key={i}
                        className={cn(
                          "transition-all",
                          isSelected ? "border-primary/40 bg-primary/5" : "opacity-70"
                        )}
                      >
                        <CardContent className="pt-4 space-y-3">
                          {/* Header with checkbox */}
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleVariationSelection(i)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold">Variation {i + 1}</span>
                                {variation.angle && (
                                  <Badge variant="secondary" className="text-xs">
                                    {angleLabels[variation.angle] || variation.angle}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Copy fields */}
                          <div className="space-y-3 pl-7">
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Headline</Label>
                                <span className={cn(
                                  "text-xs",
                                  variation.headline.length > 25 ? "text-destructive font-semibold" : "text-muted-foreground"
                                )}>
                                  {variation.headline.length}/25
                                </span>
                              </div>
                              <Input
                                value={variation.headline}
                                onChange={(e) => updateCopyField(i, "headline", e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Primary Text</Label>
                              <Textarea
                                value={variation.primary_text}
                                onChange={(e) => updateCopyField(i, "primary_text", e.target.value)}
                                className="mt-1"
                                rows={4}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Description</Label>
                                <span className={cn(
                                  "text-xs",
                                  variation.description.length > 27 ? "text-destructive font-semibold" : "text-muted-foreground"
                                )}>
                                  {variation.description.length}/27
                                </span>
                              </div>
                              <Input
                                value={variation.description}
                                onChange={(e) => updateCopyField(i, "description", e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={async () => {
                    await saveState();
                    setCurrentStep(3);
                  }}
                  disabled={!canProceedToStep3}
                >
                  Review <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Review & Publish */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Destination Toggle */}
              <Card className="border-2 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${saveToBench ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
                        {saveToBench ? (
                          <Sparkles className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Upload className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <Label className="font-semibold text-sm">
                          {saveToBench ? "Save to Bench" : "Go Live on Meta"}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {saveToBench 
                            ? "Creative will be saved for future rotation when fatigue is detected"
                            : "Creative will be uploaded to Meta and built into ads"
                          }
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={saveToBench}
                      onCheckedChange={setSaveToBench}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review Your {saveToBench ? "Bench Creative" : "Campaign"}</CardTitle>
                  <CardDescription>
                    {assets.length} ad{assets.length !== 1 ? "s" : ""} will be created — one per creative, each with {approvedCount} approved copy variation{approvedCount !== 1 ? "s" : ""}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Approved copy variations */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Approved Copy ({approvedCount})
                    </h3>
                    <div className="space-y-2">
                      {sharedCopy.selectedIndices
                        .sort((a, b) => a - b)
                        .map(idx => {
                          const v = sharedCopy.variations[idx];
                          return (
                            <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">V{idx + 1}</Badge>
                                {v.angle && (
                                  <span className="text-xs text-muted-foreground">
                                    {angleLabels[v.angle] || v.angle}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium">{v.headline}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">{v.primary_text}</p>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Creative assets */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      Creative Assets ({assets.length})
                    </h3>
                    <div className="space-y-2">
                      {assets.map((asset, i) => (
                        <div key={asset.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <Badge variant="secondary" className="text-xs shrink-0">Ad {i + 1}</Badge>
                          {asset.file_type.startsWith("video/") ? (
                            <FileVideo className="h-4 w-4 text-blue-500 shrink-0" />
                          ) : (
                            <FileImage className="h-4 w-4 text-green-500 shrink-0" />
                          )}
                          <span className="text-sm truncate">{asset.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Edit Copy
                </Button>
                <Button
                  variant="lumi"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {saveToBench ? "Saving to Bench..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {publishLabel}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
