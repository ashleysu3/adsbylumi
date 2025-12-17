import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, Film, Image, Trash2, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export interface ProductionItem {
  id: string;
  format: "talking_head" | "broll" | "graphic";
  hook: string;
  guidance: string;
  angleName: string;
  completed: boolean;
  assetNote?: string;
}

interface ProductionChecklistPanelProps {
  items: ProductionItem[];
  onToggleComplete: (id: string) => void;
  onRemove: (id: string) => void;
  workspaceId?: string;
}

const formatIcons = {
  talking_head: Video,
  broll: Film,
  graphic: Image,
};

const formatLabels = {
  talking_head: "Record Video",
  broll: "Record / Upload B-Roll",
  graphic: "Design Graphic",
};

export function ProductionChecklistPanel({
  items,
  onToggleComplete,
  onRemove,
  workspaceId,
}: ProductionChecklistPanelProps) {
  const navigate = useNavigate();
  const completedCount = items.filter((item) => item.completed).length;
  const hasMinimumItems = items.length >= 3;
  const itemsNeeded = Math.max(0, 3 - items.length);

  // Group items by format
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.format]) {
      acc[item.format] = [];
    }
    acc[item.format].push(item);
    return acc;
  }, {} as Record<string, ProductionItem[]>);

  const handleGoToProduction = () => {
    if (workspaceId) {
      navigate(`/production?workspace=${workspaceId}`);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Production Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No items yet</p>
            <p className="text-xs mt-1">Click "Add to Checklist" on creative cells to build your production list</p>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Add at least 3 concepts to continue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Production Checklist</CardTitle>
          <Badge variant={hasMinimumItems ? "default" : "secondary"} className={hasMinimumItems ? "bg-green-500/10 text-green-600 border-green-500/20" : ""}>
            {hasMinimumItems ? (
              <><Sparkles className="h-3 w-3 mr-1" />{items.length} ready</>
            ) : (
              <>{items.length}/3 min</>
            )}
          </Badge>
        </div>
        {!hasMinimumItems && (
          <p className="text-xs text-muted-foreground mt-1">
            Add {itemsNeeded} more concept{itemsNeeded !== 1 ? 's' : ''} to unlock Production
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col">
        <ScrollArea className="flex-1 max-h-[calc(100vh-400px)]">
          <div className="px-6 pb-6 space-y-6">
            {Object.entries(groupedItems).map(([format, formatItems]) => {
              const Icon = formatIcons[format as keyof typeof formatIcons];
              return (
                <div key={format} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {formatLabels[format as keyof typeof formatLabels]}
                  </div>
                  <div className="space-y-2">
                    {formatItems.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "p-3 rounded-lg border bg-card transition-opacity",
                          item.completed && "opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => onToggleComplete(item.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "font-medium text-sm",
                                item.completed && "line-through"
                              )}
                            >
                              {item.hook}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.guidance}
                            </p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {item.angleName}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => onRemove(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* CTA Section */}
        <div className="p-4 border-t border-border mt-auto">
          <Button 
            onClick={handleGoToProduction}
            disabled={!hasMinimumItems}
            className="w-full"
            size="lg"
          >
            {hasMinimumItems ? (
              <>
                Go to Production
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              `Add ${itemsNeeded} more to continue`
            )}
          </Button>
          {hasMinimumItems && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Record videos, upload assets & approve concepts
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
