import { Badge } from '@/components/ui/badge';

interface ReportSection {
  title: string;
  content: string;
}

interface LegendItem {
  emoji: string;
  label: string;
}

export function parseReportSections(text: string): { legend: LegendItem[]; sections: ReportSection[] } {
  const lines = text.split('\n');
  const legend: LegendItem[] = [];
  const sections: ReportSection[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  // Common legend patterns
  const legendPatterns = [
    { pattern: /🟢\s*[=–-]?\s*(.+)/i, emoji: '🟢' },
    { pattern: /🟡\s*[=–-]?\s*(.+)/i, emoji: '🟡' },
    { pattern: /🔴\s*[=–-]?\s*(.+)/i, emoji: '🔴' },
    { pattern: /⚪\s*[=–-]?\s*(.+)/i, emoji: '⚪' },
  ];

  for (const line of lines) {
    // Detect section headers like === TITLE ===
    const sectionMatch = line.match(/^={2,}\s*(.+?)\s*={2,}$/);
    if (sectionMatch) {
      if (currentTitle || currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
      }
      currentTitle = sectionMatch[1].trim();
      currentLines = [];
      continue;
    }

    // Extract legend items
    let isLegend = false;
    for (const lp of legendPatterns) {
      const m = line.match(lp.pattern);
      if (m && m[1].length < 60) {
        // Only extract if it looks like a legend definition (short label)
        const label = m[1].replace(/^[=–-]\s*/, '').trim();
        if (!legend.find(l => l.emoji === lp.emoji)) {
          legend.push({ emoji: lp.emoji, label });
          isLegend = true;
        }
        break;
      }
    }

    if (!isLegend) {
      currentLines.push(line);
    }
  }

  // Push last section
  if (currentTitle || currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
  }

  return { legend, sections };
}

export function ReportLegendBar({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/40 rounded-xl border mb-1">
      <span className="text-xs font-medium text-muted-foreground mr-1 self-center">Legend:</span>
      {items.map((item) => (
        <Badge key={item.emoji} variant="secondary" className="text-xs gap-1 px-2 py-0.5 font-normal">
          <span>{item.emoji}</span>
          {item.label}
        </Badge>
      ))}
    </div>
  );
}

export function ReportSectionRenderer({ sections }: { sections: ReportSection[] }) {
  return (
    <div className="space-y-5">
      {sections.map((section, i) => (
        <div key={i} className="space-y-2">
          {section.title && (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary border-b border-primary/20 pb-1">
              {section.title}
            </h3>
          )}
          {section.content && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
              {section.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
