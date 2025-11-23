import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Copy, 
  RefreshCw, 
  HelpCircle, 
  Sparkles, 
  ChevronDown,
  Video,
  Image as ImageIcon,
  FileText,
  Layers
} from "lucide-react";
import { toast } from "sonner";

interface CreativeAssetsProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

const formatIcons = {
  talking_head: Video,
  b_roll: Video,
  carousel: Layers,
  static: ImageIcon,
  script: FileText,
  overlay: FileText,
};

const stageColors = {
  tofu: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
  mofu: "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400",
  bofu: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
};

export function CreativeAssets({ workspace, onUpdate }: CreativeAssetsProps) {
  const creative = workspace.creative_json || {};
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [activeStage, setActiveStage] = useState<string>("tofu");

  const toggleConcept = (conceptId: string) => {
    setExpandedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleExpand = (conceptId: string, action: string) => {
    toast.info(`${action}...`);
    // Future: Call edge function to regenerate/expand
  };

  if (!creative || Object.keys(creative).length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No creative assets generated yet</p>
            <Button onClick={() => window.location.href = `/creative?workspace=${workspace.id}`}>
              Generate Creative
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const creativeMix = creative.creative_mix || {};
  const tofuCreative = creativeMix.tofu || [];
  const mofuCreative = creativeMix.mofu || [];
  const bofuCreative = creativeMix.bofu || [];

  const allStages = [
    { id: "tofu", label: "TOFU (Awareness)", items: tofuCreative, color: "border-blue-500" },
    { id: "mofu", label: "MOFU (Consideration)", items: mofuCreative, color: "border-purple-500" },
    { id: "bofu", label: "BOFU (Conversion)", items: bofuCreative, color: "border-green-500" },
  ];

  const renderConcept = (concept: any, index: number, stage: string) => {
    const conceptId = `${stage}-${index}`;
    const isExpanded = expandedConcepts.has(conceptId);
    const FormatIcon = formatIcons[concept.format as keyof typeof formatIcons] || FileText;

    return (
      <Card key={conceptId} className={`border-l-4 ${stage === 'tofu' ? 'border-l-blue-500' : stage === 'mofu' ? 'border-l-purple-500' : 'border-l-green-500'}`}>
        <Collapsible open={isExpanded} onOpenChange={() => toggleConcept(conceptId)}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FormatIcon className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-base">{concept.title}</h4>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={stageColors[stage as keyof typeof stageColors]}>
                    {stage.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary">{concept.format}</Badge>
                  {concept.angle && (
                    <Badge variant="outline" className="bg-accent/50">
                      {concept.angle}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleExpand(conceptId, "Regenerating")}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <CollapsibleTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {concept.script && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Script</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(concept.script, "Script")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                    {concept.script}
                  </p>
                </div>
              )}

              {concept.overlay_text && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Overlay Text</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md">{concept.overlay_text}</p>
                </div>
              )}

              {concept.broll_instructions && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">B-Roll Instructions</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                    {concept.broll_instructions}
                  </p>
                </div>
              )}

              {concept.carousel_structure && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Carousel Structure</p>
                  <div className="text-sm bg-muted/30 p-3 rounded-md">
                    {typeof concept.carousel_structure === 'string' 
                      ? concept.carousel_structure 
                      : JSON.stringify(concept.carousel_structure, null, 2)}
                  </div>
                </div>
              )}

              {concept.static_layout && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Static Layout</p>
                  <p className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                    {concept.static_layout}
                  </p>
                </div>
              )}

              {concept.psychology_trigger && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Psychology Trigger</p>
                  <p className="text-sm text-primary bg-primary/5 p-3 rounded-md">
                    {concept.psychology_trigger}
                  </p>
                </div>
              )}

              {concept.why_it_works && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Why This Works</p>
                  <p className="text-sm bg-accent/10 p-3 rounded-md">
                    {concept.why_it_works}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExpand(conceptId, "Getting more options")}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  More Options
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExpand(conceptId, "Expanding this idea")}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Expand Idea
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-sm">Funnel Stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {allStages.map((stage) => (
              <Button
                key={stage.id}
                variant={activeStage === stage.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveStage(stage.id)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm">{stage.label}</span>
                  <Badge variant="secondary" className="ml-2">
                    {stage.items.length}
                  </Badge>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          <div className="space-y-6 pr-4">
            {allStages
              .filter(stage => activeStage === "all" || stage.id === activeStage)
              .map((stage) => (
                <div key={stage.id}>
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-1">{stage.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stage.id === "tofu" && "Awareness stage: Hooks and curiosity-driven creative"}
                      {stage.id === "mofu" && "Consideration stage: Story, proof, and authority"}
                      {stage.id === "bofu" && "Conversion stage: Clear offers and calls-to-action"}
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {stage.items.length > 0 ? (
                      stage.items.map((concept: any, index: number) => 
                        renderConcept(concept, index, stage.id)
                      )
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No {stage.id.toUpperCase()} creative generated yet
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}