import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lightbulb, FileText, Sparkles, Loader2, Shuffle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { CopyVariations } from "./CopyVariations";

interface CopyEditorProps {
  concept: any;
  uploadedAsset?: any;
  workspace: any;
  initialCopy?: {
    headline: string;
    primary_text: string;
    description: string;
    call_to_action: string;
  };
  onApprove: (copy: any) => void;
  onBack: () => void;
}

export function CopyEditor({ concept, uploadedAsset, workspace, initialCopy, onApprove, onBack }: CopyEditorProps) {
  const [copy, setCopy] = useState({
    headline: initialCopy?.headline || concept.headline || "",
    primary_text: initialCopy?.primary_text || concept.primary_copy || "",
    description: initialCopy?.description || concept.description || "",
    call_to_action: initialCopy?.call_to_action || "LEARN_MORE",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [generationSource, setGenerationSource] = useState<'ai' | 'manual'>('manual');
  const [variations, setVariations] = useState<any[]>([]);
  const [showVariations, setShowVariations] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | null>(null);

  useEffect(() => {
    if (!uploadedAsset?.file_url) return;
    
    if (uploadedAsset.file_type?.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = uploadedAsset.file_url;
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight;
        setAspectRatio(ratio > 0.9 && ratio < 1.1 ? '1:1' : '9:16');
      };
    } else if (uploadedAsset.file_type?.startsWith('image/')) {
      const img = new Image();
      img.src = uploadedAsset.file_url;
      img.onload = () => {
        const ratio = img.width / img.height;
        setAspectRatio(ratio > 0.9 && ratio < 1.1 ? '1:1' : '9:16');
      };
    }
  }, [uploadedAsset]);

  const handleApprove = () => {
    onApprove(copy);
  };

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('finalize-ad-copy', {
        body: {
          concept,
          stage: concept.stage || 'tofu',
          uploadedAssetUrl: uploadedAsset?.file_url,
          brandInfo: {
            name: workspace?.name || 'Your Brand',
            voice: workspace?.brand_voice,
            audience: workspace?.target_audience
          }
        }
      });
      
      if (error) throw error;
      
      setCopy({
        headline: data.headline,
        primary_text: data.primary_text,
        description: data.description,
        call_to_action: data.call_to_action
      });
      
      setAiResponse(data);
      setGenerationSource('ai');
      toast({ title: 'AI copy generated from your Knowledge Base!' });
    } catch (error) {
      console.error('Copy generation error:', error);
      toast({ 
        title: 'Failed to generate copy', 
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setCopy({
      headline: concept.headline || "",
      primary_text: concept.primary_copy || "",
      description: concept.description || "",
      call_to_action: "LEARN_MORE"
    });
    setAiResponse(null);
    setGenerationSource('manual');
  };

  const handleGenerateVariations = async () => {
    setIsGeneratingVariations(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-copy-variations', {
        body: {
          concept,
          stage: concept.stage || 'tofu',
          uploadedAssetUrl: uploadedAsset?.file_url,
          brandInfo: {
            name: workspace?.name || 'Your Brand',
            voice: workspace?.brand_voice,
            audience: workspace?.target_audience
          }
        }
      });
      
      if (error) throw error;
      
      setVariations(data.variations || []);
      setShowVariations(true);
      toast({ title: `Generated ${data.variations?.length || 0} copy variations!` });
    } catch (error) {
      console.error('Variations generation error:', error);
      toast({ 
        title: 'Failed to generate variations', 
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const handleSelectVariation = (variation: any) => {
    setCopy({
      headline: variation.headline,
      primary_text: variation.primary_text,
      description: variation.description,
      call_to_action: variation.call_to_action
    });
    setAiResponse({
      ...variation,
      why_this_works: variation.why_this_angle,
      knowledge_applied: [variation.framework_used],
      cta_reasoning: `Using ${variation.call_to_action} because this is a ${concept.stage || 'tofu'} stage ad.`
    });
    setGenerationSource('ai');
    setShowVariations(false);
    toast({ title: `Applied ${variation.variation_name}!` });
  };

  const ctaOptions = [
    { value: "LEARN_MORE", label: "Learn More" },
    { value: "SHOP_NOW", label: "Shop Now" },
    { value: "SIGN_UP", label: "Sign Up" },
    { value: "GET_QUOTE", label: "Get Quote" },
    { value: "BOOK_NOW", label: "Book Now" },
    { value: "DOWNLOAD", label: "Download" },
    { value: "WATCH_MORE", label: "Watch More" },
    { value: "APPLY_NOW", label: "Apply Now" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Finalize Your Ad Copy</h2>
            <p className="text-muted-foreground">AI-powered copy from your Knowledge Base</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateVariations}
            disabled={isGeneratingVariations || !uploadedAsset}
            size="lg"
            className="gap-2"
          >
            {isGeneratingVariations ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Directions...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Choose Copy Direction
              </>
            )}
          </Button>
          {aiResponse && (
            <Button variant="outline" onClick={handleReset}>
              Reset to Original
            </Button>
          )}
        </div>
      </div>

      {generationSource === 'ai' && (
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          AI Generated
        </Badge>
      )}

      {/* Show Variations UI */}
      {showVariations && variations.length > 0 ? (
        <CopyVariations
          variations={variations}
          onSelect={handleSelectVariation}
          onCancel={() => setShowVariations(false)}
          currentCopy={copy}
        />
      ) : (
        <>
          {/* Preview */}
          <Card className="p-6 bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Ad Preview</h3>
              {aspectRatio && (
                <Badge variant="secondary">
                  {aspectRatio === '1:1' ? 'Square (1:1)' : 'Story (9:16)'}
                </Badge>
              )}
            </div>
            
            <div className="bg-background rounded-lg border p-4 space-y-3 max-w-md mx-auto">
              {/* Brand Header */}
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {workspace?.name?.charAt(0) || "B"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{workspace?.name || "Your Brand"}</div>
                  <div className="text-xs text-muted-foreground">Sponsored</div>
                </div>
              </div>
              
              {/* Primary Text - ONLY show for square format */}
              {aspectRatio === '1:1' && (
                <p className="text-sm leading-snug">
                  {copy.primary_text || "Your primary text will appear here..."}
                </p>
              )}
              
              {/* Creative */}
              {uploadedAsset ? (
                uploadedAsset.file_type?.startsWith('video/') ? (
                  <div className="relative">
                    <video 
                      src={uploadedAsset.file_url} 
                      className="w-full rounded object-cover"
                      style={{ 
                        aspectRatio: aspectRatio === '1:1' ? '1/1' : '9/16',
                        maxHeight: aspectRatio === '9:16' ? '500px' : '400px'
                      }}
                      controls
                      muted
                    />
                    {aspectRatio === '9:16' && (
                      <Badge 
                        variant="outline" 
                        className="absolute top-2 left-2 bg-black/60 text-white border-white/20"
                      >
                        Full-screen video
                      </Badge>
                    )}
                  </div>
                ) : (
                  <img 
                    src={uploadedAsset.file_url} 
                    className="w-full rounded object-cover"
                    style={{ 
                      aspectRatio: aspectRatio === '1:1' ? '1/1' : '9/16',
                      maxHeight: aspectRatio === '9:16' ? '500px' : '400px'
                    }}
                    alt="Creative preview"
                  />
                )
              ) : (
                <div className="bg-muted h-64 rounded flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Upload creative to see preview</p>
                </div>
              )}
              
              {/* Headline + Description - Always below creative */}
              <div className="text-sm space-y-1">
                <div className="font-semibold">{copy.headline || "Your headline here"}</div>
                <div className="text-muted-foreground text-xs">{copy.description || "Description..."}</div>
              </div>
              
              {/* CTA Button */}
              <Button size="sm" variant="outline" className="w-full">
                {ctaOptions.find((opt) => opt.value === copy.call_to_action)?.label || "Learn More"}
              </Button>
            </div>
            
            {/* Format-Specific Warnings */}
            {aspectRatio === '9:16' && uploadedAsset?.file_type?.startsWith('video/') && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs text-yellow-900 dark:text-yellow-100">
                  <strong>Note:</strong> 9:16 videos display full-screen on mobile. 
                  Primary text appears ABOVE the video in feed, but users may not see it during playback. 
                  Keep headline punchy (&lt;20 characters recommended).
                </p>
              </div>
            )}
          </Card>

      {/* Editable Fields */}
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="headline">
            Headline 
            <span className="text-muted-foreground text-xs ml-1">
              ({aspectRatio === '9:16' && uploadedAsset?.file_type?.startsWith('video/') 
                ? '20 characters recommended for video' 
                : '40 characters max'})
            </span>
          </Label>
          <Input
            id="headline"
            value={copy.headline}
            onChange={(e) => setCopy({ ...copy, headline: e.target.value.slice(0, 40) })}
            placeholder={aspectRatio === '9:16' ? "Stop scrolling!" : "Stop scrolling if you're tired of..."}
            maxLength={40}
          />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{copy.headline.length}/40</span>
            {aspectRatio === '9:16' && uploadedAsset?.file_type?.startsWith('video/') && copy.headline.length > 20 && (
              <span className="text-yellow-600">Consider shortening for video</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_text">
            Primary Text <span className="text-muted-foreground text-xs">(125 characters recommended)</span>
          </Label>
          <Textarea
            id="primary_text"
            value={copy.primary_text}
            onChange={(e) => setCopy({ ...copy, primary_text: e.target.value })}
            placeholder="Have you ever felt like your Meta ads are burning cash without results? You're not alone..."
            rows={4}
          />
          <div className="text-xs text-muted-foreground text-right">
            {copy.primary_text.length} characters
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Description <span className="text-muted-foreground text-xs">(30 characters max)</span>
          </Label>
          <Input
            id="description"
            value={copy.description}
            onChange={(e) => setCopy({ ...copy, description: e.target.value.slice(0, 30) })}
            placeholder="Get started today"
            maxLength={30}
          />
          <div className="text-xs text-muted-foreground text-right">{copy.description.length}/30</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta">Call-to-Action Button</Label>
          
          {aiResponse?.cta_reasoning && (
            <Card className="p-3 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    AI Recommends: {ctaOptions.find(o => o.value === copy.call_to_action)?.label}
                  </p>
                  <p className="text-blue-800 dark:text-blue-200">{aiResponse.cta_reasoning}</p>
                </div>
              </div>
            </Card>
          )}
          
          <Select 
            value={copy.call_to_action} 
            onValueChange={(value) => {
              setCopy({ ...copy, call_to_action: value });
              if (generationSource === 'ai') setGenerationSource('manual');
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ctaOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>{option.label}</span>
                    {option.value === "LEARN_MORE" && (
                      <Badge variant="secondary" className="text-xs">
                        Most Popular
                      </Badge>
                    )}
                    {aiResponse && option.value === aiResponse.call_to_action && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Sparkles className="h-2 w-2" />
                        AI Pick
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* AI Insights */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">
              {aiResponse ? "Why This Copy Works" : "Copy Best Practices"}
            </h4>
            
            {aiResponse?.why_this_works ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {aiResponse.why_this_works}
                </p>
                
                {aiResponse.knowledge_applied?.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-2">📚 Knowledge Base Applied:</p>
                    <div className="flex flex-wrap gap-1">
                      {aiResponse.knowledge_applied.map((kb: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {kb}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Lead with pain point or desired outcome</li>
                <li>• Create continuity between creative and copy</li>
                <li>• Use "you" language to make it personal</li>
                <li>• Click "Generate Copy with AI" to apply your Knowledge Base</li>
              </ul>
            )}
            
            <div className="pt-2 border-t border-primary/10">
              <p className="text-xs font-medium text-primary mb-1">
                {aiResponse?.compliance_check?.passed ? "✓" : "⚠"} Meta Compliance Check:
              </p>
              {aiResponse?.compliance_check ? (
                <p className="text-xs text-muted-foreground">
                  {aiResponse.compliance_check.notes}
                </p>
              ) : (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• No guarantees or income claims</li>
                  <li>• No personal attribute targeting</li>
                  <li>• No shocking/sensational language</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleApprove}>Approve & Mark Ready →</Button>
      </div>
        </>
      )}
    </div>
  );
}
