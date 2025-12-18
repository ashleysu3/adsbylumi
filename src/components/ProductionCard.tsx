import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Image, LayoutGrid, CheckCircle2, Clock, Upload, Trash2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface ProductionItem {
  id: string;
  concept_id: string;
  concept: any;
  stage: string;
  format: string;
  status: "pending" | "ready" | "in_progress" | "recorded" | "uploaded" | "approved";
  production_notes?: string;
  uploaded_asset_url?: string;
  created_at: string;
}

interface ProductionCardProps {
  item: ProductionItem;
  onClick: () => void;
  onRemove?: (itemId: string) => void;
}

const formatIcons: Record<string, any> = {
  talking_head: Video,
  broll: Video,
  static: Image,
  carousel: LayoutGrid,
};

// Simplified status config - no copy step
const statusConfig = {
  pending: {
    label: "Not Started",
    color: "bg-muted text-muted-foreground",
    borderColor: "border-muted",
    buttonText: "START",
    icon: Clock,
  },
  ready: {
    label: "Ready to Create",
    color: "bg-blue-500/10 text-blue-600",
    borderColor: "border-blue-500",
    buttonText: "START",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-500/10 text-blue-600",
    borderColor: "border-blue-500",
    buttonText: "CONTINUE",
    icon: Clock,
  },
  recorded: {
    label: "Ready to Upload",
    color: "bg-yellow-500/10 text-yellow-600",
    borderColor: "border-yellow-500",
    buttonText: "UPLOAD",
    icon: Upload,
  },
  uploaded: {
    label: "Ready for Campaign",
    color: "bg-purple-500/10 text-purple-600",
    borderColor: "border-purple-500",
    buttonText: "READY",
    icon: CheckCircle2,
  },
  approved: {
    label: "Ready for Campaign",
    color: "bg-purple-500/10 text-purple-600",
    borderColor: "border-purple-500",
    buttonText: "READY",
    icon: CheckCircle2,
  },
};

export function ProductionCard({ item, onClick, onRemove }: ProductionCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const FormatIcon = formatIcons[item.format] || Video;
  const statusInfo = statusConfig[item.status];
  const StatusIcon = statusInfo.icon;

  const stageLabels: Record<string, string> = {
    tofu: "TOFU - Awareness",
    mofu: "MOFU - Consideration",
    bofu: "BOFU - Conversion",
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmRemove = () => {
    onRemove?.(item.id);
    setShowDeleteDialog(false);
  };

  const isComplete = item.status === "uploaded" || item.status === "approved";

  return (
    <>
      <Card
        variant="glow"
        className={`p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isComplete ? "border-primary/50 shadow-glow" : ""}`}
        onClick={onClick}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <FormatIcon className="h-4 w-4 text-primary" />
              </div>
              {item.stage && (
                <Badge variant="outline" className="text-xs">
                  {stageLabels[item.stage.toLowerCase()] || item.stage}
                </Badge>
              )}
              {(item as any).angleName && (
                <Badge variant="secondary" className="text-xs">
                  {(item as any).angleName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <StatusIcon className={`h-5 w-5 ${isComplete ? "text-primary" : "text-muted-foreground"}`} />
              {onRemove && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleRemove} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove from Production
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <h3 className="font-semibold text-lg line-clamp-2">
              {item.concept?.title || (item as any).hook || "Untitled Concept"}
            </h3>
            <p className="text-sm text-muted-foreground capitalize mt-1">
              {(item.format || "").replace(/_/g, " ") || "Unknown format"}
            </p>
          </div>

          {/* Production Notes Preview */}
          {item.production_notes && (
            <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 rounded-lg p-2">
              {item.production_notes}
            </p>
          )}

          {/* Status & Action */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            <Button
              variant={isComplete ? "lumi" : "outline"}
              size="sm"
              disabled={isComplete}
            >
              {statusInfo.buttonText}
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Production?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{item.concept?.title || (item as any).hook || "this concept"}" from your production list. 
              You can always re-add it from the Creative dashboard later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
