import { Resend } from 'https://esm.sh/resend@2.0.0';
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

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8B5CF6, #D946EF); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🐛 Bug Report</h1>
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

          <!-- Screenshot Notice -->
          ${screenshot ? `
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #fcd34d;">
            <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #92400e;">📷 Screenshot Attached</h2>
            <p style="margin: 0; color: #a16207; font-size: 14px;">
              ${screenshotFilename || 'screenshot.png'}
            </p>
          </div>
          ` : ''}

          <!-- Reply CTA -->
          <div style="background: linear-gradient(135deg, #8B5CF6, #D946EF); padding: 16px; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 12px 0; color: white; font-size: 14px;">
              Reply directly to this email to follow up with the user.
            </p>
            <a href="mailto:${userEmail}?subject=Re: Your Bug Report - Your Ad Assistant" style="display: inline-block; background: white; color: #8B5CF6; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              Reply to User
            </a>
          </div>
        </div>

        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Your Ad Assistant • Bug Report System</p>
        </div>
      </div>
    `;

    // Prepare attachments if screenshot exists
    const attachments = [];
    if (screenshot && screenshotFilename) {
      // Extract base64 data from data URL
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
      subject: `🐛 Bug Report: ${currentPage} - ${formattedTimestamp}`,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log('Bug report email sent:', emailResponse);

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
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
