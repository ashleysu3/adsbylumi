import { Resend } from 'https://esm.sh/resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface BugReportRequest {
  userEmail: string;
  details: string;
  context: string;
  currentPage: string;
  currentUrl: string;
  userAgent: string;
  timestamp: string;
  conversationContext: string;
  screenshot?: string | null;
  screenshotFilename?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BugReportRequest = await req.json();
    const {
      userEmail,
      details,
      context,
      currentPage,
      currentUrl,
      userAgent,
      timestamp,
      conversationContext,
      screenshot,
      screenshotFilename,
    } = body;

    if (!userEmail) {
      throw new Error('User email is required');
    }

    // Initialize Supabase client with service role for inserting bug reports
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Try to get user ID from auth header if available
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id || null;
    }

    // Upload screenshot to storage if present
    let screenshotUrl = null;
    if (screenshot && screenshotFilename) {
      const base64Data = screenshot.split(',')[1];
      if (base64Data) {
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const filename = `bug-reports/${Date.now()}-${screenshotFilename}`;
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('creative-assets')
          .upload(filename, binaryData, {
            contentType: screenshot.split(';')[0].split(':')[1] || 'image/png',
            upsert: false
          });
        
        if (!uploadError && uploadData) {
          const { data: urlData } = supabaseAdmin.storage
            .from('creative-assets')
            .getPublicUrl(filename);
          screenshotUrl = urlData?.publicUrl;
        }
      }
    }

    // Store bug report in database
    const { data: bugReport, error: dbError } = await supabaseAdmin
      .from('bug_reports')
      .insert({
        user_id: userId,
        user_email: userEmail,
        details: details || null,
        context: context || null,
        current_page: currentPage || null,
        current_url: currentUrl || null,
        user_agent: userAgent || null,
        conversation_context: conversationContext || null,
        screenshot_url: screenshotUrl,
        status: 'new',
        priority: 'normal',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error storing bug report:', dbError);
      // Continue with email even if DB fails
    }

    // Format the bug report email
    const formattedTimestamp = new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Parse browser info from user agent
    const browserInfo = userAgent.includes('Chrome') 
      ? 'Chrome' 
      : userAgent.includes('Safari') 
        ? 'Safari' 
        : userAgent.includes('Firefox') 
          ? 'Firefox' 
          : 'Unknown Browser';
    
    const deviceInfo = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';

    const reportId = bugReport?.id ? `#${bugReport.id.slice(0, 8)}` : '';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8B5CF6, #D946EF); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🐛 Bug Report ${reportId}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
            Submitted ${formattedTimestamp}
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
          <!-- User Info -->
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">📧 Reported By</h2>
            <p style="margin: 0; color: #6b7280;">
              <a href="mailto:${userEmail}" style="color: #8B5CF6; text-decoration: none;">${userEmail}</a>
            </p>
          </div>

          <!-- User's Description -->
          ${details ? `
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">📝 User's Description</h2>
            <p style="margin: 0; color: #374151; white-space: pre-wrap; line-height: 1.5;">${details}</p>
          </div>
          ` : ''}

          <!-- Technical Details -->
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">🔧 Technical Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Page:</td>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;"><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${currentPage}</code></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Context:</td>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">${context}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Device:</td>
                <td style="padding: 8px 0; color: #374151; font-size: 14px;">${deviceInfo} • ${browserInfo}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Full URL:</td>
                <td style="padding: 8px 0; color: #374151; font-size: 14px; word-break: break-all;">${currentUrl}</td>
              </tr>
            </table>
          </div>

          <!-- Recent Conversation -->
          ${conversationContext ? `
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">💬 Recent Chat Context</h2>
            <pre style="margin: 0; color: #374151; white-space: pre-wrap; font-size: 13px; line-height: 1.5; background: #f9fafb; padding: 12px; border-radius: 6px; overflow-x: auto;">${conversationContext}</pre>
          </div>
          ` : ''}

          <!-- Screenshot -->
          ${screenshotUrl ? `
          <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">📷 Screenshot</h2>
            <img src="${screenshotUrl}" alt="Bug screenshot" style="max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;" />
          </div>
          ` : ''}

          <!-- Reply CTA -->
          <div style="background: linear-gradient(135deg, #8B5CF6, #D946EF); padding: 16px; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 12px 0; color: white; font-size: 14px;">
              Reply directly to this email to follow up with the user.
            </p>
            <a href="mailto:${userEmail}?subject=Re: Your Bug Report ${reportId} - Lumi" style="display: inline-block; background: white; color: #8B5CF6; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              Reply to User
            </a>
          </div>
        </div>

        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Lumi • Bug Report System</p>
        </div>
      </div>
    `;

    // Prepare attachments if screenshot exists (for email backup)
    const attachments = [];
    if (screenshot && screenshotFilename && !screenshotUrl) {
      const base64Data = screenshot.split(',')[1];
      if (base64Data) {
        attachments.push({
          filename: screenshotFilename,
          content: base64Data,
        });
      }
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: 'Bug Reports <bugs@adsbylumi.com>',
      to: ['support@adsbylumi.com'],
      reply_to: userEmail,
      subject: `🐛 Bug Report ${reportId}: ${currentPage} - ${formattedTimestamp}`,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log('Bug report email sent:', emailResponse);

    // Send Slack notification (fire-and-forget)
    try {
      const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';
      const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
      const SLACK_KEY = Deno.env.get('SLACK_API_KEY');

      if (LOVABLE_KEY && SLACK_KEY) {
        const snippet = details ? details.substring(0, 120) + (details.length > 120 ? '...' : '') : 'No details provided';
        const slackText = `🐛 Bug Report ${reportId} from ${userEmail}`;
        const slackBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:bug: *New Bug Report ${reportId}*\n\n*From:* ${userEmail}\n*Page:* \`${currentPage || 'unknown'}\`\n*Details:* ${snippet}`,
            },
          },
        ];

        await fetch(`${GATEWAY_URL}/chat.postMessage`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_KEY}`,
            'X-Connection-Api-Key': SLACK_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: 'lumi-alerts',
            text: slackText,
            blocks: slackBlocks,
            username: 'Lumi',
            icon_emoji: ':sparkles:',
          }),
        });
        console.log('Bug report Slack notification sent');
      }
    } catch (slackError) {
      console.error('Failed to send Slack notification (non-blocking):', slackError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: bugReport?.id,
        emailId: emailResponse.data?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error sending bug report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
