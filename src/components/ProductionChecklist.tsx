import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Heart, Film } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { VideoTextPreview, DEFAULT_OVERLAY_STYLE } from "@/components/VideoTextPreview";
import type { OverlayStyle, TextOverlay } from "@/components/VideoTextPreview";

interface BRollClip {
  id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  tags?: string[];
}

interface ProductionChecklistProps {
  workspace: any;
  onUpdate: (updates: any) => void;
  brand?: any;
}

export function ProductionChecklist({ workspace, onUpdate, brand }: ProductionChecklistProps) {
  const navigate = useNavigate();
  const [productionItems, setProductionItems] = useState<any[]>([]);
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [readyForProduction, setReadyForProduction] = useState<Set<string>>(new Set());
  const [clipAssignments, setClipAssignments] = useState<Record<string, string>>({});

  const brollClips: BRollClip[] = (brand as any)?.broll_library || [];
  const overlayStyle: OverlayStyle = (brand as any)?.overlay_style || DEFAULT_OVERLAY_STYLE;

  useEffect(() => {
    initializeProductionItems();
  }, [workspace]);

  const initializeProductionItems = async () => {
    if (!workspace?.loved_concepts || !workspace?.creative_json) return;

    const existingItems = workspace.production_items || [];
    const lovedConceptIds = workspace.loved_concepts || [];
    const creativeMix = workspace.creative_json?.creative_mix || {};

    // Create production items for each loved concept
    const items: any[] = [];

    ["tofu", "mofu", "bofu"].forEach((stage) => {
      const stageConcepts = creativeMix[stage] || [];
      stageConcepts.forEach((concept: any) => {
        const conceptId = `${stage}-${concept.id || items.length}`;
        if (lovedConceptIds.includes(conceptId)) {
          // Check if item already exists
          let existingItem = existingItems.find((item: any) => item.concept_id === conceptId);
          
          if (!existingItem) {
            existingItem = {
              id: `prod-${Date.now()}-${items.length}`,
              concept_id: conceptId,
              concept: concept,
              stage: stage.toUpperCase(),
              format: concept.format || "talking_head",
              status: "pending",
              production_notes: "",
              created_at: new Date().toISOString(),
            };
          }
          
          items.push(existingItem);
        }
      });
    });

    setProductionItems(items);

    // Initialize ready set from existing items
    const ready = new Set(
      items.filter((item) => item.status === "ready").map((item) => item.id)
    );
    setReadyForProduction(ready);

    // Auto-assign b-roll clips (round-robin)
    if (brollClips.length > 0) {
      const brollItems = items.filter((i) => i.format === "broll");
      const assignments: Record<string, string> = {};
      brollItems.forEach((item, idx) => {
        const existing = item.assigned_clip_id;
        if (existing && brollClips.find((c) => c.id === existing)) {
          assignments[item.id] = existing;
        } else {
          assignments[item.id] = brollClips[idx % brollClips.length].id;
        }
      });
      setClipAssignments(assignments);
    }
  };

  const toggleExpanded = (conceptId: string) => {
    const newExpanded = new Set(expandedConcepts);
    if (newExpanded.has(conceptId)) {
      newExpanded.delete(conceptId);
    } else {
      newExpanded.add(conceptId);
    }
    setExpandedConcepts(newExpanded);
  };

  const updateProductionNotes = (itemId: string, notes: string) => {
    const updatedItems = productionItems.map((item) =>
      item.id === itemId ? { ...item, production_notes: notes } : item
    );
    setProductionItems(updatedItems);
  };

  const toggleReadyForProduction = async (itemId: string) => {
    const newReady = new Set(readyForProduction);
    const item = productionItems.find((i) => i.id === itemId);
    
    if (newReady.has(itemId)) {
      newReady.delete(itemId);
      item.status = "pending";
    } else {
      newReady.add(itemId);
      item.status = "ready";
    }
    
    setReadyForProduction(newReady);
    
    const updatedItems = productionItems.map((i) =>
      i.id === itemId ? item : i
    );
    setProductionItems(updatedItems);
    
    // Save to database
    await supabase
      .from("campaign_workspaces")
      .update({ production_items: updatedItems })
      .eq("id", workspace.id);
      
    onUpdate({ production_items: updatedItems });
  };

  const handleSendToProduction = async () => {
    const readyItems = productionItems.filter((item) => readyForProduction.has(item.id));
    
    if (readyItems.length < 3) {
      toast.error("Please mark at least 3 concepts as ready for production");
      return;
    }

    await supabase
      .from("campaign_workspaces")
      .update({ production_items: productionItems })
      .eq("id", workspace.id);

    toast.success(`Sending ${readyItems.length} concepts to Production Dashboard`);
    navigate("/production");
  };

  const groupedItems = productionItems.reduce((acc: any, item: any) => {
    if (!acc[item.stage]) {
      acc[item.stage] = [];
    }
    acc[item.stage].push(item);
    return acc;
  }, {});

  const stageLabels: Record<string, string> = {
    TOFU: "TOFU - Awareness Stage",
    MOFU: "MOFU - Consideration Stage",
    BOFU: "BOFU - Conversion Stage",
  };

  const formatLabels: Record<string, string> = {
    talking_head: "Talking Head",
    broll: "B-Roll",
    static: "Static Image",
    carousel: "Carousel",
  };

  if (productionItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Loved Concepts Yet</h3>
          <p className="text-muted-foreground mb-4">
            Click "Love It" on concepts in the creative dashboard to add them to your production checklist
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                📋 Production Checklist
                <Badge variant="secondary">{productionItems.length} Concepts</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Review your loved concepts and add production notes before sending to production
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary">
              {readyForProduction.size}/{productionItems.length} Ready
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Grouped Concepts by Stage */}
      {Object.entries(groupedItems).map(([stage, items]: [string, any]) => (
        <Card key={stage}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {stageLabels[stage] || stage}
              <Badge variant="outline">{items.length} concepts</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item: any) => {
              const isExpanded = expandedConcepts.has(item.id);
              const isReady = readyForProduction.has(item.id);

              return (
                <Card key={item.id} className={`${isReady ? "border-primary" : ""}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Title & Format */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.concept?.title || "Untitled Concept"}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {formatLabels[item.format] || item.format}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {isReady ? "✓ Ready" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Expandable Section */}
                    {isExpanded && (
                      <div className="space-y-3 border-t pt-3">
                        {/* Original Concept Details */}
                        {item.concept?.hook && (
                          <div className="bg-muted/30 rounded p-3 text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Hook</p>
                            <p>{item.concept.hook}</p>
                          </div>
                        )}
                        {item.concept?.script && (
                          <div className="bg-muted/30 rounded p-3 text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Script Preview</p>
                            <p className="line-clamp-3 whitespace-pre-wrap">{item.concept.script}</p>
                          </div>
                        )}
                        {item.concept?.primary_copy && (
                          <div className="bg-muted/30 rounded p-3 text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Primary Copy</p>
                            <p className="line-clamp-2">{item.concept.primary_copy}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* B-Roll Video Preview */}
                    {item.format === "broll" && (
                      <div className="space-y-3 border-t pt-3">
                        {brollClips.length > 0 ? (() => {
                          const assignedClipId = clipAssignments[item.id];
                          const assignedClip = brollClips.find((c) => c.id === assignedClipId);
                          const textOverlays: TextOverlay[] = (item.text_overlays || item.concept?.text_overlays || []).map((o: any) =>
                            typeof o === "string" ? { text: o } : o
                          );

                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  <Film className="h-4 w-4" />
                                  B-Roll Preview
                                </p>
                                <Select
                                  value={assignedClipId || ""}
                                  onValueChange={(v) => setClipAssignments((prev) => ({ ...prev, [item.id]: v }))}
                                >
                                  <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <SelectValue placeholder="Swap clip" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {brollClips.map((clip) => (
                                      <SelectItem key={clip.id} value={clip.id}>
                                        {clip.file_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {assignedClip && textOverlays.length > 0 && (
                                <VideoTextPreview
                                  videoUrl={assignedClip.file_url}
                                  overlays={textOverlays}
                                  style={overlayStyle}
                                  compact
                                />
                              )}
                              {assignedClip && textOverlays.length === 0 && (
                                <div className="rounded-lg overflow-hidden">
                                  <video
                                    src={assignedClip.file_url}
                                    className="w-full aspect-[9/16] max-h-[300px] object-cover rounded-lg"
                                    controls
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <Film className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Upload b-roll clips in <span className="font-medium">My Brand</span> to see previews here
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Production Notes */}
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${item.id}`} className="text-sm font-medium">
                        Your Production Notes
                      </Label>
                      <Textarea
                        id={`notes-${item.id}`}
                        placeholder="Add notes for recording/designing this concept (e.g., 'Use ring light, film at golden hour, wear blue shirt')"
                        value={item.production_notes || ""}
                        onChange={(e) => updateProductionNotes(item.id, e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    {/* Mark Ready Checkbox */}
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id={`ready-${item.id}`}
                        checked={isReady}
                        onCheckedChange={() => toggleReadyForProduction(item.id)}
                      />
                      <Label
                        htmlFor={`ready-${item.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        Mark as ready for production
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
                        )}
      {/* Send to Production Button */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold mb-1">Ready to produce your concepts?</h4>
              <p className="text-sm text-muted-foreground">
                {readyForProduction.size >= 3
                  ? "You've marked enough concepts. Send them to production to start creating!"
                  : `Mark at least 3 concepts as ready (currently: ${readyForProduction.size})`}
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleSendToProduction}
              disabled={readyForProduction.size < 3}
            >
              Send to Production →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
