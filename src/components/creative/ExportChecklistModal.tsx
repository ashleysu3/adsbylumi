import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Check, Loader2 } from 'lucide-react';
import { generateProductionCSV, downloadCSV, generateFilename, ExportOptions, ProductionItem } from '@/lib/export-production-checklist';
import { toast } from 'sonner';


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

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = generateProductionCSV(productionItems, angleCopy, options);
      const filename = generateFilename(brandName, offerName);
      downloadCSV(csv, filename);
      setExported(true);
      toast.success('Checklist exported successfully!');
      
      // Reset after a moment
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
          {/* Item count */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Creatives to export</span>
            <Badge variant="secondary">{productionItems.length} items</Badge>
          </div>

          {/* Export options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Include in export:</p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="scripts"
                  checked={options.includeScripts}
                  onCheckedChange={() => toggleOption('includeScripts')}
                />
                <Label htmlFor="scripts" className="text-sm cursor-pointer">
                  Scripts & talking points
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="creative"
                  checked={options.includeCreativeDirection}
                  onCheckedChange={() => toggleOption('includeCreativeDirection')}
                />
                <Label htmlFor="creative" className="text-sm cursor-pointer">
                  Visual direction & text overlays
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="psychology"
                  checked={options.includePsychology}
                  onCheckedChange={() => toggleOption('includePsychology')}
                />
                <Label htmlFor="psychology" className="text-sm cursor-pointer">
                  Psychology notes (why it works)
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="adcopy"
                  checked={options.includeAdCopy}
                  onCheckedChange={() => toggleOption('includeAdCopy')}
                />
                <Label htmlFor="adcopy" className="text-sm cursor-pointer">
                  Ad copy (headlines, primary text, CTAs)
                </Label>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg">
            <strong>Tip:</strong> Open the CSV in Google Sheets or Excel. Share with your client for approvals, or send to your creative team for recording and graphic production.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : exported ? (
              <Check className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exported ? 'Downloaded!' : 'Download CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
