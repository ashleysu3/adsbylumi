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
import { Sparkle, FileText, Sparkles, Loader2, Shuffle, Crop, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { CopyVariations } from "./CopyVariations";
import { SmartCropSuggestions } from "./SmartCropSuggestions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GeneratingModal } from "@/components/GeneratingModal";

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
  const [activePlacement, setActivePlacement] = useState<'feed' | 'stories' | 'reels'>('feed');
  const [placementCreatives, setPlacementCreatives] = useState<Record<string, any>>({
    feed: null,
    stories: null,
    reels: null
  });
  const [showSmartCrop, setShowSmartCrop] = useState(false);
  const [smartCropPlacement, setSmartCropPlacement] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadedAsset?.file_url) return;
    
    // Initialize all placements with the uploaded asset
    setPlacementCreatives({
      feed: uploadedAsset,
      stories: uploadedAsset,
      reels: uploadedAsset
    });
    
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

  const getPlacementRecommendations = (placement: string) => {
    switch (placement) {
      case 'feed':
        return {
          aspectRatio: '1:1',
          maxHeadline: 40,
          recommendedHeadline: 25,
          showPrimaryText: true,
          tips: [
            'Square format (1:1) performs best in Feed',
            'Primary text is highly visible - use it to hook attention',
            'Users often scroll quickly - make headline count',
            'Include clear value proposition in primary text'
          ]
        };
      case 'stories':
        return {
          aspectRatio: '9:16',
          maxHeadline: 40,
          recommendedHeadline: 15,
          showPrimaryText: false,
          tips: [
            'Full-screen 9:16 format required',
            'Primary text appears above but may be hidden when tapping',
            'Keep headline ultra-short (under 15 characters)',
            'Visual should tell the story - minimal copy needed'
          ]
        };
      case 'reels':
        return {
          aspectRatio: '9:16',
          maxHeadline: 40,
          recommendedHeadline: 20,
          showPrimaryText: false,
          tips: [
            'Full-screen 9:16 video format',
            'Sound-on environment - consider voiceover',
            'First 3 seconds are critical for retention',
            'Headline should create curiosity or intrigue'
          ]
        };
      default:
        return {
          aspectRatio: '1:1',
          maxHeadline: 40,
          recommendedHeadline: 25,
          showPrimaryText: true,
          tips: []
        };
    }
  };

  const handleUploadPlacementCreative = async (placement: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${workspace.id}/${placement}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: urlData } = await supabase.storage
        .from('campaign-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-assets')
        .getPublicUrl(fileName);

      setPlacementCreatives(prev => ({
        ...prev,
        [placement]: {
          id: `${placement}_${Date.now()}`,
          file_name: file.name,
          file_type: file.type,
          file_url: publicUrl,
          storage_path: fileName
        }
      }));

      toast({ title: `${placement} creative uploaded!` });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ 
        title: 'Upload failed', 
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive'
      });
    }
  };

  const getCurrentCreative = () => placementCreatives[activePlacement] || uploadedAsset;

  const handleSmartCrop = (placement: string) => {
    setSmartCropPlacement(placement);
    setShowSmartCrop(true);
  };

  const handleApplySmartCrop = async (croppedBlob: Blob) => {
    if (!smartCropPlacement) return;

    try {
      const fileName = `${workspace.id}/${smartCropPlacement}_cropped_${Date.now()}.jpg`;
      
      const { error: uploadError, data: urlData } = await supabase.storage
        .from('campaign-assets')
        .upload(fileName, croppedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-assets')
        .getPublicUrl(fileName);

      setPlacementCreatives(prev => ({
        ...prev,
        [smartCropPlacement]: {
          id: `${smartCropPlacement}_cropped_${Date.now()}`,
          file_name: fileName,
          file_type: 'image/jpeg',
          file_url: publicUrl,
          storage_path: fileName
        }
      }));

      setShowSmartCrop(false);
      setSmartCropPlacement(null);
      toast({ title: `Smart crop applied to ${smartCropPlacement}!` });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Failed to save cropped image',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive'
      });
    }
  };

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
          {/* Placement Preview */}
          <Card className="p-6 bg-muted/30">
            <h3 className="font-semibold mb-4">Ad Preview by Placement</h3>
            
            <Tabs value={activePlacement} onValueChange={(v) => setActivePlacement(v as any)}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="stories">Stories</TabsTrigger>
                <TabsTrigger value="reels">Reels</TabsTrigger>
              </TabsList>

              <TabsContent value={activePlacement} className="space-y-4">
                {/* Placement Info */}
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {getPlacementRecommendations(activePlacement).aspectRatio} aspect ratio
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSmartCrop(activePlacement)}
                      disabled={!uploadedAsset || uploadedAsset.file_type?.startsWith('video/')}
                    >
                      <Crop className="h-3 w-3 mr-1" />
                      Smart Crop
                    </Button>
                    <input
                      type="file"
                      id={`upload-${activePlacement}`}
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPlacementCreative(activePlacement, file);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById(`upload-${activePlacement}`)?.click()}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload
                    </Button>
                  </div>
                </div>
                {/* Preview */}
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
                  
                  {/* Primary Text - Only show for feed */}
                  {getPlacementRecommendations(activePlacement).showPrimaryText && (
                    <p className="text-sm leading-snug">
                      {copy.primary_text || "Your primary text will appear here..."}
                    </p>
                  )}
                  
                  {/* Creative */}
                  {getCurrentCreative() ? (
                    getCurrentCreative().file_type?.startsWith('video/') ? (
                      <div className="relative">
                        <video 
                          src={getCurrentCreative().file_url} 
                          className="w-full rounded object-cover"
                          style={{ 
                            aspectRatio: getPlacementRecommendations(activePlacement).aspectRatio,
                            maxHeight: activePlacement === 'feed' ? '400px' : '500px'
                          }}
                          controls
                          muted
                        />
                        {activePlacement !== 'feed' && (
                          <Badge 
                            variant="outline" 
                            className="absolute top-2 left-2 bg-black/60 text-white border-white/20"
                          >
                            Full-screen {activePlacement}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <img 
                        src={getCurrentCreative().file_url} 
                        className="w-full rounded object-cover"
                        style={{ 
                          aspectRatio: getPlacementRecommendations(activePlacement).aspectRatio,
                          maxHeight: activePlacement === 'feed' ? '400px' : '500px'
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

                {/* Placement-Specific Tips */}
                <Alert>
                  <Sparkle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">
                        {activePlacement === 'feed' ? 'Feed' : activePlacement === 'stories' ? 'Stories' : 'Reels'} Best Practices:
                      </p>
                      <ul className="text-xs space-y-1">
                        {getPlacementRecommendations(activePlacement).tips.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                      {copy.headline.length > getPlacementRecommendations(activePlacement).recommendedHeadline && (
                        <p className="text-xs text-yellow-600 pt-2 border-t">
                          ⚠️ Your headline is {copy.headline.length} characters. 
                          Consider shortening to {getPlacementRecommendations(activePlacement).recommendedHeadline} for {activePlacement}.
                        </p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
          </Card>

      {/* Editable Fields */}
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="headline">
            Headline 
            <span className="text-muted-foreground text-xs ml-1">
              ({getPlacementRecommendations(activePlacement).recommendedHeadline} characters recommended for {activePlacement}, 40 max)
            </span>
          </Label>
          <Input
            id="headline"
            value={copy.headline}
            onChange={(e) => setCopy({ ...copy, headline: e.target.value.slice(0, 40) })}
            placeholder={
              activePlacement === 'feed' 
                ? "Stop scrolling if you're tired of..." 
                : activePlacement === 'stories'
                ? "Stop scrolling!"
                : "Watch this..."
            }
            maxLength={40}
          />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{copy.headline.length}/40</span>
            {copy.headline.length > getPlacementRecommendations(activePlacement).recommendedHeadline && (
              <span className="text-yellow-600">
                Consider shortening for {activePlacement}
              </span>
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
                <Sparkle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
          <Sparkle className="h-5 w-5 text-primary mt-0.5 animate-sparkle-pulse" />
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

      {/* Smart Crop Dialog */}
      <Dialog open={showSmartCrop} onOpenChange={setShowSmartCrop}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Smart Crop for {smartCropPlacement}</DialogTitle>
          </DialogHeader>
          {showSmartCrop && uploadedAsset && smartCropPlacement && (
            <SmartCropSuggestions
              imageUrl={uploadedAsset.file_url}
              targetAspectRatio={
                smartCropPlacement === 'feed' ? '1:1' : '9:16'
              }
              onApplyCrop={handleApplySmartCrop}
              onCancel={() => {
                setShowSmartCrop(false);
                setSmartCropPlacement(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Generating Modal for finalize-ad-copy */}
      <GeneratingModal 
        isOpen={isGenerating} 
        title="Generating Ad Copy"
        steps={[
          "Analyzing your concept...",
          "Applying brand voice...",
          "Writing headlines...",
          "Crafting primary text...",
          "Optimizing for placement..."
        ]}
      />

      {/* Generating Modal for copy variations */}
      <GeneratingModal 
        isOpen={isGeneratingVariations} 
        title="Loading Copy Directions"
        steps={[
          "Analyzing concept angles...",
          "Generating headline variations...",
          "Creating copy frameworks...",
          "Building direction options..."
        ]}
      />
    </div>
  );
}
