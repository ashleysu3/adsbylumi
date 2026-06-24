import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Type,
  Lightbulb,
  Layers,
  Film,
  Image as ImageIcon,
  TrendingUp,
  ArrowLeft,
  Beaker,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LabCopy } from "./LabCopy";
import { LabAngles } from "./LabAngles";
import { LabConcepts } from "./LabConcepts";
import { LabBRoll } from "./LabBRoll";
import { LabGraphics } from "./LabGraphics";
import { LabTrends } from "./LabTrends";

type ToolKey = "copy" | "angles" | "concepts" | "broll" | "graphics" | "trends";

const TOOLS: Array<{
  key: ToolKey;
  title: string;
  desc: string;
  icon: any;
  accent: string;
  comingSoon?: boolean;
}> = [
  {
    key: "copy",
    title: "Copywriting",
    desc: "Hooks, primary text, captions, headlines and CTAs in your voice.",
    icon: Type,
    accent: "from-blue-500/15 to-blue-500/0 text-blue-600",
  },
  {
    key: "angles",
    title: "Angles",
    desc: "Generate fresh angles for your offer without starting a build.",
    icon: Lightbulb,
    accent: "from-amber-500/15 to-amber-500/0 text-amber-600",
  },
  {
    key: "concepts",
    title: "Concepts",
    desc: "Ad concepts — graphic, carousel, b-roll, talking head.",
    icon: Layers,
    accent: "from-purple-500/15 to-purple-500/0 text-purple-600",
  },
  {
    key: "broll",
    title: "B-Roll",
    desc: "Shot ideas and clips you can save and reuse.",
    icon: Film,
    accent: "from-rose-500/15 to-rose-500/0 text-rose-600",
  },
  {
    key: "graphics",
    title: "Graphics",
    desc: "Generate static and carousel visuals on-brand.",
    icon: ImageIcon,
    accent: "from-emerald-500/15 to-emerald-500/0 text-emerald-600",
    comingSoon: true,
  },
  {
    key: "trends",
    title: "Trend Translator",
    desc: "Translate a trending post or sound into ad concepts for your brand.",
    icon: TrendingUp,
    accent: "from-cyan-500/15 to-cyan-500/0 text-cyan-600",
    comingSoon: true,
  },
];

export function TheLab() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [active, setActive] = useState<ToolKey | null>(null);

  useEffect(() => {
    const tool = params.get("tool") as ToolKey | null;
    if (tool && TOOLS.some((t) => t.key === tool)) setActive(tool);
    else setActive(null);
  }, [params]);

  const openTool = (k: ToolKey) => {
    const next = new URLSearchParams(params);
    next.set("mode", "lab");
    next.set("tool", k);
    setParams(next, { replace: true });
  };

  const back = () => {
    const next = new URLSearchParams(params);
    next.delete("tool");
    next.delete("seed");
    setParams(next, { replace: true });
  };

  if (active) {
    const meta = TOOLS.find((t) => t.key === active)!;
    const Icon = meta.icon;
    const seed = params.get("seed") || undefined;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft className="h-4 w-4 mr-1" /> The Lab
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-medium">{meta.title}</span>
          </div>
        </div>
        <Card>
          <CardContent className="p-4 sm:p-6">
            {active === "copy" && <LabCopy seedId={seed} />}
            {active === "angles" && <LabAngles seedId={seed} />}
            {active === "concepts" && <LabConcepts seedId={seed} />}
            {active === "broll" && <LabBRoll seedId={seed} />}
            {active === "graphics" && <LabGraphics seedId={seed} />}
            {active === "trends" && <LabTrends seedId={seed} />}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display">The Lab</h2>
            <Badge variant="secondary" className="text-xs">Free play</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Use any tool on its own — no campaign required. Every output saves to{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => navigate("/my-creatives")}
            >
              My Creatives
            </button>{" "}
            as a draft. Nothing goes live until you say so.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => openTool(t.key)}
              className="text-left group"
            >
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
                      t.accent
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                  </div>
                  <div className="text-xs text-primary inline-flex items-center group-hover:translate-x-0.5 transition-transform">
                    Open <ChevronRight className="h-3 w-3 ml-0.5" />
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
