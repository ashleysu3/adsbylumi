import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Image, Sparkle, LayoutGrid } from "lucide-react";
import { useState } from "react";

interface DesignGuideProps {
  concept: any;
  onComplete: () => void;
  onBack: () => void;
}

export function DesignGuide({ concept = {}, onComplete, onBack }: DesignGuideProps) {
  const [checklist, setChecklist] = useState({
    dimensions: false,
    fonts: false,
    colors: false,
    elements: false,
  });

  const allChecked = Object.values(checklist).every((v) => v);

  const isCarousel = concept.format === "carousel";
  const Icon = isCarousel ? LayoutGrid : Image;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Icon className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Design Checklist</h2>
          <p className="text-muted-foreground">
            {isCarousel ? "Carousel Ad" : "Static Image Ad"}
          </p>
        </div>
      </div>

      {/* Design Checklist */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg">Before You Design</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="dimensions"
              checked={checklist.dimensions}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, dimensions: checked as boolean })
              }
            />
            <Label htmlFor="dimensions" className="cursor-pointer">
              Set up canvas: 1080x1080px (square) or 1080x1920px (story)
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="fonts"
              checked={checklist.fonts}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, fonts: checked as boolean })
              }
            />
            <Label htmlFor="fonts" className="cursor-pointer">
              Use large, readable fonts (minimum 40pt for headlines)
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="colors"
              checked={checklist.colors}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, colors: checked as boolean })
              }
            />
            <Label htmlFor="colors" className="cursor-pointer">
              Use high-contrast colors (dark text on light bg or vice versa)
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="elements"
              checked={checklist.elements}
              onCheckedChange={(checked) =>
                setChecklist({ ...checklist, elements: checked as boolean })
              }
            />
            <Label htmlFor="elements" className="cursor-pointer">
              Keep text under 20% of image area (Meta requirement)
            </Label>
          </div>
        </div>
      </Card>

      {/* Layout Guide */}
      {concept.static_layout && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold text-lg">Layout Structure</h3>
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
            {typeof concept.static_layout === "string" ? (
              <p className="whitespace-pre-wrap">{concept.static_layout}</p>
            ) : (
              <>
                {concept.static_layout.headline_text && (
                  <div>
                    <span className="font-semibold text-primary">Headline:</span>
                    <p className="mt-1">{concept.static_layout.headline_text}</p>
                  </div>
                )}
                {concept.static_layout.sub_headline_text && (
                  <div>
                    <span className="font-semibold text-primary">Sub-headline:</span>
                    <p className="mt-1">{concept.static_layout.sub_headline_text}</p>
                  </div>
                )}
                {concept.static_layout.body_text_section && (
                  <div>
                    <span className="font-semibold text-primary">Body Text:</span>
                    <p className="mt-1">{concept.static_layout.body_text_section}</p>
                  </div>
                )}
                {concept.static_layout.call_to_action && (
                  <div>
                    <span className="font-semibold text-primary">CTA:</span>
                    <p className="mt-1">{concept.static_layout.call_to_action}</p>
                  </div>
                )}
                {concept.static_layout.background_visual && (
                  <div>
                    <span className="font-semibold text-primary">Visual Element:</span>
                    <p className="mt-1">{concept.static_layout.background_visual}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Carousel Structure */}
      {isCarousel && concept.carousel_structure?.slides && (
        <Card className="p-6 space-y-3">
          <h3 className="font-semibold text-lg">
            Carousel Slides ({concept.carousel_structure.slides.length})
          </h3>
          <div className="space-y-4">
            {concept.carousel_structure.slides.map((slide: any, index: number) => (
              <div key={index} className="bg-muted/50 rounded-lg p-4">
                <div className="font-semibold text-sm mb-2">Slide {index + 1}</div>
                {slide.visual && (
                  <p className="text-sm">
                    <span className="text-primary">Visual:</span> {slide.visual}
                  </p>
                )}
                {slide.text && (
                  <p className="text-sm mt-1">
                    <span className="text-primary">Text:</span> {slide.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pro Tips */}
      <Card className="p-6 space-y-3 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2">
          <Sparkle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Pro Tips</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground ml-7">
          <li>• Use tools like Canva, Figma, or Adobe Express</li>
          <li>• Test multiple color variations to see what performs best</li>
          <li>• Add subtle drop shadows to make text pop</li>
          {isCarousel && <li>• Design the first slide to be the most eye-catching</li>}
          <li>• Export as PNG or JPG at highest quality</li>
          <li>• Mobile-first: ensure it looks good on small screens</li>
        </ul>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onComplete} disabled={!allChecked}>
          Mark as Designed →
        </Button>
      </div>
    </div>
  );
}
