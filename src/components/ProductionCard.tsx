import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Image, LayoutGrid, CheckCircle2, Clock, Upload, FileText } from "lucide-react";

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
}

const formatIcons: Record<string, any> = {
  talking_head: Video,
  broll: Video,
  static: Image,
  carousel: LayoutGrid,
};

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
    label: "Review Copy",
    color: "bg-green-500/10 text-green-600",
    borderColor: "border-green-500",
    buttonText: "REVIEW",
    icon: FileText,
  },
  approved: {
    label: "Ready for Campaign",
    color: "bg-purple-500/10 text-purple-600",
    borderColor: "border-purple-500",
    buttonText: "READY",
    icon: CheckCircle2,
  },
};

export function ProductionCard({ item, onClick }: ProductionCardProps) {
  const FormatIcon = formatIcons[item.format] || Video;
  const statusInfo = statusConfig[item.status];
  const StatusIcon = statusInfo.icon;

  const stageLabels: Record<string, string> = {
    tofu: "TOFU - Awareness",
    mofu: "MOFU - Consideration",
    bofu: "BOFU - Conversion",
  };

  return (
    <Card
      className={`p-6 cursor-pointer transition-all hover:shadow-lg ${statusInfo.borderColor} border-2 ${
        item.status === "ready" ? "animate-pulse" : ""
      }`}
      onClick={onClick}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FormatIcon className="h-5 w-5 text-muted-foreground" />
            {item.stage && (
              <Badge variant="outline" className="text-xs">
                {stageLabels[item.stage.toLowerCase()] || item.stage}
              </Badge>
            )}
            {(item as any).angleName && (
              <Badge variant="outline" className="text-xs">
                {(item as any).angleName}
              </Badge>
            )}
          </div>
          <StatusIcon className="h-5 w-5 text-muted-foreground" />
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

        {/* Creative Guidance Preview (from creative dashboard) */}
        {((item as any).guidance || (item as any).notes || item.concept?.guidance || item.concept?.notes) && (
          <div className="text-xs text-muted-foreground bg-primary/5 rounded p-2 border border-primary/10">
            <span className="font-medium text-primary/70 block mb-1">Creative Direction:</span>
            <p className="line-clamp-2">
              {(item as any).guidance || (item as any).notes || item.concept?.guidance || item.concept?.notes}
            </p>
          </div>
        )}

        {/* Production Notes Preview */}
        {item.production_notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 rounded p-2">
            {item.production_notes}
          </p>
        )}

        {/* Status & Action */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          <Button
            variant={item.status === "approved" ? "default" : "outline"}
            size="sm"
            disabled={item.status === "approved"}
          >
            {statusInfo.buttonText}
          </Button>
        </div>
      </div>
    </Card>
  );
}
