
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Testimonial {
  id: string;
  reviewer_name: string;
  business_name: string;
  instagram_handle: string | null;
  approved_quote: string | null;
  review_text: string;
  rating: number;
}

const TestimonialCarousel = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("public_approved_reviews" as any)
        .select("id, reviewer_name, business_name, instagram_handle, approved_quote, review_text, rating")
        .order("approved_at", { ascending: false })
        .limit(20);
      setTestimonials((data as any) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (testimonials.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  if (loading || testimonials.length === 0) return null;

  const t = testimonials[current];
  const displayText = t.approved_quote || t.review_text;

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-primary uppercase tracking-wide mb-2">What Our Users Say</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Real results from real business owners
          </h2>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="bg-card rounded-2xl border border-border p-8 md:p-10 shadow-sm text-center relative"
            >
              <Quote className="h-8 w-8 text-primary/20 mx-auto mb-4" />
              <p className="text-lg md:text-xl text-foreground leading-relaxed mb-6 italic max-w-2xl mx-auto">
                "{displayText}"
              </p>
              <div className="flex items-center justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s <= t.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <p className="font-semibold text-foreground">{t.reviewer_name}</p>
              <p className="text-sm text-muted-foreground">
                {t.business_name}
                {t.instagram_handle && ` · ${t.instagram_handle}`}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          {testimonials.length > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === current ? "w-6 bg-primary" : "w-2 bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrent((c) => (c + 1) % testimonials.length)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default TestimonialCarousel;
