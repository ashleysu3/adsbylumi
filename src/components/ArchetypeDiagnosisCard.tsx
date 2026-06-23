import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Compass, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ARCHETYPE_LIST,
  diagnoseArchetype,
  getArchetype,
  type ArchetypeSlug,
  type DiagnosisInput,
} from "@/lib/business-archetypes";

type Props = {
  brandId: string;
  currentSlug: string | null | undefined;
  diagnosisInput: DiagnosisInput;
  onChanged?: (slug: ArchetypeSlug) => void;
  // Compact variant fits inline at the top of Strategy; expanded variant
  // is for the onboarding wizard step.
  variant?: "inline" | "card";
};

export function ArchetypeDiagnosisCard({
  brandId,
  currentSlug,
  diagnosisInput,
  onChanged,
  variant = "card",
}: Props) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const diagnosis = useMemo(() => diagnoseArchetype(diagnosisInput), [
    diagnosisInput.pricePoint,
    diagnosisInput.offerType,
    diagnosisInput.goal,
    diagnosisInput.offerName,
  ]);

  // When the brand hasn't been diagnosed yet, surface the auto-guess so the
  // user can confirm it with one click.
  const activeSlug = (currentSlug as ArchetypeSlug | null) || null;
  const proposed = activeSlug ?? diagnosis.slug;
  const proposedArchetype = getArchetype(proposed);

  const save = async (slug: ArchetypeSlug) => {
    if (!brandId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("brands")
        .update({
          business_model: slug,
          business_model_confirmed_at: new Date().toISOString(),
        })
        .eq("id", brandId);
      if (error) throw error;
      onChanged?.(slug);
      setOpen(false);
      toast.success(`Operating as ${getArchetype(slug)?.label}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Couldn't save business model");
    } finally {
      setSaving(false);
    }
  };

  if (!proposedArchetype) return null;

  // Compact inline form — used at the top of Strategy.tsx.
  if (variant === "inline" && activeSlug) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Compass className="h-3.5 w-3.5" />
        <span>
          Operating as <span className="font-medium text-foreground">{proposedArchetype.label}</span>
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
              Change <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <ArchetypePicker
              currentSlug={activeSlug}
              onPick={save}
              saving={saving}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Card variant — auto-guess + confirm + change.
  return (
    <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Compass className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">
              {activeSlug ? "Operating as" : "Looks like you're running"}
            </span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {proposedArchetype.label}
            </Badge>
            {!activeSlug && diagnosis.confidence !== "high" && (
              <span className="text-[11px] text-muted-foreground">
                ({diagnosis.confidence} confidence)
              </span>
            )}
          </div>
          <p className="text-sm text-foreground">{proposedArchetype.blurb}</p>
          {!activeSlug && (
            <p className="text-xs text-muted-foreground">{diagnosis.reason}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {!activeSlug && (
              <Button
                size="sm"
                onClick={() => save(diagnosis.slug)}
                disabled={saving}
                className="gap-1 rounded-xl"
              >
                <Check className="h-3.5 w-3.5" /> Yes, that's me
              </Button>
            )}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl">
                  {activeSlug ? "Change framework" : "Change"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-2">
                <ArchetypePicker
                  currentSlug={activeSlug ?? diagnosis.slug}
                  onPick={save}
                  saving={saving}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ArchetypePicker({
  currentSlug,
  onPick,
  saving,
}: {
  currentSlug: ArchetypeSlug;
  onPick: (slug: ArchetypeSlug) => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-1">
      {ARCHETYPE_LIST.map((a) => {
        const active = a.slug === currentSlug;
        return (
          <button
            key={a.slug}
            disabled={saving}
            onClick={() => onPick(a.slug)}
            className={`w-full text-left rounded-md p-2 transition-colors hover:bg-muted ${
              active ? "bg-primary/10 ring-1 ring-primary/30" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{a.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="text-[11px] text-muted-foreground">{a.tagline}</div>
          </button>
        );
      })}
    </div>
  );
}
