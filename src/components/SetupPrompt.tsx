import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, type LucideIcon } from "lucide-react";

interface SetupPromptProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  tone?: "info" | "warning";
  autoTask?: { title: string; link_to: string };
  className?: string;
}

/**
 * App-wide "we need X" inline panel.
 * Never show a blank panel or raw error when required input is missing —
 * use SetupPrompt instead. When `autoTask` is provided, a row is created in
 * the `tasks` table on mount (deduped by exact title) so the missing item
 * also surfaces in the tray.
 */
export function SetupPrompt({
  icon: Icon = Sparkles,
  title,
  description,
  ctaLabel,
  onCta,
  tone = "info",
  autoTask,
  className,
}: SetupPromptProps) {
  const taskCreatedRef = useRef(false);

  useEffect(() => {
    if (!autoTask || taskCreatedRef.current) return;
    taskCreatedRef.current = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u?.user?.id;
        if (!userId) return;
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("user_id", userId)
          .eq("title", autoTask.title)
          .neq("status", "completed")
          .limit(1);
        if (existing && existing.length > 0) return;
        await supabase.from("tasks").insert({
          user_id: userId,
          title: autoTask.title,
          link_to: autoTask.link_to,
          source: "setup_prompt",
          status: "open",
        });
      } catch {
        /* non-blocking */
      }
    })();
  }, [autoTask?.title, autoTask?.link_to]);

  const toneCls =
    tone === "warning"
      ? "border-amber-200 bg-amber-50/60 dark:bg-amber-500/5"
      : "border-border bg-muted/30";
  const iconCls = tone === "warning" ? "text-amber-600" : "text-lumi-pink-1";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex items-start gap-3",
        toneCls,
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", iconCls)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Button
        size="sm"
        variant={tone === "warning" ? "default" : "outline"}
        onClick={(e) => {
          e.stopPropagation();
          onCta();
        }}
        className="flex-shrink-0"
      >
        {ctaLabel}
      </Button>
    </div>
  );
}

export default SetupPrompt;
