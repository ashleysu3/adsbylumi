import React from 'react';

interface ReportSection {
  title: string;
  content: string;
}

export function parseReportSections(text: string): { sections: ReportSection[] } {
  const lines = text.split('\n');
  const sections: ReportSection[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  // Strip any status-key blocks from the output
  let skipLegend = false;

  for (const line of lines) {
    // Skip legend/status-key lines
    if (/^\*?\*?Status Key/i.test(line.trim())) { skipLegend = true; continue; }
    if (skipLegend) {
      if (line.trim() === '---' || line.trim() === '') { skipLegend = false; }
      continue;
    }

    // Match markdown headings
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

    currentLines.push(line);
  }

  if (currentTitle || currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
  }

  return { sections };
}

/** Render a table from markdown-like pipe syntax */
function renderTable(rows: string[], startIdx: number): { element: React.ReactNode; endIdx: number } {
  const tableRows: string[][] = [];
  let i = startIdx;
  while (i < rows.length) {
    const line = rows[i].trim();
    if (!line.startsWith('|')) break;
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
                  <td key={ci} className={`px-4 py-2 border-t border-border/30 ${getMetricColor(cell)}`}>
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

/** Detect color hints in metric values */
function getMetricColor(cell: string): string {
  // Check for delta indicators
  if (/[+]\d+.*%/.test(cell) || /↑/.test(cell)) return 'text-emerald-600 dark:text-emerald-400 font-medium';
  if (/[-−]\d+.*%/.test(cell) || /↓/.test(cell)) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-foreground/90';
}

/** Render inline markdown: **bold**, metrics like "CPL: $4.20" */
function renderFormattedLine(line: string, idx: number) {
  if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
    return <hr key={idx} className="border-border/40 my-4" />;
  }

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

  // Checklist items: - [ ] or - [x]
  const checklistMatch = line.match(/^(\s*)[-*]\s*\[([ x])\]\s*(.*)$/i);
  if (checklistMatch) {
    const checked = checklistMatch[2].toLowerCase() === 'x';
    return (
      <div key={idx} className="flex items-start gap-2.5 py-1" style={{ paddingLeft: `${Math.floor((checklistMatch[1]?.length || 0) / 2) * 16}px` }}>
        <span className={`mt-0.5 text-sm shrink-0 ${checked ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {checked ? '☑' : '☐'}
        </span>
        <span className="text-sm leading-relaxed text-foreground/85">{parseInlineFormatting(checklistMatch[3])}</span>
      </div>
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
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    const boldMatch = seg.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>;
    }
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
        const isCampaignSection = /[✅⚠️💰📊📋🤝]/.test(section.title);
        const isActionSection = /Agency Action|What We Need/i.test(section.title);

        return (
          <div key={i} className={`${
            isActionSection
              ? 'bg-primary/5 rounded-2xl border-2 border-primary/20 p-4'
              : isCampaignSection
                ? 'bg-card rounded-2xl border p-4 shadow-sm'
                : ''
          }`}>
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
