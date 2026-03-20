import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Check, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface ReportDraft {
  id: string;
  brand_id: string;
  report_text: string;
  date_range_start: string;
  date_range_end: string;
  metrics_snapshot: any;
  campaign_statuses: any;
  brand?: { name: string };
}

interface ReportDraftPreviewProps {
  report: ReportDraft;
  onApprove: (id: string) => void;
  onSend: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  status: 'draft' | 'approved' | 'sent';
  isLoading?: boolean;
}

export function ReportDraftPreview({ report, onApprove, onSend, onUpdateText, status, isLoading }: ReportDraftPreviewProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(report.report_text);

  const statuses = (report.campaign_statuses || {}) as Record<string, string>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {report.brand?.name} — Weekly Report
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {format(new Date(report.date_range_start), 'MMM d')} – {format(new Date(report.date_range_end), 'MMM d')}
            </Badge>
            <Badge variant="outline" className={
              status === 'sent' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' :
              status === 'approved' ? 'bg-primary/10 text-primary border-primary/20' :
              'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            }>
              {status === 'sent' ? '✅ Sent' : status === 'approved' ? '✓ Approved' : '📝 Draft'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campaign statuses */}
        {Object.keys(statuses).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaign Status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statuses).map(([name, s]) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {s === 'green' ? '✅' : s === 'yellow' ? '⚠️' : '🔴'} {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Report body */}
        {editing ? (
          <div className="space-y-2">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[200px] text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onUpdateText(report.id, editText); setEditing(false); }}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditText(report.report_text); setEditing(false); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setEditing(true)}>
            {report.report_text || 'No report content yet. Click to edit.'}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {status === 'draft' && (
            <Button size="sm" onClick={() => onApprove(report.id)} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Approve Report
            </Button>
          )}
          {status === 'approved' && (
            <Button size="sm" onClick={() => onSend(report.id)} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Send Report
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
