import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowRight, Clock, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useTasks, TaskFilter } from "@/hooks/useTasks";
import { toast } from "sonner";

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
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// LUMI's evaluate-campaign-status engine already scores every recommendation
// 0-100 (estimateImpact) to rank which one to surface — previously computed
// and then discarded once it became a task. Surfacing it here mirrors how
// Meta/Google's own ad tools show an impact score on their recommendations,
// so it's a pattern these users already know from the platforms themselves.
function impactBadge(task: { source: string; action_payload: any }): { label: string; className: string } | null {
  if (task.source !== "recommendation") return null;
  const impact = task.action_payload?.impact;
  if (typeof impact !== "number") return null;
  if (impact >= 70) {
    return { label: "High impact", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30" };
  }
  if (impact >= 35) {
    return { label: "Medium impact", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30" };
  }
  return { label: "Low impact", className: "bg-muted text-muted-foreground border-border" };
}

export default function Tasks() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TaskFilter>("open");
  const { tasks, loading, updateStatus, snoozeTask, unsnoozeTask, deleteTask, createTask } =
    useTasks(filter);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      setTitle(""); setDescription(""); setLinkTo(""); setShowForm(false);
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

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">My Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your action items live here.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Add task
          </Button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="border rounded-lg p-4 space-y-3 bg-card">
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
              placeholder="Link to route (optional, e.g. /campaigns)"
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
                {submitting ? "Adding…" : "Add task"}
              </Button>
            </div>
          </form>
        )}

        <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskFilter)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="snoozed">Snoozed</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
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
          {tasks.map((t) => (
            <div key={t.id} className="border rounded-lg p-4 flex gap-3 items-start bg-card">
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
                  <p className="font-medium">{t.title}</p>
                  {(() => {
                    const badge = impactBadge(t);
                    return badge ? (
                      <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                )}
                {filter === "snoozed" && t.snoozed_until && (
                  <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Reappears {formatSnoozeUntil(t.snoozed_until)}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {t.link_to && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(t.link_to!)}>
                      Go <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                  {t.action_type && (
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> LUMI can handle this (coming soon)
                    </span>
                  )}

                  {filter === "open" && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">
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

                  {filter !== "open" && filter !== "snoozed" && (
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
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task entirely. If it was auto-created by LUMI for missing setup, it may
              come back the next time that setup is still missing — dismiss it instead if you'd rather
              just hide it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
