import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Copy, Check, ExternalLink, Gift, Loader2, Download, Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import lumiLogo from "@/assets/lumi-logo.png";

export default function PartnerDashboard() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affiliateData, setAffiliateData] = useState<any>(null);
  const [partnerName, setPartnerName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadPartnerData();
    } else {
      setError("Missing access token. Please use the link from your approval email.");
      setLoading(false);
    }
  }, [token]);

  const loadPartnerData = async () => {
    setLoading(true);
    try {
      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from("partner_access_tokens")
        .select("*")
        .eq("token", token!)
        .single();

      if (tokenError || !tokenData) {
        setError("Invalid or expired access link. Please contact hello@adsbylumi.com for a new one.");
        setLoading(false);
        return;
      }

      // Check expiry
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setError("This access link has expired. Please contact hello@adsbylumi.com for a new one.");
        setLoading(false);
        return;
      }

      setPartnerName(tokenData.email.split("@")[0]);

      // Fetch affiliate data from Rewardful
      const { data, error: fnError } = await supabase.functions.invoke("get-affiliate-data", {
        body: { email: tokenData.email },
      });

      if (!fnError && data?.exists) {
        setAffiliateData(data);
      } else {
        setError("Could not load your affiliate data. Please try again or contact support.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copied! 🎉");
    setTimeout(() => setCopied(null), 2000);
  };

  const trialCode = affiliateData?.partnerTrialCode || '';
  const trialLink = trialCode ? `https://adsbylumi.com/?code=${trialCode}` : affiliateData?.referralLink || '';

  const copyBlocks = affiliateData
    ? [
        {
          label: "Social Post",
          text: trialCode
            ? `I've been recommending LUMI to my audience and they love it. It builds your entire Meta ad campaign — strategy, copy, creative briefs, everything — in minutes. Perfect for coaches & course creators. Use code ${trialCode} for a free 14-day trial: ${trialLink}`
            : `I've been recommending LUMI to my audience and they love it. It builds your entire Meta ad campaign — strategy, copy, creative briefs, everything — in minutes. Perfect for coaches & course creators. Try it here: ${affiliateData.referralLink}`,
        },
        {
          label: "Email / Newsletter",
          text: trialCode
            ? `Quick recommendation: There's a tool called LUMI that acts as your own ads manager. You plug in your offer, and it builds your entire Meta ad campaign — angles, copy, creative briefs, everything. I've seen great results from my audience. Use code ${trialCode} for a free 14-day trial: ${trialLink}`
            : `Quick recommendation: There's a tool called LUMI that acts as your own ads manager. You plug in your offer, and it builds your entire Meta ad campaign — angles, copy, creative briefs, everything. I've seen great results from my audience. Check it out here: ${affiliateData.referralLink}`,
        },
        {
          label: "DM / Story",
          text: trialCode
            ? `Have you tried LUMI for your ads? It's a game-changer for coaches & course creators. Use code ${trialCode} for a free 14-day trial → ${trialLink}`
            : `Have you tried LUMI for your ads? It's a game-changer for coaches & course creators — here's my link: ${affiliateData.referralLink}`,
        },
      ]
    : [];

  const brandAssets = [
    { name: "LUMI Logo (PNG)", icon: Image, url: "https://adsbylumi.com/lovable-uploads/lumi-logo.png" },
    { name: "LUMI Icon", icon: Image, url: "https://adsbylumi.com/lovable-uploads/lumi-bulb.png" },
    { name: "Partner Badge", icon: FileText, url: "https://adsbylumi.com/lovable-uploads/82f0195b-d6a7-443a-a86e-a18f8721ac42.png" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(40,33%,97%)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[hsl(24,95%,53%)]" />
          <p className="text-[hsl(0,0%,40%)]" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
            Loading your partner dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[hsl(40,33%,97%)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <img src={lumiLogo} alt="LUMI" className="h-8 mx-auto mb-6" />
            <p className="text-[hsl(0,0%,7%)] font-semibold mb-2" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
              Access Issue
            </p>
            <p className="text-sm text-[hsl(0,0%,40%)] mb-6">{error}</p>
            <Button asChild variant="outline">
              <a href="mailto:hello@adsbylumi.com">Contact Support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(40,33%,97%)]">
      {/* Header */}
      <div className="border-b border-[hsl(40,20%,90%)] bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={lumiLogo} alt="LUMI" className="h-7" />
          <Badge className="bg-gradient-to-r from-[hsl(24,95%,53%)] to-[hsl(330,81%,60%)] text-white border-0 text-xs">
            Partner
          </Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(24,95%,53%)] to-[hsl(330,81%,60%)] flex items-center justify-center">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(0,0%,7%)]" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                Your Partner Dashboard
              </h1>
              <p className="text-sm text-[hsl(0,0%,40%)]">
                Welcome back! Track your referrals and grab marketing assets.
              </p>
            </div>
          </div>
        </div>

        {affiliateData && (
          <div className="space-y-6">
            {/* Partner Trial Code */}
            {trialCode && (
              <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-green-700 mb-2">🎁 Your partner trial code</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl font-bold tracking-widest text-[hsl(0,0%,7%)]">{trialCode}</span>
                    <Button variant="outline" size="icon" onClick={() => handleCopy(trialCode, "trialCode")}>
                      {copied === "trialCode" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-[hsl(0,0%,40%)] mb-3">
                    Share this code with your audience. They get a <strong>14-day free trial</strong> of LUMI, and you earn commission when they convert.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={trialLink} readOnly className="font-medium text-sm" />
                    <Button variant="outline" size="icon" onClick={() => handleCopy(trialLink, "trialLink")}>
                      {copied === "trialLink" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-[hsl(0,0%,60%)] mt-2">Share this direct link — the code is auto-applied at checkout</p>
                </CardContent>
              </Card>
            )}

            {/* Referral Link */}
            <Card className="border-[hsl(40,20%,90%)] shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-[hsl(0,0%,40%)] mb-3">Your referral link</p>
                <div className="flex items-center gap-2">
                  <Input value={affiliateData.referralLink} readOnly className="font-medium" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(affiliateData.referralLink, "link")}>
                    {copied === "link" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "People Referred", value: affiliateData.leadsCount },
                { label: "Paying Subscribers", value: affiliateData.conversionsCount },
                { label: "Total Earned", value: `$${(affiliateData.earningsCents / 100).toFixed(2)}` },
              ].map((stat) => (
                <Card key={stat.label} className="border-[hsl(40,20%,90%)] shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-[hsl(0,0%,7%)]">{stat.value}</p>
                    <p className="text-xs text-[hsl(0,0%,40%)]">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Commission Info */}
            <Card className="border-2 border-[hsl(330,81%,60%,0.15)] bg-gradient-to-r from-[hsl(330,81%,60%,0.03)] to-[hsl(270,60%,70%,0.03)]">
              <CardContent className="p-6">
                <p className="font-semibold text-[hsl(0,0%,7%)] mb-1" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                  30% Recurring Monthly Commission
                </p>
                <p className="text-sm text-[hsl(0,0%,40%)]">
                  You earn 30% of every subscription payment for as long as your referral stays subscribed. Payouts are managed through Rewardful.
                </p>
                <a
                  href="https://app.rewardful.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[hsl(24,95%,53%)] hover:underline mt-3"
                >
                  Manage payouts on Rewardful <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>

            {/* Marketing Assets */}
            <div>
              <h2 className="text-lg font-bold mb-4 text-[hsl(0,0%,7%)]" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                Brand Assets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {brandAssets.map((asset) => (
                  <Card key={asset.name} className="border-[hsl(40,20%,90%)] shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 text-center">
                      <asset.icon className="h-8 w-8 mx-auto mb-2 text-[hsl(0,0%,40%)]" />
                      <p className="text-sm font-medium text-[hsl(0,0%,7%)] mb-2">{asset.name}</p>
                      <Button asChild variant="outline" size="sm" className="text-xs">
                        <a href={asset.url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Copy Blocks */}
            <div>
              <h2 className="text-lg font-bold mb-4 text-[hsl(0,0%,7%)]" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                Ready-to-use copy
              </h2>
              <div className="space-y-4">
                {copyBlocks.map((block) => (
                  <Card key={block.label} className="border-[hsl(40,20%,90%)] shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">{block.label}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(block.text, block.label)} className="text-xs">
                          {copied === block.label ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm text-[hsl(0,0%,40%)] leading-relaxed">{block.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[hsl(40,20%,90%)] text-center">
          <p className="text-xs text-[hsl(0,0%,60%)]">
            Questions? Reach out to{" "}
            <a href="mailto:hello@adsbylumi.com" className="text-[hsl(24,95%,53%)] hover:underline">
              hello@adsbylumi.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
