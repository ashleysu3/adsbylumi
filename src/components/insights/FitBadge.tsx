import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target } from "lucide-react";

export interface FitInfo {
  fit_score: "A" | "B" | "C" | "D" | "F";
  attracts?: string;
  wrong_fit_phrases?: { quote: string; why: string }[];
  right_fit_suggestions?: string[];
}

const CLS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-lime-100 text-lime-800 border-lime-300",
  C: "bg-amber-100 text-amber-800 border-amber-300",
  D: "bg-orange-100 text-orange-800 border-orange-300",
  F: "bg-red-100 text-red-800 border-red-300",
};

export function FitBadge({ fit }: { fit?: FitInfo | null }) {
  if (!fit) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-[10px] gap-1 cursor-help ${CLS[fit.fit_score] || ""}`}
          >
            <Target className="h-3 w-3" /> Fit {fit.fit_score}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs space-y-1.5">
          {fit.attracts && (
            <p>
              <span className="font-semibold">Attracts:</span> {fit.attracts}
            </p>
          )}
          {fit.wrong_fit_phrases && fit.wrong_fit_phrases.length > 0 && (
            <div>
              <p className="font-semibold">Watch:</p>
              <ul className="list-disc pl-4">
                {fit.wrong_fit_phrases.slice(0, 3).map((p, i) => (
                  <li key={i}>
                    "{p.quote}" — {p.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fit.right_fit_suggestions && fit.right_fit_suggestions.length > 0 && (
            <div>
              <p className="font-semibold">Sharpen:</p>
              <ul className="list-disc pl-4">
                {fit.right_fit_suggestions.slice(0, 3).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
