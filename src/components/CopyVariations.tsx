import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Sparkles, Info } from "lucide-react";
import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface Variation {
  variation_name: string;
  headline: string;
  primary_text: string;
  description: string;
  call_to_action: string;
  framework_used: string;
  why_this_angle: string;
  best_for: string;
}

interface CopyVariationsProps {
  variations: Variation[];
  onSelect: (variation: Variation) => void;
  onCancel: () => void;
  currentCopy?: {
    headline: string;
    primary_text: string;
  };
}

const ctaLabels: Record<string, string> = {
  LEARN_MORE: "Learn More",
  SIGN_UP: "Sign Up",
  SHOP_NOW: "Shop Now",
  GET_QUOTE: "Get Quote",
  BOOK_NOW: "Book Now",
  DOWNLOAD: "Download",
  WATCH_MORE: "Watch More",
  APPLY_NOW: "Apply Now",
};

export function CopyVariations({ variations, onSelect, onCancel, currentCopy }: CopyVariationsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Choose Your Copy Variation
          </h3>
          <p className="text-sm text-muted-foreground">
            Each option uses a different proven framework from your Knowledge Base
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <Tabs defaultValue="0" className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${variations.length}, 1fr)` }}>
          {variations.map((variation, index) => (
            <TabsTrigger 
              key={index} 
              value={index.toString()}
              onClick={() => setSelectedIndex(index)}
            >
              Option {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {variations.map((variation, index) => (
          <TabsContent key={index} value={index.toString()} className="space-y-4">
            <Card className="border-2 border-primary/20">
              <CardContent className="pt-6 space-y-4">
                {/* Framework Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      {variation.framework_used}
                    </Badge>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Why This Angle Works</h4>
                          <p className="text-sm text-muted-foreground">{variation.why_this_angle}</p>
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground">Best For:</p>
                            <p className="text-xs text-muted-foreground">{variation.best_for}</p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  {selectedIndex === index && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* Ad Preview */}
                <div className="bg-muted/50 rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      B
                    </div>
                    <div>
                      <div className="font-semibold text-xs">Your Brand</div>
                      <div className="text-xs text-muted-foreground">Sponsored</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm">{variation.primary_text}</p>
                    
                    <div className="bg-muted h-32 rounded flex items-center justify-center text-xs text-muted-foreground">
                      [Your Creative]
                    </div>
                    
                    <div className="space-y-1">
                      <div className="font-semibold text-sm">{variation.headline}</div>
                      <div className="text-xs text-muted-foreground">{variation.description}</div>
                    </div>
                    
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      {ctaLabels[variation.call_to_action] || "Learn More"}
                    </Button>
                  </div>
                </div>

                {/* Character Counts */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Headline</div>
                    <div className={variation.headline.length > 40 ? "text-destructive font-semibold" : "text-foreground"}>
                      {variation.headline.length}/40
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Primary Text</div>
                    <div className="text-foreground">{variation.primary_text.length} chars</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Description</div>
                    <div className={variation.description.length > 30 ? "text-destructive font-semibold" : "text-foreground"}>
                      {variation.description.length}/30
                    </div>
                  </div>
                </div>

                {/* Select Button */}
                <Button 
                  className="w-full gap-2" 
                  onClick={() => onSelect(variation)}
                  variant={selectedIndex === index ? "default" : "outline"}
                >
                  {selectedIndex === index ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Use This Variation
                    </>
                  ) : (
                    "Select This Option"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Comparison View */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-3 text-sm">Quick Comparison</h4>
          <div className="space-y-2">
            {variations.map((variation, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedIndex === index 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-background hover:bg-muted/50'
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">Option {index + 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {variation.framework_used}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {variation.headline}
                    </p>
                  </div>
                  {selectedIndex === index && (
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
