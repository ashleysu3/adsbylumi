import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Send, ExternalLink, Mail } from 'lucide-react';

// Sample data mirrors what send-weekly-reports puts in the email — Big
// Picture rows + Quick List items, both drawn from the engine. The card
// layout intentionally mirrors the Live Ads page so the email feels like
// the same product.
type CampaignStatus = 'healthy' | 'attention' | 'critical' | 'no-data';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  healthy: '✨ Doing great',
  attention: '👀 Keep an eye on this',
  critical: '🔄 Needs a refresh',
  'no-data': '⏳ Still warming up',
};

const STATUS_DOT: Record<CampaignStatus, string> = {
  healthy: 'bg-green-500',
  attention: 'bg-amber-500',
  critical: 'bg-red-500',
  'no-data': 'bg-amber-500',
};

const STATUS_BADGE: Record<CampaignStatus, string> = {
  healthy: 'bg-green-50 text-green-700 border-green-200',
  attention: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  'no-data': 'bg-muted text-muted-foreground border-border',
};

const SAMPLE_CAMPAIGNS = [
  {
    name: 'Free Workshop Registration',
    status: 'attention' as CampaignStatus,
    isLive: true,
    dailyBudget: '$45.00/day',
    spend: '$298.10 spent',
    primaryLabel: 'CPL',
    primaryValue: '$32.40',
    primaryGoal: '< $25',
    secondaryLabel: 'Leads',
    secondaryValue: '14',
    secondaryGoal: '> 20',
    actionRec: 'Refresh creative before scaling',
    changeNote: '2 recent changes — data still settling',
  },
  {
    name: 'Client Success Stories — Video',
    status: 'healthy' as CampaignStatus,
    isLive: true,
    dailyBudget: '$50.00/day',
    spend: '$312.40 spent',
    primaryLabel: 'CPL',
    primaryValue: '$18.50',
    primaryGoal: '< $30',
    secondaryLabel: 'Leads',
    secondaryValue: '21',
    secondaryGoal: '> 15',
    actionRec: 'Increase budget',
    changeNote: '',
  },
];

const SAMPLE_QUICK_LIST = [
  {
    campaign: 'Free Workshop Registration',
    title: 'CPL is $32 — each lead is costing $7 over target',
    description:
      "Your goal is under $25 but you're at $32.40. CTR is 0.82% — people aren't clicking, so the hook and creative aren't grabbing attention. Meta can't optimize delivery to your goal when the click signal is weak.",
    impact: 'Better creative signals help Meta find the right people faster.',
  },
  {
    campaign: 'Client Success Stories — Video',
    title: 'Scale budget 20% — hitting your goal',
    description:
      "Your CPL is $18.50, which beats your goal of under $30. This campaign is ready to scale at its current efficiency.",
    impact: 'Capture more results at the same cost per lead.',
  },
];

export default function WeeklyDigestPreview() {
  const navigate = useNavigate();
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSendingTest(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('send-weekly-reports', {
        body: { testMode: true, testEmail: testEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Test email sent to ${testEmail}! Check your inbox in a moment.`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient-lumi">Weekly Report Preview</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              The Big Picture + Quick List your subscribers actually receive — based on the same engine the in-app view uses.
            </p>
          </div>
        </div>

        {/* Send test email */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Send test email to</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-64 h-9"
                />
              </div>
              <Button
                onClick={handleSendTestEmail}
                disabled={sendingTest || !testEmail.trim()}
                variant="lumi"
                className="gap-2"
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingTest ? 'Sending...' : 'Send Test Email'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email preview */}
        <Card className="overflow-hidden border-2">
          <CardHeader className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-400 text-white pb-5">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5" />
              <Badge variant="outline" className="text-white border-white/30">Sample</Badge>
            </div>
            <CardTitle className="text-2xl">📊 Weekly Ad Report</CardTitle>
            <p className="text-white/90 text-sm mt-1">
              Sample Brand · {SAMPLE_CAMPAIGNS.length} campaigns with data this week
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div>
              <p className="font-semibold">Hey there 👋</p>
              <p className="text-sm text-muted-foreground mt-2">
                Here's the big picture across the campaigns that actually ran this week, plus the few moves worth making.{' '}
                <span className="text-foreground font-medium">1 needs attention · 1 on track</span>.
              </p>
            </div>

            {/* Big Picture — matches the Live Ads card layout */}
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-3">The Big Picture</p>
              <div className="space-y-3">
                {SAMPLE_CAMPAIGNS.map((c) => (
                  <div key={c.name} className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
                    {/* Change context chip */}
                    {c.changeNote && (
                      <div className="pl-5 -mb-1">
                        <div className="inline-flex items-center gap-1.5 text-[11px] rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                          ⏳ {c.changeNote}
                        </div>
                      </div>
                    )}

                    {/* Row 1: status dot + name + Live label */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[c.status]}`} />
                        <h3 className="font-semibold text-sm sm:text-base truncate">{c.name}</h3>
                      </div>
                      <span className={`text-xs font-medium ${c.isLive ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {c.isLive ? 'Live' : 'Paused'}
                      </span>
                    </div>

                    {/* Row 2: budget + spend chips */}
                    <div className="flex flex-wrap items-center gap-2 pl-5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.dailyBudget}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.spend}</span>
                    </div>

                    {/* Row 3: verdict + KPI vs goal */}
                    <div className="flex flex-wrap items-center gap-2 pl-5">
                      <Badge variant="outline" className={`text-xs rounded-full ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                      <span className="text-xs text-foreground">
                        {c.primaryLabel}: <strong>{c.primaryValue}</strong>{' '}
                        <span className="text-muted-foreground">(goal {c.primaryGoal})</span>
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-foreground">
                        {c.secondaryLabel}: <strong>{c.secondaryValue}</strong>{' '}
                        <span className="text-muted-foreground">(goal {c.secondaryGoal})</span>
                      </span>
                    </div>

                    {/* Row 4: action recommendation pill */}
                    <div className="pl-5">
                      <Badge variant="outline" className="text-xs rounded-full">
                        {c.actionRec}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick List */}
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-3">
                Quick List — this week's moves
              </p>
              <div className="space-y-3">
                {SAMPLE_QUICK_LIST.map((q, i) => (
                  <div key={i} className="border rounded-xl p-4 bg-card">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {q.campaign}
                    </div>
                    <div className="mt-1 font-bold text-sm">{q.title}</div>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{q.description}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <strong className="text-foreground/80">Why it matters:</strong> {q.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-2">
              <Button variant="lumi" className="gap-2" onClick={() => navigate('/live-ads')}>
                Open the Big Picture <ExternalLink className="h-4 w-4" />
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2">
                Approve, snooze, or skip each move in the app.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
