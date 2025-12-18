import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Copy, Check, Sparkles, FileText, MessageSquare, Type } from "lucide-react";
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

interface CopyPreviewProps {
  angles: { id: string; name: string }[];
  activeAngleId: string;
  onAngleChange: (angleId: string) => void;
  angleCopy: Record<string, AngleCopy>;
  onRegenerateAngleCopy: (angleId: string) => Promise<void>;
  isRegenerating: boolean;
}

export function CopyPreview({
  angles,
  activeAngleId,
  onAngleChange,
  angleCopy,
  onRegenerateAngleCopy,
  isRegenerating,
}: CopyPreviewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("headlines");

  const currentAngleCopy = angleCopy[activeAngleId];
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

  const renderVariations = (variations: CopyVariation[], type: "headline" | "description" | "primary") => {
    if (!variations || variations.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No {type} variations generated yet.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        {variations.map((variation, index) => {
          const id = `${activeAngleId}-${type}-${index}`;
          const isCopied = copiedId === id;

          return (
            <Card
              key={id}
              className={cn(
                "p-4 transition-all hover:shadow-md group relative",
                type === "primary" && "p-5"
              )}
            >
              <div className="flex items-start justify-between gap-3">
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
                  </div>
                  <p className={cn(
                    "text-sm",
                    type === "headline" && "font-semibold text-base",
                    type === "primary" && "whitespace-pre-wrap text-muted-foreground"
                  )}>
                    {variation.text}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(variation.text, id)}
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
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
                {currentAngleCopy?.headlines?.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="descriptions" className="gap-2 min-h-[44px]">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Descriptions</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {currentAngleCopy?.descriptions?.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="primary" className="gap-2 min-h-[44px]">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Primary</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {currentAngleCopy?.primary_copy?.length || 0}
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
