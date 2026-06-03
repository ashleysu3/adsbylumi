import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Video, Image, X, Sparkles, PenLine, ArrowRight, Loader2, CheckCircle2, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UploadedFile {
  id: string;
  file: File;
  format: "talking_head" | "broll" | "graphic" | "carousel";
  preview?: string;
  storagePath?: string;
  storageUrl?: string;
}

interface AngleInfo {
  id: string;
  name: string;
}

interface BYOCreativeUploaderProps {
  workspaceId: string;
  brandId: string;
  onComplete: (items: any[], copyChoice: "lumi" | "manual" | "picked", pickedCopy?: any) => void;
  onCancel: () => void;
  angleCopy?: Record<string, any>;
  angles?: AngleInfo[];
}

const formatOptions = [
  { value: "talking_head", label: "Talking Head", icon: Video },
  { value: "broll", label: "B-Roll / Lofi Video", icon: Video },
  { value: "graphic", label: "Graphic / Static", icon: Image },
];

type Step = "upload" | "copy_choice" | "pick_copy" | "uploading";

// --- Copy Picker Sub-component ---
function CopyPickerStep({
  angleCopy,
  angles,
  onConfirm,
  onBack,
}: {
  angleCopy: Record<string, any>;
  angles: AngleInfo[];
  onConfirm: (picked: { headlines: string[]; descriptions: string[]; primary_copy: string[] }) => void;
  onBack: () => void;
}) {
  const [selectedHeadlines, setSelectedHeadlines] = useState<Set<string>>(new Set());
  const [selectedDescriptions, setSelectedDescriptions] = useState<Set<string>>(new Set());
  const [selectedPrimary, setSelectedPrimary] = useState<Set<string>>(new Set());

  const angleNameMap = new Map(angles.map(a => [a.id, a.name]));

  // Collect all copy items across angles
  const allHeadlines: { text: string; angleId: string; key: string }[] = [];
  const allDescriptions: { text: string; angleId: string; key: string }[] = [];
  const allPrimary: { text: string; angleId: string; key: string }[] = [];

  Object.entries(angleCopy).forEach(([angleId, copy]: [string, any]) => {
    if (!copy) return;
    (copy.headlines || []).forEach((h: string, i: number) => {
      if (h?.trim()) allHeadlines.push({ text: h, angleId, key: `${angleId}_h_${i}` });
    });
    (copy.descriptions || []).forEach((d: string, i: number) => {
      if (d?.trim()) allDescriptions.push({ text: d, angleId, key: `${angleId}_d_${i}` });
    });
    (copy.primary_copy || []).forEach((p: string, i: number) => {
      if (p?.trim()) allPrimary.push({ text: p, angleId, key: `${angleId}_p_${i}` });
    });
  });

  const totalSelected = selectedHeadlines.size + selectedDescriptions.size + selectedPrimary.size;

  const toggle = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setFn(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    if (totalSelected === 0) { toast.error("Select at least one piece of copy"); return; }
    const headlines = allHeadlines.filter(h => selectedHeadlines.has(h.key)).map(h => h.text);
    const descriptions = allDescriptions.filter(d => selectedDescriptions.has(d.key)).map(d => d.text);
    const primary_copy = allPrimary.filter(p => selectedPrimary.has(p.key)).map(p => p.text);
    onConfirm({ headlines, descriptions, primary_copy });
  };

  const renderSection = (
    title: string,
    items: { text: string; angleId: string; key: string }[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">{title} <span className="text-muted-foreground font-normal">({items.length})</span></h4>
        <div className="space-y-2">
          {items.map(item => (
            <label
              key={item.key}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                selected.has(item.key)
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Checkbox
                checked={selected.has(item.key)}
                onCheckedChange={() => toggle(selected, setSelected, item.key)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm leading-relaxed">{item.text}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {angleNameMap.get(item.angleId) || "Unknown"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{item.text.length} chars</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="py-8 space-y-6">
        <div className="text-center space-y-2">
          <Library className="h-10 w-10 mx-auto text-primary mb-2" />
          <h3 className="text-xl font-display font-bold">Pick your favorite copy</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Browse all the copy Lumi has generated across your angles and select the ones you want to use with your uploaded creative.
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-6 pr-1">
          {renderSection("Headlines", allHeadlines, selectedHeadlines, setSelectedHeadlines)}
          {renderSection("Descriptions", allDescriptions, selectedDescriptions, setSelectedDescriptions)}
          {renderSection("Primary Copy", allPrimary, selectedPrimary, setSelectedPrimary)}
        </div>

        {allHeadlines.length === 0 && allDescriptions.length === 0 && allPrimary.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No copy has been generated yet. Go back and choose another option.</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            ← Back
          </Button>
          <Button onClick={handleConfirm} disabled={totalSelected === 0} className="gap-2">
            Use {totalSelected} selected
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Component ---
export function BYOCreativeUploader({ workspaceId, brandId, onComplete, onCancel, angleCopy = {}, angles = [] }: BYOCreativeUploaderProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if there's existing copy to pick from
  const hasExistingCopy = Object.values(angleCopy).some((copy: any) =>
    copy && ((copy.headlines?.length > 0) || (copy.descriptions?.length > 0) || (copy.primary_copy?.length > 0))
  );

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    processFiles(selected);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFiles = (incoming: File[]) => {
    const maxSize = 250 * 1024 * 1024;
    const valid = incoming.filter(f => {
      if (f.size > maxSize) { toast.error(`${f.name} exceeds 250MB limit`); return false; }
      return true;
    });

    const newFiles: UploadedFile[] = valid.map(file => {
      const isVideo = file.type.startsWith("video/");
      return {
        id: `byo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        format: isVideo ? "talking_head" : "graphic",
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
  };

  const updateFormat = (id: string, format: "talking_head" | "broll" | "graphic" | "carousel") => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, format } : f));
  };

  const removeFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleContinueToCopyChoice = () => {
    if (files.length === 0) { toast.error("Upload at least one file"); return; }
    setStep("copy_choice");
  };

  const doUploadAndComplete = async (copyChoice: "lumi" | "manual" | "picked", pickedCopy?: any) => {
    setStep("uploading");
    setIsUploading(true);

    try {
      const uploadedFiles: UploadedFile[] = [];
      for (const f of files) {
        const ext = f.file.name.split('.').pop() || 'bin';
        const path = `${brandId}/${workspaceId}/byo_${f.id}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('creative-assets')
          .upload(path, f.file, { upsert: true });

        if (uploadError) {
          console.error(`Upload failed for ${f.file.name}:`, uploadError);
          toast.error(`Failed to upload ${f.file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('creative-assets')
          .getPublicUrl(path);

        uploadedFiles.push({ ...f, storagePath: path, storageUrl: urlData.publicUrl });
      }

      if (uploadedFiles.length === 0) {
        toast.error("No files were uploaded successfully");
        setStep("upload");
        setIsUploading(false);
        return;
      }

      const productionItems = uploadedFiles.map(f => ({
        id: `prod_${f.id}`,
        format: f.format,
        hook: f.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        guidance: "User-uploaded creative asset",
        angleName: "My Creative",
        completed: false,
        linkedAsset: { storagePath: f.storagePath, url: f.storageUrl, name: f.file.name, type: f.file.type },
        status: "approved",
      }));

      const byoAngle = { id: "byo_uploads", name: "My Creative", description: "Your own uploaded creative assets.", isDefault: true };

      const { data: wsData } = await supabase
        .from("campaign_workspaces")
        .select("creative_json, production_items, user_uploaded_assets")
        .eq("id", workspaceId)
        .single();

      const existingCreative = (wsData?.creative_json || {}) as Record<string, any>;
      const existingProduction = (wsData?.production_items || []) as any[];
      const existingAssets = (wsData?.user_uploaded_assets || []) as any[];

      const angles_list = existingCreative.angles || [];
      if (!angles_list.some((a: any) => a.id === "byo_uploads")) {
        angles_list.push(byoAngle);
      }

      const newAssets = uploadedFiles.map(f => ({
        id: f.id,
        linked_concept_id: `prod_${f.id}`,
        file_url: f.storageUrl,
        storagePath: f.storagePath,
        file_type: f.file.type,
        name: f.file.name,
        size: f.file.size,
        created_at: new Date().toISOString(),
      }));

      // If picked copy, merge into angle_copy
      const updatedAngleCopy = existingCreative.angle_copy || {};
      if (copyChoice === "picked" && pickedCopy) {
        updatedAngleCopy["byo_uploads"] = pickedCopy;
      }

      await supabase.from("campaign_workspaces").update({
        creative_json: {
          ...existingCreative,
          angles: angles_list,
          selectedAngleIds: [...new Set([...(existingCreative.selectedAngleIds || []), "byo_uploads"])],
          byoUploadMode: true,
          angle_copy: updatedAngleCopy,
        },
        production_items: [...existingProduction, ...productionItems],
        user_uploaded_assets: [...existingAssets, ...newAssets],
        updated_at: new Date().toISOString(),
      }).eq("id", workspaceId);

      toast.success(`${uploadedFiles.length} creative${uploadedFiles.length > 1 ? 's' : ''} uploaded!`);
      onComplete(productionItems, copyChoice, pickedCopy);
    } catch (error: any) {
      console.error("BYO upload error:", error);
      toast.error("Something went wrong during upload");
      setStep("upload");
    } finally {
      setIsUploading(false);
    }
  };

  if (step === "uploading") {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-16 text-center space-y-4">
          <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
          <h3 className="text-lg font-semibold">Uploading your creative…</h3>
          <p className="text-sm text-muted-foreground">This may take a moment for larger files.</p>
        </CardContent>
      </Card>
    );
  }

  if (step === "pick_copy") {
    return (
      <CopyPickerStep
        angleCopy={angleCopy}
        angles={angles}
        onConfirm={(picked) => doUploadAndComplete("picked", picked)}
        onBack={() => setStep("copy_choice")}
      />
    );
  }

  if (step === "copy_choice") {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 space-y-8">
          <div className="text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
            <h3 className="text-xl font-display font-bold">{files.length} file{files.length > 1 ? 's' : ''} ready</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Now let's handle the ad copy — headlines, descriptions, and primary text that go with your creative.
            </p>
          </div>
          
          <div className={cn("grid gap-4 max-w-2xl mx-auto", hasExistingCopy ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <button
              onClick={() => doUploadAndComplete("lumi")}
              className="group p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold">Lumi writes the copy</h4>
              <p className="text-xs text-muted-foreground">
                AI-generated headlines, descriptions & primary text based on your brand & offer.
              </p>
            </button>

            {hasExistingCopy && (
              <button
                onClick={() => setStep("pick_copy")}
                className="group p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Library className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold">Pick from existing copy</h4>
                <p className="text-xs text-muted-foreground">
                  Browse copy already generated across your angles and cherry-pick your favorites.
                </p>
              </button>
            )}
            
            <button
              onClick={() => doUploadAndComplete("manual")}
              className="group p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold">I'll add my own copy</h4>
              <p className="text-xs text-muted-foreground">
                Enter your own headlines, descriptions & primary text on the next step.
              </p>
            </button>
          </div>

          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="text-muted-foreground">
              ← Back to uploads
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Upload step
  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "border-2 border-dashed rounded-2xl transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-medium">Drop your ads here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">
            Videos and images • Max 250MB per file
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-muted bg-muted/30">
        <CardContent className="py-4 space-y-2">
          <div className="flex items-start gap-2">
            <Image className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Images</p>
              <p className="text-xs text-muted-foreground">Upload your square (1:1) version first. You'll be prompted to add a 9:16 Stories version next.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Video className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Videos</p>
              <p className="text-xs text-muted-foreground">9:16 vertical format only.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{files.length} file{files.length > 1 ? 's' : ''} ready</h3>
          </div>

          <div className="space-y-3">
            {files.map(f => (
              <Card key={f.id} className="overflow-hidden rounded-xl">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {f.preview ? (
                      <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    ) : f.file.type.startsWith("video/") ? (
                      <Video className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Image className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{f.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(f.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>

                  <Select
                    value={f.format}
                    onValueChange={(v) => updateFormat(f.id, v as any)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleContinueToCopyChoice} className="gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            ← Back to Generate Angles
          </Button>
        </div>
      )}
    </div>
  );
}
