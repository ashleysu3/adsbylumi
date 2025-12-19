import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Type, 
  MessageSquare, 
  AlertCircle, 
  Check, 
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyVariation {
  text: string;
  framework: string;
  character_count?: number;
  length?: string;
}

interface AngleCopy {
  headlines: CopyVariation[];
  descriptions: CopyVariation[];
  primary_copy: CopyVariation[];
}

interface CopySelections {
  headlines: number[];
  descriptions: number[];
  primary_copy: number[];
}

interface AngleData {
  id: string;
  name: string;
  description?: string;
}

interface ProductionItem {
  id?: string;
  angle?: string;
  angleName?: string;
  concept?: {
    title?: string;
    hook?: string;
  };
  status?: string;
  linkedAsset?: {
    url?: string;
  };
  uploaded_asset_id?: string;
  finalCopy?: {
    headline?: string;
    description?: string;
    primary_text?: string;
  };
  final_copy?: {
    headline?: string;
    description?: string;
    primary_text?: string;
  };
}

interface PreBuildCopySummaryProps {
  creativeJson?: {
    angles?: AngleData[];
    angleCopy?: Record<string, AngleCopy>;
    copy_selections?: Record<string, CopySelections>;
  };
  productionItems?: ProductionItem[];
}

export function PreBuildCopySummary({ creativeJson, productionItems = [] }: PreBuildCopySummaryProps) {
  const [expandedAngles, setExpandedAngles] = useState<Set<string>>(new Set());

  const angles = creativeJson?.angles || [];
  const angleCopy = creativeJson?.angleCopy || {};
  const copySelections = creativeJson?.copy_selections || {};

  // Get ready concepts (approved with asset)
  const readyConcepts = productionItems.filter((item) => {
    const hasAsset = item.linkedAsset?.url || item.uploaded_asset_id;
    return item.status === 'approved' && hasAsset;
  });

  // Group ready concepts by angle
  const conceptsByAngle: Record<string, ProductionItem[]> = {};
  readyConcepts.forEach((item) => {
    const angleId = item.angle || 'unknown';
    if (!conceptsByAngle[angleId]) {
      conceptsByAngle[angleId] = [];
    }
    conceptsByAngle[angleId].push(item);
  });

  // Get angles that have production items
  const activeAngleIds = Object.keys(conceptsByAngle);

  const toggleAngle = (angleId: string) => {
    setExpandedAngles((prev) => {
      const next = new Set(prev);
      if (next.has(angleId)) {
        next.delete(angleId);
      } else {
        next.add(angleId);
      }
      return next;
    });
  };

  const getSelectedCopy = (angleId: string, type: keyof AngleCopy) => {
    const selections = copySelections[angleId];
    const copy = angleCopy[angleId];
    
    if (!copy || !copy[type]) return [];
    
    const typeKey = type as keyof CopySelections;
    const selectedIndices = selections?.[typeKey] || [];
    
    if (selectedIndices.length === 0) {
      // No selections = all will be used
      return copy[type];
    }
    
    return selectedIndices.map((idx) => copy[type][idx]).filter(Boolean);
  };

  const hasAnySelections = (angleId: string) => {
    const selections = copySelections[angleId];
    if (!selections) return false;
    return (
      (selections.headlines?.length || 0) > 0 ||
      (selections.descriptions?.length || 0) > 0 ||
      (selections.primary_copy?.length || 0) > 0
    );
  };

  const hasCopyGenerated = (angleId: string) => {
    const copy = angleCopy[angleId];
    return copy && (
      (copy.headlines?.length || 0) > 0 ||
      (copy.descriptions?.length || 0) > 0 ||
      (copy.primary_copy?.length || 0) > 0
    );
  };

  if (readyConcepts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Copy That Will Be Used
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This is the ad copy that will be uploaded for each angle. Selected variations are highlighted.
        </p>

        {activeAngleIds.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No ads ready to publish. Approve concepts and add assets first.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {activeAngleIds.map((angleId) => {
              const angle = angles.find((a) => a.id === angleId);
              const angleName = angle?.name || conceptsByAngle[angleId]?.[0]?.angleName || 'Unknown Angle';
              const conceptCount = conceptsByAngle[angleId]?.length || 0;
              const isExpanded = expandedAngles.has(angleId);
              const hasSelections = hasAnySelections(angleId);
              const hasCopy = hasCopyGenerated(angleId);

              const headlines = getSelectedCopy(angleId, 'headlines');
              const descriptions = getSelectedCopy(angleId, 'descriptions');
              const primaryCopy = getSelectedCopy(angleId, 'primary_copy');

              return (
                <div
                  key={angleId}
                  className={cn(
                    "border rounded-lg overflow-hidden",
                    hasSelections ? "border-primary/30" : "border-border"
                  )}
                >
                  {/* Angle header */}
                  <button
                    onClick={() => toggleAngle(angleId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-medium">{angleName}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {conceptCount} ad{conceptCount !== 1 ? 's' : ''}
                      </Badge>
                      {hasSelections && (
                        <Badge className="text-xs gap-1 bg-primary">
                          <Check className="h-3 w-3" />
                          Selected
                        </Badge>
                      )}
                      {!hasCopy && (
                        <Badge variant="destructive" className="text-xs">
                          No copy
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4 space-y-4">
                      {!hasCopy ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No copy generated for this angle. Ads will use item-level copy if available.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          {!hasSelections && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                No selections made — all variations will be available for these ads.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Headlines */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Type className="h-4 w-4 text-primary" />
                              Headlines ({headlines.length})
                            </div>
                            <div className="pl-6 space-y-1">
                              {headlines.slice(0, 3).map((h, i) => (
                                <div key={i} className="text-sm p-2 bg-background rounded border">
                                  <span className="font-medium">{h.text}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {h.framework}
                                  </Badge>
                                </div>
                              ))}
                              {headlines.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{headlines.length - 3} more
                                </p>
                              )}
                            </div>
                          </div>

                          <Separator />

                          {/* Descriptions */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <FileText className="h-4 w-4 text-primary" />
                              Descriptions ({descriptions.length})
                            </div>
                            <div className="pl-6 space-y-1">
                              {descriptions.slice(0, 2).map((d, i) => (
                                <div key={i} className="text-sm p-2 bg-background rounded border">
                                  <span>{d.text}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {d.framework}
                                  </Badge>
                                </div>
                              ))}
                              {descriptions.length > 2 && (
                                <p className="text-xs text-muted-foreground">
                                  +{descriptions.length - 2} more
                                </p>
                              )}
                            </div>
                          </div>

                          <Separator />

                          {/* Primary Copy */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              Primary Copy ({primaryCopy.length})
                            </div>
                            <div className="pl-6 space-y-1">
                              {primaryCopy.slice(0, 2).map((p, i) => (
                                <div key={i} className="text-sm p-2 bg-background rounded border">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {p.framework}
                                    </Badge>
                                    {p.length && (
                                      <Badge variant="secondary" className="text-xs capitalize">
                                        {p.length}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground line-clamp-2">{p.text}</p>
                                </div>
                              ))}
                              {primaryCopy.length > 2 && (
                                <p className="text-xs text-muted-foreground">
                                  +{primaryCopy.length - 2} more
                                </p>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Ads using this angle */}
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Ads using this copy:</p>
                        <div className="grid gap-2">
                          {conceptsByAngle[angleId]?.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-background rounded border text-sm">
                              <span className="truncate">{item.concept?.title || 'Untitled'}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Ready
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
