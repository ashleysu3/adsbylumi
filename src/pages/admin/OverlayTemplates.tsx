import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Upload, Loader2, Palette, Sparkles, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const overlayTemplatesTable = 'text_overlay_templates' as any;

// ============================================================================
// Admin · Text Overlay Templates (patch #18)
//
// CRUD UI for the global text-overlay style template library. Patch #18:
//   - Re-ships the AI auto-analyze flow that drifted out of production.
//     Click "Auto-analyze with AI" after uploading a reference video and
//     Gemini extracts the style — font, color, position, case, stroke —
//     into the form so admin just reviews + saves.
//   - Adds a "Paste URL" option alongside the upload, so admins don't
//     have to download IG clips to their device first. Server-side
//     fetcher edge function pulls the bytes and uploads to storage.
// ============================================================================

type LetterCase = 'as-typed' | 'upper' | 'lower' | 'title';
type FontWeight = 'normal' | 'bold' | 'black';
type Position = 'top' | 'center' | 'bottom';

interface Template {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  font_family: string;
  font_size: number;
  font_weight: FontWeight;
  text_color: string;
  bg_color: string;
  bg_opacity: number;
  position: Position;
  text_shadow: boolean;
  letter_case: LetterCase;
  text_stroke_color: string | null;
  text_stroke_width: number;
  reference_video_url: string | null;
  reference_video_storage_path: string | null;
}

const FONT_OPTIONS = [
  'Inter',
  'Playfair Display',
  'Montserrat',
  'Bebas Neue',
  'Poppins',
  'Oswald',
  'Lora',
  'Raleway',
];

const EMPTY_FORM: Omit<Template, 'id'> = {
  name: '',
  description: '',
  sort_order: 100,
  is_active: true,
  font_family: 'Inter',
  font_size: 48,
  font_weight: 'bold',
  text_color: '#FFFFFF',
  bg_color: '#000000',
  bg_opacity: 0.6,
  position: 'bottom',
  text_shadow: true,
  letter_case: 'as-typed',
  text_stroke_color: null,
  text_stroke_width: 0,
  reference_video_url: null,
  reference_video_storage_path: null,
};

// Grab a frame at ~50% of the video's duration and return it as a base64
// PNG data URL. Used for AI auto-analyze — text is usually visible by the
// middle of a short IG clip, so that's a reasonable default sample point.
async function captureMidFrame(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
    };

    const onMeta = () => {
      const t = Math.max(0.5, (video.duration || 5) * 0.5);
      try {
        video.currentTime = t;
      } catch (e) {
        cleanup();
        reject(new Error('Seek failed'));
      }
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    const onErr = () => {
      cleanup();
      reject(new Error('Could not load video for frame capture'));
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onErr);
  });
}

export default function AdminOverlayTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(overlayTemplatesTable)
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast.error('Could not load templates: ' + error.message);
    } else {
      setTemplates(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (t: Template) => {
    if (!window.confirm(`Delete "${t.name}"? Users won't see it anymore.`)) return;
    const { error } = await supabase.from(overlayTemplatesTable).delete().eq('id', t.id);
    if (error) {
      toast.error('Delete failed: ' + error.message);
    } else {
      toast.success('Template deleted');
      loadTemplates();
    }
  };

  const handleToggleActive = async (t: Template) => {
    const { error } = await supabase
      .from(overlayTemplatesTable)
      .update({ is_active: !t.is_active })
      .eq('id', t.id);
    if (error) {
      toast.error('Update failed: ' + error.message);
    } else {
      loadTemplates();
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Palette className="h-6 w-6" />
              Text Overlay Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Curated style presets users pick from in the b-roll text editor. Upload an Instagram reference clip
              (or paste a direct video URL) to show them the vibe.
            </p>
          </div>
          <Button variant="lumi" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="p-12 text-center">
                <Palette className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold">No templates yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "New template" to create your first.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preview</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Font / Style</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {t.reference_video_url ? (
                          <video
                            src={t.reference_video_url}
                            className="h-16 w-10 object-cover rounded"
                            muted
                            playsInline
                            onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                          />
                        ) : (
                          <div className="h-16 w-10 bg-muted rounded flex items-center justify-center">
                            <Palette className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">{t.font_family}</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{t.font_weight}</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{t.letter_case}</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{t.position}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(t)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(t)} aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create */}
      <TemplateFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSaved={() => {
          setShowCreate(false);
          loadTemplates();
        }}
      />
      {/* Edit */}
      {editing && (
        <TemplateFormDialog
          open={!!editing}
          onOpenChange={o => !o && setEditing(null)}
          template={editing}
          onSaved={() => {
            setEditing(null);
            loadTemplates();
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ============================================================================
// Create / edit dialog
// ============================================================================

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Omit<Template, 'id'>>(() =>
    template ? { ...template, id: undefined as any } as any : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // URL paste UI state.
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  useEffect(() => {
    if (template) setForm({ ...template } as any);
    else setForm(EMPTY_FORM);
    setShowUrlInput(false);
    setUrlValue('');
  }, [template, open]);

  const patch = (p: Partial<typeof form>) => setForm(prev => ({ ...prev, ...p }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
        font_family: form.font_family,
        font_size: form.font_size,
        font_weight: form.font_weight,
        text_color: form.text_color,
        bg_color: form.bg_color,
        bg_opacity: form.bg_opacity,
        position: form.position,
        text_shadow: form.text_shadow,
        letter_case: form.letter_case,
        text_stroke_color: form.text_stroke_color,
        text_stroke_width: form.text_stroke_width,
        reference_video_url: form.reference_video_url,
        reference_video_storage_path: form.reference_video_storage_path,
      };
      if (template) {
        const { error } = await supabase
          .from(overlayTemplatesTable)
          .update(payload)
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(overlayTemplatesTable).insert(payload);
        if (error) throw error;
      }
      toast.success(template ? 'Template updated' : 'Template created');
      onSaved();
    } catch (err: any) {
      toast.error('Save failed: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `overlay-templates/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
      const { error } = await supabase.storage
        .from('creative-assets')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('creative-assets').getPublicUrl(path);
      patch({ reference_video_url: data.publicUrl, reference_video_storage_path: path });
      toast.success('Reference video uploaded');
    } catch (err: any) {
      toast.error('Upload failed: ' + (err?.message || 'unknown'));
    } finally {
      setUploading(false);
    }
  };

  // Patch #18: paste a URL instead of uploading. Calls the
  // fetch-reference-video edge function which downloads server-side and
  // stores in the same creative-assets bucket as the upload path.
  const handleFetchUrl = async () => {
    const url = urlValue.trim();
    if (!url) {
      toast.error('Paste a URL first');
      return;
    }
    setFetchingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-reference-video', {
        body: { url },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success || !data?.url) {
        const hint = (data as any)?.hint ? `\n\n${(data as any).hint}` : '';
        throw new Error(((data as any)?.error || 'Could not load that URL') + hint);
      }
      patch({ reference_video_url: data.url, reference_video_storage_path: data.storagePath });
      setShowUrlInput(false);
      setUrlValue('');
      toast.success('Reference video imported from URL');
    } catch (err: any) {
      toast.error('Import failed', {
        description: err?.message || 'Try a direct video URL or upload the file.',
        duration: 10000,
      });
    } finally {
      setFetchingUrl(false);
    }
  };

  // Grab a frame ~halfway through the video (text is usually visible by
  // then in IG b-roll) and send it to Gemini via the AI gateway. Returns
  // once the form has been populated or an error is shown.
  const handleAutoAnalyze = async () => {
    if (!form.reference_video_url) {
      toast.error('Upload or paste a reference video first');
      return;
    }
    setAnalyzing(true);
    try {
      const frameDataUrl = await captureMidFrame(form.reference_video_url);
      const { data, error } = await supabase.functions.invoke('analyze-overlay-reference', {
        body: { imageBase64: frameDataUrl },
      });
      if (error) throw new Error(error.message || 'Request failed');
      if (!data?.success || !data?.draft) {
        throw new Error(data?.error || 'AI returned no draft');
      }
      const d = data.draft;
      patch({
        name: form.name || d.name_suggestion || 'Reference Style',
        description: form.description || d.description_suggestion || '',
        font_family: d.font_family,
        font_size: d.font_size,
        font_weight: d.font_weight,
        text_color: d.text_color,
        bg_color: d.bg_color,
        bg_opacity: d.bg_opacity,
        position: d.position,
        text_shadow: d.text_shadow,
        letter_case: d.letter_case,
        text_stroke_color: d.text_stroke_color,
        text_stroke_width: d.text_stroke_width,
      });
      toast.success('Style extracted — review + save when it looks right', {
        description: d.confidence_notes || undefined,
        duration: 10000,
      });
    } catch (err: any) {
      console.error('Auto-analyze failed:', err);
      toast.error('Auto-analyze failed: ' + (err?.message || 'unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            Drop in an Instagram reference (upload or paste URL), click "Auto-analyze with AI", review the extracted
            style, save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column: form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => patch({ name: e.target.value })}
                placeholder='e.g. "Clean Bold"'
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description || ''}
                onChange={e => patch({ description: e.target.value })}
                rows={2}
                placeholder="Short note explaining the vibe."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Font</Label>
                <Select value={form.font_family} onValueChange={v => patch({ font_family: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Weight</Label>
                <Select value={form.font_weight} onValueChange={v => patch({ font_weight: v as FontWeight })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Letter case</Label>
                <Select value={form.letter_case} onValueChange={v => patch({ letter_case: v as LetterCase })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="as-typed">As typed</SelectItem>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                    <SelectItem value="lower">lowercase</SelectItem>
                    <SelectItem value="title">Title Case</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <Select value={form.position} onValueChange={v => patch({ position: v as Position })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Font size ({form.font_size}px)</Label>
              <Slider
                value={[form.font_size]}
                min={24}
                max={96}
                step={2}
                onValueChange={([v]) => patch({ font_size: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Text color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.text_color}
                    onChange={e => patch({ text_color: e.target.value })}
                    className="h-9 w-10 border rounded cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">{form.text_color}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Background color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.bg_color}
                    onChange={e => patch({ bg_color: e.target.value })}
                    className="h-9 w-10 border rounded cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">{form.bg_color}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>BG opacity ({Math.round(form.bg_opacity * 100)}%)</Label>
              <Slider
                value={[form.bg_opacity]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => patch({ bg_opacity: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Text shadow</Label>
              <Switch
                checked={form.text_shadow}
                onCheckedChange={v => patch({ text_shadow: v })}
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-sm font-semibold">Text stroke (outline)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.text_stroke_color || '#000000'}
                      onChange={e => patch({ text_stroke_color: e.target.value })}
                      className="h-9 w-10 border rounded cursor-pointer"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[11px]"
                      onClick={() => patch({ text_stroke_color: null, text_stroke_width: 0 })}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Width ({form.text_stroke_width}px)</Label>
                  <Slider
                    value={[form.text_stroke_width]}
                    min={0}
                    max={12}
                    step={1}
                    onValueChange={([v]) => patch({ text_stroke_width: v })}
                    disabled={!form.text_stroke_color}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <Label>Sort order ({form.sort_order})</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => patch({ sort_order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-[11px] text-muted-foreground">Lower sort order appears first in the picker.</p>
            </div>
          </div>

          {/* Right column: reference video + AI analyze */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Reference video</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                The clip users see in the picker as "this is the vibe."
              </p>

              {form.reference_video_url ? (
                <div className="space-y-2">
                  <video
                    src={form.reference_video_url}
                    className="w-full aspect-[9/16] object-cover rounded-lg bg-black"
                    controls
                    muted
                    loop
                    playsInline
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="lumi"
                      className="gap-1.5"
                      onClick={handleAutoAnalyze}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {analyzing ? 'Analyzing…' : 'Auto-analyze with AI'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => patch({ reference_video_url: null, reference_video_storage_path: null })}
                    >
                      Remove reference
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    AI prefills the form with its best guess. You review + tweak before saving.
                  </p>
                </div>
              ) : showUrlInput ? (
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="https://… (direct .mp4 link works best)"
                    value={urlValue}
                    onChange={e => setUrlValue(e.target.value)}
                    disabled={fetchingUrl}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFetchUrl();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="lumi"
                      onClick={handleFetchUrl}
                      disabled={fetchingUrl || !urlValue.trim()}
                      className="gap-1.5"
                    >
                      {fetchingUrl ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )}
                      {fetchingUrl ? 'Fetching…' : 'Import from URL'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowUrlInput(false);
                        setUrlValue('');
                      }}
                      disabled={fetchingUrl}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Direct video URLs (.mp4 / .mov) work reliably. Instagram and TikTok page URLs may fail
                    because those sites hide videos from anonymous requests — if so, save the clip locally
                    and use the upload option instead.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block aspect-[9/16] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 transition-colors flex items-center justify-center">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="text-center">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Click to upload MP4 / MOV</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleVideoUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => setShowUrlInput(true)}
                    disabled={uploading}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    …or paste a video URL
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="lumi" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {template ? 'Save changes' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
