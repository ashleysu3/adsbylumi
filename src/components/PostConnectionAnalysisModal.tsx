import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, TrendingUp, Lightbulb, ArrowRight, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { SparkleIcon } from "@/components/SparkleIcon";
import { motion } from "framer-motion";

interface PostConnectionAnalysisModalProps {
  brandId: string;
  open: boolean;
  onClose: () => void;
}

interface AnalysisResult {
  hasData: boolean;
  summary?: string;
  topFormats?: string[];
  keyPatterns?: string[];
  recommendations?: string[];
  detectedUrls?: string[];
  adsAnalyzed?: number;
  dateRange?: string;
}

export function PostConnectionAnalysisModal({ brandId, open, onClose }: PostConnectionAnalysisModalProps) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    if (!open || !brandId) return;
    setLoading(true);
    setAnalysis(null);
    setSelectedUrls(new Set());
    setImported(false);

    supabase.functions.invoke("analyze-past-creatives", {
      body: { brandId },
    }).then(({ data, error }) => {
      if (error) {
        console.error("Analysis error:", error);
        setAnalysis({ hasData: false });
      } else {
        setAnalysis(data);
        // Auto-select all detected URLs
        if (data?.detectedUrls?.length) {
          setSelectedUrls(new Set(data.detectedUrls));
        }
      }
      setLoading(false);
    });
  }, [open, brandId]);

  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleImportOffers = async () => {
    if (selectedUrls.size === 0) return;
    setImporting(true);

    let successCount = 0;
    for (const url of selectedUrls) {
      try {
        // Extract offer info from URL
        const { data: offerData, error: extractError } = await supabase.functions.invoke("extract-offer-info", {
          body: { url, brandId },
        });

        if (extractError) {
          console.error(`Failed to extract from ${url}:`, extractError);
          continue;
        }

        // Create offer record
        const { error: insertError } = await supabase.from("offers").insert({
          brand_id: brandId,
          name: offerData?.name || new URL(url).pathname.split("/").filter(Boolean).pop() || "Imported Offer",
          url,
          description: offerData?.description || null,
          price_point: offerData?.price || null,
          ai_generated_description: true,
          ai_generated_price: !!offerData?.price,
        });

        if (insertError) {
          console.error(`Failed to create offer for ${url}:`, insertError);
          continue;
        }

        successCount++;
      } catch (err) {
        console.error(`Error importing ${url}:`, err);
      }
    }

    if (successCount > 0) {
      toast.success(`Imported ${successCount} offer${successCount !== 1 ? "s" : ""} from your ads ✨`);
      setImported(true);
    } else {
      toast.error("Could not import offers. You can add them manually later.");
    }

    setImporting(false);
  };

  const noData = analysis && !analysis.hasData;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparkleIcon size="sm" state="thinking" />
            {loading ? "Scanning Your Ad History..." : noData ? "No Recent Ad Data" : "Lumi Found Your Ads ✨"}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "Lumi is scanning your last 90 days of ad data..."
              : noData
              ? "No worries — Lumi will use best practices to get you started."
              : `Analyzed ${analysis?.adsAnalyzed || 0} ads from the last 90 days`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing your campaigns, creative formats, and landing pages...</p>
              </div>
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : noData ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No recent ad data found — that's totally okay! Lumi will use industry best practices and your brand info to get you started strong.
              </p>
              <Button onClick={onClose} variant="lumi" className="mt-2">
                Let's Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Summary */}
              {analysis?.summary && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium">{analysis.summary}</p>
                </div>
              )}

              {/* Top Formats */}
              {analysis?.topFormats && analysis.topFormats.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Top Performing Formats
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.topFormats.map((f, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-muted border border-border font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Patterns */}
              {analysis?.keyPatterns && analysis.keyPatterns.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Key Patterns
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.keyPatterns.map((p, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {analysis?.recommendations && analysis.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Lumi's Recommendations
                  </h4>
                  <ul className="space-y-1.5">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detected URLs */}
              {analysis?.detectedUrls && analysis.detectedUrls.length > 0 && !imported && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <h4 className="text-sm font-semibold">
                    Landing Pages Found in Your Ads
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Select the pages you'd like to import as offers — Lumi will auto-extract the details.
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {analysis.detectedUrls.map((url) => (
                      <label
                        key={url}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedUrls.has(url)}
                          onCheckedChange={() => toggleUrl(url)}
                        />
                        <span className="text-sm truncate flex-1">{url}</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      </label>
                    ))}
                  </div>
                  <Button
                    onClick={handleImportOffers}
                    disabled={selectedUrls.size === 0 || importing}
                    variant="lumi"
                    className="w-full"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing {selectedUrls.size} offer{selectedUrls.size !== 1 ? "s" : ""}...
                      </>
                    ) : (
                      <>
                        Import {selectedUrls.size} as Offer{selectedUrls.size !== 1 ? "s" : ""}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {imported && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Offers imported successfully!</p>
                </div>
              )}

              {/* Continue button */}
              {(!analysis?.detectedUrls?.length || imported) && (
                <Button onClick={onClose} variant="lumi" className="w-full">
                  Continue to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}

              {analysis?.detectedUrls && analysis.detectedUrls.length > 0 && !imported && (
                <Button onClick={onClose} variant="ghost" className="w-full text-muted-foreground">
                  Skip — I'll add offers later
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
