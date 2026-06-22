import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface HookScore {
  specificity?: number; // 0-3
  tension?: number; // 0-3
  clarity?: number; // 0-2
  scroll_stop?: number; // 0-2
  total?: number; // 0-10
  banned_word_penalty?: number;
  flagged_banned_words?: string[];
}

interface HookScoreBadgeProps {
  score?: HookScore | null;
  className?: string;
  label?: string;
}

function colorClasses(total: number) {
  if (total >= 9) return "bg-green-500/15 text-green-700 border-green-500/30";
  if (total >= 7) return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (total >= 5) return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-red-500/15 text-red-700 border-red-500/30";
}

function rowBar(value: number, max: number) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-16 rounded bg-muted overflow-hidden">
      <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function HookScoreBadge({ score, className, label = "Hook score" }: HookScoreBadgeProps) {
  if (!score || typeof score.total !== "number") return null;
  const total = Math.max(0, Math.min(10, Math.round(score.total)));
  const specificity = score.specificity ?? 0;
  const tension = score.tension ?? 0;
  const clarity = score.clarity ?? 0;
  const scrollStop = score.scroll_stop ?? 0;
  const penalty = score.banned_word_penalty ?? 0;
  const flagged = score.flagged_banned_words ?? [];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0 h-5 cursor-help gap-1",
              colorClasses(total),
              className
            )}
          >
            {total}/10
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs p-3 w-60">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{label}</p>
              <span className={cn("text-xs font-bold", colorClasses(total).split(" ")[1])}>
                {total}/10
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span>Specificity</span>
                <div className="flex items-center gap-2">
                  {rowBar(specificity, 3)}
                  <span className="tabular-nums w-6 text-right">{specificity}/3</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Tension</span>
                <div className="flex items-center gap-2">
                  {rowBar(tension, 3)}
                  <span className="tabular-nums w-6 text-right">{tension}/3</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Clarity</span>
                <div className="flex items-center gap-2">
                  {rowBar(clarity, 2)}
                  <span className="tabular-nums w-6 text-right">{clarity}/2</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Scroll-stop</span>
                <div className="flex items-center gap-2">
                  {rowBar(scrollStop, 2)}
                  <span className="tabular-nums w-6 text-right">{scrollStop}/2</span>
                </div>
              </div>
            </div>
            {penalty > 0 && (
              <div className="pt-1 border-t text-[11px] text-red-600">
                −{penalty} for banned word{flagged.length === 1 ? "" : "s"}
                {flagged.length > 0 && `: ${flagged.map((w) => `"${w}"`).join(", ")}`}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              Rubric: specificity 0-3, tension 0-3, clarity 0-2, scroll-stop 0-2.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
