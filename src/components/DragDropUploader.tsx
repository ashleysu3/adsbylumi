import { useState, useRef, DragEvent } from "react";
import { z } from "zod";
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
  Eye,
  Link2,
  CloudUpload,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// File validation schema
const fileValidationSchema = z.object({
  name: z.string().max(255, "Filename too long"),
  size: z.number().max(20 * 1024 * 1024, "File must be less than 20MB"),
  type: z.string().refine(
    (type) => [
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf'
    ].some(allowed => type.startsWith(allowed.split('/')[0]) || type === allowed),
    "File type not supported"
  )
});

interface DragDropUploaderProps {
  workspace: any;
  onUpdate: (updates: any) => void;
  productionItem?: any;
}

export function DragDropUploader({ workspace, onUpdate, productionItem }: DragDropUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const [linkingAsset, setLinkingAsset] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadedAssets = workspace.user_uploaded_assets || [];
  
  // Filter assets to only show those linked to this specific concept
  const relevantAssets = productionItem?.concept_id 
    ? uploadedAssets.filter((asset: any) => asset.linked_concept_id === productionItem.concept_id)
    : uploadedAssets;
  
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

  const validateFiles = (files: File[]) => {
    const validFiles: File[] = [];
    
    files.forEach(file => {
      try {
        fileValidationSchema.parse({
          name: file.name,
          size: file.size,
          type: file.type
        });
        validFiles.push(file);
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast.error(`${file.name}: ${error.errors[0].message}`);
        }
      }
    });
    
    return validFiles;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await uploadFiles(files);
    event.target.value = '';
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = validateFiles(files);
    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const brandId = workspace.brand_id;
      const newAssets: any[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
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
          file_name: sanitizedName,
          file_type: file.type,
          file_size: file.size,
          file_url: urlData.publicUrl,
          storage_path: filePath,
          uploaded_at: new Date().toISOString(),
          linked_concept_id: productionItem?.concept_id || null,
          linked_concept_title: productionItem?.concept?.title || null
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

      onUpdate({ user_uploaded_assets: updatedAssets });

      toast.success(`Uploaded ${validFiles.length} file${validFiles.length > 1 ? 's' : ''} successfully!`);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
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

      onUpdate({ user_uploaded_assets: updatedAssets });

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
    
    onUpdate({ user_uploaded_assets: updatedAssets });
    setLinkingAsset(null);
    toast.success('Asset linked to concept');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudUpload className="h-5 w-5" />
          Upload Creative Assets
        </CardTitle>
        <CardDescription>
          Drag and drop files or click to browse. Max 20MB per file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${isDragging 
              ? 'border-primary bg-primary/5 scale-[1.02]' 
              : 'border-border hover:border-primary/50 hover:bg-muted/20'
            }
            ${uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
          `}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,image/*,application/pdf"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
          
          <CloudUpload className={`h-16 w-16 mx-auto mb-4 transition-colors ${
            isDragging ? 'text-primary' : 'text-muted-foreground'
          }`} />
          
          <p className="text-lg font-medium mb-2">
            {isDragging ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse your computer
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-normal">Videos (MP4, MOV)</Badge>
            <Badge variant="outline" className="font-normal">Images (JPG, PNG, WEBP)</Badge>
            <Badge variant="outline" className="font-normal">PDFs</Badge>
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4 animate-pulse" />
                Uploading files...
              </span>
              <span className="font-medium">{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Uploaded Assets List */}
        {relevantAssets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Uploaded Assets ({relevantAssets.length})
              </h4>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {relevantAssets.map((asset: any) => {
                const FileIcon = getFileIcon(asset.file_type);

                return (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{asset.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(asset.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(asset.uploaded_at).toLocaleDateString()}</span>
                        </div>
                        {asset.linked_concept_title && (
                          <div className="flex items-center gap-1 mt-1">
                            <Link2 className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary truncate">{asset.linked_concept_title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAsset(asset)}
                        title="Delete"
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
