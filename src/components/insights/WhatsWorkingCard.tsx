import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, TrendingUp, Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TrendInsights {
  whats_working: {
    summary: string;
    top_patterns: { pattern: string; why_it_works: string }[];
  };
  industry_trends: { trend: string; description: string; relevance: string }[];
  recommendations: { idea: string; format: string; hook_suggestion: string; psychology_trigger: string }[];
}

interface WhatsWorkingCardProps {
  brandId: string;
}

export function WhatsWorkingCard({ brandId }: WhatsWorkingCardProps) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<TrendInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-trend-insights', {
        body: { brandId },
      });

      if (error) throw error;
      if (data?.insights) {
        setInsights(data.insights);
        setLoaded(true);
      }
    } catch (err: any) {
      console.error('Error fetching trend insights:', err);
      toast.error('Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  const relevanceColor = (r: string) => {
    switch (r) {
      case 'high': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!loaded) {
    return (
      <Card className="rounded-2xl border-[hsl(var(--lumi-orange-1)/0.2)] bg-[hsl(var(--lumi-orange-1)/0.03)]">
        <CardContent className="p-6 text-center">
          <Sparkles className="h-8 w-8 text-[hsl(var(--lumi-orange-1))] mx-auto mb-3" />
          <h3 className="font-semibold mb-1">What's Working Now</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get AI-powered insights on your top creative patterns and industry trends
          </p>
          <Button onClick={fetchInsights} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? 'Analyzing...' : 'Generate Insights'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-4">
      {/* What's Working Summary */}
      <Card className="rounded-2xl border-green-200 bg-green-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              What's Working
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={fetchInsights} disabled={loading} className="rounded-xl">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{insights.whats_working.summary}</p>
          {insights.whats_working.top_patterns.map((p, i) => (
            <div key={i} className="p-3 rounded-xl bg-white border border-green-100">
              <p className="text-sm font-medium">{p.pattern}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.why_it_works}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Industry Trends */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
            Industry Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.industry_trends.map((t, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border">
              <Badge className={`text-xs shrink-0 ${relevanceColor(t.relevance)}`}>{t.relevance}</Badge>
              <div>
                <p className="text-sm font-medium">{t.trend}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="rounded-2xl border-[hsl(var(--lumi-orange-1)/0.2)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
            Creative Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.recommendations.map((r, i) => (
            <div key={i} className="p-3 rounded-xl bg-[hsl(var(--lumi-orange-1)/0.03)] border border-[hsl(var(--lumi-orange-1)/0.1)]">
              <p className="text-sm font-medium">{r.idea}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{r.format}</Badge>
                <Badge variant="outline" className="text-xs">🧠 {r.psychology_trigger}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Hook: "{r.hook_suggestion}"</p>
            </div>
          ))}
          <Button
            onClick={() => navigate('/creative?refresh=true')}
            className="w-full rounded-xl mt-2"
            variant="outline"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Create More Like This
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
