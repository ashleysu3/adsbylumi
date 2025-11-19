import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, FileVideo, FileImage, File, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface AssetUploaderProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

interface UploadedAsset {
  id: string;
  file_url: string;
  file_type: string;
  name: string;
  size: number;
  created_at: string;
}

export function AssetUploader({ workspace, onUpdate }: AssetUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const assets = Array.isArray(workspace.user_uploaded_assets) 
    ? workspace.user_uploaded_assets 
    : [];
  const [localAssets, setLocalAssets] = useState<UploadedAsset[]>(assets);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      // In a real implementation, this would upload to Supabase Storage
      // For now, we'll simulate the upload
      const newAssets: UploadedAsset[] = Array.from(files).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file_url: URL.createObjectURL(file), // Temporary URL for demo
        file_type: file.type,
        name: file.name,
        size: file.size,
        created_at: new Date().toISOString(),
      }));

      const updatedAssets = [...localAssets, ...newAssets];
      setLocalAssets(updatedAssets);
      
      await onUpdate({ 
        user_uploaded_assets: updatedAssets,
        progress_status: updatedAssets.length > 0 ? "ready_to_publish" : workspace.progress_status
      });
      
      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAsset = async (assetId: string) => {
    const updatedAssets = localAssets.filter(a => a.id !== assetId);
    setLocalAssets(updatedAssets);
    await onUpdate({ user_uploaded_assets: updatedAssets });
    toast.success("Asset removed");
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("video/")) return <FileVideo className="h-5 w-5" />;
    if (fileType.startsWith("image/")) return <FileImage className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Your Final Creative</CardTitle>
          <CardDescription>
            Upload your finished videos, images, and other creative assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                MP4, JPG, PNG, PDF, etc. (Max 50MB per file)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {localAssets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Uploaded Assets ({localAssets.length})
                  </h4>
                </div>
                
                <div className="space-y-2">
                  {localAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getFileIcon(asset.file_type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(asset.size)} • {new Date(asset.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAsset(asset.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Videos</p>
                <p className="text-muted-foreground">MP4, H.264 codec, 9:16 or 4:5 aspect ratio, under 30MB</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Images</p>
                <p className="text-muted-foreground">JPG or PNG, 1080x1080 or 1080x1920, under 10MB</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Carousels</p>
                <p className="text-muted-foreground">2-10 images, each 1080x1080, JPG or PNG</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}