import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

interface AssetTypeOption {
  type: string;
  label: string;
}

interface AddReferenceContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  assetTypes: AssetTypeOption[];
  defaultType?: string;
  onAdded: () => void;
}

const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'rtf', 'html', 'htm'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function AddReferenceContentModal({
  open,
  onOpenChange,
  brandId,
  assetTypes,
  defaultType,
  onAdded,
}: AddReferenceContentModalProps) {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [assetType, setAssetType] = useState<string>(defaultType || assetTypes[0]?.type || 'other');
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTab('paste');
    setAssetType(defaultType || assetTypes[0]?.type || 'other');
    setLabel('');
    setContent('');
    setFiles([]);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} is over 10MB and was skipped`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const isTextFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return file.type.startsWith('text/') || TEXT_EXTENSIONS.includes(ext);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const inserts: Array<{
        brand_id: string;
        asset_type: string;
        content: string;
        label: string | null;
        offer_ids: string[];
      }> = [];

      if (tab === 'paste') {
        if (!content.trim()) {
          toast.error('Please paste some content');
          setSubmitting(false);
          return;
        }
        inserts.push({
          brand_id: brandId,
          asset_type: assetType,
          content: content.trim(),
          label: label.trim() || null,
          offer_ids: [],
        });
      } else {
        if (files.length === 0) {
          toast.error('Please choose at least one file');
          setSubmitting(false);
          return;
        }

        for (const file of files) {
          if (isTextFile(file)) {
            const text = await readTextFile(file);
            if (!text.trim()) continue;
            inserts.push({
              brand_id: brandId,
              asset_type: assetType,
              content: text.trim(),
              label: label.trim() || file.name,
              offer_ids: [],
            });
          } else {
            // Upload to storage and store a reference
            const path = `${brandId}/reference-content/${Date.now()}-${file.name}`;
            const { error: upErr } = await supabase.storage
              .from('creative-assets')
              .upload(path, file, { upsert: false });
            if (upErr) {
              console.error('Upload error', upErr);
              toast.error(`Failed to upload ${file.name}`);
              continue;
            }
            const { data: pub } = supabase.storage
              .from('creative-assets')
              .getPublicUrl(path);
            inserts.push({
              brand_id: brandId,
              asset_type: assetType,
              content: `[File attached] ${file.name}\nURL: ${pub.publicUrl}`,
              label: label.trim() || file.name,
              offer_ids: [],
            });
          }
        }

        if (inserts.length === 0) {
          toast.error('No content could be extracted from the selected files');
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase
        .from('brand_content_assets')
        .insert(inserts);

      if (error) throw error;

      toast.success(
        inserts.length === 1
          ? 'Reference content added'
          : `${inserts.length} items added`,
      );
      reset();
      onOpenChange(false);
      onAdded();
    } catch (err) {
      console.error('Error adding reference content:', err);
      toast.error('Failed to add reference content');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add reference content</DialogTitle>
          <DialogDescription>
            Paste text or upload files. Lumi will use these to make your ads more authentic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Category</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assetTypes.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Label (optional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Jessica's testimonial"
                maxLength={120}
              />
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'paste' | 'upload')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">Paste text</TabsTrigger>
              <TabsTrigger value="upload">Upload files</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste testimonials, scripts, survey responses, sales copy..."
                className="min-h-[180px]"
              />
            </TabsContent>

            <TabsContent value="upload" className="space-y-3">
              <label
                htmlFor="ref-file-input"
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to choose files</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Text files (.txt, .md, .csv) are read directly. Other files are stored as attachments. Max 10MB each.
                </p>
                <input
                  id="ref-file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
              </label>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between p-2 border rounded text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(idx)}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="lumi">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Adding...
              </>
            ) : (
              'Add to library'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
