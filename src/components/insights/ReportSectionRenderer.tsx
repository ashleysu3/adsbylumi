import React from 'react';
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
    { pattern: /[✅🟢]\s*[-–=]?\s*(.+)/i, emoji: '✅' },
    { pattern: /[⚠️🟡]\s*[-–=]?\s*(.+)/i, emoji: '⚠️' },
    { pattern: /[❌🔴]\s*[-–=]?\s*(.+)/i, emoji: '❌' },
    { pattern: /[👀⚪]\s*[-–=]?\s*(.+)/i, emoji: '👀' },
  ];

  for (const line of lines) {
    // Match markdown headings: ## or ### or ====
    const h2Match = line.match(/^#{2,3}\s+(.+)$/);
    const sectionMatch = line.match(/^={2,}\s*(.+?)\s*={2,}$/);
    const heading = h2Match?.[1] || sectionMatch?.[1];

    if (heading) {
      if (currentTitle || currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
      }
      currentTitle = heading.trim();
      currentLines = [];
      continue;
    }

    // Check for legend lines (status key)
    let isLegend = false;
    for (const lp of legendPatterns) {
      const m = line.match(lp.pattern);
      if (m && m[1].length < 80) {
        const label = m[1].replace(/^[-–=]\s*/, '').trim();
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

/** Render a table from markdown-like pipe syntax */
function renderTable(rows: string[], startIdx: number): { element: React.ReactNode; endIdx: number } {
  const tableRows: string[][] = [];
  let i = startIdx;
  while (i < rows.length) {
    const line = rows[i].trim();
    if (!line.startsWith('|')) break;
    // Skip separator rows (|---|---|)
    if (/^\|[-:\s|]+\|$/.test(line)) { i++; continue; }
    const cells = line.split('|').filter(Boolean).map(c => c.trim());
    tableRows.push(cells);
    i++;
  }

  if (tableRows.length === 0) return { element: null, endIdx: startIdx };

  const isHeader = tableRows.length > 1;
  const headerRow = isHeader ? tableRows[0] : null;
  const bodyRows = isHeader ? tableRows.slice(1) : tableRows;

  return {
    element: (
      <div className="overflow-x-auto rounded-xl border bg-card my-3">
        <table className="w-full text-sm">
          {headerRow && (
            <thead>
              <tr className="border-b bg-muted/40">
                {headerRow.map((cell, ci) => (
                  <th key={ci} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {parseInlineFormatting(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'bg-muted/20' : ''}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2 text-foreground/90 border-t border-border/30">
                    {parseInlineFormatting(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    endIdx: i,
  };
}

/** Render inline markdown: **bold**, metrics like "CPL: $4.20" */
function renderFormattedLine(line: string, idx: number) {
  // Horizontal rule
  if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
    return <hr key={idx} className="border-border/40 my-4" />;
  }

  // Empty line
  if (!line.trim()) return <div key={idx} className="h-2" />;

  // H4 subheading
  const h4Match = line.match(/^####\s+(.+)$/);
  if (h4Match) {
    return (
      <h4 key={idx} className="text-sm font-bold text-foreground mt-3 mb-1 flex items-center gap-1.5">
        {parseInlineFormatting(h4Match[1])}
      </h4>
    );
  }

  // Bullet lines
  const bulletMatch = line.match(/^(\s*)([-•▸→*]|\d+\.)\s+(.*)$/);
  const isBullet = !!bulletMatch;
  const bulletContent = bulletMatch ? bulletMatch[3] : line;
  const indent = bulletMatch ? Math.floor((bulletMatch[1]?.length || 0) / 2) : 0;

  const parts = parseInlineFormatting(isBullet ? bulletContent : line);

  if (isBullet) {
    return (
      <div key={idx} className="flex items-start gap-2.5 py-0.5" style={{ paddingLeft: `${indent * 16}px` }}>
        <span className="text-primary/50 mt-1 text-[8px] shrink-0">●</span>
        <span className="text-sm leading-relaxed text-foreground/85">{parts}</span>
      </div>
    );
  }

  // Metric line: "Key: Value"
  const metricMatch = line.match(/^\*?\*?([A-Z][A-Za-z /&]+)\*?\*?:\s*(.+)$/);
  if (metricMatch) {
    return (
      <div key={idx} className="flex items-baseline justify-between gap-3 py-1 px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
          {parseInlineFormatting(metricMatch[1])}
        </span>
        <span className="text-sm font-semibold text-foreground text-right">
          {parseInlineFormatting(metricMatch[2])}
        </span>
      </div>
    );
  }

  return (
    <div key={idx} className="text-sm leading-relaxed text-foreground/85 py-0.5">
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
    // Highlight dollar amounts and percentages
    if (/\$[\d,.]+/.test(seg) || /[\d.]+%/.test(seg) || /[\d.]+x\b/i.test(seg)) {
      return <span key={i} className="font-medium">{seg}</span>;
    }
    return <span key={i}>{seg}</span>;
  });
}

export function ReportSectionRenderer({ sections }: { sections: ReportSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        // Determine if this is a campaign section (has status emoji in title)
        const isCampaignSection = /[✅⚠️❌👀💰📊🟢🟡🔴]/.test(section.title);

        return (
          <div key={i} className={`${isCampaignSection ? 'bg-card rounded-2xl border p-4 shadow-sm' : ''}`}>
            {section.title && (
              <h3 className={`font-bold mb-3 ${
                isCampaignSection
                  ? 'text-base font-display text-foreground'
                  : 'text-sm uppercase tracking-wide text-primary border-b border-primary/20 pb-1.5'
              }`}>
                {parseInlineFormatting(section.title)}
              </h3>
            )}
            {section.content && (
              <div className="space-y-0.5">
                {renderContentWithTables(section.content)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderContentWithTables(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this starts a table
    if (line.trim().startsWith('|')) {
      const { element, endIdx } = renderTable(lines, i);
      if (element) {
        elements.push(<React.Fragment key={`table-${i}`}>{element}</React.Fragment>);
        i = endIdx;
        continue;
      }
    }

    elements.push(renderFormattedLine(line, i));
    i++;
  }

  return elements;
}
