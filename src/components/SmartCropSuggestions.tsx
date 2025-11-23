import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scissors, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

interface CropSuggestion {
  aspectRatio: '1:1' | '9:16';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  reason: string;
}

interface SmartCropSuggestionsProps {
  imageUrl: string;
  targetAspectRatio: '1:1' | '9:16';
  onApplyCrop: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

export function SmartCropSuggestions({ 
  imageUrl, 
  targetAspectRatio, 
  onApplyCrop, 
  onCancel 
}: SmartCropSuggestionsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [suggestions, setSuggestions] = useState<CropSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(0);
  const [isApplying, setIsApplying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    analyzImage();
  }, [imageUrl, targetAspectRatio]);

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const calculateCropSuggestions = (
    detections: any[], 
    imgWidth: number, 
    imgHeight: number
  ): CropSuggestion[] => {
    const targetRatio = targetAspectRatio === '1:1' ? 1 : 9/16;
    const suggestions: CropSuggestion[] = [];

    if (detections.length === 0) {
      // No subjects detected - suggest center crop
      const cropDimensions = getCenterCropDimensions(imgWidth, imgHeight, targetRatio);
      suggestions.push({
        aspectRatio: targetAspectRatio,
        ...cropDimensions,
        confidence: 0.5,
        reason: "Center crop (no subjects detected)"
      });
    } else {
      // Find bounding box containing all important subjects
      let minX = imgWidth, minY = imgHeight, maxX = 0, maxY = 0;
      let totalScore = 0;

      detections.forEach(det => {
        const box = det.box;
        minX = Math.min(minX, box.xmin);
        minY = Math.min(minY, box.ymin);
        maxX = Math.max(maxX, box.xmax);
        maxY = Math.max(maxY, box.ymax);
        totalScore += det.score;
      });

      const subjectWidth = maxX - minX;
      const subjectHeight = maxY - minY;
      const subjectCenterX = minX + subjectWidth / 2;
      const subjectCenterY = minY + subjectHeight / 2;

      // Calculate crop that includes all subjects with padding
      const padding = 0.2; // 20% padding around subjects
      const paddedWidth = subjectWidth * (1 + padding * 2);
      const paddedHeight = subjectHeight * (1 + padding * 2);

      let cropWidth, cropHeight;
      if (targetRatio === 1) {
        // 1:1 - square crop
        const size = Math.max(paddedWidth, paddedHeight);
        cropWidth = cropHeight = Math.min(size, imgWidth, imgHeight);
      } else {
        // 9:16 - vertical crop
        cropWidth = Math.min(paddedWidth, imgWidth);
        cropHeight = cropWidth / targetRatio;
        if (cropHeight > imgHeight) {
          cropHeight = imgHeight;
          cropWidth = cropHeight * targetRatio;
        }
      }

      let cropX = Math.max(0, subjectCenterX - cropWidth / 2);
      let cropY = Math.max(0, subjectCenterY - cropHeight / 2);

      // Ensure crop stays within bounds
      if (cropX + cropWidth > imgWidth) cropX = imgWidth - cropWidth;
      if (cropY + cropHeight > imgHeight) cropY = imgHeight - cropHeight;

      suggestions.push({
        aspectRatio: targetAspectRatio,
        x: Math.round(cropX),
        y: Math.round(cropY),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight),
        confidence: Math.min(totalScore / detections.length, 1),
        reason: `Optimized for ${detections.length} detected subject${detections.length > 1 ? 's' : ''}`
      });

      // Add alternative: rule of thirds crop
      const ruleOfThirdsCrop = getRuleOfThirdsCrop(
        subjectCenterX, 
        subjectCenterY, 
        imgWidth, 
        imgHeight, 
        targetRatio
      );
      suggestions.push({
        aspectRatio: targetAspectRatio,
        ...ruleOfThirdsCrop,
        confidence: 0.7,
        reason: "Rule of thirds composition"
      });
    }

    return suggestions;
  };

  const getCenterCropDimensions = (
    imgWidth: number, 
    imgHeight: number, 
    targetRatio: number
  ) => {
    let cropWidth, cropHeight;
    
    if (targetRatio === 1) {
      const size = Math.min(imgWidth, imgHeight);
      cropWidth = cropHeight = size;
    } else {
      cropWidth = Math.min(imgWidth, imgHeight * targetRatio);
      cropHeight = cropWidth / targetRatio;
      
      if (cropHeight > imgHeight) {
        cropHeight = imgHeight;
        cropWidth = cropHeight * targetRatio;
      }
    }

    return {
      x: Math.round((imgWidth - cropWidth) / 2),
      y: Math.round((imgHeight - cropHeight) / 2),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  };

  const getRuleOfThirdsCrop = (
    subjectX: number,
    subjectY: number,
    imgWidth: number,
    imgHeight: number,
    targetRatio: number
  ) => {
    let cropWidth, cropHeight;
    
    if (targetRatio === 1) {
      const size = Math.min(imgWidth, imgHeight) * 0.8;
      cropWidth = cropHeight = size;
    } else {
      cropWidth = imgWidth * 0.7;
      cropHeight = cropWidth / targetRatio;
    }

    // Position subject at rule of thirds intersection
    const offsetX = cropWidth / 3;
    const offsetY = cropHeight / 3;

    let cropX = Math.max(0, subjectX - offsetX);
    let cropY = Math.max(0, subjectY - offsetY);

    if (cropX + cropWidth > imgWidth) cropX = imgWidth - cropWidth;
    if (cropY + cropHeight > imgHeight) cropY = imgHeight - cropHeight;

    return {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight)
    };
  };

  const analyzImage = async () => {
    try {
      setIsAnalyzing(true);
      console.log("Loading image for analysis...");
      
      const img = await loadImage(imageUrl);
      imageRef.current = img;
      console.log(`Image loaded: ${img.width}x${img.height}`);

      // Use object detection to find subjects
      console.log("Loading object detection model...");
      let detector;
      try {
        // Try WebGPU first
        detector = await pipeline(
          'object-detection',
          'Xenova/detr-resnet-50',
          { device: 'webgpu' }
        );
      } catch (webgpuError) {
        console.log("WebGPU not available, falling back to WASM");
        // Fallback to WASM
        detector = await pipeline(
          'object-detection',
          'Xenova/detr-resnet-50'
        );
      }

      console.log("Detecting objects...");
      const detections = await detector(imageUrl, {
        threshold: 0.3,
        percentage: true
      });

      console.log("Detections:", detections);

      // Filter for people and important objects
      const importantLabels = ['person', 'face', 'dog', 'cat', 'bird', 'car', 'bottle', 'cup'];
      const filteredDetections = detections.filter((det: any) => 
        importantLabels.some(label => det.label.toLowerCase().includes(label))
      );

      console.log("Filtered detections:", filteredDetections);

      // Convert percentage-based boxes to pixel coordinates
      const pixelDetections = filteredDetections.map((det: any) => ({
        ...det,
        box: {
          xmin: det.box.xmin * img.width,
          ymin: det.box.ymin * img.height,
          xmax: det.box.xmax * img.width,
          ymax: det.box.ymax * img.height
        }
      }));

      const cropSuggestions = calculateCropSuggestions(
        pixelDetections,
        img.width,
        img.height
      );

      console.log("Crop suggestions:", cropSuggestions);
      setSuggestions(cropSuggestions);
      
      toast({
        title: "Analysis complete",
        description: `Found ${cropSuggestions.length} crop suggestion${cropSuggestions.length > 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: "Using center crop as fallback",
        variant: "destructive"
      });

      // Fallback to center crop
      const img = imageRef.current;
      if (img) {
        const targetRatio = targetAspectRatio === '1:1' ? 1 : 9/16;
        const centerCrop = getCenterCropDimensions(img.width, img.height, targetRatio);
        setSuggestions([{
          aspectRatio: targetAspectRatio,
          ...centerCrop,
          confidence: 0.5,
          reason: "Center crop (fallback)"
        }]);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyCrop = async () => {
    if (!imageRef.current || !canvasRef.current || suggestions.length === 0) return;

    setIsApplying(true);
    try {
      const suggestion = suggestions[selectedSuggestion];
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error("Cannot get canvas context");

      canvas.width = suggestion.width;
      canvas.height = suggestion.height;

      ctx.drawImage(
        imageRef.current,
        suggestion.x,
        suggestion.y,
        suggestion.width,
        suggestion.height,
        0,
        0,
        suggestion.width,
        suggestion.height
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Failed to create blob")),
          'image/jpeg',
          0.92
        );
      });

      onApplyCrop(blob);
      toast({ title: "Crop applied successfully!" });
    } catch (error) {
      console.error("Crop error:", error);
      toast({
        title: "Failed to apply crop",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsApplying(false);
    }
  };

  const drawPreview = () => {
    if (!imageRef.current || !canvasRef.current || suggestions.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const maxWidth = 500;
    const scale = Math.min(1, maxWidth / img.width);
    
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw crop overlay
    const suggestion = suggestions[selectedSuggestion];
    const x = suggestion.x * scale;
    const y = suggestion.y * scale;
    const w = suggestion.width * scale;
    const h = suggestion.height * scale;

    // Dim area outside crop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, y);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, canvas.width - (x + w), h);
    ctx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));

    // Draw crop rectangle
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Draw corner markers
    const markerSize = 20;
    ctx.fillStyle = '#10b981';
    // Top-left
    ctx.fillRect(x, y, markerSize, 3);
    ctx.fillRect(x, y, 3, markerSize);
    // Top-right
    ctx.fillRect(x + w - markerSize, y, markerSize, 3);
    ctx.fillRect(x + w - 3, y, 3, markerSize);
    // Bottom-left
    ctx.fillRect(x, y + h - 3, markerSize, 3);
    ctx.fillRect(x, y + h - markerSize, 3, markerSize);
    // Bottom-right
    ctx.fillRect(x + w - markerSize, y + h - 3, markerSize, 3);
    ctx.fillRect(x + w - 3, y + h - markerSize, 3, markerSize);
  };

  useEffect(() => {
    if (suggestions.length > 0 && imageRef.current) {
      drawPreview();
    }
  }, [suggestions, selectedSuggestion]);

  if (isAnalyzing) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-semibold">Analyzing image content...</p>
            <p className="text-sm text-muted-foreground">
              Detecting subjects and calculating optimal crop zones
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Smart Crop Suggestions</h3>
        </div>
        <Badge variant="secondary">{targetAspectRatio} aspect ratio</Badge>
      </div>

      {/* Preview */}
      <div className="relative bg-muted rounded-lg p-4 flex justify-center">
        <canvas ref={canvasRef} className="max-w-full rounded" />
      </div>

      {/* Suggestions List */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Choose a crop suggestion:</p>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => setSelectedSuggestion(index)}
            className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
              selectedSuggestion === index
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">{suggestion.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {suggestion.width}×{suggestion.height}px • 
                  Confidence: {Math.round(suggestion.confidence * 100)}%
                </p>
              </div>
              {selectedSuggestion === index && (
                <Check className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button 
          onClick={applyCrop} 
          disabled={isApplying}
          className="flex-1 gap-2"
        >
          {isApplying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Scissors className="h-4 w-4" />
              Apply Crop
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
