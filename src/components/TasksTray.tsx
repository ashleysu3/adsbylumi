import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ArrowRight,
  CheckSquare,
  Clock,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTasks, useOpenTaskCount, Task, TaskFilter } from "@/hooks/useTasks";
import { TaskExecuteDialog } from "@/components/TaskExecuteDialog";
import { TaskActionType } from "@/lib/task-executors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================================
// TasksTray — LUMI's recommended tasks + the user's own tasks, in a slide-out
// panel that lives on top of every dashboard screen.
//
// The little tab that opens it is draggable: pick an edge (left/right) and any
// vertical position, and it stays there (saved per user).
// ============================================================================

const POS_KEY = "lumi:tasks-tray:pos";

type TrayPos = { edge: "left" | "right"; topPct: number };

const DEFAULT_POS: TrayPos = { edge: "right", topPct: 55 };

const SNOOZE_PRESETS: { label: string; build: () => Date }[] = [
  { label: "1 hour", build: () => new Date(Date.now() + 60 * 60 * 1000) },
  {
    label: "Later today",
    build: () => {
      const d = new Date();
      d.setHours(d.getHours() + 4);
      return d;
    },
  },
  {
    label: "Tomorrow morning",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Next week",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

function formatSnoozeUntil(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// LUMI's evaluate-campaign-status engine scores every recommendation 0-100.
function impactBadge(task: Task): { label: string; className: string } | null {
  if (task.source !== "recommendation") return null;
  const impact = (task.action_payload as any)?.impact;
  if (typeof impact !== "number") return null;
  if (impact >= 70)
    return {
      label: "High impact",
      className:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
    };
  if (impact >= 35)
    return {
      label: "Medium impact",
      className:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
    };
  return { label: "Low impact", className: "bg-muted text-muted-foreground border-border" };
}

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "snoozed", label: "Snoozed" },
  { key: "done", label: "Done" },
];

export function TasksTray() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const count = useOpenTaskCount();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>("open");
  const { tasks, loading, updateStatus, snoozeTask, unsnoozeTask, deleteTask, createTask, refetch } =
    useTasks(filter);

  const [execTask, setExecTask] = useState<Task | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── tab position (per user) ────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [pos, setPos] = useState<TrayPos>(DEFAULT_POS);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`${POS_KEY}:${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.edge && typeof parsed.topPct === "number") setPos(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [userId]);

  const savePos = useCallback(
    (next: TrayPos) => {
      setPos(next);
      if (!userId) return;
      try {
        localStorage.setItem(`${POS_KEY}:${userId}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      movedRef.current = true;
      const topPct = Math.min(92, Math.max(6, (e.clientY / window.innerHeight) * 100));
      const edge: TrayPos["edge"] = e.clientX < window.innerWidth / 2 ? "left" : "right";
      setPos({ edge, topPct });
    };
    const up = () => {
      setDragging(false);
      setPos((p) => {
        savePos(p);
        return p;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, savePos]);

  // ── open via ?tasks=open or a global event ─────────────────────────────
  useEffect(() => {
    if (searchParams.get("tasks") === "open") {
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("tasks");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-tasks-tray", handler);
    return () => window.removeEventListener("open-tasks-tray", handler);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        link_to: linkTo.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      setLinkTo("");
      setShowForm(false);
      toast.success("Task added");
    } catch {
      toast.error("Couldn't add task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSnooze = async (id: string, until: Date, label: string) => {
    await snoozeTask(id, until);
    toast.success(`Snoozed until ${label}`);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteTask(confirmDeleteId);
    setConfirmDeleteId(null);
    toast.success("Task deleted");
  };

  const side = pos.edge;

  return (
    <>
      {/* ── draggable tab ─────────────────────────────────────────────── */}
      <button
        type="button"
        aria-label="My tasks"
        onPointerDown={(e) => {
          movedRef.current = false;
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          setDragging(true);
        }}
        onClick={() => {
          if (movedRef.current) return; // it was a drag, not a click
          setOpen((v) => !v);
        }}
        style={{ top: `${pos.topPct}%` }}
        className={cn(
          "fixed z-40 -translate-y-1/2 select-none touch-none",
          "flex items-center gap-1.5 px-2.5 py-3 text-white shadow-lg",
          "bg-gradient-to-b from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1",
          "transition-[box-shadow,transform] hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring",
          side === "right" ? "right-0 rounded-l-xl" : "left-0 rounded-r-xl",
          dragging && "cursor-grabbing opacity-90",
        )}
      >
        <GripVertical className="h-3 w-3 opacity-70" />
        <CheckSquare className="h-4 w-4" />
        {count > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white/90 text-[10px] font-bold text-lumi-purple-1 flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* ── panel ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed top-0 bottom-0 z-50 w-full sm:w-[420px] bg-background border-border shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          open
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-base font-semibold">My Tasks</h2>
            <p className="text-xs text-muted-foreground">
              What LUMI recommends next, plus anything you add.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Close tasks">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  filter === f.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {showForm && (
          <form onSubmit={submit} className="mx-4 mt-3 border rounded-lg p-3 space-y-2 bg-card">
            <Input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <Input
              placeholder="Link to route (optional, e.g. /studio)"
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
                {submitting ? "Adding…" : "Add task"}
              </Button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground py-12 text-center border rounded-lg">
              {filter === "open"
                ? "No tasks right now — you're all caught up."
                : filter === "snoozed"
                  ? "Nothing snoozed."
                  : `No ${filter} tasks.`}
            </p>
          )}
          {tasks.map((t) => {
            const badge = impactBadge(t);
            return (
              <div key={t.id} className="border rounded-lg p-3 flex gap-3 items-start bg-card">
                {filter === "open" ? (
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => updateStatus(t.id, "done")}
                    className="mt-1"
                    aria-label="Mark done"
                  />
                ) : (
                  <div className="w-4 h-4 mt-1" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{t.title}</p>
                    {badge && (
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full border shrink-0 ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  )}
                  {filter === "snoozed" && t.snoozed_until && (
                    <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Reappears {formatSnoozeUntil(t.snoozed_until)}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {t.action_type && ["pause", "budget", "rotate"].includes(t.action_type) ? (
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setExecTask(t)}>
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

                    {filter === "open" && (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                            >
                              <Clock className="h-3 w-3 mr-1" /> Snooze
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {SNOOZE_PRESETS.map((p) => (
                              <DropdownMenuItem
                                key={p.label}
                                onClick={() => handleSnooze(t.id, p.build(), p.label)}
                              >
                                {p.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => updateStatus(t.id, "dismissed")}
                        >
                          <X className="h-3 w-3 mr-1" /> Dismiss
                        </Button>
                      </>
                    )}

                    {filter === "snoozed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => unsnoozeTask(t.id)}
                      >
                        Wake up now
                      </Button>
                    )}

                    {filter === "done" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => updateStatus(t.id, "open")}
                      >
                        Reopen
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setConfirmDeleteId(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="px-4 py-2 border-t text-[11px] text-muted-foreground">
          Tip: drag the tab to move this list to either side of your screen.
        </p>
      </aside>

      <TaskExecuteDialog
        task={
          execTask && execTask.action_type
            ? {
                id: execTask.id,
                title: execTask.title,
                action_type: execTask.action_type as TaskActionType,
                action_payload: execTask.action_payload,
              }
            : null
        }
        open={!!execTask}
        onOpenChange={(o) => {
          if (!o) setExecTask(null);
        }}
        onDone={() => {
          setExecTask(null);
          refetch();
        }}
      />

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task entirely. If LUMI auto-created it for missing setup, it may come
              back next time that setup is still missing — dismiss it instead if you'd rather just
              hide it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
