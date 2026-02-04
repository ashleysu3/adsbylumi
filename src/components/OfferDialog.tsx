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

type PageGoal = 'purchase' | 'discovery_call' | 'free_resource' | 'other';

const PAGE_GOAL_OPTIONS: { value: PageGoal; label: string; description: string }[] = [
  { value: 'purchase', label: 'Purchase', description: 'Buy a product or service directly' },
  { value: 'discovery_call', label: 'Book a Call', description: 'Schedule a discovery or sales call' },
  { value: 'free_resource', label: 'Collect Leads', description: 'Capture name/email (lead magnet, webinar, challenge)' },
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
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    price_point: "",
    target_outcome: "",
    page_goal: "" as PageGoal | "",
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
      
      try {
        const { data, error } = await supabase.functions.invoke('extract-offer-info', {
          body: { 
            offerUrl: url,
            offerName: formData.name 
          }
        });

        if (error) throw error;

        lastExtractedUrl.current = url;
        setExtractedData(data);

        // Update form with core fields
        setFormData(prev => ({
          ...prev,
          description: data.description || prev.description,
          price_point: data.price_point || prev.price_point,
          target_outcome: data.target_outcome || prev.target_outcome,
        }));

        if (data.needs_clarification) {
          toast.info("Some info couldn't be found - please review and fill in the gaps");
        } else {
          toast.success("✨ Page analyzed! Review the extracted info.");
        }
      } catch (error: any) {
        console.error('Auto-extract error:', error);
        // Silent fail for auto-extract
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
    triggerAutoExtract(value);
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
        target_outcome: data.target_outcome || prev.target_outcome,
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
        })
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

      onSuccess();
      onOpenChange(false);
      setFormData({ name: "", url: "", description: "", price_point: "", target_outcome: "", page_goal: "" });
      setExtractedData(null);
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
      lastExtractedUrl.current = "";
      setAutoExtractPending(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Offer</DialogTitle>
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
              ) : extractedData ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Page analyzed — info extracted below
                </>
              ) : autoExtractPending ? (
                "Will analyze when you stop typing..."
              ) : (
                "Paste your URL and we'll automatically extract offer details"
              )}
            </p>
          </div>

          {/* Extraction Status & Summary */}
          {extractedData && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {extractedData.extraction_success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="font-medium text-sm">
                    {extractedData.extraction_success ? "Page analyzed successfully" : "Limited extraction"}
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

              {/* Clarification Questions - User can answer these in the form fields below */}
              {extractedData.needs_clarification && extractedData.clarification_questions?.length ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                    We couldn't find some details — please fill them in below:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {extractedData.clarification_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    ↓ Edit the fields below to add missing info
                  </p>
                </div>
              ) : null}

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

                  {extractedData.missing_info?.length ? (
                    <div>
                      <p className="text-xs font-medium mb-1 text-amber-600">Missing Info</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {extractedData.missing_info.map((m, i) => (
                          <li key={i}>• {m}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
              {extractedData && formData.description && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  ✨ Auto-filled • Click to edit
                </span>
              )}
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
            {!formData.description && extractedData?.needs_clarification && (
              <p className="text-xs text-destructive">← This info is missing, please fill it in</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="price_point">Price</Label>
              {extractedData && formData.price_point && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  ✨ Auto-filled • Click to edit
                </span>
              )}
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
            {!formData.price_point && extractedData?.needs_clarification && (
              <p className="text-xs text-destructive">← This info is missing, please fill it in</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="target_outcome">Target Outcome</Label>
              {extractedData && formData.target_outcome && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  ✨ Auto-filled • Click to edit
                </span>
              )}
            </div>
            <Input
              id="target_outcome"
              value={formData.target_outcome}
              onChange={(e) => setFormData(prev => ({ ...prev, target_outcome: e.target.value }))}
              placeholder="What transformation does this deliver?"
              className={`transition-all ${
                extractedData && formData.target_outcome 
                  ? 'border-primary/30 bg-primary/5 focus:bg-background cursor-text' 
                  : ''
              }`}
            />
            {!formData.target_outcome && extractedData?.needs_clarification && (
              <p className="text-xs text-destructive">← This info is missing, please fill it in</p>
            )}
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
  );
}
