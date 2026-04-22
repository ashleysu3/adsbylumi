import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LinkNewOfferToCampaignDialog } from "./LinkNewOfferToCampaignDialog";

type PageGoal = 'purchase' | 'discovery_call' | 'free_resource' | 'other';

const PAGE_GOAL_OPTIONS: { value: PageGoal; label: string; description: string }[] = [
  { value: 'purchase', label: 'Sell a Product/Service', description: 'They pay money to buy something' },
  { value: 'discovery_call', label: 'Book a Call', description: 'Schedule a discovery or sales call' },
  { value: 'free_resource', label: 'Collect Leads (Free)', description: 'Free webinar, training, challenge, PDF, opt-in, or lead magnet' },
  { value: 'other', label: 'Other', description: 'Something else (waitlist, community, etc.)' },
];

interface ExtractedData {
  description?: string;
  price_point?: string;
  target_outcome?: string;
  key_benefits?: string[];
  pain_points_addressed?: string[];
  unique_selling_points?: string[];
  social_proof?: string;
  emotional_hooks?: string[];
  target_audience_indicators?: string;
  tone_and_voice?: string;
  cta_language?: string[];
  objections_addressed?: string[];
  raw_copy_highlights?: string[];
  content_summary?: string;
  missing_info?: string[];
  needs_clarification?: boolean;
  clarification_questions?: string[];
  extraction_success?: boolean;
}

interface OfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  onSuccess: () => void;
}

export function OfferDialog({ open, onOpenChange, brandId, onSuccess }: OfferDialogProps) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [autoExtractPending, setAutoExtractPending] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showExtractedDetails, setShowExtractedDetails] = useState(false);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [pastedContent, setPastedContent] = useState("");
  const [linkCampaignDialog, setLinkCampaignDialog] = useState<{
    open: boolean;
    offerId: string;
    offerName: string;
    offerDescription?: string | null;
    offerPrice?: string | null;
    offerUrl?: string | null;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    price_point: "",
    target_outcome: "",
    page_goal: "" as PageGoal | "",
    use_brand_style_defaults: true,
  });

  const extractDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastExtractedUrl = useRef<string>("");

  // Auto-extract when URL is pasted/changed (debounced)
  const triggerAutoExtract = useCallback((url: string) => {
    if (!url || url.length < 10) return;
    
    // Clear any pending extraction
    if (extractDebounceRef.current) {
      clearTimeout(extractDebounceRef.current);
    }
    
    // Don't re-extract the same URL
    if (url === lastExtractedUrl.current) return;
    
    setAutoExtractPending(true);
    
    // Debounce for 1.5s after user stops typing
    extractDebounceRef.current = setTimeout(async () => {
      if (extracting) {
        setAutoExtractPending(false);
        return;
      }
      
      setExtracting(true);
      setAutoExtractPending(false);
      setExtractedData(null);
      setExtractionFailed(false);
      
      try {
        const { data, error } = await supabase.functions.invoke('extract-offer-info', {
          body: { 
            offerUrl: url,
            offerName: formData.name 
          }
        });

        if (error) throw error;

        lastExtractedUrl.current = url;

        // Check if extraction actually got content
        if (!data.extraction_success || data.needs_clarification) {
          setExtractionFailed(true);
          setExtractedData(data);
          toast.info("Couldn't read the page — you can paste the content below");
        } else {
          setExtractedData(data);
          setFormData(prev => ({
            ...prev,
            description: data.description || prev.description,
            price_point: data.price_point || prev.price_point,
            target_outcome: typeof data.target_outcome === 'string'
              ? data.target_outcome
              : data.target_outcome
                ? JSON.stringify(data.target_outcome)
                : prev.target_outcome,
          }));
          toast.success("✨ Page analyzed! Review the extracted info.");
        }
      } catch (error: any) {
        console.error('Auto-extract error:', error);
        setExtractionFailed(true);
        toast.info("Couldn't read the page — you can paste the content below");
      } finally {
        setExtracting(false);
      }
    }, 1500);
  }, [extracting, formData.name]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (extractDebounceRef.current) {
        clearTimeout(extractDebounceRef.current);
      }
    };
  }, []);

  const handleUrlChange = (value: string) => {
    setFormData(prev => ({ ...prev, url: value }));
    setExtractionFailed(false);
    setPastedContent("");
    triggerAutoExtract(value);
  };

  const handlePasteExtract = async () => {
    if (!pastedContent.trim() || pastedContent.trim().length < 50) {
      toast.error("Please paste more content from the page");
      return;
    }

    setExtracting(true);
    setExtractedData(null);
    try {
      const { data, error } = await supabase.functions.invoke('extract-offer-info', {
        body: { 
          offerUrl: formData.url || null,
          offerName: formData.name,
          pastedContent: pastedContent.trim()
        }
      });

      if (error) throw error;

      setExtractedData(data);
      setExtractionFailed(false);

      setFormData(prev => ({
        ...prev,
        description: data.description || prev.description,
        price_point: data.price_point || prev.price_point,
        target_outcome: typeof data.target_outcome === 'string'
          ? data.target_outcome
          : data.target_outcome
            ? JSON.stringify(data.target_outcome)
            : prev.target_outcome,
      }));

      if (data.needs_clarification) {
        toast.info("Some info couldn't be found — please review and fill in the gaps");
      } else {
        toast.success("✨ Content analyzed! Review the extracted info.");
      }
    } catch (error: any) {
      console.error('Error extracting from pasted content:', error);
      toast.error("Failed to analyze pasted content");
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractInfo = async () => {
    if (!formData.url) {
      toast.error("Please enter an offer URL first");
      return;
    }

    setExtracting(true);
    setExtractedData(null);
    try {
      const { data, error } = await supabase.functions.invoke('extract-offer-info', {
        body: { 
          offerUrl: formData.url,
          offerName: formData.name 
        }
      });

      if (error) throw error;

      lastExtractedUrl.current = formData.url;
      setExtractedData(data);

      // Update form with core fields
      setFormData(prev => ({
        ...prev,
        description: data.description || prev.description,
        price_point: data.price_point || prev.price_point,
        target_outcome: typeof data.target_outcome === 'string'
          ? data.target_outcome
          : data.target_outcome
            ? JSON.stringify(data.target_outcome)
            : prev.target_outcome,
        page_goal: data.suggested_page_goal && ['purchase', 'discovery_call', 'free_resource', 'other'].includes(data.suggested_page_goal)
          ? data.suggested_page_goal
          : prev.page_goal,
      }));

      if (data.needs_clarification) {
        toast.info("Some info couldn't be found - please review and fill in the gaps");
      } else {
        toast.success("Offer info extracted from page");
      }
    } catch (error: any) {
      console.error('Error extracting offer info:', error);
      toast.error("Failed to extract offer info");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build messaging guidelines from extracted data
      const messagingGuidelines = extractedData ? {
        key_benefits: extractedData.key_benefits || [],
        pain_points: extractedData.pain_points_addressed || [],
        unique_selling_points: extractedData.unique_selling_points || [],
        social_proof: extractedData.social_proof || null,
        emotional_hooks: extractedData.emotional_hooks || [],
        target_audience: extractedData.target_audience_indicators || null,
        tone_and_voice: extractedData.tone_and_voice || null,
        cta_language: extractedData.cta_language || [],
        objections_addressed: extractedData.objections_addressed || [],
        raw_copy_highlights: extractedData.raw_copy_highlights || [],
      } : null;

      // Insert offer with enriched data
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .insert({
          brand_id: brandId,
          name: formData.name,
          url: formData.url,
          description: formData.description,
          price_point: formData.price_point,
          target_outcome: formData.target_outcome,
          page_goal: formData.page_goal || null,
          ai_generated_description: !!extractedData,
          ai_generated_price: !!extractedData?.price_point,
          messaging_guidelines: messagingGuidelines,
          use_brand_style_defaults: formData.use_brand_style_defaults,
        } as any)
        .select()
        .single();

      if (offerError) throw offerError;

      // Generate product psychology
      toast.info("Generating product psychology...");
      const { error: psychError } = await supabase.functions.invoke('generate-product-psychology', {
        body: { 
          offerId: offer.id,
          brandId: brandId 
        }
      });

      if (psychError) {
        console.error('Psychology generation error:', psychError);
        toast.warning("Offer created, but psychology generation failed");
      } else {
        toast.success("Offer created with product psychology");
      }

      // Show link-to-campaign dialog
      setLinkCampaignDialog({
        open: true,
        offerId: offer.id,
        offerName: formData.name,
        offerDescription: formData.description,
        offerPrice: formData.price_point,
        offerUrl: formData.url,
      });

      onSuccess();
      onOpenChange(false);
      setFormData({ name: "", url: "", description: "", price_point: "", target_outcome: "", page_goal: "", use_brand_style_defaults: true });
      setExtractedData(null);
      setExtractionFailed(false);
      setPastedContent("");
    } catch (error: any) {
      console.error('Error creating offer:', error);
      toast.error("Failed to create offer");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setExtractedData(null);
      setShowExtractedDetails(false);
      setExtractionFailed(false);
      setPastedContent("");
      lastExtractedUrl.current = "";
      setAutoExtractPending(false);
    }
    onOpenChange(open);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add What You're Promoting</DialogTitle>
          <DialogDescription>
            Enter your offer details and we'll generate a product-specific psychological profile
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Offer Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Signature Course"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Offer URL</Label>
            <div className="relative">
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/offer"
                className="pr-10"
                required
              />
              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : autoExtractPending ? (
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                ) : extractedData ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {extracting ? (
                <>
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Analyzing your offer page...
                </>
              ) : extractedData && !extractionFailed ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Page analyzed — info extracted below
                </>
              ) : extractionFailed ? (
                <>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  Couldn't read the page — paste the content below
                </>
              ) : autoExtractPending ? (
                "Will analyze when you stop typing..."
              ) : (
                "Paste your URL and we'll automatically extract offer details"
              )}
            </p>
          </div>

          {/* Paste fallback when extraction fails */}
          {extractionFailed && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">We couldn't read that page</p>
                  <p className="text-xs text-muted-foreground">
                    The page may be behind a login, have bot protection, or block automated access. 
                    Copy all the text from the page and paste it below — we'll use that instead.
                  </p>
                </div>
              </div>
              <Textarea
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                rows={5}
                placeholder="Go to your offer page, select all the text (Ctrl+A / Cmd+A), copy it, and paste it here..."
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={handlePasteExtract}
                disabled={extracting || pastedContent.trim().length < 50}
                className="w-full"
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing pasted content...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Pasted Content
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Extraction Status & Summary */}
          {extractedData && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
              {extractedData.needs_clarification ? (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  <span className="font-medium text-sm">
                    {extractedData.needs_clarification ? "Almost there — a few fields below need your input" : "Page analyzed successfully"}
                  </span>
                </div>
                {extractedData.key_benefits?.length || extractedData.pain_points_addressed?.length ? (
                  <Badge variant="secondary" className="text-xs">
                    {(extractedData.key_benefits?.length || 0) + (extractedData.pain_points_addressed?.length || 0)} insights found
                  </Badge>
                ) : null}
              </div>

              {extractedData.content_summary && (
                <p className="text-sm text-muted-foreground">{extractedData.content_summary}</p>
              )}


              {/* Expandable Details */}
              <Collapsible open={showExtractedDetails} onOpenChange={setShowExtractedDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-xs">View extracted details</span>
                    {showExtractedDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {extractedData.raw_copy_highlights?.length ? (
                    <div>
                      <p className="text-xs font-medium mb-1">Copy Highlights</p>
                      <div className="flex flex-wrap gap-1">
                        {extractedData.raw_copy_highlights.slice(0, 5).map((highlight, i) => (
                          <Badge key={i} variant="outline" className="text-xs font-normal">
                            "{highlight.substring(0, 50)}{highlight.length > 50 ? '...' : ''}"
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {extractedData.key_benefits?.length ? (
                    <div>
                      <p className="text-xs font-medium mb-1">Key Benefits Found</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {extractedData.key_benefits.slice(0, 4).map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {extractedData.pain_points_addressed?.length ? (
                    <div>
                      <p className="text-xs font-medium mb-1">Pain Points Addressed</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {extractedData.pain_points_addressed.slice(0, 4).map((p, i) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {extractedData.emotional_hooks?.length ? (
                    <div>
                      <p className="text-xs font-medium mb-1">Emotional Hooks</p>
                      <div className="flex flex-wrap gap-1">
                        {extractedData.emotional_hooks.map((hook, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {hook}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {extractedData.social_proof && (
                    <div>
                      <p className="text-xs font-medium mb-1">Social Proof</p>
                      <p className="text-xs text-muted-foreground">{extractedData.social_proof}</p>
                    </div>
                  )}

                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Page Goal - Required for strategy recommendation */}
          <div className="space-y-3">
            <Label className="text-base font-medium">
              What is this page directing people to do? <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={formData.page_goal}
              onValueChange={(value: PageGoal) => setFormData(prev => ({ ...prev, page_goal: value }))}
              className="grid grid-cols-2 gap-3"
            >
              {PAGE_GOAL_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`goal-${option.value}`}
                  className={`flex flex-col gap-1 rounded-lg border p-3 cursor-pointer transition-all hover:border-primary/50 ${
                    formData.page_goal === option.value 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={option.value} id={`goal-${option.value}`} />
                    <span className="font-medium text-sm">{option.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">{option.description}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Editable extracted fields - clear visual that these can be edited */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              {extractedData && formData.description ? (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  ✨ Auto-filled • Click to edit
                </span>
              ) : extractedData && !formData.description && extractedData.needs_clarification ? (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">
                  Needs info
                </Badge>
              ) : null}
            </div>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="What's included in this offer..."
              className={`transition-all ${
                extractedData && formData.description 
                  ? 'border-primary/30 bg-primary/5 focus:bg-background cursor-text' 
                  : ''
              }`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="price_point">Price</Label>
              {extractedData && formData.price_point ? (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  ✨ Auto-filled • Click to edit
                </span>
              ) : extractedData && !formData.price_point && extractedData.needs_clarification ? (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">
                  Needs info
                </Badge>
              ) : null}
            </div>
            <Input
              id="price_point"
              value={formData.price_point}
              onChange={(e) => setFormData(prev => ({ ...prev, price_point: e.target.value }))}
              placeholder="$997 or Free"
              className={`transition-all ${
                extractedData && formData.price_point 
                  ? 'border-primary/30 bg-primary/5 focus:bg-background cursor-text' 
                  : ''
              }`}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Before & After</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Lumi uses this to write ads that speak to your audience's real experience</p>
              </div>
              {extractedData && formData.target_outcome ? (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  ✨ Auto-filled • Click to edit
                </span>
              ) : extractedData && !formData.target_outcome && extractedData.needs_clarification ? (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">
                  Needs info
                </Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor="target_before" className="text-xs">😩 Before</Label>
                <Textarea
                  id="target_before"
                  rows={2}
                  value={(() => {
                    const match = formData.target_outcome?.match(/^Before:\s*(.*?)(?:\.\s*After:|$)/s);
                    return match ? match[1].trim() : (formData.target_outcome && !formData.target_outcome.startsWith("Before:") ? formData.target_outcome : "");
                  })()}
                  onChange={(e) => {
                    const afterMatch = formData.target_outcome?.match(/After:\s*(.*?)\.?\s*$/s);
                    const after = afterMatch ? afterMatch[1].trim() : "";
                    const before = e.target.value;
                    setFormData(prev => ({ ...prev, target_outcome: `Before: ${before}. After: ${after}.` }));
                  }}
                  placeholder="What are they struggling with right now?"
                  className={`min-h-[60px] transition-all ${
                    extractedData && formData.target_outcome 
                      ? 'border-primary/30 bg-primary/5 focus:bg-background cursor-text' 
                      : ''
                  }`}
                />
              </div>
              <div>
                <Label htmlFor="target_after" className="text-xs">✨ After</Label>
                <Textarea
                  id="target_after"
                  rows={2}
                  value={(() => {
                    const match = formData.target_outcome?.match(/After:\s*(.*?)\.?\s*$/s);
                    return match ? match[1].trim() : "";
                  })()}
                  onChange={(e) => {
                    const beforeMatch = formData.target_outcome?.match(/^Before:\s*(.*?)(?:\.\s*After:|$)/s);
                    const before = beforeMatch ? beforeMatch[1].trim() : "";
                    const after = e.target.value;
                    setFormData(prev => ({ ...prev, target_outcome: `Before: ${before}. After: ${after}.` }));
                  }}
                  placeholder="What does life look like after they buy?"
                  className={`min-h-[60px] transition-all ${
                    extractedData && formData.target_outcome 
                      ? 'border-primary/30 bg-primary/5 focus:bg-background cursor-text' 
                      : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Apply brand Style defaults */}
          <div className="rounded-lg border bg-muted/30 p-3 flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor="use-brand-style" className="text-sm font-medium cursor-pointer">
                Apply brand Style defaults to this offer
              </Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                When on, ad scripts and creative plans for this offer will use your brand's copy voice,
                emoji preferences, bullet style, text overlay style, and b-roll. Turn off if this offer
                should sound different from the rest of your brand.
              </p>
            </div>
            <input
              id="use-brand-style"
              type="checkbox"
              role="switch"
              aria-checked={formData.use_brand_style_defaults}
              checked={formData.use_brand_style_defaults}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, use_brand_style_defaults: e.target.checked }))
              }
              className="mt-1 h-4 w-4 accent-primary cursor-pointer shrink-0"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.page_goal}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Offer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {linkCampaignDialog && (
      <LinkNewOfferToCampaignDialog
        open={linkCampaignDialog.open}
        onOpenChange={(open) => {
          if (!open) setLinkCampaignDialog(null);
        }}
        brandId={brandId}
        offerId={linkCampaignDialog.offerId}
        offerName={linkCampaignDialog.offerName}
        offerDescription={linkCampaignDialog.offerDescription}
        offerPrice={linkCampaignDialog.offerPrice}
        offerUrl={linkCampaignDialog.offerUrl}
      />
    )}
    </>
  );
}
