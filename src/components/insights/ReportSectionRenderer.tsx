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

  const legendPatterns = [
    { pattern: /🟢\s*[=–-]?\s*(.+)/i, emoji: '🟢' },
    { pattern: /🟡\s*[=–-]?\s*(.+)/i, emoji: '🟡' },
    { pattern: /🔴\s*[=–-]?\s*(.+)/i, emoji: '🔴' },
    { pattern: /⚪\s*[=–-]?\s*(.+)/i, emoji: '⚪' },
  ];

  for (const line of lines) {
    const sectionMatch = line.match(/^={2,}\s*(.+?)\s*={2,}$/);
    if (sectionMatch) {
      if (currentTitle || currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
      }
      currentTitle = sectionMatch[1].trim();
      currentLines = [];
      continue;
    }

    let isLegend = false;
    for (const lp of legendPatterns) {
      const m = line.match(lp.pattern);
      if (m && m[1].length < 60) {
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

/** Render inline markdown: **bold**, metrics like "CPL: $4.20" */
function renderFormattedLine(line: string, idx: number) {
  // Horizontal rule
  if (/^-{3,}$/.test(line.trim())) {
    return <hr key={idx} className="border-border/50 my-3" />;
  }

  // Empty line
  if (!line.trim()) return <div key={idx} className="h-2" />;

  // Bullet lines
  const bulletMatch = line.match(/^(\s*)([-•▸→]|\d+\.)\s+(.*)$/);
  const isBullet = !!bulletMatch;
  const bulletContent = bulletMatch ? bulletMatch[3] : line;
  const indent = bulletMatch ? Math.floor((bulletMatch[1]?.length || 0) / 2) : 0;

  // Parse inline formatting
  const parts = parseInlineFormatting(isBullet ? bulletContent : line);

  if (isBullet) {
    return (
      <div key={idx} className="flex items-start gap-2 py-0.5" style={{ paddingLeft: `${indent * 16}px` }}>
        <span className="text-primary/60 mt-0.5 text-xs shrink-0">•</span>
        <span className="text-sm leading-relaxed text-foreground/90">{parts}</span>
      </div>
    );
  }

  // Check if this is a metric line like "CPL: $4.20" or "ROAS: 3.2x"
  const metricMatch = line.match(/^([A-Z][A-Za-z/ ]+):\s*(.+)$/);
  if (metricMatch) {
    return (
      <div key={idx} className="flex items-baseline gap-2 py-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">{metricMatch[1]}:</span>
        <span className="text-sm font-semibold text-foreground">{parseInlineFormatting(metricMatch[2])}</span>
      </div>
    );
  }

  return (
    <div key={idx} className="text-sm leading-relaxed text-foreground/90 py-0.5">
      {parts}
    </div>
  );
}

function parseInlineFormatting(text: string): React.ReactNode {
  // Split by **bold** markers
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    const boldMatch = seg.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>;
    }
    // Highlight emoji status indicators
    if (/^[🟢🟡🔴⚪]/.test(seg)) {
      return <span key={i}>{seg}</span>;
    }
    return <span key={i}>{seg}</span>;
  });
}

import React from 'react';

export function ReportSectionRenderer({ sections }: { sections: ReportSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <div key={i} className="space-y-1.5">
          {section.title && (
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary border-b border-primary/20 pb-1.5 mb-2">
              {section.title}
            </h3>
          )}
          {section.content && (
            <div className="space-y-0.5">
              {section.content.split('\n').map((line, li) => renderFormattedLine(line, li))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
