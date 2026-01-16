import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Video, Film, Image, ChevronDown, ChevronUp, 
  Upload, Eye, CheckCircle2, AlertCircle, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductionItem } from "./ProductionChecklistPanel";

const formatIcons = { talking_head: Video, broll: Film, graphic: Image };
const formatLabels = { talking_head: "Talking Head", broll: "B-Roll", graphic: "Graphic" };

interface CreativeChecklistCardProps {
  item: ProductionItem;
  uploadedAsset?: {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
  } | null;
  onUploadClick: () => void;
  onRemove: () => void;
  onPreview?: (asset: any) => void;
}

export function CreativeChecklistCard({ 
  item, 
  uploadedAsset, 
  onUploadClick, 
  onRemove,
  onPreview 
}: CreativeChecklistCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = formatIcons[item.format as keyof typeof formatIcons] || Image;
  const formatLabel = formatLabels[item.format as keyof typeof formatLabels] || item.format;
  
  const hasAsset = !!uploadedAsset;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-all border-l-4",
        hasAsset ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/10" : "border-l-primary/50"
      )}>
        <CollapsibleTrigger asChild>
          <CardContent className="pt-4 pb-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                hasAsset ? "bg-green-100 dark:bg-green-900/30" : "bg-primary/10"
              )}>
                <Icon className={cn("h-5 w-5", hasAsset ? "text-green-600" : "text-primary")} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">{formatLabel}</Badge>
                  {item.angleName && (
                    <Badge variant="outline" className="text-xs">{item.angleName}</Badge>
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
              {/* Instructions/Guidance */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Creative Direction</h5>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{item.guidance || "No additional guidance provided."}</p>
                </div>
              </div>
              
              {/* Format-specific instructions */}
              {item.format === "talking_head" && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recording Tips</h5>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Use good lighting (natural light or ring light)</li>
                    <li>Eye level camera, look directly at lens</li>
                    <li>Record in vertical (9:16) for Stories/Reels</li>
                    <li>Speak naturally, as if to a friend</li>
                  </ul>
                </div>
              )}
              
              {item.format === "broll" && (
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
              
              {item.format === "graphic" && (
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
              
              {/* Upload Section */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Asset</h5>
                {hasAsset ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedAsset.file_name}</p>
                      <p className="text-xs text-muted-foreground">Uploaded successfully</p>
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
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full h-20 border-dashed gap-2"
                    onClick={onUploadClick}
                  >
                    <Upload className="h-5 w-5" />
                    <span>Upload {formatLabel}</span>
                  </Button>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex justify-end">
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
  );
}
