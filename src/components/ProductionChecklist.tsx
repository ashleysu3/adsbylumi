import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RefreshCw, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  completed: boolean;
  notes?: string;
  details?: string[];
  expanded?: boolean;
}

interface ProductionChecklistProps {
  workspace: any;
  onUpdate: (updates: any) => Promise<void>;
}

export function ProductionChecklist({ workspace, onUpdate }: ProductionChecklistProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    workspace.production_checklist || generateInitialChecklist(workspace.creative_json)
  );

  const toggleItem = async (itemId: string) => {
    const updated = checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    await onUpdate({ production_checklist: updated });
  };

  const updateNotes = async (itemId: string, notes: string) => {
    const updated = checklist.map(item =>
      item.id === itemId ? { ...item, notes } : item
    );
    setChecklist(updated);
    await onUpdate({ production_checklist: updated });
  };

  const toggleExpanded = (itemId: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const regenerateItem = async (itemId: string) => {
    toast.info("Regenerating suggestions...");
    // This would call an edge function to regenerate specific creative elements
    setTimeout(() => {
      toast.success("New suggestions generated!");
    }, 1500);
  };

  const categories = Array.from(new Set(checklist.map(item => item.category)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Production Checklist</CardTitle>
          <CardDescription>
            Everything you need to produce and finalize your campaign creative
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map(category => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  {category}
                  <Badge variant="secondary">
                    {checklist.filter(i => i.category === category && i.completed).length}/
                    {checklist.filter(i => i.category === category).length}
                  </Badge>
                </h3>
                <div className="space-y-3">
                  {checklist
                    .filter(item => item.category === category)
                    .map(item => (
                      <Card key={item.id} className="border-l-4 border-l-primary/20">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className={`font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                                  {item.title}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => regenerateItem(item.id)}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleExpanded(item.id)}
                                  >
                                    {item.expanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>

                              {item.expanded && item.details && (
                                <div className="mt-3 p-3 bg-secondary/20 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Lightbulb className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-medium">Production Tips</p>
                                  </div>
                                  <ul className="text-sm space-y-1 list-disc list-inside">
                                    {item.details.map((detail, idx) => (
                                      <li key={idx}>{detail}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <Textarea
                                placeholder="Add your notes..."
                                value={item.notes || ""}
                                onChange={(e) => updateNotes(item.id, e.target.value)}
                                className="mt-2"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function generateInitialChecklist(creativeJson: any): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  if (creativeJson?.hooks) {
    items.push({
      id: "hooks",
      category: "📹 To Record",
      title: "Film all hook variations",
      description: `Record ${creativeJson.hooks.length} different hooks for A/B testing`,
      completed: false,
      details: [
        "Film in 9:16 vertical format",
        "Keep each hook under 3 seconds",
        "Use good lighting and clear audio",
        "Film multiple takes of each hook",
      ],
    });
  }

  if (creativeJson?.scripts) {
    items.push({
      id: "scripts",
      category: "📹 To Record",
      title: "Record talking head scripts",
      description: `Film ${creativeJson.scripts.length} script variations`,
      completed: false,
      details: [
        "Target 30-60 seconds per video",
        "Maintain eye contact with camera",
        "Use a lapel mic for clear audio",
        "Keep energy high and authentic",
      ],
    });
  }

  if (creativeJson?.broll) {
    items.push({
      id: "broll",
      category: "📹 To Record",
      title: "Capture B-roll footage",
      description: "Film all suggested B-roll shots",
      completed: false,
      details: [
        "Shoot in 4K for quality",
        "Film more than you need",
        "Get various angles and movements",
        "Match lighting to main footage",
      ],
    });
  }

  if (creativeJson?.static_copy || creativeJson?.graphics) {
    items.push({
      id: "graphics",
      category: "🎨 To Design",
      title: "Create static graphics",
      description: "Design all static ad graphics",
      completed: false,
      details: [
        "Export in 1080x1080 and 1080x1920",
        "Use brand colors and fonts",
        "Keep text readable on mobile",
        "Include clear CTA",
      ],
    });
  }

  if (creativeJson?.carousels) {
    items.push({
      id: "carousels",
      category: "🎨 To Design",
      title: "Design carousel ads",
      description: `Create ${creativeJson.carousels.length} carousel variations`,
      completed: false,
      details: [
        "Each card should be 1080x1080",
        "Maximum 10 cards per carousel",
        "First card must grab attention",
        "Last card should have strong CTA",
      ],
    });
  }

  items.push({
    id: "edit",
    category: "✂️ Post-Production",
    title: "Edit final videos",
    description: "Combine footage with overlays and captions",
    completed: false,
    details: [
      "Add text overlays from creative brief",
      "Include captions for accessibility",
      "Export as MP4, H.264 codec",
      "Target file size under 30MB",
    ],
  });

  items.push({
    id: "formats",
    category: "✂️ Post-Production",
    title: "Export all required formats",
    description: "Create 9:16, 4:5, and 1:1 versions",
    completed: false,
    details: [
      "9:16 (1080x1920) for Stories/Reels",
      "4:5 (1080x1350) for Feed",
      "1:1 (1080x1080) for multi-placement",
      "Test on multiple devices",
    ],
  });

  return items;
}