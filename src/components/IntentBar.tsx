import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import {
  IntentConversation,
  callIntentRouter,
  type IntentResponse,
} from "@/components/IntentConversation";

interface IntentBarProps {
  /**
   * Visual size. `sm` matches the sidebar instance; `lg` is the featured
   * Home launchpad treatment.
   */
  size?: "sm" | "lg";
  /** Placeholder when not animating. */
  placeholder?: string;
  /**
   * If provided, cycles these prompts with a typewriter animation as the
   * input placeholder while the field is empty + unfocused.
   */
  typewriterPrompts?: string[];
  /** Background class for the inner pill (so it blends with its container). */
  innerBgClassName?: string;
  className?: string;
}

/**
 * Shared "How can LUMI help today?" command bar.
 *
 * Both the sidebar (compact) and the Home launchpad (featured) render this
 * component so submit + styling stay in lockstep. Submit currently routes to
 * Create New — the real AI intent router lives at:
 *   // TODO: connect to AI intent router + task tray
 */
export function IntentBar({
  size = "sm",
  placeholder = "How can LUMI help today?",
  typewriterPrompts,
  innerBgClassName = "bg-sidebar",
  className,
}: IntentBarProps) {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState(placeholder);
  const [submitting, setSubmitting] = useState(false);
  const [convoOpen, setConvoOpen] = useState(false);
  const [convoSeed, setConvoSeed] = useState<{ userText: string; response: IntentResponse } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typewriter cycling through example prompts. Disabled while the user is
  // typing or focused so we never fight their input.
  useEffect(() => {
    if (!typewriterPrompts || typewriterPrompts.length === 0) {
      setAnimatedPlaceholder(placeholder);
      return;
    }
    if (value || focused) return;

    let cancelled = false;
    let promptIdx = 0;
    let charIdx = 0;
    let phase: "typing" | "holding" | "deleting" = "typing";
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      const full = typewriterPrompts[promptIdx % typewriterPrompts.length];
      if (phase === "typing") {
        charIdx += 1;
        setAnimatedPlaceholder(full.slice(0, charIdx));
        if (charIdx >= full.length) {
          phase = "holding";
          timer = setTimeout(tick, 1600);
          return;
        }
        timer = setTimeout(tick, 55);
      } else if (phase === "holding") {
        phase = "deleting";
        timer = setTimeout(tick, 40);
      } else {
        charIdx -= 1;
        setAnimatedPlaceholder(full.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          phase = "typing";
          promptIdx += 1;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 28);
      }
    };
    timer = setTimeout(tick, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [typewriterPrompts, placeholder, value, focused]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: connect to AI intent router + task tray
    navigate("/create");
  };

  const isLg = size === "lg";

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <div
        className={cn(
          "relative overflow-hidden",
          isLg ? "rounded-2xl p-[2px]" : "rounded-xl p-[1.5px]",
        )}
      >
        {/* Animated gradient border */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1",
            isLg ? "rounded-2xl" : "rounded-xl",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer",
            isLg ? "rounded-2xl before:rounded-2xl" : "rounded-xl before:rounded-xl",
          )}
        />
        <div
          className={cn(
            "relative flex items-center gap-2",
            innerBgClassName,
            isLg
              ? "rounded-[14px] px-5 py-4"
              : "rounded-[10px] px-2.5 py-1.5",
          )}
        >
          <Sparkles
            className={cn(
              "text-lumi-pink-1 flex-shrink-0",
              isLg ? "h-5 w-5" : "h-3.5 w-3.5",
            )}
          />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={animatedPlaceholder}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70",
              isLg ? "text-base sm:text-lg" : "text-sm",
            )}
          />
        </div>
      </div>
    </form>
  );
}

export default IntentBar;
