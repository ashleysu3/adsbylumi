import { useEffect, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Check, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { RenderStyle } from '@/lib/ffmpeg-renderer';

// ============================================================================
// TemplateGallery
//
// Picker UI for text-overlay style templates curated by admins. Shows a
// popover grid of templates with their reference video preview playing on
// hover. Clicking a template applies its style spec to whatever the user
// is composing (via onApply).
//
// Usage:
//   <TemplateGallery currentStyle={style} onApply={setStyle} />
//
// Gallery reads from public.text_overlay_templates (RLS lets authenticated
// users read is_active=true rows).
// ============================================================================

export interface OverlayTemplate {
  id: string;
  name: string;
  description: string | null;
  reference_video_url: string | null;
  style: RenderStyle;
}

interface TemplateGalleryProps {
  currentStyle?: RenderStyle;
  /** Called with the full RenderStyle from the chosen template. */
  onApply: (style: RenderStyle, templateName: string) => void;
  /** When present, this template id is highlighted as "applied". */
  selectedTemplateId?: string | null;
  onSelectTemplateId?: (id: string | null) => void;
  className?: string;
}

export function TemplateGallery({
  onApply,
  selectedTemplateId,
  onSelectTemplateId,
  className,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<OverlayTemplate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('text_overlay_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const mapped: OverlayTemplate[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        reference_video_url: row.reference_video_url,
        style: rowToStyle(row),
      }));
      setTemplates(mapped);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // Lazy fetch on first open — no point hammering the DB on every render.
  useEffect(() => {
    if (open && templates === null) fetchTemplates();
  }, [open, templates]);

  const selected = templates?.find(t => t.id === selectedTemplateId) || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 ${className || ''}`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span className="text-xs">
            {selected ? `Style: ${selected.name}` : 'Pick a style template'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[440px] p-0 max-h-[480px] overflow-y-auto">
        <div className="p-3 border-b">
          <p className="text-sm font-semibold">Text style templates</p>
          <p className="text-[11px] text-muted-foreground">
            Pick a style — your overlays render in the chosen look. Hover a thumbnail to preview.
          </p>
        </div>

        {loading && (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates…
          </div>
        )}

        {!loading && templates && templates.length === 0 && (
          <div className="p-8 text-center">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No templates yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              An admin can create some in Admin → Overlay Templates.
            </p>
          </div>
        )}

        {!loading && templates && templates.length > 0 && (
          <div className="grid grid-cols-2 gap-3 p-3">
            {/* "Brand default" resets the picker. */}
            {selectedTemplateId && (
              <button
                key="clear"
                className="col-span-2 p-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted"
                onClick={() => {
                  onSelectTemplateId?.(null);
                  setOpen(false);
                }}
              >
                Clear template · use brand default
              </button>
            )}
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={t.id === selectedTemplateId}
                onSelect={() => {
                  onApply(t.style, t.name);
                  onSelectTemplateId?.(t.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: OverlayTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative rounded-lg border overflow-hidden text-left transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-[hsl(var(--lumi-orange-1))]' : 'border-border'
      }`}
    >
      {/* Preview — plays reference video on hover; poster on rest. */}
      <div className="aspect-[9/16] bg-muted relative overflow-hidden">
        {template.reference_video_url ? (
          <video
            src={template.reference_video_url}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            autoPlay={hover}
            onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
            onMouseLeave={e => {
              const v = e.target as HTMLVideoElement;
              v.pause();
              v.currentTime = 0;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
            <Sparkles className="h-8 w-8 text-slate-500" />
          </div>
        )}
        {selected && (
          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-[hsl(var(--lumi-orange-1))] text-white flex items-center justify-center">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className="p-2 bg-background">
        <p className="text-xs font-semibold truncate">{template.name}</p>
        {template.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {template.style.fontFamily}
          </Badge>
          {template.style.letterCase && template.style.letterCase !== 'as-typed' && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
              {template.style.letterCase}
            </Badge>
          )}
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
            {template.style.position}
          </Badge>
        </div>
      </div>
    </button>
  );
}

// Map a raw DB row (snake_case) onto the RenderStyle camelCase shape.
function rowToStyle(row: any): RenderStyle {
  return {
    fontFamily: row.font_family,
    fontSize: row.font_size,
    textColor: row.text_color,
    bgColor: row.bg_color,
    bgOpacity: Number(row.bg_opacity),
    position: row.position,
    textShadow: row.text_shadow,
    fontWeight: row.font_weight,
    letterCase: row.letter_case,
    textStrokeColor: row.text_stroke_color || null,
    textStrokeWidth: row.text_stroke_width || 0,
  };
}
