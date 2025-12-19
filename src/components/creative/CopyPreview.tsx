import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Copy, Check, Sparkles, FileText, MessageSquare, Type, Pencil, Save, X, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AngleCopyNav } from "./AngleCopyNav";

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
  hook?: string;
}

interface CopyPreviewProps {
  angles: AngleData[];
  activeAngleId: string;
  onAngleChange: (angleId: string) => void;
  angleCopy: Record<string, AngleCopy>;
  onRegenerateAngleCopy: (angleId: string) => Promise<void>;
  isRegenerating: boolean;
  selections?: Record<string, CopySelections>;
  onSelectionsChange?: (angleId: string, selections: CopySelections) => void;
  onCopyEdit?: (angleId: string, type: keyof AngleCopy, index: number, newText: string) => void;
  hideAngleNav?: boolean;
}

const sectionConfig = {
  headlines: {
    label: "Headlines",
    description: "Short, punchy headlines for your ads (max 40 characters)",
    icon: Type,
    type: "headline" as const,
  },
  descriptions: {
    label: "Descriptions",
    description: "Ad descriptions that expand on your headline (max 125 characters)",
    icon: FileText,
    type: "description" as const,
  },
  primary_copy: {
    label: "Primary Copy",
    description: "Primary text variations in different lengths",
    icon: MessageSquare,
    type: "primary" as const,
  },
};

const sectionOrder: (keyof typeof sectionConfig)[] = ["headlines", "descriptions", "primary_copy"];

export function CopyPreview({
  angles,
  activeAngleId,
  onAngleChange,
  angleCopy,
  onRegenerateAngleCopy,
  isRegenerating,
  selections = {},
  onSelectionsChange,
  onCopyEdit,
  hideAngleNav = false,
}: CopyPreviewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  const currentAngleCopy = angleCopy[activeAngleId];
  const currentSelections = selections[activeAngleId] || { headlines: [], descriptions: [], primary_copy: [] };
  
  const hasAngleCopy = currentAngleCopy && (
    currentAngleCopy.headlines?.length > 0 ||
    currentAngleCopy.descriptions?.length > 0 ||
    currentAngleCopy.primary_copy?.length > 0
  );

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = async () => {
    await onRegenerateAngleCopy(activeAngleId);
  };

  const handleSelectionToggle = (type: keyof AngleCopy, index: number) => {
    if (!onSelectionsChange) return;
    
    const typeKey = type as keyof CopySelections;
    const currentTypeSelections = currentSelections[typeKey] || [];
    const newTypeSelections = currentTypeSelections.includes(index)
      ? currentTypeSelections.filter(i => i !== index)
      : [...currentTypeSelections, index];
    
    onSelectionsChange(activeAngleId, {
      ...currentSelections,
      [typeKey]: newTypeSelections,
    });
  };

  const handleStartEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleSaveEdit = (type: keyof AngleCopy, index: number) => {
    if (!onCopyEdit || !editText.trim()) {
      setEditingId(null);
      return;
    }
    
    onCopyEdit(activeAngleId, type, index, editText.trim());
    setEditingId(null);
    setEditText("");
    toast.success("Copy updated");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const getSelectedCount = () => {
    const h = currentSelections.headlines?.length || 0;
    const d = currentSelections.descriptions?.length || 0;
    const p = currentSelections.primary_copy?.length || 0;
    return h + d + p;
  };

  const renderVariationCard = (
    variation: CopyVariation, 
    index: number, 
    type: "headline" | "description" | "primary",
    typeKey: keyof CopySelections
  ) => {
    const id = `${activeAngleId}-${type}-${index}`;
    const isCopied = copiedId === id;
    const isEditing = editingId === id;
    const isSelected = (currentSelections[typeKey] || []).includes(index);

    return (
      <Card
        key={id}
        className={cn(
          "p-4 transition-all hover:shadow-md group relative",
          type === "primary" && "p-5",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          {onSelectionsChange && (
            <div className="pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleSelectionToggle(typeKey as keyof AngleCopy, index)}
                className="h-5 w-5"
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className="text-xs shrink-0">
                {variation.framework}
              </Badge>
              {variation.character_count && (
                <span className="text-xs text-muted-foreground">
                  {variation.character_count} chars
                </span>
              )}
              {variation.length && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {variation.length}
                </Badge>
              )}
              {isSelected && (
                <Badge className="text-xs gap-1 bg-primary">
                  <Star className="h-3 w-3" />
                  Selected
                </Badge>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                {type === "primary" ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[120px] text-sm"
                    autoFocus
                  />
                ) : (
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-sm"
                    autoFocus
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(typeKey as keyof AngleCopy, index)}
                    className="gap-1"
                  >
                    <Save className="h-3 w-3" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className={cn(
                "text-sm",
                type === "headline" && "font-semibold text-base",
                type === "primary" && "whitespace-pre-wrap text-muted-foreground"
              )}>
                {variation.text}
              </p>
            )}
          </div>
          
          {!isEditing && (
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {onCopyEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleStartEdit(id, variation.text)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleCopy(variation.text, id)}
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Visual angle navigation - hidden when controlled externally */}
      {!hideAngleNav && (
        <AngleCopyNav
          angles={angles}
          activeAngleId={activeAngleId}
          onAngleChange={onAngleChange}
          selections={selections}
          angleCopy={angleCopy}
        />
      )}

      {/* Regenerate button and selection count */}
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        {getSelectedCount() > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs sm:text-sm">
            <Star className="h-3 w-3" />
            {getSelectedCount()} selected
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="min-h-[44px] gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRegenerating && "animate-spin")} />
          {isRegenerating ? "Regenerating..." : "Regenerate Copy"}
        </Button>
      </div>

      {/* Copy Content */}
      {!hasAngleCopy ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Copy Not Generated Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Copy variations will be generated automatically when you create your creative grid, or you can generate them now.
              </p>
            </div>
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="gap-2"
            >
              {isRegenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Copy
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        /* Grid layout matching Creative section */
        <div className="space-y-4 sm:space-y-6">
          {sectionOrder.map((sectionKey) => {
            const config = sectionConfig[sectionKey];
            const variations = currentAngleCopy?.[sectionKey] || [];
            const selectedCount = currentSelections[sectionKey]?.length || 0;
            const Icon = config.icon;

            return (
              <div key={sectionKey} className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </h3>
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Check className="h-3 w-3" />
                      {selectedCount} selected
                    </Badge>
                  )}
                </div>
                
                {variations.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
                    <p className="text-sm">No {config.label.toLowerCase()} generated yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {variations.map((variation, index) => 
                      renderVariationCard(variation, index, config.type, sectionKey)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
