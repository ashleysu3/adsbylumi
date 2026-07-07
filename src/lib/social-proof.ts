// brand.social_proof is written by TWO different extractors with different
// shapes depending on which one last resolved: extract-social-proof writes a
// flat string[] ("items"), analyze-brand-voice writes a richer
// { testimonials: [{quote, attribution, result}], ... } object. Normalize both
// (plus a lone string, just in case) into a flat list of quote-like strings so
// callers can show/use real testimonial text regardless of which shape landed.
export type TestimonialQuote = { text: string; attribution?: string };

export function getTestimonialQuotes(sp: unknown): TestimonialQuote[] {
  if (!sp) return [];
  if (typeof sp === "string") return sp.trim() ? [{ text: sp.trim() }] : [];
  if (Array.isArray(sp)) {
    const out: TestimonialQuote[] = [];
    for (const item of sp) {
      if (typeof item === "string") {
        if (item.trim()) out.push({ text: item.trim() });
        continue;
      }
      if (item && typeof item === "object" && typeof (item as any).quote === "string") {
        const q = (item as any).quote.trim();
        if (q) out.push({ text: q, attribution: (item as any).attribution || undefined });
      }
    }
    return out;
  }
  if (typeof sp === "object") {
    const testimonials = (sp as any).testimonials;
    if (Array.isArray(testimonials)) {
      const out: TestimonialQuote[] = [];
      for (const t of testimonials) {
        const q = typeof t?.quote === "string" ? t.quote.trim() : "";
        if (q) out.push({ text: q, attribution: t?.attribution || undefined });
      }
      return out;
    }
  }
  return [];
}
