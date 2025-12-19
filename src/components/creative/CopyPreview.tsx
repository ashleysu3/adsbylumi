import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Copy, Check, Sparkles, FileText, MessageSquare, Type, Pencil, Save, X, Star } from "lucide-react";
import { toast } from "sonner";
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

interface CopyPreviewProps {
  angles: { id: string; name: string }[];
  activeAngleId: string;
  onAngleChange: (angleId: string) => void;
  angleCopy: Record<string, AngleCopy>;
  onRegenerateAngleCopy: (angleId: string) => Promise<void>;
  isRegenerating: boolean;
  selections?: Record<string, CopySelections>;
  onSelectionsChange?: (angleId: string, selections: CopySelections) => void;
  onCopyEdit?: (angleId: string, type: keyof AngleCopy, index: number, newText: string) => void;
}

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
}: CopyPreviewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("headlines");
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

  const renderVariations = (variations: CopyVariation[], type: "headline" | "description" | "primary") => {
    if (!variations || variations.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No {type} variations generated yet.</p>
        </div>
      );
    }

    const typeKey = type === "headline" ? "headlines" : type === "description" ? "descriptions" : "primary_copy";

    return (
      <div className="grid gap-3">
        {variations.map((variation, index) => {
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
                  <div className="flex items-center gap-2 mb-2">
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
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with angle selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <Select value={activeAngleId} onValueChange={onAngleChange}>
            <SelectTrigger className="w-full sm:w-[280px] min-h-[44px]">
              <SelectValue placeholder="Select angle" />
            </SelectTrigger>
            <SelectContent>
              {angles.map((angle) => (
                <SelectItem key={angle.id} value={angle.id}>
                  {angle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {getSelectedCount() > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3" />
              {getSelectedCount()} selected
            </Badge>
          )}
        </div>

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

      {/* Selection info */}
      {onSelectionsChange && hasAngleCopy && (
        <Card className="p-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            <Star className="h-4 w-4 inline mr-1 text-primary" />
            Select your favorite variations for each type. Selected copy will be used when building your campaign.
          </p>
        </Card>
      )}

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="headlines" className="gap-2 min-h-[44px]">
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Headlines</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {currentSelections.headlines?.length || 0}/{currentAngleCopy?.headlines?.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="descriptions" className="gap-2 min-h-[44px]">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Descriptions</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {currentSelections.descriptions?.length || 0}/{currentAngleCopy?.descriptions?.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="primary" className="gap-2 min-h-[44px]">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Primary</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {currentSelections.primary_copy?.length || 0}/{currentAngleCopy?.primary_copy?.length || 0}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="headlines" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Short, punchy headlines for your ads (max 40 characters)
                </p>
              </div>
              {renderVariations(currentAngleCopy?.headlines || [], "headline")}
            </div>
          </TabsContent>

          <TabsContent value="descriptions" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Ad descriptions that expand on your headline (max 125 characters)
                </p>
              </div>
              {renderVariations(currentAngleCopy?.descriptions || [], "description")}
            </div>
          </TabsContent>

          <TabsContent value="primary" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Primary text variations in different lengths
                </p>
              </div>
              {renderVariations(currentAngleCopy?.primary_copy || [], "primary")}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
