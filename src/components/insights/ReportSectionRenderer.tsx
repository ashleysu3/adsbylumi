import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlossaryTermInline } from '@/components/GlossaryTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Loader2, Lightbulb } from 'lucide-react';
import { adsGlossary } from '@/lib/ads-glossary';

interface ReportSection {
  title: string;
  content: string;
}

export function parseReportSections(text: string): { sections: ReportSection[] } {
  const lines = text.split('\n');
  const sections: ReportSection[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];
  let skipLegend = false;

  for (const line of lines) {
    if (/^\*?\*?Status Key/i.test(line.trim())) { skipLegend = true; continue; }
    if (skipLegend) {
      if (line.trim() === '---' || line.trim() === '') { skipLegend = false; }
      continue;
    }

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

// ── Glossary term detection ──────────────────────────────────────────────
const GLOSSARY_PATTERNS: { key: string; regex: RegExp }[] = Object.entries(adsGlossary).map(([key, term]) => {
  const label = term.acronym || term.term;
  return { key, regex: new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') };
});

function wrapGlossaryTerms(text: string): React.ReactNode {
  const usedKeys = new Set<string>();
  const segments: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  while (remaining.length > 0) {
    let earliest: { key: string; index: number; match: string } | null = null;
    for (const { key, regex } of GLOSSARY_PATTERNS) {
      if (usedKeys.has(key)) continue;
      const m = remaining.match(regex);
      if (m && m.index !== undefined && (!earliest || m.index < earliest.index)) {
        earliest = { key, index: m.index, match: m[0] };
      }
    }

    if (!earliest) {
      segments.push(<span key={`rem-${keyCounter++}`}>{remaining}</span>);
      break;
    }

    if (earliest.index > 0) {
      segments.push(<span key={`pre-${keyCounter++}`}>{remaining.slice(0, earliest.index)}</span>);
    }
    usedKeys.add(earliest.key);
    segments.push(
      <GlossaryTermInline key={`gl-${earliest.key}`} term={earliest.key} label={earliest.match} />
    );
    remaining = remaining.slice(earliest.index + earliest.match.length);
  }

  return segments.length === 1 ? segments[0] : <>{segments}</>;
}

// ── Table renderer ───────────────────────────────────────────────────────
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

function getMetricColor(cell: string): string {
  if (/[+]\d+.*%/.test(cell) || /↑/.test(cell)) return 'text-emerald-600 dark:text-emerald-400 font-medium';
  if (/[-−]\d+.*%/.test(cell) || /↓/.test(cell)) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-foreground/90';
}

function renderFormattedLine(line: string, idx: number) {
  if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
    return <hr key={idx} className="border-border/40 my-4" />;
  }

  if (!line.trim()) return <div key={idx} className="h-2" />;

  const h4Match = line.match(/^####\s+(.+)$/);
  if (h4Match) {
    return (
      <h4 key={idx} className="text-sm font-bold text-foreground mt-3 mb-1 flex items-center gap-1.5">
        {parseInlineFormatting(h4Match[1])}
      </h4>
    );
  }

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
  const nodes = segments.map((seg, i) => {
    const boldMatch = seg.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>;
    }
    if (/\$[\d,.]+/.test(seg) || /[\d.]+%/.test(seg) || /[\d.]+x\b/i.test(seg)) {
      return <span key={i} className="font-medium">{seg}</span>;
    }
    return <span key={i}>{seg}</span>;
  });

  // Now wrap glossary terms in the text-only segments
  return nodes.map((node, i) => {
    if (typeof node === 'object' && (node as any)?.props?.className?.includes('font-semibold')) return node;
    if (typeof node === 'object' && (node as any)?.props?.children && typeof (node as any).props.children === 'string') {
      return <React.Fragment key={`gw-${i}`}>{wrapGlossaryTerms((node as any).props.children)}</React.Fragment>;
    }
    return node;
  });
}

// ── Approve button component ─────────────────────────────────────────────
function ApproveActionCard({ action, brandId }: { action: string; brandId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved'>('idle');

  const handleApprove = async () => {
    setStatus('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Insert as approved pending optimization
      await supabase.from('pending_optimizations').insert({
        brand_id: brandId,
        recommendation_type: 'report_action',
        action_description: action,
        status: 'approved',
        auto_applied: false,
      });

      // Trigger apply-optimizations
      await supabase.functions.invoke('apply-optimizations', {
        body: { brandId, autoOptimize: false },
      });

      setStatus('approved');
      toast.success('Action approved — LUMI is on it!');
    } catch (err: any) {
      console.error('Failed to approve:', err);
      toast.error('Failed to approve action');
      setStatus('idle');
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 text-sm text-foreground/85">{parseInlineFormatting(action)}</div>
      <Button
        variant={status === 'approved' ? 'secondary' : 'lumi'}
        size="sm"
        className="rounded-xl shrink-0 text-xs gap-1"
        disabled={status !== 'idle'}
        onClick={handleApprove}
      >
        {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
        {status === 'approved' && <Check className="h-3 w-3" />}
        {status === 'approved' ? 'Approved ✅' : status === 'loading' ? 'Approving...' : 'Approve'}
      </Button>
    </div>
  );
}

// ── Main renderer ────────────────────────────────────────────────────────
interface ReportSectionRendererProps {
  sections: ReportSection[];
  brandId?: string;
  mode?: 'agency' | 'self-serve';
}

export function ReportSectionRenderer({ sections, brandId, mode }: ReportSectionRendererProps) {
  const isSelfServe = mode === 'self-serve';

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {sections.map((section, i) => {
          const isCampaignSection = /[✅⚠️💰📊📋🤝]/.test(section.title);
          const isActionSection = /Agency Action|What We Need|LUMI Recommends/i.test(section.title);
          const isApproveSection = /Approve These Changes/i.test(section.title);
          const isTryThisSection = /Try This|💡/i.test(section.title);

          return (
            <div key={i} className={`${
              isApproveSection && isSelfServe
                ? 'bg-primary/5 rounded-2xl border-2 border-primary/20 p-4'
                : isTryThisSection
                  ? 'bg-amber-500/5 rounded-2xl border-2 border-amber-500/20 p-4'
                  : isActionSection
                    ? 'bg-primary/5 rounded-2xl border-2 border-primary/20 p-4'
                    : isCampaignSection
                      ? 'bg-card rounded-2xl border p-4 shadow-sm'
                      : ''
            }`}>
              {section.title && (
                <h3 className={`font-bold mb-3 flex items-center gap-2 ${
                  isTryThisSection
                    ? 'text-base font-display text-amber-700 dark:text-amber-400'
                    : isCampaignSection
                      ? 'text-base font-display text-foreground'
                      : 'text-sm uppercase tracking-wide text-primary border-b border-primary/20 pb-1.5'
                }`}>
                  {isTryThisSection && <Lightbulb className="h-4 w-4" />}
                  {parseInlineFormatting(section.title)}
                </h3>
              )}
              {section.content && (
                <div className="space-y-0.5">
                  {isApproveSection && isSelfServe && brandId
                    ? renderApproveSection(section.content, brandId)
                    : renderContentWithTables(section.content)
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function renderApproveSection(content: string, brandId: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match checklist items: - [ ] Approve: ... or - [ ] ...
    const checkMatch = line.match(/^[-*]\s*\[[ x]?\]\s*(.+)$/i);
    if (checkMatch) {
      const actionText = checkMatch[1].replace(/^Approve:\s*/i, '').trim();
      elements.push(
        <ApproveActionCard key={`approve-${i}`} action={actionText} brandId={brandId} />
      );
    } else if (line.trim()) {
      elements.push(renderFormattedLine(line, i));
    }
  }

  return elements;
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
