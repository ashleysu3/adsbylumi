import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find founding members who signed up 7+ days ago and haven't received the feedback email
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: betaUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('is_beta_user', true)
      .eq('beta_feedback_email_sent', false)
      .lte('created_at', sevenDaysAgo);

    if (fetchError) {
      console.error('Error fetching beta users:', fetchError);
      throw new Error(fetchError.message);
    }

    if (!betaUsers || betaUsers.length === 0) {
      console.log('No beta users due for feedback email');
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${betaUsers.length} beta users due for feedback email`);

    let sent = 0;
    for (const user of betaUsers) {
      try {
        // Call the feedback email function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-beta-feedback-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            email: user.email,
            fullName: user.full_name || '',
          }),
        });

        if (response.ok) {
          // Mark as sent
          await supabase
            .from('profiles')
            .update({ beta_feedback_email_sent: true })
            .eq('id', user.id);
          sent++;
          console.log(`Feedback email sent to ${user.email}`);
        } else {
          console.error(`Failed to send feedback email to ${user.email}:`, await response.text());
        }
      } catch (err) {
        console.error(`Error sending feedback email to ${user.email}:`, err);
      }
    }

    return new Response(JSON.stringify({ sent, total: betaUsers.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in send-beta-feedback-requests:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
