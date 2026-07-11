// The buyer-psychology trio: who you're for, the pain, the desire — the same
// fields the onboarding reveal shows, because every word in the kit was
// written from them.
export function BuyerPsychology({
  idealClient,
  pain,
  desire,
}: {
  idealClient?: string;
  pain?: string;
  desire?: string;
}) {
  if (!idealClient && !pain && !desire) return null;
  return (
    <div>
      <h2 className="font-display text-2xl sm:text-3xl text-center mb-2">Who your buyer is</h2>
      <p className="text-sm text-muted-foreground text-center mb-8">
        Every word in this kit was written from this — not from a template.
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        {idealClient && (
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Who you're for
            </div>
            <p className="text-sm leading-snug">{idealClient}</p>
          </div>
        )}
        {pain && (
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Pain point
            </div>
            <p className="text-sm leading-snug">{pain}</p>
          </div>
        )}
        {desire && (
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
              Desire
            </div>
            <p className="text-sm leading-snug">{desire}</p>
          </div>
        )}
      </div>
    </div>
  );
}
