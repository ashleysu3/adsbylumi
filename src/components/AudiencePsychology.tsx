import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, ChevronDown, RefreshCw, Loader2, Users, Heart, AlertCircle, Zap } from "lucide-react";

interface AudiencePsychologyProps {
  brandId: string;
  psychology: any;
  status: string;
  onUpdate: () => void;
}

export function AudiencePsychology({ brandId, psychology, status, onUpdate }: AudiencePsychologyProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    toast.info("Generating audience psychology profile...");

    try {
      const { error } = await supabase.functions.invoke('generate-audience-psychology', {
        body: { brandId }
      });

      if (error) throw error;

      toast.success("Audience psychology generated successfully");
      setTimeout(() => onUpdate(), 2000);
    } catch (error: any) {
      console.error('Error generating psychology:', error);
      toast.error("Failed to generate audience psychology");
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'generating':
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating...</Badge>;
      case 'completed':
        return <Badge variant="default">Ready</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  if (!psychology && status !== 'completed') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <CardTitle>Audience Psychology</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
          <CardDescription>
            Generate a deep psychological profile of your target audience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate} disabled={generating || status === 'generating'}>
            {generating || status === 'generating' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>Audience Psychology</CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            Deep psychological insights about your target audience
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {psychology?.demographics && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Demographics</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{psychology.demographics}</p>
              </div>
            )}

            {psychology?.psychographics && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Psychographics</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{psychology.psychographics}</p>
              </div>
            )}

            {psychology?.pain_points && psychology.pain_points.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Pain Points</h4>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {psychology.pain_points.map((point: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {psychology?.desires && psychology.desires.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Desires</h4>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {psychology.desires.map((desire: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{desire}</li>
                  ))}
                </ul>
              </div>
            )}

            {psychology?.objections && psychology.objections.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Objections</h4>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {psychology.objections.map((objection: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{objection}</li>
                  ))}
                </ul>
              </div>
            )}

            {psychology?.motivations && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Motivations</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{psychology.motivations}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
