import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2 } from "lucide-react";
import { AdFitReviewDialog, FitReview } from "./AdFitReviewDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  action_payload: any;
}

interface Props {
  workspaceId: string;
  brandId: string;
  variant?: "compact" | "full";
}

const SCORE_CLASS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-lime-100 text-lime-800 border-lime-300",
  C: "bg-amber-100 text-amber-800 border-amber-300",
  D: "bg-orange-100 text-orange-800 border-orange-300",
  F: "bg-red-100 text-red-800 border-red-300",
};

export function AdFitReviewTaskCard({ workspaceId, brandId, variant = "compact" }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, action_payload")
      .eq("action_type", "ad_fit_review")
      .eq("status", "open")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(5);
    const match = (data || []).find(
      (t: any) => t.action_payload?.workspace_id === workspaceId,
    );
    setTask(match || null);
  };

  useEffect(() => {
    load();
  }, [workspaceId, brandId]);

  if (!task) return null;
  const review = task.action_payload?.review as FitReview | undefined;
  if (!review) return null;

  return (
    <div
      className="rounded-xl border-l-4 border-l-primary bg-gradient-to-r from-lumi-orange-1/5 via-lumi-pink-1/5 to-lumi-purple-1/5 p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-2">
        <Wand2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{task.title}</p>
            <Badge
              variant="outline"
              className={`text-[10px] ${SCORE_CLASS[review.fit_score] || ""}`}
            >
              Fit {review.fit_score}
            </Badge>
          </div>
          {variant === "full" && review.attracts && (
            <p className="text-xs text-muted-foreground mt-1">
              Currently attracts: {review.attracts}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="flex-shrink-0">
          See it
        </Button>
      </div>
      <AdFitReviewDialog
        open={open}
        onOpenChange={setOpen}
        taskId={task.id}
        workspaceId={workspaceId}
        brandId={brandId}
        review={review}
        onResolved={load}
      />
    </div>
  );
}
