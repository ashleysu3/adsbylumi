import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, ArrowRight, Sparkles } from "lucide-react";
import { useTasks, useOpenTaskCount, Task } from "@/hooks/useTasks";
import { TaskExecuteDialog } from "@/components/TaskExecuteDialog";
import { TaskActionType } from "@/lib/task-executors";

export function TasksTray() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const count = useOpenTaskCount();
  const { tasks, loading, updateStatus, refetch } = useTasks("open");
  const [execTask, setExecTask] = useState<Task | null>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open tasks"
          className="relative rounded-full p-2 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <CheckSquare className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>My Tasks</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No tasks right now — you're all caught up.
            </p>
          )}
          {tasks.map((t) => (
            <div key={t.id} className="border rounded-lg p-3 flex gap-3 items-start">
              <Checkbox
                checked={false}
                onCheckedChange={() => updateStatus(t.id, "done")}
                className="mt-1"
                aria-label="Mark task done"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {t.action_type && ["pause", "budget", "rotate"].includes(t.action_type) ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setExecTask(t)}
                    >
                      <Sparkles className="h-3 w-3" /> LUMI can do this
                    </Button>
                  ) : t.link_to ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setOpen(false);
                        navigate(t.link_to!);
                      }}
                    >
                      Go <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => { setOpen(false); navigate("/tasks"); }}
          >
            View all tasks
          </Button>
        </div>

        <TaskExecuteDialog
          task={execTask && execTask.action_type ? {
            id: execTask.id,
            title: execTask.title,
            action_type: execTask.action_type as TaskActionType,
            action_payload: execTask.action_payload,
          } : null}
          open={!!execTask}
          onOpenChange={(o) => { if (!o) setExecTask(null); }}
          onDone={() => { setExecTask(null); refetch(); }}
        />
      </SheetContent>
    </Sheet>
  );
}
