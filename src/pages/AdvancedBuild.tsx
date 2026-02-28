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
import { PageShimmer } from "@/components/GradientShimmer";
import { toast } from "sonner";
import {
  Upload, X, FileVideo, FileImage, ChevronLeft, ChevronRight,
  Sparkles, CheckCircle2, Loader2, Eye, Wand2, Copy, Trash2
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
}

interface AssetCopy {
  userProvided: boolean;
  variations: CopyVariation[];
  selectedIndex: number;
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

  // Step 2: Copy per asset
  const [assetCopy, setAssetCopy] = useState<Record<string, AssetCopy>>({});

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

      // Load offer data if available
      if (ws.offer_id) {
        const { data: offerData } = await supabase
          .from("offers")
          .select("*")
          .eq("id", ws.offer_id)
          .single();
        setOffer(offerData);
      }

      // Restore saved advanced build state
      const answers = ws.campaign_builder_answers as any;
      if (answers?.advancedBuild && answers?.assets) {
        setAssets(answers.assets.map((a: any) => ({ ...a, file: null })));
        if (answers.copyVariations) {
          setAssetCopy(answers.copyVariations);
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

  const saveState = async (updatedAssets?: UploadedAsset[], updatedCopy?: Record<string, AssetCopy>) => {
    const a = updatedAssets || assets;
    const c = updatedCopy || assetCopy;
    try {
      await supabase
        .from("campaign_workspaces")
        .update({
          campaign_builder_answers: {
            advancedBuild: true,
            assets: a.map(({ file, ...rest }) => rest),
            copyVariations: c,
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

  // Step 1: File upload
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

      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${workspaceId}/${crypto.randomUUID()}.${ext}`;

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

      // Initialize copy state for new assets
      const updatedCopy = { ...assetCopy };
      newAssets.forEach(a => {
        updatedCopy[a.id] = {
          userProvided: false,
          variations: [{ primary_text: "", headline: "", description: "" }],
          selectedIndex: 0,
          generating: false,
        };
      });
      setAssetCopy(updatedCopy);

      await saveState(updated, updatedCopy);
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
    const updatedCopy = { ...assetCopy };
    delete updatedCopy[assetId];
    setAssets(updated);
    setAssetCopy(updatedCopy);
    await saveState(updated, updatedCopy);
    toast.success("Asset removed");
  };

  // Step 2: Generate copy for an asset
  const generateCopyForAsset = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    setAssetCopy(prev => ({
      ...prev,
      [assetId]: { ...prev[assetId], generating: true },
    }));

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
          assetFilename: asset.name,
          assetType: asset.file_type,
        },
      });

      if (error) throw error;

      const variations: CopyVariation[] = data.variations || [];
      
      const updatedCopy = {
        ...assetCopy,
        [assetId]: {
          userProvided: false,
          variations: variations.length > 0 ? variations : [{ primary_text: "", headline: "", description: "" }],
          selectedIndex: 0,
          generating: false,
        },
      };
      setAssetCopy(updatedCopy);
      await saveState(undefined, updatedCopy);
      toast.success(`Generated ${variations.length} copy variations`);
    } catch (error: any) {
      console.error("Copy generation error:", error);
      toast.error("Failed to generate copy");
      setAssetCopy(prev => ({
        ...prev,
        [assetId]: { ...prev[assetId], generating: false },
      }));
    }
  };

  const updateCopyField = (assetId: string, variationIndex: number, field: keyof CopyVariation, value: string) => {
    setAssetCopy(prev => {
      const current = prev[assetId];
      if (!current) return prev;
      const variations = [...current.variations];
      variations[variationIndex] = { ...variations[variationIndex], [field]: value };
      return {
        ...prev,
        [assetId]: { ...current, variations, userProvided: true },
      };
    });
  };

  const selectVariation = (assetId: string, index: number) => {
    setAssetCopy(prev => ({
      ...prev,
      [assetId]: { ...prev[assetId], selectedIndex: index },
    }));
  };

  // Step 3: Save and mark ready (or save to bench)
  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Save final state
      await saveState();

      if (saveToBench) {
        // Save each asset to creative_bench
        for (const asset of assets) {
          const copy = assetCopy[asset.id];
          const selected = copy?.variations[copy?.selectedIndex || 0];
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
              copy: selected || null,
            } as any,
          });
        }

        await supabase
          .from("campaign_workspaces")
          .update({
            progress_status: "bench_saved",
            user_uploaded_assets: assets.map(({ file, ...rest }) => rest) as any,
            selected_copy: Object.fromEntries(
              Object.entries(assetCopy).map(([id, copy]) => [
                id,
                copy.variations[copy.selectedIndex],
              ])
            ) as any,
          } as any)
          .eq("id", workspaceId!);

        toast.success(`${assets.length} creative saved to bench!`);
        navigate("/campaigns");
      } else {
        // Normal publish flow
        await supabase
          .from("campaign_workspaces")
          .update({
            progress_status: "ready_to_publish",
            user_uploaded_assets: assets.map(({ file, ...rest }) => rest) as any,
            selected_copy: Object.fromEntries(
              Object.entries(assetCopy).map(([id, copy]) => [
                id,
                copy.variations[copy.selectedIndex],
              ])
            ) as any,
          })
          .eq("id", workspaceId!);

        toast.success("Campaign ready! Heading to build...");
        navigate(`/campaigns/build?workspace=${workspaceId}`);
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

  const canProceedToStep2 = assets.length > 0;
  const canProceedToStep3 = assets.length > 0 && Object.keys(assetCopy).length > 0 &&
    assets.every(a => {
      const copy = assetCopy[a.id];
      if (!copy) return false;
      const selected = copy.variations[copy.selectedIndex];
      return selected && (selected.headline || selected.primary_text);
    });

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
                    Upload finished videos and images. Each will become its own ad set.
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

          {/* STEP 2: Copy */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                <img src={lumiLogo} alt="Lumi" className="h-8 w-8" />
                <p className="text-sm">
                  Add your own copy or let me write 5 variations for each asset based on your offer psychology.
                </p>
              </div>

              {assets.map((asset) => {
                const copy = assetCopy[asset.id];
                if (!copy) return null;

                return (
                  <Card key={asset.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        {asset.file_type.startsWith("video/") ? (
                          <FileVideo className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FileImage className="h-5 w-5 text-green-500" />
                        )}
                        <CardTitle className="text-base truncate">{asset.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Generate button */}
                      {!copy.userProvided && copy.variations[0]?.headline === "" && (
                        <Button
                          variant="lumi"
                          className="w-full"
                          onClick={() => generateCopyForAsset(asset.id)}
                          disabled={copy.generating}
                        >
                          {copy.generating ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating copy...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4 mr-2" />
                              Let Lumi Write Copy
                            </>
                          )}
                        </Button>
                      )}

                      {/* Variation tabs */}
                      {copy.variations.length > 1 && (
                        <div className="flex gap-1 flex-wrap">
                          {copy.variations.map((_, i) => (
                            <Button
                              key={i}
                              size="sm"
                              variant={copy.selectedIndex === i ? "default" : "outline"}
                              onClick={() => selectVariation(asset.id, i)}
                              className="h-7 text-xs"
                            >
                              V{i + 1}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Copy fields for selected variation */}
                      {copy.variations.length > 0 && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Headline</Label>
                            <Input
                              placeholder="Short, punchy headline..."
                              value={copy.variations[copy.selectedIndex]?.headline || ""}
                              onChange={(e) => updateCopyField(asset.id, copy.selectedIndex, "headline", e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Primary Text</Label>
                            <Textarea
                              placeholder="Main ad copy..."
                              value={copy.variations[copy.selectedIndex]?.primary_text || ""}
                              onChange={(e) => updateCopyField(asset.id, copy.selectedIndex, "primary_text", e.target.value)}
                              className="mt-1"
                              rows={3}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Description</Label>
                            <Input
                              placeholder="Optional description..."
                              value={copy.variations[copy.selectedIndex]?.description || ""}
                              onChange={(e) => updateCopyField(asset.id, copy.selectedIndex, "description", e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}

                      {/* Write your own if generated */}
                      {copy.variations.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          Edit any variation above, or select a different one.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

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
                            : "Creative will be uploaded to Meta and built into ad sets"
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review Your {saveToBench ? "Bench Creative" : "Campaign"}</CardTitle>
                  <CardDescription>
                    {saveToBench 
                      ? `${assets.length} creative will be saved to your bench for auto-rotation.`
                      : `${assets.length} ad set${assets.length !== 1 ? "s" : ""} will be created — one per creative asset.`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assets.map((asset, i) => {
                    const copy = assetCopy[asset.id];
                    const selected = copy?.variations[copy?.selectedIndex || 0];

                    return (
                      <div key={asset.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">Ad Set {i + 1}</Badge>
                          {asset.file_type.startsWith("video/") ? (
                            <FileVideo className="h-4 w-4 text-blue-500" />
                          ) : (
                            <FileImage className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-sm font-medium truncate">{asset.name}</span>
                        </div>
                        {selected && (
                          <div className="text-sm space-y-1 pl-4 border-l-2 border-primary/30">
                            {selected.headline && (
                              <p><span className="text-muted-foreground">Headline:</span> {selected.headline}</p>
                            )}
                            {selected.primary_text && (
                              <p className="line-clamp-2">
                                <span className="text-muted-foreground">Primary:</span> {selected.primary_text}
                              </p>
                            )}
                            {selected.description && (
                              <p><span className="text-muted-foreground">Desc:</span> {selected.description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                      {saveToBench ? "Save to Bench" : "Build Campaign"}
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
