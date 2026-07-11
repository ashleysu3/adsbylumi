import { Heart, Frown, ShieldAlert, Flame } from "lucide-react";

// The buyer-psychology reveal — the part that, walking people through it live,
// consistently sold them: seeing their own buyer described better than they
// could describe them. Shows who they're for, the pains, the desires, the
// objections in the way, and what actually moves that person to buy.

const asList = (v: unknown, max = 3): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()).slice(0, max)
    : [];
const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function Column({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof Heart;
  label: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl bg-muted/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
      </div>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm leading-snug flex gap-2">
            <span className="text-primary/50 select-none">—</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BuyerPsychology({
  idealClient,
  ap,
}: {
  idealClient?: string;
  ap?: Record<string, any> | null;
}) {
  const who = (idealClient || "").trim();
  const demographics = asText(ap?.demographics);
  const psychographics = asText(ap?.psychographics);
  const pains = asList(ap?.pain_points || ap?.painPoints);
  const desires = asList(ap?.desires);
  const objections = asList(ap?.objections);
  const motivations = asText(ap?.motivations);

  const hasAnything = who || demographics || psychographics || pains.length || desires.length || objections.length || motivations;
  if (!hasAnything) return null;

  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl text-center mb-2">Who your buyer really is</h2>
      <p className="text-sm text-muted-foreground text-center mb-8 max-w-lg mx-auto">
        Every word in this kit was written from this — not from a template. This is the person your ads
        are built to reach.
      </p>

      {/* Who they are */}
      {(who || demographics || psychographics) && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            Your ideal client
          </div>
          {who && <p className="text-base leading-snug font-medium">{who}</p>}
          {(demographics || psychographics) && (
            <p className="text-sm text-muted-foreground leading-snug mt-2">
              {[demographics, psychographics].filter(Boolean).join(" ")}
            </p>
          )}
        </div>
      )}

      {/* Pains · Desires · Objections */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Column icon={Frown} label="What keeps them up" items={pains} />
        <Column icon={Heart} label="What they secretly want" items={desires} />
        <Column icon={ShieldAlert} label="What holds them back" items={objections} />
      </div>

      {/* What actually moves them to buy */}
      {motivations && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-[11px] uppercase tracking-wide text-primary font-semibold">
              What actually moves them to buy
            </span>
          </div>
          <p className="text-sm leading-relaxed">{motivations}</p>
        </div>
      )}
    </div>
  );
}
