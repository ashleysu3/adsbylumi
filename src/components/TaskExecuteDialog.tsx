// Confirm-and-execute dialog used by the TasksTray "LUMI can do this"
// button. Wraps the same executors the /performance hero uses so both
// surfaces fire the exact same Meta calls behind the same confirm step.
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, DollarSign, RefreshCw, Pause } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  executePause,
  executeBudget,
  executeRotate,
  previewBudget,
  closeMatchingTasks,
  TaskActionType,
} from "@/lib/task-executors";

export interface ExecutableTaskShape {
  id: string;
  title: string;
  action_type: TaskActionType;
  action_payload: any;
}

interface Props {
  task: ExecutableTaskShape | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Called after a successful execution. Tray can use it to refetch. */
  onDone?: () => void;
}

export function TaskExecuteDialog({ task, open, onOpenChange, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false);

  // Budget-specific state
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<{ isCBO: boolean; level: string; current: number | null; adSetId: string | null } | null>(null);
  const [newBudgetInput, setNewBudgetInput] = useState("");

  // Rotate-specific state
  const [bench, setBench] = useState<Array<{ id: string; meta_ad_id: string; production_item_id: string | null }>>([]);
  const [selectedBenchId, setSelectedBenchId] = useState<string>("");

  useEffect(() => {
    if (!open || !task) return;
    setPreview(null);
    setNewBudgetInput("");
    setBench([]);
    setSelectedBenchId("");

    if (task.action_type === "budget") {
      (async () => {
        setLoadingPreview(true);
        try {
          const adSetId = task.action_payload?.entityLevel === "adset" ? task.action_payload?.entityId : undefined;
          const res = await previewBudget({ workspaceId: task.action_payload.workspaceId, adSetId });
          if (!res.ok) {
            toast.error("Couldn't read current budget", { description: res.error });
            onOpenChange(false);
            return;
          }
          const current = res.current;
          const kind = task.action_payload?.kind || "increase_budget";
          const proposed = current
            ? Math.max(1, Math.round((kind === "increase_budget" ? current * 1.25 : current * 0.75)))
            : kind === "increase_budget" ? 25 : 10;
          setPreview({ isCBO: res.isCBO, level: res.level, current, adSetId: res.adSetId });
          setNewBudgetInput(String(proposed));
        } finally {
          setLoadingPreview(false);
        }
      })();
    } else if (task.action_type === "rotate") {
      (async () => {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("creative_bench")
          .select("id, meta_ad_id, production_item_id, retest_eligible_at, status")
          .eq("brand_id", task.action_payload.brandId)
          .eq("workspace_id", task.action_payload.workspaceId)
          .in("status", ["bench", "paused", "retesting"])
          .not("meta_ad_id", "is", null);
        if (error) {
          toast.error("Couldn't load bench creatives", { description: error.message });
          onOpenChange(false);
          return;
        }
        const cands = (data || [])
          .filter((r: any) => !r.retest_eligible_at || r.retest_eligible_at <= nowIso)
          .map((r: any) => ({ id: r.id, meta_ad_id: r.meta_ad_id, production_item_id: r.production_item_id }));
        if (cands.length === 0) {
          toast.message("No fresh creative ready to swap in.");
          onOpenChange(false);
          return;
        }
        setBench(cands);
        setSelectedBenchId(cands[0].id);
      })();
    }
  }, [open, task]);

  async function markTaskDone(id: string) {
    await supabase
      .from("tasks" as any)
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function handleConfirm() {
    if (!task) return;
    setSubmitting(true);
    try {
      let res: { ok: boolean; error?: string };
      if (task.action_type === "pause") {
        res = await executePause({
          workspaceId: task.action_payload.workspaceId,
          brandId: task.action_payload.brandId,
          entityId: task.action_payload.entityId,
          entityLevel: task.action_payload.entityLevel,
          reason: task.action_payload.reason || task.title,
        });
        if (res.ok) toast.success("Paused in Meta");
      } else if (task.action_type === "budget") {
        const newBudget = parseFloat(newBudgetInput);
        if (!Number.isFinite(newBudget) || newBudget < 1) {
          toast.error("Enter a valid daily budget (min $1).");
          setSubmitting(false);
          return;
        }
        const adSetId = preview?.isCBO ? undefined : (task.action_payload?.entityLevel === "adset" ? task.action_payload?.entityId : undefined);
        res = await executeBudget({ workspaceId: task.action_payload.workspaceId, newBudget, adSetId });
        if (res.ok) toast.success(`Budget updated to $${newBudget}/day in Meta`);
      } else if (task.action_type === "rotate") {
        const picked = bench.find((c) => c.id === selectedBenchId);
        if (!picked) { toast.error("Pick a creative to swap in."); setSubmitting(false); return; }
        res = await executeRotate({
          workspaceId: task.action_payload.workspaceId,
          brandId: task.action_payload.brandId,
          fatigueAdId: task.action_payload.fatigueAdId || task.action_payload.entityId,
          benchAdId: picked.meta_ad_id,
          reason: task.action_payload.reason || task.title,
        });
        if (res.ok) toast.success("Creative swapped in Meta");
      } else {
        res = { ok: false, error: "Unknown action" };
      }

      if (!res.ok) {
        toast.error("LUMI couldn't complete this", { description: res.error });
        return;
      }
      await markTaskDone(task.id);
      // Also close any sibling open task targeting same entity+action.
      await closeMatchingTasks({ actionType: task.action_type, entityId: task.action_payload.entityId });
      onDone?.();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!task) return null;

  const renderBody = () => {
    if (task.action_type === "pause") {
      return (
        <AlertDialogDescription>
          This will stop spending in Meta immediately. You can re-enable it any time in Meta or from See all metrics.
        </AlertDialogDescription>
      );
    }
    if (task.action_type === "budget") {
      return (
        <AlertDialogDescription asChild>
          <div className="space-y-3 pt-2">
            {loadingPreview && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading current budget from Meta…
              </div>
            )}
            {!loadingPreview && preview && (
              <>
                <div className="text-sm">
                  <span className="font-medium text-foreground">Current: ${preview.current?.toFixed(2) ?? "—"}/day</span>{" "}
                  <span className="text-muted-foreground">
                    on {preview.isCBO ? "the campaign (CBO)" : preview.level?.startsWith("adset") ? "this ad set" : "the campaign"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tray-new-budget" className="text-foreground">New daily budget (USD)</Label>
                  <Input
                    id="tray-new-budget"
                    type="number"
                    min={1}
                    step="1"
                    value={newBudgetInput}
                    onChange={(e) => setNewBudgetInput(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will change spend in Meta immediately. Meta's learning may reset after large changes.
                </p>
              </>
            )}
          </div>
        </AlertDialogDescription>
      );
    }
    if (task.action_type === "rotate") {
      return (
        <AlertDialogDescription asChild>
          <div className="space-y-3 pt-2">
            <div className="text-sm">This pauses the current ad and activates the selected bench creative in Meta.</div>
            {bench.length > 1 ? (
              <RadioGroup value={selectedBenchId} onValueChange={setSelectedBenchId} className="space-y-2">
                {bench.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                    <RadioGroupItem value={c.id} id={`tray-bench-${c.id}`} />
                    <Label htmlFor={`tray-bench-${c.id}`} className="text-sm font-normal cursor-pointer">
                      <span className="font-medium text-foreground">Ad {c.meta_ad_id}</span>
                      {c.production_item_id ? ` · ${c.production_item_id}` : ""}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : bench[0] && (
              <div className="rounded-md border p-2 text-sm">
                <span className="font-medium text-foreground">Ad {bench[0].meta_ad_id}</span>
                {bench[0].production_item_id ? ` · ${bench[0].production_item_id}` : ""}
              </div>
            )}
          </div>
        </AlertDialogDescription>
      );
    }
    return null;
  };

  const titleIcon =
    task.action_type === "budget" ? <DollarSign className="h-4 w-4" /> :
    task.action_type === "rotate" ? <RefreshCw className="h-4 w-4" /> :
    <Pause className="h-4 w-4" />;

  const confirmLabel =
    task.action_type === "budget" ? "Update budget in Meta" :
    task.action_type === "rotate" ? "Swap in Meta" :
    "Pause it in Meta";

  return (
    <AlertDialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">{titleIcon} {task.title}</AlertDialogTitle>
          {renderBody()}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting || loadingPreview || (task.action_type === "budget" && !preview) || (task.action_type === "rotate" && !selectedBenchId)}
          >
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" /> Working…</>) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
