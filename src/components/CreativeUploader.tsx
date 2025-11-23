import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  X, 
  FileVideo, 
  FileImage, 
  FileText,
  Check,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreativeUploaderProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

export function CreativeUploader({ workspace, onUpdate }: CreativeUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadedAssets = workspace.user_uploaded_assets || [];

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('video/')) return FileVideo;
    if (fileType.startsWith('image/')) return FileImage;
    return FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate file types
    const allowedTypes = [
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf'
    ];

    const validFiles = Array.from(files).filter(file => {
      if (!allowedTypes.some(type => file.type.startsWith(type.split('/')[0]) || file.type === type)) {
        toast.error(`${file.name}: Unsupported file type`);
        return false;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 20MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const brandId = workspace.brand_id;
      const newAssets: any[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${brandId}/${workspace.id}/${fileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('creative-assets')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('creative-assets')
          .getPublicUrl(filePath);

        newAssets.push({
          id: `asset_${Date.now()}_${i}`,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: urlData.publicUrl,
          storage_path: filePath,
          uploaded_at: new Date().toISOString()
        });

        setUploadProgress(((i + 1) / validFiles.length) * 100);
      }

      // Update workspace with new assets
      const updatedAssets = [...uploadedAssets, ...newAssets];
      
      const { error: updateError } = await supabase
        .from('campaign_workspaces')
        .update({
          user_uploaded_assets: updatedAssets,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);

      if (updateError) throw updateError;

      await onUpdate({ user_uploaded_assets: updatedAssets });

      toast.success(`Uploaded ${validFiles.length} file${validFiles.length > 1 ? 's' : ''} successfully!`);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  const handleDeleteAsset = async (asset: any) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('creative-assets')
        .remove([asset.storage_path]);

      if (storageError) throw storageError;

      // Update workspace
      const updatedAssets = uploadedAssets.filter((a: any) => a.id !== asset.id);
      
      const { error: updateError } = await supabase
        .from('campaign_workspaces')
        .update({
          user_uploaded_assets: updatedAssets,
          updated_at: new Date().toISOString()
        })
        .eq('id', workspace.id);

      if (updateError) throw updateError;

      await onUpdate({ user_uploaded_assets: updatedAssets });

      toast.success('Asset deleted successfully');

    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete asset');
    }
  };

  const getStageFromFileName = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.includes('tofu')) return 'tofu';
    if (lower.includes('mofu')) return 'mofu';
    if (lower.includes('bofu')) return 'bofu';
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Final Creative Assets
        </CardTitle>
        <CardDescription>
          Upload your finished videos, images, and graphics. Max 20MB per file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Button */}
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
          <input
            type="file"
            id="file-upload"
            multiple
            accept="video/*,image/*,application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              Videos (MP4, MOV), Images (JPG, PNG, WEBP), or PDFs
            </p>
          </label>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Uploaded Assets List */}
        {uploadedAssets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Uploaded Assets ({uploadedAssets.length})</h4>
            <div className="space-y-2">
              {uploadedAssets.map((asset: any) => {
                const FileIcon = getFileIcon(asset.file_type);
                const stage = getStageFromFileName(asset.file_name);

                return (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{asset.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(asset.file_size)}</span>
                          {stage && (
                            <Badge variant="outline" className="text-xs">
                              {stage.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAsset(asset)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Helper Text */}
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-medium">Tip: Include stage in filename</p>
            <p className="text-muted-foreground">
              Add "TOFU", "MOFU", or "BOFU" to your filename for automatic categorization
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}