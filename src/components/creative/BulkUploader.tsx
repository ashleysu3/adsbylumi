import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Video, Image, X, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreativeAngle } from "./AngleSelector";

export interface UploadedAsset {
  id: string;
  file: File;
  format: "talking_head" | "broll" | "graphic";
  angleId: string;
  preview?: string;
}

interface BulkUploaderProps {
  angles: CreativeAngle[];
  uploadedAssets: UploadedAsset[];
  onAssetsChange: (assets: UploadedAsset[]) => void;
  onAddToChecklist: (assets: UploadedAsset[]) => void;
}

const formatOptions = [
  { value: "talking_head", label: "Talking Head", icon: Video },
  { value: "broll", label: "B-Roll / Lofi Video", icon: Video },
  { value: "graphic", label: "Graphic / Static", icon: Image },
];

export function BulkUploader({
  angles,
  uploadedAssets,
  onAssetsChange,
  onAddToChecklist,
}: BulkUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    processFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFiles = (files: File[]) => {
    const newAssets: UploadedAsset[] = files.map((file) => {
      const isVideo = file.type.startsWith("video/");
      const format = isVideo ? "broll" : "graphic";
      
      return {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        format: format as "talking_head" | "broll" | "graphic",
        angleId: angles[0]?.id || "",
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
    });

    onAssetsChange([...uploadedAssets, ...newAssets]);
  };

  const updateAsset = (id: string, updates: Partial<UploadedAsset>) => {
    onAssetsChange(
      uploadedAssets.map((asset) =>
        asset.id === id ? { ...asset, ...updates } : asset
      )
    );
  };

  const removeAsset = (id: string) => {
    const asset = uploadedAssets.find(a => a.id === id);
    if (asset?.preview) {
      URL.revokeObjectURL(asset.preview);
    }
    onAssetsChange(uploadedAssets.filter((a) => a.id !== id));
  };

  const handleAddToChecklist = () => {
    onAddToChecklist(uploadedAssets);
    onAssetsChange([]);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-bold">Upload Your Assets</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Already have videos or images ready? Upload them here and tag each one.
        </p>
      </div>

      {/* Drop zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-medium">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">
            Videos and images accepted
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

      {/* Uploaded assets list */}
      {uploadedAssets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{uploadedAssets.length} files ready</h3>
            <Button onClick={handleAddToChecklist} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add All to Checklist
            </Button>
          </div>

          <div className="space-y-3">
            {uploadedAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Preview */}
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {asset.preview ? (
                      <img
                        src={asset.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : asset.file.type.startsWith("video/") ? (
                      <Video className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Image className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{asset.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(asset.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>

                  {/* Format selector */}
                  <Select
                    value={asset.format}
                    onValueChange={(value) =>
                      updateAsset(asset.id, { format: value as any })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Angle selector */}
                  <Select
                    value={asset.angleId}
                    onValueChange={(value) =>
                      updateAsset(asset.id, { angleId: value })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select angle" />
                    </SelectTrigger>
                    <SelectContent>
                      {angles.map((angle) => (
                        <SelectItem key={angle.id} value={angle.id}>
                          {angle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAsset(asset.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
