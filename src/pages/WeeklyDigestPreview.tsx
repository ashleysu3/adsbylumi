import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useBrand } from '@/contexts/BrandContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { parseReportSections, ReportSectionRenderer } from '@/components/insights/ReportSectionRenderer';
import { ArrowLeft, Loader2, Send, FileText } from 'lucide-react';

export default function WeeklyDigestPreview() {
  const navigate = useNavigate();
  const { isAgencyUser } = useBrand();
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Fake sample report data
  const sampleReportText = `## 📊 What's Happening

Your campaigns reached **24,582 people** this week, generating **347 link clicks** and **12 conversions**. Overall spend was **$312.40** across 3 active campaigns.

| Metric | This Week | Previous Week | Trend |
|--------|-----------|---------------|-------|
| Spend | $312.40 | $298.10 | ⬆️ +4.8% |
| Link Clicks | 347 | 312 | ✅ +11.2% |
| CTR | 1.41% | 1.22% | ✅ +15.6% |
| CPC | $0.90 | $0.96 | ✅ -6.3% |
| Conversions | 12 | 9 | ✅ +33.3% |
| CPL | $26.03 | $33.12 | ✅ -21.4% |
| ROAS | 3.2x | 2.7x | ✅ +18.5% |

**Top Performer:** "Client Success Stories – Video" campaign is crushing it with a 2.1% CTR and $18.50 CPL — well below your $30 target.

**Needs Attention:** "Free Workshop Registration" campaign frequency is at 3.8 — approaching the creative fatigue threshold.

## ✦ LUMI Recommends

- ✅ **Scale "Client Success Stories" budget by 20%** — This campaign is performing well above benchmarks. We recommend increasing the daily budget from $25 to $30 to capture more conversions at this efficient rate.

- ⚠️ **Refresh creative for "Free Workshop Registration"** — Frequency is approaching 4.0, which typically signals audience fatigue. We recommend introducing 2–3 new ad variations with fresh hooks to maintain engagement.

- ✅ **Continue monitoring "Brand Awareness" campaign** — CTR is steady at 1.3% and CPC is within target. No changes needed this week.

## 🤝 Approve These Changes

The following optimizations are ready for your approval:

1. **Increase "Client Success Stories" daily budget from $25 → $30** — Expected to generate 3–4 additional conversions per week at the current CPL.

2. **Pause lowest-performing ad in "Free Workshop Registration"** — The "Testimonial Carousel" variant has a 0.6% CTR vs. the campaign average of 1.2%. We recommend pausing it and redirecting budget to better performers.`;

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSendingTest(true);
    try {
      // Simulate sending — in production this would call an edge function
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(`Test email sent to ${testEmail}!`);
    } catch (error: any) {
      console.error('Error sending test:', error);
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const parsed = parseReportSections(sampleReportText);

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
              <span className="text-gradient-lumi">Performance Report Preview</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Preview what your performance report looks like with sample data
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

        {/* Report content */}
        {parsed && (
          <Card className="overflow-hidden border-2">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5" />
                <Badge variant="outline" className="text-white border-white/30">Sample Report</Badge>
              </div>
              <CardTitle className="text-2xl">📊 Performance Report</CardTitle>
              <p className="text-slate-300 text-sm mt-1">
                Sample Brand · Jan 13 — Jan 20, 2025
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <ReportSectionRenderer
                sections={parsed.sections}
                mode={isAgencyUser ? 'agency' : 'self-serve'}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
