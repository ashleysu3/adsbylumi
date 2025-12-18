import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Film, Image, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreativeCellData {
  id: string;
  format: "talking_head" | "broll" | "graphic";
  hook: string;
  guidance: string;
  row: "attention" | "trust" | "action";
  angleId: string;
}

interface CreativeCellProps {
  cell: CreativeCellData;
  isSelected: boolean;
  onToggle: (cellId: string) => void;
  onAddToChecklist?: (cellId: string) => void;
  onRegenerate?: (cellId: string) => void;
  isInChecklist?: boolean;
  isRegenerating?: boolean;
}

const formatIcons = {
  talking_head: Video,
  broll: Film,
  graphic: Image,
};

const formatLabels = {
  talking_head: "Talking Head",
  broll: "B-Roll / Lofi Video",
  graphic: "Graphic / Static",
};

export function CreativeCell({ 
  cell, 
  isSelected, 
  onToggle, 
  onAddToChecklist, 
  onRegenerate,
  isInChecklist,
  isRegenerating 
}: CreativeCellProps) {
  const Icon = formatIcons[cell.format];

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md h-full group relative",
        isSelected && "ring-2 ring-primary bg-primary/5",
        isRegenerating && "opacity-60 pointer-events-none"
      )}
      onClick={() => onToggle(cell.id)}
    >
      {isRegenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="text-xs font-normal gap-1.5">
            <Icon className="h-3 w-3" />
            {formatLabels[cell.format]}
          </Badge>
          <div className="flex items-center gap-1">
            {onRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate(cell.id);
                }}
                disabled={isRegenerating}
                title="Regenerate this idea"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(cell.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="font-medium text-sm leading-snug">{cell.hook}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{cell.guidance}</p>
        {onAddToChecklist && (
          <Button
            variant={isInChecklist ? "secondary" : "outline"}
            size="sm"
            className="w-full h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAddToChecklist(cell.id);
            }}
            disabled={isInChecklist}
          >
            {isInChecklist ? (
              "Added to Checklist"
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Add to Checklist
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
