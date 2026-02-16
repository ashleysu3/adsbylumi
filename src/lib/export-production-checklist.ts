// CSV Export utility for production checklist

interface TextOverlay {
  type?: string;
  text: string;
  timing?: string;
}

export interface ProductionItem {
  id: string;
  format: string;
  hook: string;
  angleName?: string;
  script_lines?: string[];
  text_overlays?: TextOverlay[];
  visual_hook?: string;
  guidance?: string;
  why_this_works?: string;
}

interface AngleCopy {
  headline?: string;
  description?: string;
  primary_text?: string;
  cta?: string;
}

export interface ExportOptions {
  includeScripts: boolean;
  includePsychology: boolean;
  includeCreativeDirection: boolean;
  includeAdCopy: boolean;
  brandName?: string;
  offerName?: string;
}

const FORMAT_LABELS: Record<string, string> = {
  talking_head: 'Talking Head',
  talking_head_broll: 'Talking Head + B-Roll',
  broll_voiceover: 'B-Roll + Voiceover',
  ugc_testimonial: 'UGC Testimonial',
  static_image: 'Static Image',
  carousel: 'Carousel',
  motion_graphic: 'Motion Graphic',
};

function escapeCSV(value: string | undefined | null): string {
  if (!value) return '';
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateProductionCSV(
  items: ProductionItem[],
  angleCopyMap: Record<string, AngleCopy>,
  options: ExportOptions
): string {
  const rows: string[][] = [];

  // Header row
  const headers = ['#', 'Format', 'Angle', 'Hook'];
  if (options.includeScripts) headers.push('Script');
  headers.push('Text Overlays', 'Visual Direction');
  if (options.includePsychology) headers.push('Why It Works');
  if (options.includeAdCopy) {
    headers.push('Headline', 'Primary Text', 'CTA');
  }
  headers.push('Status');
  
  rows.push(headers);

  // Data rows
  items.forEach((item, index) => {
    const row: string[] = [
      String(index + 1),
      FORMAT_LABELS[item.format] || item.format,
      item.angleName || 'Unassigned',
      item.hook || '',
    ];

    if (options.includeScripts) {
      row.push(item.script_lines?.join('\n\n') || 'N/A');
    }

    // Text overlays
    const overlays = item.text_overlays
      ?.map(t => `[${t.timing}] ${t.type}: ${t.text}`)
      .join('\n') || '';
    row.push(overlays);

    // Visual direction
    row.push(item.visual_hook || item.guidance || '');

    if (options.includePsychology) {
      row.push(item.why_this_works || '');
    }

    if (options.includeAdCopy) {
      // Find the angle copy for this item
      const angleCopy = Object.values(angleCopyMap).find((_, idx) => {
        const keys = Object.keys(angleCopyMap);
        return keys[idx] && items.find(i => i.angleName === item.angleName);
      });
      
      row.push(angleCopy?.headline || '');
      row.push(angleCopy?.primary_text || '');
      row.push(angleCopy?.cta || 'Learn More');
    }

    row.push('☐ To Record');

    rows.push(row);
  });

  // Convert to CSV string
  return rows.map(row => row.map(escapeCSV).join(',')).join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  // Add BOM for Excel compatibility with UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function generateCreativeBriefCSV(
  items: ProductionItem[],
  angleCopyMap: Record<string, AngleCopy>,
  options: ExportOptions
): string {
  const rows: string[][] = [];

  // Header with brand/offer info
  if (options.brandName || options.offerName) {
    rows.push([`Creative Brief — ${[options.brandName, options.offerName].filter(Boolean).join(' | ')} — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`]);
    rows.push([]); // blank row
  }

  // Column headers
  const headers = ['Asset #', 'Angle', 'Format', 'Hook', 'Graphic Copy', 'Script', 'Visual Direction', 'Headline', 'Primary Text', 'CTA', 'Notes'];
  rows.push(headers);

  items.forEach((item, index) => {
    // Consolidate text overlays into "Graphic Copy"
    const graphicCopy = item.text_overlays
      ?.map(t => {
        const label = t.type ? `[${t.type.toUpperCase()}]` : '';
        const timing = t.timing ? ` (${t.timing})` : '';
        return `${label} ${t.text}${timing}`.trim();
      })
      .join('\n') || '';

    const script = item.script_lines?.join('\n') || '';
    const visualDirection = item.visual_hook || item.guidance || '';

    // Simplified psychology note
    const notes = item.why_this_works
      ? `Why this works: ${item.why_this_works}`
      : '';

    // Find matching angle copy
    const angleKey = Object.keys(angleCopyMap).find(key => {
      return items.some(i => i.angleName === item.angleName && key);
    });
    const copy = angleKey ? angleCopyMap[angleKey] : undefined;

    const row: string[] = [
      String(index + 1),
      item.angleName || 'Unassigned',
      FORMAT_LABELS[item.format] || item.format,
      item.hook || '',
      graphicCopy,
      script,
      visualDirection,
      copy?.headline || '',
      copy?.primary_text || '',
      copy?.cta || 'Learn More',
      notes,
    ];

    rows.push(row);
  });

  return rows.map(row => row.map(escapeCSV).join(',')).join('\n');
}

export function generateFilename(brandName?: string, offerName?: string, isBrief?: boolean): string {
  const parts = [isBrief ? 'creative-brief' : 'production-checklist'];
  if (brandName) parts.push(brandName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  if (offerName) parts.push(offerName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  parts.push(new Date().toISOString().split('T')[0]);
  return parts.join('_') + '.csv';
}
