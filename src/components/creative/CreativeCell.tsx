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
        "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98] h-full group relative",
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
      <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="text-xs font-normal gap-1 sm:gap-1.5 px-2 py-0.5">
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{formatLabels[cell.format]}</span>
            <span className="sm:hidden">{cell.format === "talking_head" ? "Video" : cell.format === "broll" ? "B-Roll" : "Graphic"}</span>
          </Badge>
          <div className="flex items-center gap-1">
            {onRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
              className="h-5 w-5"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
        <p className="font-medium text-xs sm:text-sm leading-snug">{cell.hook}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{cell.guidance}</p>
        {onAddToChecklist && (
          <Button
            variant={isInChecklist ? "secondary" : "outline"}
            size="sm"
            className="w-full min-h-[36px] sm:min-h-[32px] text-xs sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAddToChecklist(cell.id);
            }}
            disabled={isInChecklist}
          >
            {isInChecklist ? (
              "Added"
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
