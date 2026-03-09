import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Lightbulb, Film, Type, Megaphone, Copy, BookmarkPlus, ArrowRight, Loader2, TrendingUp, Video, Zap, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import lumiLogo from "@/assets/lumi-logo.png";

interface TrendAnalysis {
  whyItWorks: {
    psychologyDriver: string;
    engagementMechanism: string;
    platformContext: string;
  };
  formatBlueprint: {
    structure: string;
    duration: string;
    style: string;
    brandAdaptation: string;
  };
  hookVariations: Array<{
    hook: string;
    angle: string;
    whyItWorks: string;
  }>;
  filmingTips: string[];
  caption: string;
  adConcept: {
    headline: string;
    primaryText: string;
    description: string;
    cta: string;
    script: string;
  };
  trendSummary: string;
}

export default function TrendTranslator() {
  const { activeBrand } = useBrand();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [trendDescription, setTrendDescription] = useState("");
  const [offerId, setOfferId] = useState<string>("");
  const [offers, setOffers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [scraped, setScraped] = useState<{ platform: string; caption: string; thumbnailUrl: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeBrand?.id) return;
    supabase
      .from("offers")
      .select("id, name")
      .eq("brand_id", activeBrand.id)
      .eq("archived", false)
      .then(({ data }) => {
        if (data?.length) {
          setOffers(data);
          setOfferId(data[0].id);
        }
      });
  }, [activeBrand?.id]);

  const handleAnalyze = async () => {
    if (!activeBrand?.id) {
      toast.error("Select a brand first");
      return;
    }
    if (!url && !trendDescription) {
      toast.error("Paste a URL or describe the trend");
      return;
    }

    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("translate-trend", {
        body: {
          brandId: activeBrand.id,
          offerId: offerId || null,
          url: url || null,
          trendDescription: trendDescription || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setScraped(data.scraped);
      toast.success("Trend translated for your brand!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to analyze trend");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToConcepts = async () => {
    if (!activeBrand?.id || !analysis) return;
    setSaving(true);
    try {
      const conceptContent = JSON.stringify({
        trendSummary: analysis.trendSummary,
        sourceUrl: url || null,
        hooks: analysis.hookVariations,
        adConcept: analysis.adConcept,
        formatBlueprint: analysis.formatBlueprint,
        caption: analysis.caption,
      });

      const { error } = await supabase.from("content_ideas").insert({
        brand_id: activeBrand.id,
        offer_id: offerId || null,
        title: `Trend: ${analysis.trendSummary?.slice(0, 80) || 'Translated trend'}`,
        content: conceptContent,
        type: "trend_translation",
        status: "idea",
        tags: ["trend", scraped?.platform || "manual"],
      });

      if (error) throw error;
      toast.success("Saved to Concept Library!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleUseInCampaign = () => {
    if (!analysis) return;
    // Navigate to create with pre-seeded hook/angle data
    const params = new URLSearchParams();
    if (offerId) params.set("offerId", offerId);
    params.set("trendHook", analysis.hookVariations?.[0]?.hook || "");
    params.set("trendAngle", analysis.trendSummary || "");
    navigate(`/create?${params.toString()}`);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[image:var(--gradient-lumi)] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
              Trend Translator
            </h1>
            <p className="text-muted-foreground mt-1">
              Paste a trending post and LUMI will translate it into an ad concept for your brand.
            </p>
          </div>
        </div>

        {/* Input Section */}
        <Card className="border-border/50">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Paste a URL</label>
              <Input
                variant="glow"
                placeholder="https://www.instagram.com/reel/... or TikTok, YouTube link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or describe the trend</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Textarea
              variant="glow"
              placeholder='e.g. "The POV trend where someone shows their before and after transformation using a product, with text overlay counting the days"'
              value={trendDescription}
              onChange={(e) => setTrendDescription(e.target.value)}
              rows={3}
              disabled={loading}
            />

            {offers.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Translate for which offer?</label>
                <Select value={offerId} onValueChange={setOfferId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {offers.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={loading || (!url && !trendDescription)}
              className="w-full bg-[image:var(--gradient-lumi)] text-white hover:opacity-90"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  LUMI is translating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Translate This Trend
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <img src={lumiLogo} alt="LUMI" className="h-10 w-10 animate-pulse" />
              <p className="text-sm text-muted-foreground">Analyzing trend and translating for your brand...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Trend Summary */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground">{analysis.trendSummary}</p>
                      {scraped?.platform && scraped.platform !== 'unknown' && (
                        <Badge variant="secondary" className="mt-2 text-xs capitalize">{scraped.platform}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Why It Works */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Why It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Psychology Driver", value: analysis.whyItWorks.psychologyDriver },
                    { label: "Engagement Mechanism", value: analysis.whyItWorks.engagementMechanism },
                    { label: "Platform Context", value: analysis.whyItWorks.platformContext },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm text-foreground">{item.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Format Blueprint */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="h-5 w-5 text-blue-500" />
                    Format Blueprint
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Structure", value: analysis.formatBlueprint.structure },
                    { label: "Duration", value: analysis.formatBlueprint.duration },
                    { label: "Style", value: analysis.formatBlueprint.style },
                    { label: "Your Brand's Adaptation", value: analysis.formatBlueprint.brandAdaptation },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm text-foreground">{item.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Hook Variations */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    Hook Variations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.hookVariations.map((hook, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{hook.angle}</Badge>
                        <button
                          onClick={() => copyToClipboard(hook.hook, "Hook")}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-medium text-foreground">"{hook.hook}"</p>
                      <p className="text-xs text-muted-foreground">{hook.whyItWorks}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Filming Tips */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Film className="h-5 w-5 text-purple-500" />
                    Filming Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.filmingTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Caption */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Type className="h-5 w-5 text-green-500" />
                    Ready-to-Post Caption
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-foreground whitespace-pre-wrap pr-8">{analysis.caption}</p>
                    <button
                      onClick={() => copyToClipboard(analysis.caption, "Caption")}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Ad Concept */}
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    Ad Concept
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Headline</p>
                      <p className="text-sm font-semibold text-foreground">{analysis.adConcept.headline}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CTA</p>
                      <p className="text-sm font-semibold text-foreground">{analysis.adConcept.cta}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Primary Text</p>
                    <div className="relative p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-sm text-foreground whitespace-pre-wrap pr-8">{analysis.adConcept.primaryText}</p>
                      <button
                        onClick={() => copyToClipboard(analysis.adConcept.primaryText, "Primary text")}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</p>
                    <p className="text-sm text-foreground">{analysis.adConcept.description}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">30-Second Script</p>
                      <button
                        onClick={() => copyToClipboard(analysis.adConcept.script, "Script")}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-sm text-foreground whitespace-pre-wrap italic">{analysis.adConcept.script}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
                <Button
                  onClick={handleSaveToConcepts}
                  disabled={saving}
                  variant="outline"
                  className="flex-1"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookmarkPlus className="h-4 w-4 mr-2" />}
                  Save to Concept Library
                </Button>
                <Button
                  onClick={handleUseInCampaign}
                  className="flex-1 bg-[image:var(--gradient-lumi)] text-white hover:opacity-90"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Use in Campaign
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
