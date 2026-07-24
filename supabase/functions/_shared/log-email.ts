import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

interface EmailLogEntry {
  recipient_email: string;
  recipient_name?: string;
  recipient_user_id?: string;
  email_type: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  metadata?: Record<string, any>;
  edge_function: string;
}

export async function logEmail(entry: EmailLogEntry) {
  try {
    // email_logs.recipient_email is NOT NULL — guard so a missing address never
    // takes down the caller with a 23502 constraint violation.
    const safeEntry: EmailLogEntry = {
      ...entry,
      recipient_email: entry.recipient_email && entry.recipient_email.trim() !== ''
        ? entry.recipient_email
        : 'unknown@missing.local',
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('email_logs')
      .insert(safeEntry);

    if (error) {
      console.error('Failed to log email:', error);
    }
  } catch (err) {
    // Never let logging failures break the email flow
    console.error('Email logging error:', err);
  }
}
