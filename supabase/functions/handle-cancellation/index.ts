import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[HANDLE-CANCELLATION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { userId, userEmail, fullName, tierName, periodEnd } = await req.json();

    if (!userId) throw new Error("userId is required");

    logStep("Processing cancellation", { userId, userEmail });

    // 1. Get all brands for this user
    const { data: brands, error: brandsError } = await supabaseAdmin
      .from("brands")
      .select("id, name, meta_account_id, meta_access_token")
      .eq("user_id", userId);

    if (brandsError) {
      logStep("Error fetching brands", { error: brandsError.message });
      throw new Error("Failed to fetch user brands");
    }

    const pauseResults: any[] = [];
    const adsManagerLinks: string[] = [];

    // 2. For each brand with Meta connected, pause all active campaigns
    for (const brand of (brands || [])) {
      if (!brand.meta_account_id || !brand.meta_access_token) {
        logStep("Skipping brand without Meta connection", { brandId: brand.id, brandName: brand.name });
        continue;
      }

      const metaAccountId = brand.meta_account_id;
      const metaAccessToken = brand.meta_access_token;

      // Add Ads Manager link for this account
      const cleanAccountId = metaAccountId.replace("act_", "");
      adsManagerLinks.push(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAccountId}`);

      // Fetch active campaigns
      try {
        const campaignsUrl = `https://graph.facebook.com/v18.0/${metaAccountId}/campaigns?fields=id,name,status&filtering=[{"field":"status","operator":"IN","value":["ACTIVE"]}]&limit=500&access_token=${metaAccessToken}`;

        const campaignsRes = await fetch(campaignsUrl);
        const campaignsData = await campaignsRes.json();

        if (!campaignsRes.ok) {
          logStep("Failed to fetch campaigns from Meta", { error: campaignsData.error });
          pauseResults.push({ brand: brand.name, error: campaignsData.error?.message || "Failed to fetch campaigns" });
          continue;
        }

        const activeCampaigns = campaignsData.data || [];
        logStep(`Found ${activeCampaigns.length} active campaigns for brand ${brand.name}`);

        // Pause each active campaign
        for (const campaign of activeCampaigns) {
          try {
            const pauseRes = await fetch(
              `https://graph.facebook.com/v18.0/${campaign.id}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "PAUSED",
                  access_token: metaAccessToken,
                }),
              }
            );

            const pauseData = await pauseRes.json();
            if (pauseRes.ok && pauseData.success) {
              logStep(`Paused campaign ${campaign.name} (${campaign.id})`);
              pauseResults.push({ brand: brand.name, campaign: campaign.name, campaignId: campaign.id, status: "paused" });
            } else {
              logStep(`Failed to pause campaign ${campaign.id}`, { error: pauseData });
              pauseResults.push({ brand: brand.name, campaign: campaign.name, campaignId: campaign.id, status: "failed", error: pauseData.error?.message });
            }
          } catch (e) {
            logStep(`Error pausing campaign ${campaign.id}`, { error: e });
            pauseResults.push({ brand: brand.name, campaign: campaign.name, campaignId: campaign.id, status: "error" });
          }
        }
      } catch (e) {
        logStep(`Error processing brand ${brand.name}`, { error: e });
        pauseResults.push({ brand: brand.name, error: "Failed to process" });
      }
    }

    const totalPaused = pauseResults.filter((r) => r.status === "paused").length;
    const totalFailed = pauseResults.filter((r) => r.status === "failed" || r.status === "error").length;
    logStep("Pause results", { totalPaused, totalFailed });

    // 3. Send cancellation email
    const email = userEmail;
    if (email) {
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
        const firstName = fullName?.split(" ")[0] || "there";
        const endDate = periodEnd
          ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          : "the end of your billing period";

        // Use the first ads manager link, or a default
        const adsManagerLink = adsManagerLinks.length > 0
          ? adsManagerLinks[0]
          : "https://adsmanager.facebook.com/adsmanager/manage/campaigns";

        const { error: emailError } = await resend.emails.send({
          from: "Lumi <hello@adsbylumi.com>",
          to: [email],
          subject: `We'll miss you, ${firstName} 💜`,
          html: buildCancellationEmailHtml(firstName, tierName || "your plan", endDate, totalPaused, adsManagerLink, adsManagerLinks),
        });

        if (emailError) {
          logStep("Failed to send cancellation email", { error: emailError });
        } else {
          logStep("Cancellation email sent", { to: email });
        }
      } catch (emailErr) {
        logStep("Error sending cancellation email", { error: emailErr });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pauseResults,
        totalPaused,
        totalFailed,
        adsManagerLinks,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildCancellationEmailHtml(
  firstName: string,
  tierName: string,
  endDate: string,
  adsPaused: number,
  primaryAdsManagerLink: string,
  allAdsManagerLinks: string[]
): string {
  const adsPausedSection = adsPaused > 0
    ? `
              <tr>
                <td style="padding: 10px 40px 25px 40px;">
                  <div style="background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border-radius: 12px; padding: 22px; border-left: 4px solid #EF4444;">
                    <p style="margin: 0; color: #991B1B; font-size: 15px; font-weight: 700;">⏸️ Your ads have been paused</p>
                    <p style="margin: 12px 0 0 0; color: #B91C1C; font-size: 14px; line-height: 1.8;">
                      We've paused <strong>${adsPaused} active campaign${adsPaused > 1 ? "s" : ""}</strong> so you won't be charged for ad spend while your subscription is inactive. Your campaigns have <strong>not</strong> been deleted — everything is exactly where you left it.
                    </p>
                    <p style="margin: 16px 0 0 0;">
                      <a href="${primaryAdsManagerLink}" style="display: inline-block; background: #EF4444; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; font-family: 'Red Hat Display', sans-serif;">
                        Double-check in Ads Manager →
                      </a>
                    </p>
                    <p style="margin: 10px 0 0 0; color: #B91C1C; font-size: 12px; line-height: 1.6;">
                      We recommend verifying in your Ads Manager that all campaigns are paused. Click the link above to check.
                    </p>
                  </div>
                </td>
              </tr>`
    : `
              <tr>
                <td style="padding: 10px 40px 25px 40px;">
                  <div style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border-radius: 12px; padding: 22px; border-left: 4px solid #22C55E;">
                    <p style="margin: 0; color: #166534; font-size: 15px; font-weight: 700;">✅ No active ads found</p>
                    <p style="margin: 12px 0 0 0; color: #15803D; font-size: 14px; line-height: 1.8;">
                      We didn't find any active campaigns running, so there's nothing to worry about. If you do have campaigns running outside of Lumi, we recommend checking your Ads Manager to make sure everything looks good.
                    </p>
                    <p style="margin: 16px 0 0 0;">
                      <a href="${primaryAdsManagerLink}" style="display: inline-block; background: #22C55E; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; font-family: 'Red Hat Display', sans-serif;">
                        Check Ads Manager →
                      </a>
                    </p>
                  </div>
                </td>
              </tr>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We'll miss you</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F6; padding: 30px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #A78BFA 0%, #EC4899 50%, #F97316 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; font-family: 'Red Hat Display', sans-serif; letter-spacing: -0.5px;">We'll miss you 💜</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; color: #111111; font-size: 18px; font-weight: 600; line-height: 1.5;">Hey ${firstName},</p>
              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8;">
                I wanted to personally let you know that your cancellation has been confirmed. No hard feelings — I get it.
              </p>
              <p style="margin: 12px 0 0 0; color: #4a5568; font-size: 15px; line-height: 1.8;">
                Your ${tierName} access will remain active until <strong style="color: #111111;">${endDate}</strong>. Everything you've built — your brand setup, audience psychology, creative assets, and campaign data — will be waiting for you if you ever decide to come back.
              </p>
            </td>
          </tr>

          <!-- Ads paused section -->
          ${adsPausedSection}

          <!-- What you still have access to -->
          <tr>
            <td style="padding: 10px 40px 25px 40px;">
              <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 22px; border-left: 4px solid #A78BFA;">
                <p style="margin: 0; color: #5B21B6; font-size: 15px; font-weight: 700;">Until ${endDate}, you still have:</p>
                <p style="margin: 12px 0 0 0; color: #6D28D9; font-size: 14px; line-height: 1.8;">
                  ✦ Full access to your dashboard<br/>
                  ✦ All your campaign data and creative assets<br/>
                  ✦ Lumi chat for strategy help<br/>
                  ✦ Performance reports and insights
                </p>
              </div>
            </td>
          </tr>

          <!-- Feedback request -->
          <tr>
            <td style="padding: 0 40px 25px 40px;">
              <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-radius: 12px; padding: 22px; border-left: 4px solid #F97316;">
                <p style="margin: 0; color: #C2410C; font-size: 14px; font-weight: 700;">💡 Quick favor?</p>
                <p style="margin: 10px 0 0 0; color: #9A3412; font-size: 14px; line-height: 1.7;">
                  If there's anything I could have done better — or a feature you wished existed — I'd love to hear it. Just reply to this email. Every piece of feedback makes Lumi better for everyone.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA to reactivate -->
          <tr>
            <td style="padding: 5px 40px 15px 40px; text-align: center;">
              <p style="margin: 0 0 16px 0; color: #4a5568; font-size: 14px;">Changed your mind? You can reactivate anytime.</p>
              <a href="https://adsbylumi.com/settings" style="display: inline-block; background: linear-gradient(135deg, #F97316 0%, #EC4899 50%, #A78BFA 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; font-family: 'Red Hat Display', sans-serif; box-shadow: 0 6px 20px rgba(236, 72, 153, 0.3); letter-spacing: 0.3px;">
                Reactivate My Plan →
              </a>
            </td>
          </tr>

          <!-- Warm closer -->
          <tr>
            <td style="padding: 20px 40px 35px 40px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                Whatever you're working on next, I'm rooting for you. And if you ever need a hand with your ads again — I'll be right here.
              </p>
              <p style="margin: 16px 0 0 0; color: #111111; font-size: 15px; font-weight: 600;">
                Wishing you all the best 💜<br/>
                <span style="font-weight: 700;">— Lumi</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #FAF9F6; padding: 22px 40px; text-align: center; border-top: 1px solid #F5F3EE;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.6;">
                Lumi by Ads by Lumi · Meta Ads, Simplified<br/>
                You're receiving this because your subscription was cancelled.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
