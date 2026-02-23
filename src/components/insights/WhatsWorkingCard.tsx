import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, TrendingUp, Lightbulb, Loader2, RefreshCw, Plus, CheckCircle2, ListPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TrendInsights {
  whats_working: {
    summary: string;
    top_patterns: { pattern: string; why_it_works: string }[];
  };
  industry_trends: { trend: string; description: string; relevance: string }[];
  recommendations: {
    idea: string;
    format: string;
    hook_suggestion: string;
    psychology_trigger: string;
    guidance?: string;
    why_it_works?: string;
    based_on?: string;
  }[];
}

interface WhatsWorkingCardProps {
  brandId: string;
  workspaceId?: string;
}

export function WhatsWorkingCard({ brandId, workspaceId }: WhatsWorkingCardProps) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<TrendInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [metaDataAvailable, setMetaDataAvailable] = useState(false);
  const [adsAnalyzed, setAdsAnalyzed] = useState(0);

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
        setMetaDataAvailable(data.metaDataAvailable || false);
        setAdsAnalyzed(data.adsAnalyzed || 0);
        setSavedIndices(new Set());
      }
    } catch (err: any) {
      console.error('Error fetching trend insights:', err);
      toast.error('Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  const saveRecommendation = async (rec: TrendInsights['recommendations'][0], index: number) => {
    setSavingIndex(index);
    try {
      const { error } = await supabase.from('content_ideas').insert({
        brand_id: brandId,
        title: rec.idea,
        content: JSON.stringify({
          format: rec.format,
          hook_suggestion: rec.hook_suggestion,
          psychology_trigger: rec.psychology_trigger,
          guidance: rec.guidance || '',
          why_it_works: rec.why_it_works || '',
          based_on: rec.based_on || '',
        }),
        type: 'creative_concept',
        status: 'idea',
        tags: [rec.format, 'from-insights', rec.psychology_trigger].filter(Boolean),
      });

      if (error) throw error;
      setSavedIndices(prev => new Set(prev).add(index));
      toast.success('Added to your creative ideas', {
        description: 'Find it in Creative Studio',
        action: {
          label: 'Go to Studio',
          onClick: () => navigate('/creative'),
        },
      });
    } catch (err: any) {
      console.error('Error saving recommendation:', err);
      toast.error('Failed to save recommendation');
    } finally {
      setSavingIndex(null);
    }
  };

  const saveAllRecommendations = async () => {
    if (!insights?.recommendations) return;
    setSavingAll(true);
    try {
      const unsaved = insights.recommendations
        .map((rec, i) => ({ rec, i }))
        .filter(({ i }) => !savedIndices.has(i));

      if (unsaved.length === 0) {
        toast.info('All recommendations already saved');
        return;
      }

      const rows = unsaved.map(({ rec }) => ({
        brand_id: brandId,
        title: rec.idea,
        content: JSON.stringify({
          format: rec.format,
          hook_suggestion: rec.hook_suggestion,
          psychology_trigger: rec.psychology_trigger,
          guidance: rec.guidance || '',
          why_it_works: rec.why_it_works || '',
          based_on: rec.based_on || '',
        }),
        type: 'creative_concept',
        status: 'idea',
        tags: [rec.format, 'from-insights', rec.psychology_trigger].filter(Boolean),
      }));

      const { error } = await supabase.from('content_ideas').insert(rows);
      if (error) throw error;

      const allIndices = new Set(insights.recommendations.map((_, i) => i));
      setSavedIndices(allIndices);
      toast.success(`Added ${unsaved.length} ideas to your creative checklist`, {
        action: {
          label: 'Go to Studio',
          onClick: () => navigate('/creative'),
        },
      });
    } catch (err: any) {
      console.error('Error saving all recommendations:', err);
      toast.error('Failed to save recommendations');
    } finally {
      setSavingAll(false);
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
            AI-powered analysis of your actual ad performance — cross-campaign patterns, top formats, and psychology-driven recommendations
          </p>
          <Button onClick={fetchInsights} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? 'Analyzing your ads...' : 'Analyze My Creatives'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-4">
      {/* Data Source Indicator */}
      {metaDataAvailable && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          Based on {adsAnalyzed} ads from your Meta account (last 90 days)
        </div>
      )}

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

      {/* Recommendations with Add to Checklist */}
      <Card className="rounded-2xl border-[hsl(var(--lumi-orange-1)/0.2)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
              Creative Recommendations
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={saveAllRecommendations}
              disabled={savingAll || savedIndices.size === insights.recommendations.length}
              className="rounded-xl text-xs"
            >
              {savingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <ListPlus className="h-3.5 w-3.5 mr-1.5" />
              )}
              {savedIndices.size === insights.recommendations.length ? 'All Saved' : 'Add All to Checklist'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.recommendations.map((r, i) => (
            <div key={i} className="p-4 rounded-xl bg-[hsl(var(--lumi-orange-1)/0.03)] border border-[hsl(var(--lumi-orange-1)/0.1)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.idea}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{r.format}</Badge>
                    <Badge variant="outline" className="text-xs">🧠 {r.psychology_trigger}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={savedIndices.has(i) ? 'ghost' : 'outline'}
                  onClick={() => saveRecommendation(r, i)}
                  disabled={savingIndex === i || savedIndices.has(i)}
                  className="rounded-xl shrink-0"
                >
                  {savingIndex === i ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : savedIndices.has(i) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Hook: "{r.hook_suggestion}"</p>
              {r.guidance && (
                <p className="text-xs text-muted-foreground mt-1">📋 {r.guidance}</p>
              )}
              {r.why_it_works && (
                <p className="text-xs text-muted-foreground mt-1">💡 {r.why_it_works}</p>
              )}
              {r.based_on && (
                <p className="text-xs text-muted-foreground mt-1 italic">Based on: {r.based_on}</p>
              )}
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
