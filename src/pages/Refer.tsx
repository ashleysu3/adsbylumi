import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ExternalLink, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";

export default function Refer() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [affiliateData, setAffiliateData] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserEmail(user.email || '');
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    setUserName(profile?.full_name || '');

    try {
      const { data, error } = await supabase.functions.invoke('get-affiliate-data', {
        body: { email: user.email }
      });
      if (!error && data?.exists) {
        setAffiliateData(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleCreateAffiliate = async () => {
    setCreating(true);
    const nameParts = userName.split(' ');
    try {
      const { data, error } = await supabase.functions.invoke('create-affiliate', {
        body: {
          email: userEmail,
          firstName: nameParts[0] || 'User',
          lastName: nameParts.slice(1).join(' ') || 'User',
        }
      });
      if (error) throw error;
      if (data?.exists) {
        toast.info("You already have an account! Refreshing...");
      } else if (data?.success) {
        toast.success("Your referral link is ready! 🎉");
      }
      await loadData();
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
      console.error(err);
    }
    setCreating(false);
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copied! 🎉");
    setTimeout(() => setCopied(null), 2000);
  };

  const copyBlocks = affiliateData ? [
    {
      label: "Social",
      text: `I've been using LUMI to run my Meta ads and it's genuinely changed how I promote my business. It builds my campaigns, writes my ad copy, and tells me what to do next — without needing to know anything about ads. If you're a coach or course creator, you need this. ${affiliateData.referralLink}`
    },
    {
      label: "Email",
      text: `Quick recommendation: I've been using a tool called LUMI that acts as your own ads manager. You plug in your offer, it builds your entire Meta ad campaign — angles, copy, creative briefs, everything. I was skeptical but it works. Check it out here: ${affiliateData.referralLink}`
    },
    {
      label: "DM / Short",
      text: `Have you tried LUMI for your ads? It's been a game changer — here's my link if you want to check it out: ${affiliateData.referralLink}`
    },
  ] : [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-pink-1))] flex items-center justify-center">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                Share LUMI, Earn $40
              </h1>
              <p className="text-muted-foreground text-sm">Know someone who needs better ads? Send them your link.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : affiliateData ? (
          <div className="space-y-6">
            {/* Referral Link */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-3">Your referral link</p>
                <div className="flex items-center gap-2 mb-3">
                  <Input value={affiliateData.referralLink} readOnly className="font-medium" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(affiliateData.referralLink, 'link')}>
                    {copied === 'link' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {affiliateData.referralCode && (
                  <Badge className="bg-muted text-foreground border-border">Your code: {affiliateData.referralCode}</Badge>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "People Referred", value: affiliateData.leadsCount },
                { label: "Paying Subscribers", value: affiliateData.conversionsCount },
                { label: "Total Earned", value: `$${(affiliateData.earningsCents / 100).toFixed(2)}` },
              ].map((stat) => (
                <Card key={stat.label} className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Manage payouts & full dashboard <ExternalLink className="h-3 w-3" />
            </a>

            {/* Copy Blocks */}
            <div className="mt-8">
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                Ready-to-use copy
              </h2>
              <div className="space-y-4">
                {copyBlocks.map((block) => (
                  <Card key={block.label} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs">{block.label}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleCopy(block.text, block.label)}
                          className="text-xs"
                        >
                          {copied === block.label ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{block.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Partner Upsell */}
            <Card className="border-2 border-[hsl(var(--lumi-pink-1)/0.2)] bg-gradient-to-r from-[hsl(var(--lumi-pink-1)/0.05)] to-[hsl(var(--lumi-purple-1)/0.05)]">
              <CardContent className="p-6 text-center">
                <p className="font-semibold mb-2">Want to earn 30% monthly instead of $40 one-time?</p>
                <p className="text-sm text-muted-foreground mb-4">Apply for the LUMI Partner Program.</p>
                <Button asChild variant="outline">
                  <Link to="/partners?type=partner">Apply for Partner Program →</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-lg font-semibold mb-2">You don't have a referral link yet.</p>
              <p className="text-sm text-muted-foreground mb-6">Get your unique link and start earning $40 for every referral.</p>
              <Button onClick={handleCreateAffiliate} disabled={creating}
                className="bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </span>
                ) : "Get My Referral Link"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
