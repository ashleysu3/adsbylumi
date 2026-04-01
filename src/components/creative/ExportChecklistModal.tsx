import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Check, Loader2, Filter } from 'lucide-react';
import { generateCreativeBriefCSV, downloadCSV, generateFilename, ExportOptions, ProductionItem } from '@/lib/export-production-checklist';
import { toast } from 'sonner';

const FORMAT_LABELS: Record<string, string> = {
  talking_head: 'Talking Head',
  talking_head_broll: 'Talking Head + B-Roll',
  broll_voiceover: 'B-Roll + Voiceover',
  ugc_testimonial: 'UGC Testimonial',
  static_image: 'Static Image',
  carousel: 'Carousel',
  motion_graphic: 'Motion Graphic',
};

interface ExportChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionItems: ProductionItem[];
  angleCopy: Record<string, any>;
  brandName?: string;
  offerName?: string;
}

export function ExportChecklistModal({
  open,
  onOpenChange,
  productionItems,
  angleCopy,
  brandName,
  offerName,
}: ExportChecklistModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    includeScripts: true,
    includePsychology: true,
    includeCreativeDirection: true,
    includeAdCopy: true,
    brandName,
    offerName,
  });
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  // Get unique formats from production items
  const availableFormats = useMemo(() => {
    const formats = new Map<string, number>();
    productionItems.forEach(item => {
      const f = item.format || 'other';
      formats.set(f, (formats.get(f) || 0) + 1);
    });
    return formats;
  }, [productionItems]);

  // Filter items based on selected formats
  const filteredItems = useMemo(() => {
    if (selectedFormats.length === 0) return productionItems;
    return productionItems.filter(item => selectedFormats.includes(item.format));
  }, [productionItems, selectedFormats]);

  const toggleFormat = (format: string) => {
    setSelectedFormats(prev => 
      prev.includes(format) ? prev.filter(f => f !== format) : [...prev, format]
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = generateCreativeBriefCSV(filteredItems, angleCopy, options);
      const filename = generateFilename(brandName, offerName, true);
      downloadCSV(csv, filename);
      setExported(true);
      toast.success(`Exported ${filteredItems.length} items!`);
      
      setTimeout(() => {
        setExported(false);
      }, 2000);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export checklist');
    } finally {
      setExporting(false);
    }
  };

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Export Production Checklist
          </DialogTitle>
          <DialogDescription>
            Download a CSV file to share with your client or creative team for recording and approvals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Filter */}
          {availableFormats.size > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                Filter by format
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(availableFormats.entries()).map(([format, count]) => {
                  const isSelected = selectedFormats.includes(format);
                  return (
                    <button
                      key={format}
                      onClick={() => toggleFormat(format)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {FORMAT_LABELS[format] || format}
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
              {selectedFormats.length > 0 && (
                <button
                  onClick={() => setSelectedFormats([])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Item count */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Creatives to export</span>
            <Badge variant="secondary">
              {filteredItems.length}{selectedFormats.length > 0 ? ` of ${productionItems.length}` : ''} items
            </Badge>
          </div>

          {/* Tip */}
          <div className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg">
            <strong>Tip:</strong> The Creative Brief includes everything your team needs: graphic copy, scripts, visual direction, and ad copy in a clean format. Open in Google Sheets or Excel.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting || filteredItems.length === 0} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : exported ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exported ? 'Downloaded!' : `Download CSV${selectedFormats.length > 0 ? ` (${filteredItems.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
