import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================================================
// ShareRetrospectiveDialog (Patch #27)
//
// Sends the campaign retrospective as a styled HTML email to one recipient
// via the `send-retrospective-email` edge function. Optional sender note
// shows up at the top of the email as a quoted block.
// ============================================================================

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  campaignName: string;
}

export function ShareRetrospectiveDialog({ open, onOpenChange, workspaceId, campaignName }: Props) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [senderNote, setSenderNote] = useState('');
  const [sending, setSending] = useState(false);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim());

  const handleSend = async () => {
    if (!validEmail) {
      toast.error('Enter a valid email address');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-retrospective-email', {
        body: {
          workspaceId,
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || undefined,
          senderNote: senderNote.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message || 'Send failed');
      if (!data?.success) throw new Error(data?.error || 'Send failed');
      toast.success(`Sent to ${recipientEmail.trim()}`);
      // Reset + close.
      setRecipientEmail('');
      setRecipientName('');
      setSenderNote('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Could not send: ' + (err?.message || 'unknown'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share retrospective</DialogTitle>
          <DialogDescription>
            Email the "{campaignName}" debrief to a teammate or client. They'll get the full report inline — no login required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="recipient-email">Recipient email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="someone@example.com"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              disabled={sending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipient-name" className="flex items-center justify-between">
              <span>Recipient name</span>
              <span className="text-[10px] text-muted-foreground font-normal">optional</span>
            </Label>
            <Input
              id="recipient-name"
              placeholder="Alex"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sender-note" className="flex items-center justify-between">
              <span>A note from you</span>
              <span className="text-[10px] text-muted-foreground font-normal">optional</span>
            </Label>
            <Textarea
              id="sender-note"
              placeholder="A quick context note that'll appear at the top of the email…"
              value={senderNote}
              onChange={e => setSenderNote(e.target.value)}
              rows={3}
              maxLength={1500}
              disabled={sending}
            />
            <p className="text-[11px] text-muted-foreground">
              The recipient will see your note in a highlighted box above the report.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button variant="lumi" onClick={handleSend} disabled={sending || !validEmail} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send retrospective'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
