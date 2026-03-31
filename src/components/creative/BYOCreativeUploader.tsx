import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Video, Image, X, Sparkles, PenLine, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UploadedFile {
  id: string;
  file: File;
  format: "talking_head" | "broll" | "graphic";
  preview?: string;
  storagePath?: string;
  storageUrl?: string;
}

interface BYOCreativeUploaderProps {
  workspaceId: string;
  brandId: string;
  onComplete: (items: any[], copyChoice: "lumi" | "manual") => void;
  onCancel: () => void;
}

const formatOptions = [
  { value: "talking_head", label: "Talking Head", icon: Video },
  { value: "broll", label: "B-Roll / Lofi Video", icon: Video },
  { value: "graphic", label: "Graphic / Static", icon: Image },
];

type Step = "upload" | "copy_choice" | "uploading";

export function BYOCreativeUploader({ workspaceId, brandId, onComplete, onCancel }: BYOCreativeUploaderProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const maxSize = 50 * 1024 * 1024; // 50MB
    const valid = incoming.filter(f => {
      if (f.size > maxSize) { toast.error(`${f.name} exceeds 50MB limit`); return false; }
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

  const updateFormat = (id: string, format: "talking_head" | "broll" | "graphic") => {
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

  const handleCopyChoice = async (choice: "lumi" | "manual") => {
    setStep("uploading");
    setIsUploading(true);

    try {
      // Upload files to Supabase storage
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

        uploadedFiles.push({
          ...f,
          storagePath: path,
          storageUrl: urlData.publicUrl,
        });
      }

      if (uploadedFiles.length === 0) {
        toast.error("No files were uploaded successfully");
        setStep("upload");
        setIsUploading(false);
        return;
      }

      // Create production items from uploaded files
      const productionItems = uploadedFiles.map(f => ({
        id: `prod_${f.id}`,
        format: f.format,
        hook: f.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        guidance: "User-uploaded creative asset",
        angleName: "My Creative",
        completed: false,
        linkedAsset: {
          storagePath: f.storagePath,
          url: f.storageUrl,
          name: f.file.name,
          type: f.file.type,
        },
        status: "approved",
      }));

      // Create a default angle for user uploads
      const byoAngle = {
        id: "byo_uploads",
        name: "My Creative",
        description: "Your own uploaded creative assets.",
        isDefault: true,
      };

      // Save to workspace
      const { data: wsData } = await supabase
        .from("campaign_workspaces")
        .select("creative_json, production_items, user_uploaded_assets")
        .eq("id", workspaceId)
        .single();

      const existingCreative = (wsData?.creative_json || {}) as Record<string, any>;
      const existingProduction = (wsData?.production_items || []) as any[];
      const existingAssets = (wsData?.user_uploaded_assets || []) as any[];

      // Add BYO angle if not present
      const angles = existingCreative.angles || [];
      if (!angles.some((a: any) => a.id === "byo_uploads")) {
        angles.push(byoAngle);
      }

      // Build user_uploaded_assets entries for the build pipeline
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

      await supabase.from("campaign_workspaces").update({
        creative_json: {
          ...existingCreative,
          angles,
          selectedAngleIds: [...new Set([...(existingCreative.selectedAngleIds || []), "byo_uploads"])],
          byoUploadMode: true,
        },
        production_items: [...existingProduction, ...productionItems],
        user_uploaded_assets: [...existingAssets, ...newAssets],
        updated_at: new Date().toISOString(),
      }).eq("id", workspaceId);

      toast.success(`${uploadedFiles.length} creative${uploadedFiles.length > 1 ? 's' : ''} uploaded!`);
      onComplete(productionItems, choice);
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
          
          <div className="grid gap-4 sm:grid-cols-2 max-w-lg mx-auto">
            <button
              onClick={() => handleCopyChoice("lumi")}
              className="group p-6 rounded-xl border-2 border-muted hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold">Lumi writes the copy</h4>
              <p className="text-xs text-muted-foreground">
                AI-generated headlines, descriptions & primary text based on your brand & offer.
              </p>
            </button>
            
            <button
              onClick={() => handleCopyChoice("manual")}
              className="group p-6 rounded-xl border-2 border-muted hover:border-primary/50 hover:bg-primary/5 transition-all text-left space-y-3"
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
            Videos and images • Max 50MB per file
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
