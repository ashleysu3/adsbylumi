import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "open" | "done" | "dismissed";
export type TaskFilter = TaskStatus | "snoozed" | "all";

export interface Task {
  id: string;
  user_id: string;
  brand_id: string | null;
  title: string;
  description: string | null;
  source: string;
  link_to: string | null;
  action_type: string | null;
  action_payload: any;
  status: TaskStatus;
  snoozed_until: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export function useTasks(statusFilter: TaskFilter = "open") {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTasks([]);
        return;
      }
      setUserId(user.id);
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("tasks" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (statusFilter === "open") {
        q = q.eq("status", "open").or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
      } else if (statusFilter === "snoozed") {
        q = q.eq("status", "open").gt("snoozed_until", nowIso);
      } else if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      setTasks((data as any) || []);
    } catch (e) {
      console.error("[useTasks] fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        () => fetchTasks()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks]);

  const updateStatus = useCallback(async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    const patch: any = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    // Reopening clears any pending snooze.
    if (status === "open") patch.snoozed_until = null;
    const { error } = await supabase.from("tasks" as any).update(patch).eq("id", id);
    if (error) {
      console.error("[useTasks] update failed", error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const snoozeTask = useCallback(async (id: string, until: Date) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase
      .from("tasks" as any)
      .update({ snoozed_until: until.toISOString(), status: "open" })
      .eq("id", id);
    if (error) {
      console.error("[useTasks] snooze failed", error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const unsnoozeTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase
      .from("tasks" as any)
      .update({ snoozed_until: null })
      .eq("id", id);
    if (error) {
      console.error("[useTasks] unsnooze failed", error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks" as any).delete().eq("id", id);
    if (error) {
      console.error("[useTasks] delete failed", error);
      fetchTasks();
    }
  }, [fetchTasks]);

  const createTask = useCallback(
    async (input: { title: string; description?: string; link_to?: string; brand_id?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("tasks" as any).insert({
        user_id: user.id,
        title: input.title,
        description: input.description || null,
        link_to: input.link_to || null,
        brand_id: input.brand_id || null,
        source: "manual",
      });
      if (error) {
        console.error("[useTasks] create failed", error);
        throw error;
      }
      fetchTasks();
    },
    [fetchTasks]
  );

  return { tasks, loading, refetch: fetchTasks, updateStatus, snoozeTask, unsnoozeTask, deleteTask, createTask };
}

export function useOpenTaskCount() {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const nowIso = new Date().toISOString();
    const { count: c } = await supabase
      .from("tasks" as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "open")
      .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
    setCount(c || 0);
  }, []);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks-count:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        () => fetchCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchCount]);

  return count;
}

