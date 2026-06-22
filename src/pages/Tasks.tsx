import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Plus, Sparkles, X } from "lucide-react";
import { useTasks, TaskStatus } from "@/hooks/useTasks";
import { toast } from "sonner";

export default function Tasks() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TaskStatus>("open");
  const { tasks, loading, updateStatus, createTask } = useTasks(filter);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkTo, setLinkTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

        <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskStatus)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
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
                <p className="font-medium">{t.title}</p>
                {t.description && (
                  <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => updateStatus(t.id, "dismissed")}
                    >
                      <X className="h-3 w-3 mr-1" /> Dismiss
                    </Button>
                  )}
                  {filter !== "open" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => updateStatus(t.id, "open")}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
