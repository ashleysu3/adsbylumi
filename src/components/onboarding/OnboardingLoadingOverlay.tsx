import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import lumiLogo from "@/assets/lumi-logo.png";

// What LUMI does beyond "makes one ad" — surfaced while the user is a
// captive audience waiting for their brand read to finish, instead of
// staring at a blank spinner. Each one is a real, shipped feature, not a
// roadmap promise.
const FEATURES: { title: string; blurb: string }[] = [
  {
    title: "A real psychological profile of your audience",
    blurb: "LUMI maps out what your ideal client is afraid of, wants, and needs to hear before they'll buy — every ad gets written to hit that, not just \"sound nice.\"",
  },
  {
    title: "3 hooks for every talking-head video",
    blurb: "Every script comes with 3 different opening hooks, so you can test what actually stops the scroll instead of guessing which one works.",
  },
  {
    title: "B-roll that's actually yours",
    blurb: "Upload your own b-roll and LUMI weaves it into your scripts automatically — or hand you a shot list to film if you're starting from scratch.",
  },
  {
    title: "Feed LUMI your best material",
    blurb: "Upload past testimonials, scripts, and copy that's already worked — LUMI studies your voice and folds it into everything it writes next.",
  },
  {
    title: "Meta's playbook, built in",
    blurb: "Ads Manager changes constantly. LUMI tracks Meta's current best practices for you, so campaigns are built the right way — no more digging through settings.",
  },
  {
    title: "A weekly \"what to do next\" email",
    blurb: "Every week, LUMI tells you what's working, what's not, and the one thing to change — no digging through reports required.",
  },
  {
    title: "A real goal for every campaign",
    blurb: "Set a goal per campaign — leads, calls, sales — and LUMI tracks whether you're actually hitting it, not just how much you spent.",
  },
  {
    title: "Budget advice that adapts to you",
    blurb: "Tell LUMI what you can spend, and it recommends how to allocate it — and adjusts strategy as your budget changes.",
  },
  {
    title: "A strategy library, not a blank page",
    blurb: "LUMI comes with proven campaign strategies built in — pick your goal and it hands you a real funnel, not a guess.",
  },
];

interface Props {
  visible: boolean;
  statusLabel: React.ReactNode;
}

export function OnboardingLoadingOverlay({ visible, statusLabel }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % FEATURES.length), 4200);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <div
      className={
        "fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-500 " +
        (visible ? "opacity-100" : "opacity-0 pointer-events-none")
      }
      aria-hidden={!visible}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card shadow-xl p-7 sm:p-8 text-center space-y-5">
        <img src={lumiLogo} alt="Lumi" className="h-6 object-contain mx-auto" />

        <div className="text-sm font-medium text-foreground flex items-center justify-center gap-2 min-h-[20px]">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          <span>{statusLabel}</span>
        </div>

        <div className="h-px bg-border" />

        <div key={idx} className="space-y-1.5 animate-fade-in min-h-[100px] sm:min-h-[92px]">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            While you wait
          </div>
          <h3 className="text-base font-semibold text-foreground">{FEATURES[idx].title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{FEATURES[idx].blurb}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-1">
          {FEATURES.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === idx ? "w-4 bg-foreground/70" : "w-1.5 bg-border")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
