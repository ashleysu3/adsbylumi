import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, 
  X, 
  FileVideo, 
  FileImage, 
  FileText,
  Check,
  AlertCircle,
  Link2,
  Eye,
  PlayCircle
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
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const [linkingAsset, setLinkingAsset] = useState<any>(null);
  const uploadedAssets = workspace.user_uploaded_assets || [];
  
  // Get all available concepts from creative_mix
  const creativeMix = workspace.creative_json?.creative_mix || {};
  const allConcepts = [
    ...(creativeMix.tofu || []).map((c: any, i: number) => ({ ...c, conceptId: `tofu-${i}`, stage: 'TOFU' })),
    ...(creativeMix.mofu || []).map((c: any, i: number) => ({ ...c, conceptId: `mofu-${i}`, stage: 'MOFU' })),
    ...(creativeMix.bofu || []).map((c: any, i: number) => ({ ...c, conceptId: `bofu-${i}`, stage: 'BOFU' })),
  ];

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
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 50MB)`);
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
          uploaded_at: new Date().toISOString(),
          linked_concept_id: null,
          linked_concept_title: null
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

  const handleLinkConcept = async (conceptId: string) => {
    if (!linkingAsset) return;
    
    const concept = allConcepts.find(c => c.conceptId === conceptId);
    if (!concept) return;
    
    const updatedAssets = uploadedAssets.map((a: any) => 
      a.id === linkingAsset.id 
        ? { ...a, linked_concept_id: conceptId, linked_concept_title: concept.title }
        : a
    );
    
    const { error } = await supabase
      .from('campaign_workspaces')
      .update({
        user_uploaded_assets: updatedAssets,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspace.id);
    
    if (error) {
      toast.error('Failed to link asset');
      return;
    }
    
    await onUpdate({ user_uploaded_assets: updatedAssets });
    setLinkingAsset(null);
    toast.success('Asset linked to concept');
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
          Upload your finished videos, images, and graphics. Max 50MB per file.
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
                        {asset.linked_concept_title && (
                          <div className="flex items-center gap-1 mt-1">
                            <Link2 className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary">{asset.linked_concept_title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Preview button */}
                      {(asset.file_type.startsWith('image/') || asset.file_type.startsWith('video/')) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewAsset(asset)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Link to concept button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLinkingAsset(asset)}
                        title="Link to concept"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      
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
            <p className="font-medium">Tip: Link assets to concepts</p>
            <p className="text-muted-foreground">
              Click the link icon to connect each asset to a specific creative concept for better organization
            </p>
          </div>
        </div>
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden min-h-[400px]">
            {previewAsset?.file_type.startsWith('image/') && (
              <img 
                src={previewAsset.file_url} 
                alt={previewAsset.file_name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
            {previewAsset?.file_type.startsWith('video/') && (
              <video 
                controls 
                src={previewAsset.file_url}
                className="max-w-full max-h-[70vh]"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>
          {previewAsset?.linked_concept_title && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Linked to: <span className="font-medium text-foreground">{previewAsset.linked_concept_title}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link to Concept Dialog */}
      <Dialog open={!!linkingAsset} onOpenChange={() => setLinkingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Asset to Concept</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose which creative concept this asset is for:
            </p>
            <Select onValueChange={handleLinkConcept}>
              <SelectTrigger>
                <SelectValue placeholder="Select a creative concept..." />
              </SelectTrigger>
              <SelectContent>
                {allConcepts.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No creative concepts generated yet
                  </div>
                ) : (
                  allConcepts.map((concept: any) => (
                    <SelectItem key={concept.conceptId} value={concept.conceptId}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {concept.stage}
                        </Badge>
                        <span className="truncate">{concept.title}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {linkingAsset?.linked_concept_title && (
              <div className="p-3 bg-muted/50 rounded text-sm">
                <p className="text-muted-foreground">Currently linked to:</p>
                <p className="font-medium">{linkingAsset.linked_concept_title}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}