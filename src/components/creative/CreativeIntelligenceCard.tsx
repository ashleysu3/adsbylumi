import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, BarChart3, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreativeIntelligence {
  hasData: boolean;
  summary: string;
  topFormats?: string[];
  keyPatterns?: string[];
  adsAnalyzed?: number;
  dateRange?: string;
  recommendations?: string[];
}

interface CreativeIntelligenceCardProps {
  intelligence: CreativeIntelligence;
}

export function CreativeIntelligenceCard({ intelligence }: CreativeIntelligenceCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!intelligence.hasData) {
    return (
      <Card className="rounded-2xl border-dashed border-primary/20 bg-primary/5">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">First campaign — testing mode</p>
              <p className="text-xs text-muted-foreground">
                We'll generate a balanced mix of formats to test what resonates with your audience.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="py-4 px-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                Based on your last 90 days
                {intelligence.adsAnalyzed && (
                  <Badge variant="secondary" className="text-[10px]">
                    {intelligence.adsAnalyzed} ads analyzed
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{intelligence.summary}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Key patterns as badges */}
        {intelligence.topFormats && intelligence.topFormats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {intelligence.topFormats.map((fmt, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/20">
                <TrendingUp className="h-3 w-3 mr-1" />
                {fmt}
              </Badge>
            ))}
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            {intelligence.keyPatterns && intelligence.keyPatterns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Key patterns</p>
                <ul className="space-y-1">
                  {intelligence.keyPatterns.map((pattern, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {intelligence.recommendations && intelligence.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Recommendations for this round</p>
                <ul className="space-y-1">
                  {intelligence.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
