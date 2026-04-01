
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles, Heart, Send, CheckCircle2, Instagram, Globe, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import lumiLogo from "@/assets/lumi-logo.png";

const confettiEmojis = ["🎉", "✨", "💛", "🚀", "⭐", "🔥", "💪", "🎊"];

const SubmitReview = () => {
  const [step, setStep] = useState<"form" | "success">("form");
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [formData, setFormData] = useState({
    reviewer_name: "",
    business_name: "",
    instagram_handle: "",
    website_url: "",
    email: "",
    review_text: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reviewer_name || !formData.business_name || !formData.email || !formData.review_text) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("user_reviews" as any).insert({
        reviewer_name: formData.reviewer_name,
        business_name: formData.business_name,
        instagram_handle: formData.instagram_handle || null,
        website_url: formData.website_url || null,
        email: formData.email,
        review_text: formData.review_text,
        rating,
      } as any);
      if (error) throw error;
      setStep("success");
    } catch (err: any) {
      toast.error("Something went wrong. Please try again!");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Gradient background orbs */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[hsl(var(--lumi-purple-1))]/10 via-[hsl(var(--lumi-blue-1))]/10 to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-gradient-to-r from-[hsl(var(--lumi-pink-1))]/5 to-[hsl(var(--lumi-orange-1))]/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 md:py-20">
        {/* Logo + Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img src={lumiLogo} alt="Lumi" className="h-12 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            We'd love to hear from you{" "}
            <span className="inline-block animate-bounce">💛</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Share your experience with Lumi and get a shoutout in our marketing! Your words help other business owners find us.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Rating */}
              <motion.div
                className="bg-card rounded-2xl border border-border p-6 shadow-sm text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <p className="text-sm font-medium text-foreground mb-3">How would you rate your experience?</p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`h-10 w-10 transition-colors ${
                          star <= (hoveredStar || rating)
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {rating === 5 ? "Amazing! 🌟" : rating === 4 ? "Great! ✨" : rating === 3 ? "Good 👍" : rating === 2 ? "Okay" : "We'll do better"}
                </p>
              </motion.div>

              {/* Review Text */}
              <motion.div
                className="bg-card rounded-2xl border border-border p-6 shadow-sm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
              >
                <Label htmlFor="review" className="text-foreground font-medium mb-2 block">
                  Tell us about your experience <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  What results have you seen? What do you love most about Lumi? How has it changed the way you run ads?
                </p>
                <Textarea
                  id="review"
                  variant="gradient"
                  placeholder="Lumi completely changed how I approach my ad strategy..."
                  value={formData.review_text}
                  onChange={(e) => setFormData((p) => ({ ...p, review_text: e.target.value }))}
                  className="min-h-[140px] resize-none text-base"
                  required
                />
              </motion.div>

              {/* Contact Info */}
              <motion.div
                className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-sm font-medium text-foreground">A little about you ✨</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      Your Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      variant="gradient"
                      placeholder="Jane Smith"
                      value={formData.reviewer_name}
                      onChange={(e) => setFormData((p) => ({ ...p, reviewer_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="business" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Business Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="business"
                      variant="gradient"
                      placeholder="Your Business Co."
                      value={formData.business_name}
                      onChange={(e) => setFormData((p) => ({ ...p, business_name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    variant="gradient"
                    placeholder="you@yourbusiness.com"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="instagram" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Instagram className="h-3 w-3" /> Instagram Handle
                    </Label>
                    <Input
                      id="instagram"
                      variant="gradient"
                      placeholder="@yourbrand"
                      value={formData.instagram_handle}
                      onChange={(e) => setFormData((p) => ({ ...p, instagram_handle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="website" className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Website
                    </Label>
                    <Input
                      id="website"
                      variant="gradient"
                      placeholder="https://yourbusiness.com"
                      value={formData.website_url}
                      onChange={(e) => setFormData((p) => ({ ...p, website_url: e.target.value }))}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Shoutout note */}
              <motion.div
                className="rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-[hsl(var(--lumi-purple-1))]/10 p-4 border border-primary/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-sm text-foreground flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>
                    By submitting, you agree that we may feature your review (with your name and business) in our marketing materials. We'll tag you if you share your Instagram! 🎉
                  </span>
                </p>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full text-base bg-gradient-to-r from-primary via-secondary to-[hsl(var(--lumi-purple-1))] hover:opacity-90 transition-opacity shadow-lg"
                >
                  {submitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Sparkles className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Submit My Review
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="text-center py-12"
            >
              {/* Confetti burst */}
              <div className="relative mb-8">
                {confettiEmojis.map((emoji, i) => (
                  <motion.span
                    key={i}
                    className="absolute text-2xl"
                    style={{ left: "50%", top: "50%" }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{
                      x: Math.cos((i / confettiEmojis.length) * Math.PI * 2) * 120,
                      y: Math.sin((i / confettiEmojis.length) * Math.PI * 2) * 120,
                      opacity: 0,
                    }}
                    transition={{ duration: 1.2, delay: 0.1 * i, ease: "easeOut" }}
                  >
                    {emoji}
                  </motion.span>
                ))}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 via-secondary/20 to-[hsl(var(--lumi-purple-1))]/20 flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                  </div>
                </motion.div>
              </div>

              <motion.h2
                className="text-3xl font-bold text-foreground mb-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                You're amazing! 🎉
              </motion.h2>
              <motion.p
                className="text-lg text-muted-foreground mb-2 max-w-md mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Thank you so much for taking the time to share your experience. It means the world to us!
              </motion.p>
              <motion.p
                className="text-sm text-muted-foreground max-w-md mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                We'll review your submission and give you a shoutout soon. Keep an eye on our socials! 💛
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="mt-8"
              >
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("form");
                    setFormData({ reviewer_name: "", business_name: "", instagram_handle: "", website_url: "", email: "", review_text: "" });
                    setRating(5);
                  }}
                >
                  <Heart className="h-4 w-4 mr-2 text-secondary" />
                  Submit Another Review
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SubmitReview;
