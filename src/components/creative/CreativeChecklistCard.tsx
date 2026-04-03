import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Video, Film, Image, ChevronDown, ChevronUp, 
  Upload, Eye, CheckCircle2, Trash2, Maximize2,
  Library, Loader2, Info, Trophy, Mic, Type, Brain, Sparkles, Copy, Volume2,
  MessageSquare, RefreshCw, FileText, Pencil, Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductionItem } from "./ProductionChecklistPanel";
import { VideoTextPreview, DEFAULT_OVERLAY_STYLE } from "@/components/VideoTextPreview";
import type { OverlayStyle, TextOverlay } from "@/components/VideoTextPreview";

const formatIcons = { talking_head: Video, broll: Film, graphic: Image };
const formatLabels = { talking_head: "Talking Head", broll: "B-Roll", graphic: "Graphic" };

// Hook technique labels and explanations
const hookTechniqueLabels: Record<string, { label: string; color: string }> = {
  mid_sentence: { label: "Mid-Sentence Start", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  confession: { label: "Confession", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  controversial: { label: "Controversial", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  specific_number: { label: "Specific Number", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  pattern_interrupt: { label: "Pattern Interrupt", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

const hookTechniqueExplanations: Record<string, string> = {
  mid_sentence: "Starting mid-thought makes viewers feel like they walked into a private conversation. Instant curiosity.",
  confession: "Vulnerability builds trust fast. Admitting a struggle or mistake creates an emotional connection.",
  controversial: "Bold takes stop the scroll. Challenging common beliefs makes people want to hear your reasoning.",
  specific_number: "Exact numbers signal credibility and experience. Generic claims get ignored; specifics get attention.",
  pattern_interrupt: "The unexpected breaks mental autopilot. When something doesn't fit the pattern, we pay attention.",
};

interface AngleCopyData {
  headlines?: { text: string; framework?: string }[];
  descriptions?: { text: string }[];
  primary_copy?: { text: string; length?: string }[];
}

interface CreativeChecklistCardProps {
  item: ProductionItem;
  uploadedAsset?: {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
  } | null;
  uploadedAssetVertical?: {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
  } | null;
  onUploadClick: () => void;
  onUploadVerticalClick?: () => void;
  onRemove: () => void;
  onPreview?: (asset: any) => void;
  onAdPreview?: () => void;
  onSaveToLibrary?: () => void;
  savingToLibrary?: boolean;
  rank?: number;
  rationale?: string;
  showAngleBadge?: boolean;
  onRefineScript?: (itemId: string, feedback: string) => Promise<void>;
  selected?: boolean;
  onToggleSelect?: () => void;
  angleCopy?: AngleCopyData;
  onCopyChange?: (updatedCopy: AngleCopyData) => void;
  onOverlaysChange?: (overlays: TextOverlay[]) => void;
  brand?: any;
}

export function CreativeChecklistCard({ 
  item, 
  uploadedAsset,
  uploadedAssetVertical,
  onUploadClick,
  onUploadVerticalClick,
  onRemove,
  onPreview,
  onAdPreview,
  onSaveToLibrary,
  savingToLibrary,
  rank,
  rationale,
  showAngleBadge = false,
  onRefineScript,
  selected,
  onToggleSelect,
  angleCopy,
  onCopyChange,
  onOverlaysChange,
  brand,
}: CreativeChecklistCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [selectedBrollClipId, setSelectedBrollClipId] = useState<string | null>(null);
  const [brollSource, setBrollSource] = useState<"lumi" | "upload">("lumi");
  const [customBrollUrl, setCustomBrollUrl] = useState<string | null>(null);
  const [customBrollName, setCustomBrollName] = useState<string | null>(null);
  const [uploadingBroll, setUploadingBroll] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [editingCopyField, setEditingCopyField] = useState<string | null>(null);
  const [editingOverlayIdx, setEditingOverlayIdx] = useState<number | null>(null);
  const [editOverlayText, setEditOverlayText] = useState("");
  const [editCopyValue, setEditCopyValue] = useState("");
  const Icon = formatIcons[item.format as keyof typeof formatIcons] || Image;
  const formatLabel = formatLabels[item.format as keyof typeof formatLabels] || item.format;
  
  const hasAsset = !!uploadedAsset;
  const isRanked = typeof rank === 'number';
  const isTalkingHead = item.format === "talking_head";
  const hasScriptDetails = isTalkingHead && (item.script_lines?.length || item.verbal_hook || item.written_hook || item.visual_hook);

  const copyScriptToClipboard = () => {
    if (!item.script_lines || item.script_lines.length === 0) {
      toast.error("No script to copy");
      return;
    }
    const scriptText = item.script_lines.join("\n");
    navigator.clipboard.writeText(scriptText);
    toast.success("Script copied to clipboard!");
  };

  const handleRefineScript = async () => {
    if (!feedbackText.trim() || !onRefineScript) return;
    setIsRefining(true);
    try {
      await onRefineScript(item.id, feedbackText.trim());
      setFeedbackText("");
      setShowFeedback(false);
      toast.success("Script refined!");
    } catch (e: any) {
      toast.error(e.message || "Failed to refine script");
    } finally {
      setIsRefining(false);
    }
  };
  
  return (
    <TooltipProvider>
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-all border-l-4",
        isRanked ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10 ring-1 ring-amber-200 dark:ring-amber-800" :
        hasAsset ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/10" : "border-l-primary/50"
      )}>
        <CollapsibleTrigger asChild>
          <CardContent className="pt-4 pb-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3">
              {/* Bulk Select Checkbox */}
              {onToggleSelect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                  className="mt-2 flex-shrink-0"
                >
                  {selected ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />
                  )}
                </button>
              )}
              {/* Rank Badge or Format Icon */}
              {isRanked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-lg shadow-md">
                      #{rank}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium">Lumi's #{rank} Pick</p>
                    {rationale && <p className="text-xs text-muted-foreground mt-1">{rationale}</p>}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  hasAsset ? "bg-green-100 dark:bg-green-900/30" : "bg-primary/10"
                )}>
                  <Icon className={cn("h-5 w-5", hasAsset ? "text-green-600" : "text-primary")} />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{formatLabel}</Badge>
                  {(showAngleBadge || !isRanked) && item.angleName && (
                    <Badge variant="outline" className="text-xs bg-primary/5">{item.angleName}</Badge>
                  )}
                  {isRanked && !showAngleBadge && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1">
                      <Trophy className="h-3 w-3" />
                      Top 5
                    </Badge>
                  )}
                  {(item as any).approval_status === 'approved' && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                      Approved ✅
                    </Badge>
                  )}
                  {(item as any).approval_status === 'changes_requested' && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                      Changes Requested 🔄
                    </Badge>
                  )}
                  {hasAsset && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto flex-shrink-0" />
                  )}
                </div>
                <p className="font-medium text-sm line-clamp-2">{item.hook}</p>
              </div>
              
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 border-t">
            <div className="space-y-4 pt-4">
              {/* Rationale for ranked items */}
              {isRanked && rationale && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h5 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase mb-1">Why Lumi Picked This</h5>
                      <p className="text-sm text-amber-700 dark:text-amber-400">{rationale}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Instructions/Guidance */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Creative Direction</h5>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{item.guidance || "No additional guidance provided."}</p>
                </div>
              </div>
              
              {/* Talking Head - Full Hook Education */}
              {item.format === "talking_head" && (
                <div className="space-y-4">
                  {/* Three-Hook System Explainer */}
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-green-500/5 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">The Three-Hook System</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Capture attention in the first 3 seconds with hooks that work together:
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Mic className="h-3 w-3 text-blue-500" />
                        <span className="font-medium">Verbal</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Type className="h-3 w-3 text-purple-500" />
                        <span className="font-medium">Written</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3 text-green-500" />
                        <span className="font-medium">Visual</span>
                      </div>
                    </div>
                  </div>

                  {/* Hook Cards */}
                  <div className="grid gap-3">
                    {/* Verbal Hook */}
                    {item.verbal_hook && (
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <Mic className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold uppercase">Verbal Hook</span>
                        </div>
                        <p className="text-sm font-medium">"{item.verbal_hook}"</p>
                      </div>
                    )}

                    {/* Written Hook */}
                    {item.written_hook && (
                      <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                        <div className="flex items-center gap-2 text-purple-600 mb-1">
                          <Type className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold uppercase">Written Hook (On Screen)</span>
                        </div>
                        <p className="text-sm font-medium">"{item.written_hook}"</p>
                      </div>
                    )}

                    {/* Visual Hook */}
                    {(item.visual_hook || item.visual_hook_options?.length) && (
                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold uppercase">Visual Hook Options</span>
                        </div>
                        {item.visual_hook_options && item.visual_hook_options.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.visual_hook_options.map((option, idx) => (
                              <Badge key={idx} variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                                {option}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm">{item.visual_hook}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Why This Works - Psychology Card */}
                  {(item.psychology_trigger || item.why_this_works || item.hook_technique) && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Why This Works</span>
                      </div>
                      {item.psychology_trigger && (
                        <Badge variant="outline" className="mb-2 text-xs bg-primary/10 text-primary border-primary/30">
                          {item.psychology_trigger}
                        </Badge>
                      )}
                      {item.why_this_works && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.why_this_works}
                        </p>
                      )}
                      {item.hook_technique && hookTechniqueExplanations[item.hook_technique] && !item.why_this_works && (
                        <p className="text-sm text-muted-foreground">
                          {hookTechniqueExplanations[item.hook_technique]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Line-by-Line Script */}
                  {item.script_lines && item.script_lines.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase">📜 Your Script</h5>
                        <div className="flex items-center gap-1">
                          {onRefineScript && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => setShowFeedback(!showFeedback)}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Refine Script
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={copyScriptToClipboard}
                          >
                            <Copy className="h-3 w-3" />
                            Copy Script
                          </Button>
                        </div>
                      </div>
                      
                      {/* Feedback Input */}
                      {showFeedback && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                          <p className="text-xs text-muted-foreground">Tell Lumi what to change — tone, length, specific phrases, or a new direction.</p>
                          <Textarea
                            placeholder="e.g. Make it shorter and more casual, focus on the transformation..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowFeedback(false)} className="text-xs">Cancel</Button>
                            <Button size="sm" onClick={handleRefineScript} disabled={!feedbackText.trim() || isRefining} className="gap-1 text-xs">
                              {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Regenerate
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        {item.script_lines.map((line, idx) => (
                          <div key={idx} className="flex gap-2 text-sm">
                            <span className="text-muted-foreground w-5 shrink-0 text-right">{idx + 1}.</span>
                            <span className={cn(
                              line.includes("(pause)") || line.includes("(lean") ? "italic text-muted-foreground" : ""
                            )}>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Text Overlays */}
                  {item.text_overlays && item.text_overlays.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase">📝 Text Overlays</h5>
                      <div className="space-y-2">
                        {item.text_overlays.map((overlay, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "p-2 rounded border text-sm",
                              overlay.type === "hook" && "bg-blue-500/5 border-blue-500/20",
                              overlay.type === "transition" && "bg-amber-500/5 border-amber-500/20",
                              overlay.type === "cta" && "bg-green-500/5 border-green-500/20",
                              overlay.type === "insight" && "bg-purple-500/5 border-purple-500/20",
                              !overlay.type && "bg-muted/50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {overlay.type && (
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {overlay.type}
                                  </Badge>
                                )}
                                <span>"{overlay.text}"</span>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                ⏱️ {overlay.timing}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delivery Style Tip */}
                  {item.delivery_style && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm italic text-muted-foreground">
                        💡 <span className="font-medium">Delivery:</span> {item.delivery_style}
                      </p>
                    </div>
                  )}

                  {/* Caption Reminder */}
                  {item.caption_reminder !== false && (
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <Volume2 className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 text-sm">
                        🔇 85% of viewers watch without sound — always add captions!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
              
              {item.format === "broll" && (
                <div className="space-y-4">
                  {/* Visual Direction */}
                  {(item.visual_hook || (item as any).visual_guidance) && (
                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold uppercase">Visual Direction</span>
                      </div>
                      <p className="text-sm">{item.visual_hook || (item as any).visual_guidance}</p>
                    </div>
                  )}

                  {/* Text Overlays for B-Roll — Editable */}
                  {item.text_overlays && item.text_overlays.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase">📝 Text Overlays</h5>
                      <div className="space-y-2">
                        {item.text_overlays.map((overlay, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "p-2 rounded border text-sm",
                              overlay.type === "hook" && "bg-blue-500/5 border-blue-500/20",
                              overlay.type === "transition" && "bg-amber-500/5 border-amber-500/20",
                              overlay.type === "cta" && "bg-green-500/5 border-green-500/20",
                              overlay.type === "insight" && "bg-purple-500/5 border-purple-500/20",
                              !overlay.type && "bg-muted/50"
                            )}
                          >
                            {editingOverlayIdx === idx ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  {overlay.type && (
                                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                                      {overlay.type}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    ⏱️ {overlay.timing}
                                  </span>
                                </div>
                                <Input
                                  value={editOverlayText}
                                  onChange={(e) => setEditOverlayText(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const updated = [...(item.text_overlays || [])];
                                      updated[idx] = { ...updated[idx], text: editOverlayText };
                                      onOverlaysChange?.(updated);
                                      setEditingOverlayIdx(null);
                                    } else if (e.key === "Escape") {
                                      setEditingOverlayIdx(null);
                                    }
                                  }}
                                />
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px]"
                                    onClick={() => setEditingOverlayIdx(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-6 text-[10px]"
                                    onClick={() => {
                                      const updated = [...(item.text_overlays || [])];
                                      updated[idx] = { ...updated[idx], text: editOverlayText };
                                      onOverlaysChange?.(updated);
                                      setEditingOverlayIdx(null);
                                    }}
                                  >
                                    <Check className="h-3 w-3 mr-0.5" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {overlay.type && (
                                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                                      {overlay.type}
                                    </Badge>
                                  )}
                                  <span className="truncate">"{overlay.text}"</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-xs text-muted-foreground">
                                    ⏱️ {overlay.timing}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                      setEditingOverlayIdx(idx);
                                      setEditOverlayText(overlay.text);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* B-Roll Source Toggle + Preview */}
                  {(() => {
                    const brollClips: any[] = (brand as any)?.broll_library || [];
                    const oStyle: OverlayStyle = (brand as any)?.overlay_style || DEFAULT_OVERLAY_STYLE;
                    const tOverlays: TextOverlay[] = (item.text_overlays || []).map((o: any) =>
                      typeof o === "string" ? { text: o } : o
                    );

                    const handleBrollFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("video/")) {
                        toast.error("Please upload a video file");
                        return;
                      }
                      if (file.size > 250 * 1024 * 1024) {
                        toast.error("File must be under 250MB");
                        return;
                      }
                      setUploadingBroll(true);
                      try {
                        const { supabase } = await import("@/integrations/supabase/client");
                        const brandId = (brand as any)?.id;
                        const path = `${brandId}/broll-custom/${Date.now()}_${file.name}`;
                        const { error: uploadError } = await supabase.storage
                          .from("creative-assets")
                          .upload(path, file);
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage
                          .from("creative-assets")
                          .getPublicUrl(path);
                        setCustomBrollUrl(urlData.publicUrl);
                        setCustomBrollName(file.name);
                        toast.success("Video uploaded!");
                      } catch (err: any) {
                        toast.error(err?.message || "Upload failed");
                      } finally {
                        setUploadingBroll(false);
                      }
                    };

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                            <Film className="h-3.5 w-3.5" />
                            B-Roll Creative
                          </h5>
                        </div>

                        {/* Source toggle */}
                        <div className="flex gap-1.5">
                          <Button
                            variant={brollSource === "lumi" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-[11px] flex-1"
                            onClick={() => setBrollSource("lumi")}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Use Lumi Creative
                          </Button>
                          <Button
                            variant={brollSource === "upload" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-[11px] flex-1"
                            onClick={() => setBrollSource("upload")}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload My Own
                          </Button>
                        </div>

                        {brollSource === "lumi" ? (
                          <>
                            {brollClips.length > 0 ? (
                              <>
                                <div className="flex justify-end">
                                  <Select
                                    value={selectedBrollClipId || brollClips[0]?.id}
                                    onValueChange={setSelectedBrollClipId}
                                  >
                                    <SelectTrigger className="w-[140px] h-7 text-[11px]">
                                      <SelectValue placeholder="Swap clip" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {brollClips.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id} className="text-xs">
                                          {c.file_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {(() => {
                                  const clipId = selectedBrollClipId || brollClips[0]?.id;
                                  const clip = brollClips.find((c: any) => c.id === clipId);
                                  if (!clip) return null;
                                  return (
                                    <div className="mx-auto w-[180px]">
                                      {tOverlays.length > 0 ? (
                                        <VideoTextPreview
                                          videoUrl={clip.file_url}
                                          overlays={tOverlays}
                                          style={oStyle}
                                          compact
                                        />
                                      ) : (
                                        <video
                                          src={clip.file_url}
                                          className="w-full aspect-[9/16] object-contain rounded-lg bg-black"
                                          controls muted playsInline preload="metadata"
                                        />
                                      )}
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  Upload b-roll clips in My Brand to see Lumi-matched previews here.
                                </AlertDescription>
                              </Alert>
                            )}
                          </>
                        ) : (
                          <>
                            {customBrollUrl ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {customBrollName}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px]"
                                    onClick={() => { setCustomBrollUrl(null); setCustomBrollName(null); }}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                                <div className="mx-auto w-[180px]">
                                  {tOverlays.length > 0 ? (
                                    <VideoTextPreview
                                      videoUrl={customBrollUrl}
                                      overlays={tOverlays}
                                      style={oStyle}
                                      compact
                                    />
                                  ) : (
                                    <video
                                      src={customBrollUrl}
                                      className="w-full aspect-[9/16] object-contain rounded-lg bg-black"
                                      controls muted playsInline preload="metadata"
                                    />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                                {uploadingBroll ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                ) : (
                                  <>
                                    <Upload className="h-5 w-5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Upload 9:16 video (max 250MB)</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={handleBrollFileUpload}
                                  disabled={uploadingBroll}
                                />
                              </label>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Why This Works - Psychology for B-Roll */}
                  {(item.psychology_trigger || item.why_this_works) && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Why This Works</span>
                      </div>
                      {item.psychology_trigger && (
                        <Badge variant="outline" className="mb-2 text-xs bg-primary/10 text-primary border-primary/30">
                          {item.psychology_trigger}
                        </Badge>
                      )}
                      {item.why_this_works && (
                        <p className="text-sm text-muted-foreground">{item.why_this_works}</p>
                      )}
                    </div>
                  )}

                  {/* Fallback generic tips if no item-specific data */}
                  {!item.visual_hook && !(item as any).visual_guidance && !item.text_overlays?.length && !item.why_this_works && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">B-Roll Tips</h5>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Capture variety: wide, medium, close-up shots</li>
                        <li>Use slow, smooth movements</li>
                        <li>Film in 4K if possible for flexibility</li>
                        <li>Include lifestyle and product shots</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {item.format === "graphic" && (
                <div className="space-y-4">
                  {/* Design Direction */}
                  {(item as any).design_direction && (
                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <Image className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold uppercase">Design Direction</span>
                      </div>
                      <p className="text-sm">{(item as any).design_direction}</p>
                    </div>
                  )}

                  {/* Graphic Copy (Text Overlays) */}
                  {item.text_overlays && item.text_overlays.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase">📝 Graphic Copy</h5>
                      <div className="space-y-2">
                        {item.text_overlays.map((overlay, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "p-2 rounded border text-sm",
                              overlay.type === "hook" && "bg-blue-500/5 border-blue-500/20",
                              overlay.type === "cta" && "bg-green-500/5 border-green-500/20",
                              !overlay.type && "bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {overlay.type && (
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {overlay.type}
                                </Badge>
                              )}
                              <span>"{overlay.text}"</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Why This Works - Psychology for Graphics */}
                  {(item.psychology_trigger || item.why_this_works) && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Why This Works</span>
                      </div>
                      {item.psychology_trigger && (
                        <Badge variant="outline" className="mb-2 text-xs bg-primary/10 text-primary border-primary/30">
                          {item.psychology_trigger}
                        </Badge>
                      )}
                      {item.why_this_works && (
                        <p className="text-sm text-muted-foreground">{item.why_this_works}</p>
                      )}
                    </div>
                  )}

                  {/* Fallback generic tips if no item-specific data */}
                  {!item.text_overlays?.length && !item.why_this_works && !(item as any).design_direction && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Design Tips</h5>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Keep text minimal and readable</li>
                        <li>Use brand colors consistently</li>
                        <li>Design for mobile-first (1080x1080 or 1080x1920)</li>
                        <li>Include clear focal point</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {/* Ad Copy Section */}
              {angleCopy && (angleCopy.headlines?.length || angleCopy.primary_copy?.length || angleCopy.descriptions?.length) ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Ad Copy
                    </h5>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                    {/* Headline */}
                    {angleCopy.headlines?.[0] && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Headline</span>
                        {editingCopyField === "headline" ? (
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              value={editCopyValue}
                              onChange={(e) => setEditCopyValue(e.target.value)}
                              className="h-7 text-sm"
                              maxLength={26}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const updated = { ...angleCopy, headlines: [{ ...angleCopy.headlines![0], text: editCopyValue }] };
                                  onCopyChange?.(updated);
                                  setEditingCopyField(null);
                                }
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                              const updated = { ...angleCopy, headlines: [{ ...angleCopy.headlines![0], text: editCopyValue }] };
                              onCopyChange?.(updated);
                              setEditingCopyField(null);
                            }}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-sm font-medium">{angleCopy.headlines[0].text}</p>
                            {onCopyChange && (
                              <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 text-muted-foreground" onClick={() => {
                                setEditingCopyField("headline");
                                setEditCopyValue(angleCopy.headlines![0].text);
                              }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Primary Copy */}
                    {angleCopy.primary_copy?.[0] && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Primary Text</span>
                        {editingCopyField === "primary" ? (
                          <div className="space-y-1 mt-1">
                            <Textarea
                              value={editCopyValue}
                              onChange={(e) => setEditCopyValue(e.target.value)}
                              className="text-sm min-h-[100px] resize-y"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => {
                              const updated = { ...angleCopy, primary_copy: [{ ...angleCopy.primary_copy![0], text: editCopyValue }] };
                              onCopyChange?.(updated);
                              setEditingCopyField(null);
                            }}>
                              <Check className="h-3 w-3" /> Save
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-0.5">
                            <p className="text-sm whitespace-pre-wrap line-clamp-4">{angleCopy.primary_copy[0].text}</p>
                            {onCopyChange && (
                              <Button size="sm" variant="ghost" className="h-5 gap-1 text-xs text-muted-foreground mt-1" onClick={() => {
                                setEditingCopyField("primary");
                                setEditCopyValue(angleCopy.primary_copy![0].text);
                              }}>
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Description */}
                    {angleCopy.descriptions?.[0] && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Description</span>
                        <p className="text-sm text-muted-foreground mt-0.5">{angleCopy.descriptions[0].text}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <p className="text-sm">No ad copy yet — generate copy in the Build tab or edit in Ad Preview</p>
                  </div>
                </div>
              )}
              
              {/* Upload Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase">Asset</h5>
                  {item.format === "graphic" && (
                    <span className="text-[10px] text-muted-foreground">Upload square (1080×1080) first, then add a 9:16 version</span>
                  )}
                  {(item.format === "talking_head" || item.format === "broll") && (
                    <span className="text-[10px] text-muted-foreground">9:16 vertical only</span>
                  )}
                </div>
                {hasAsset ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedAsset!.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {uploadedAsset!.file_type?.startsWith('video/') ? 'Video uploaded (9:16 — Stories & Reels ready ✓)' : 'Square / Feed version (1:1)'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {onPreview && (
                          <Button size="sm" variant="ghost" onClick={() => onPreview(uploadedAsset)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={onUploadClick}>
                          Replace
                        </Button>
                      </div>
                    </div>
                    
                    {/* Prominent 9:16 vertical version prompt - only for images */}
                    {!uploadedAsset!.file_type?.startsWith('video/') && onUploadVerticalClick && (
                      uploadedAssetVertical ? (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{uploadedAssetVertical.file_name}</p>
                            <p className="text-xs text-muted-foreground">9:16 Stories / Reels version ✓</p>
                          </div>
                          <div className="flex gap-1">
                            {onPreview && (
                              <Button size="sm" variant="ghost" onClick={() => onPreview(uploadedAssetVertical)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={onUploadVerticalClick}>
                              Replace
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                              <Maximize2 className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Upload a 9:16 version for Stories & Reels</p>
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                If you skip this, Lumi will auto-extend your square with color bars — just like Meta does.
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full mt-2 gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                            onClick={onUploadVerticalClick}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload 9:16 Version
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full h-20 border-dashed gap-2"
                    onClick={onUploadClick}
                  >
                    <Upload className="h-5 w-5" />
                    <span>
                      {item.format === "graphic" 
                        ? "Upload Square (1:1) Version" 
                        : `Upload ${formatLabel} (9:16)`}
                    </span>
                  </Button>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  {onAdPreview && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={onAdPreview}
                    >
                      <Maximize2 className="h-4 w-4" />
                      Preview Ad
                    </Button>
                  )}
                  {onSaveToLibrary && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={onSaveToLibrary}
                      disabled={savingToLibrary}
                    >
                      {savingToLibrary ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Library className="h-4 w-4" />
                      )}
                      Save for Later
                    </Button>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={onRemove}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    </TooltipProvider>
  );
}
