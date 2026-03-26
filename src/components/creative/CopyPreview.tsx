import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RefreshCw, Copy, Check, CheckCircle2, Sparkles, FileText, MessageSquare, Type, Pencil, Save, X, MessageCircle, Loader2 } from "lucide-react";
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
  onRegenerateSingle?: (angleId: string, type: keyof AngleCopy, index: number, feedback?: string) => Promise<void>;
  isRegenerating: boolean;
  regeneratingId?: string | null;
  selections?: Record<string, CopySelections>;
  onSelectionsChange?: (angleId: string, selections: CopySelections) => void;
  onCopyEdit?: (angleId: string, type: keyof AngleCopy, index: number, newText: string) => void;
  hideAngleNav?: boolean;
}

// Character limit recommendations for Meta ads
const charLimits = {
  headline: { ideal: 26, max: 26 },
  description: { ideal: 27, max: 40 },
  primary: { ideal: 125, max: 200 },
};

const getCharCountColor = (count: number, type: "headline" | "description" | "primary") => {
  const limits = charLimits[type];
  if (count <= limits.ideal) return "text-green-600";
  if (count <= limits.max) return "text-amber-600";
  return "text-red-500";
};

const sectionConfig = {
  headlines: {
    label: "Headlines",
    description: "Must be under 26 characters",
    icon: Type,
    type: "headline" as const,
  },
  descriptions: {
    label: "Descriptions",
    description: "Link descriptions (ideal: ~27 chars)",
    icon: FileText,
    type: "description" as const,
  },
  primary_copy: {
    label: "Primary Copy",
    description: "Primary text (ideal: 125 chars, max ~200)",
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
  onRegenerateSingle,
  isRegenerating,
  regeneratingId,
  selections = {},
  onSelectionsChange,
  onCopyEdit,
  hideAngleNav = false,
}: CopyPreviewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

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

  const handleRegenerateSingle = async (type: keyof AngleCopy, index: number, feedback?: string) => {
    if (!onRegenerateSingle) return;
    await onRegenerateSingle(activeAngleId, type, index, feedback);
  };

  const handleFeedbackSubmit = async (type: keyof AngleCopy, index: number) => {
    if (!feedbackText.trim() || !onRegenerateSingle) return;
    setFeedbackLoading(true);
    try {
      await onRegenerateSingle(activeAngleId, type, index, feedbackText.trim());
      toast.success("Regenerating with your feedback...");
    } finally {
      setFeedbackLoading(false);
      setFeedbackId(null);
      setFeedbackText("");
    }
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
    const isItemRegenerating = regeneratingId === id;
    const charCount = variation.character_count || variation.text?.length || 0;
    const charCountColor = getCharCountColor(charCount, type);
    const limits = charLimits[type];

    return (
      <Card
        key={id}
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98] h-full group relative",
          isSelected && "ring-2 ring-primary bg-primary/5",
          isItemRegenerating && "opacity-60 pointer-events-none"
        )}
        onClick={() => handleSelectionToggle(typeKey as keyof AngleCopy, index)}
      >
        {isItemRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        <CardHeader className="pb-2 pt-3 sm:pt-4 px-3 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-normal gap-1 sm:gap-1.5 px-2 py-0.5">
                {variation.framework}
                {variation.length && (
                  <span className="text-muted-foreground capitalize">• {variation.length}</span>
                )}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("text-xs font-medium cursor-help", charCountColor)}>
                      {charCount} chars
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="space-y-1">
                      <p className="font-medium">Meta Ad Character Limits</p>
                      <p className="text-green-600">Ideal: ≤ {limits.ideal} chars</p>
                      <p className="text-amber-600">Acceptable: ≤ {limits.max} chars</p>
                      <p className="text-red-500">Over max: truncated on mobile</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-1">
              {onRegenerateSingle && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRegenerateSingle(typeKey, index);
                  }}
                  disabled={isItemRegenerating}
                  title="Regenerate this copy"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(variation.text, id);
                }}
                title="Copy to clipboard"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              {onSelectionsChange && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleSelectionToggle(typeKey as keyof AngleCopy, index)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5"
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
                  maxLength={type === "headline" ? 26 : undefined}
                />
              )}
              <div className="flex items-center justify-between">
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
                {type === "headline" && (
                  <span className={cn("text-xs", editText.length > 25 ? "text-destructive" : "text-muted-foreground")}>
                    {editText.length}/25
                  </span>
                )}
              </div>
            </div>
          ) : feedbackId === id ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs text-muted-foreground">Tell Lumi what to change:</p>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="E.g., 'Make it more conversational' or 'Focus on the time-saving benefit'"
                className="min-h-[80px] text-sm resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleFeedbackSubmit(typeKey as keyof AngleCopy, index)}
                  disabled={!feedbackText.trim() || feedbackLoading}
                  className="gap-1"
                >
                  {feedbackLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setFeedbackId(null); setFeedbackText(""); }}
                  className="gap-1"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <p className={cn(
                "text-xs sm:text-sm leading-relaxed",
                type === "headline" && "font-medium",
                type === "primary" && "whitespace-pre-wrap text-muted-foreground line-clamp-4"
              )}>
                {variation.text}
              </p>
              {/* Hover overlay with two actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-[2px] rounded-md">
                {onRegenerateSingle && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFeedbackId(id);
                      setFeedbackText("");
                    }}
                  >
                    <MessageCircle className="h-3 w-3" />
                    Give Feedback
                  </Button>
                )}
                {onCopyEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(id, variation.text);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
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
            <CheckCircle2 className="h-3 w-3" />
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
          {isRegenerating ? "Regenerating..." : "Regenerate All"}
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
                      <CheckCircle2 className="h-3 w-3" />
                      {selectedCount} selected
                    </Badge>
                  )}
                </div>
                
                {variations.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
                    <p className="text-sm">No {config.label.toLowerCase()} generated yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
