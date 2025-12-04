import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, Sparkles, Target, Layers, Zap, Users, Heart, CheckCircle, ArrowRight, Package, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollReveal, StaggerChildren, StaggerItem, FloatingElement } from "@/components/animations";

const Waitlist = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({ email: email.toLowerCase().trim() });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - email already exists
          toast.success("You're already on the list! Lumi will keep you posted. ✨");
          setIsSubmitted(true);
        } else {
          throw error;
        }
      } else {
        setIsSubmitted(true);
        toast.success("You're on the list! Lumi will keep you posted. ✨");
      }
    } catch (error) {
      console.error('Waitlist signup error:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-20 px-4">
        {/* Background glow effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-lumi-yellow/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center justify-center gap-3">
              <FloatingElement duration={3} distance={5}>
                <div className="w-12 h-12 rounded-2xl bg-gradient-warm flex items-center justify-center shadow-lumi">
                  <Lightbulb className="w-6 h-6 text-primary-foreground" />
                </div>
              </FloatingElement>
              <span className="font-display text-3xl text-foreground">Lumi</span>
            </div>
          </motion.div>

          {/* Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground mb-6 leading-tight">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-lumi-yellow" />
              </span>{" "}
              Lumi is coming.
              <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Let's light up your ads.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              The warm, friendly ads assistant that builds your Meta ads for you — strategy, creative, setup, and publishing.
              <br />
              <span className="font-semibold text-foreground">No Ads Manager required.</span>
            </p>

            <div className="flex flex-col items-center gap-4">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 rounded-2xl border-border bg-card px-4 text-base"
                  disabled={isSubmitted}
                />
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 px-6 rounded-2xl whitespace-nowrap"
                  disabled={isSubmitting || isSubmitted}
                >
                  {isSubmitting ? (
                    "Saving your spot..."
                  ) : isSubmitted ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      You're in!
                    </>
                  ) : (
                    <>
                      Join the Waitlist
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground">
                Early access begins <span className="font-semibold text-primary">January 8th</span>. Only the waitlist gets invites.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What Lumi Does Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-8">
              Lumi builds your ads — <span className="text-primary">the right way.</span>
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <Card className="border-0 shadow-card bg-card">
              <CardContent className="p-8">
                <p className="text-lg text-foreground mb-6">
                  You choose your offer.
                  <br />
                  <span className="font-semibold">Lumi handles everything else:</span>
                </p>

                <ul className="space-y-3 text-muted-foreground mb-8">
                  {[
                    "The correct campaign structure",
                    "The right optimization event",
                    "Your Grow → Nurture → Convert creative",
                    "Buyer psychology–based messaging",
                    "Scripts, b-roll, carousels, & copy",
                    "Upload guidance",
                    "AND the full campaign build inside Ads Manager",
                    "All using the most up-to-date Meta best practices"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="bg-muted rounded-2xl p-6 text-center">
                  <p className="text-foreground font-medium">
                    Lumi isn't a tool you "learn."
                    <br />
                    <span className="text-primary">She's the assistant who does the building for you.</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* Why Join the Waitlist Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              The Lumi Early Access Waitlist
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Lumi access begins January 8th, and invites will be released slowly and intentionally to manage AI load, ensure stability, and support early users.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="bg-lumi-grey rounded-3xl p-8 mb-8">
              <p className="font-semibold text-foreground mb-4">This means:</p>
              <div className="space-y-3 text-left max-w-md mx-auto">
                {[
                  "Only the waitlist will receive access invitations",
                  "Invites roll out in waves (not all at once)",
                  "Joining early increases your place in line",
                  "You'll get Lumi updates and behind-the-scenes previews"
                ].map((item, i) => (
                  <p key={i} className="flex items-center gap-3 text-muted-foreground">
                    <Sparkles className="w-4 h-4 text-lumi-yellow shrink-0" />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <p className="text-foreground font-medium mb-6">
              If you want a chance at early access,
              <br />
              <span className="text-primary">you need to be on the waitlist.</span>
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-12 rounded-2xl border-border bg-card px-4 text-base"
                disabled={isSubmitted}
              />
              <Button 
                type="submit" 
                size="lg" 
                className="h-12 px-6 rounded-2xl whitespace-nowrap"
                disabled={isSubmitting || isSubmitted}
              >
                {isSubmitting ? (
                  "Saving your spot..."
                ) : isSubmitted ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    You're in!
                  </>
                ) : (
                  <>
                    Join the Waitlist
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </ScrollReveal>
        </div>
      </section>

      {/* Access Details Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-8">
              How early access works
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <Card className="border-0 shadow-card bg-card">
              <CardContent className="p-8">
                <p className="text-lg text-muted-foreground mb-6">
                  Lumi is powerful — she builds real campaigns inside real ad accounts.
                  <br />
                  To keep her running smoothly, we're releasing access in small waves starting January 8th.
                </p>

                <p className="font-semibold text-foreground mb-4">This allows us to:</p>
                <ul className="space-y-3 text-muted-foreground mb-8">
                  {[
                    "Keep Lumi stable and glowing",
                    "Manage AI processing load",
                    "Offer real support to early users",
                    "Implement feedback quickly",
                    "Expand access intentionally"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                        <Lightbulb className="w-3 h-3 text-primary" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="text-center bg-gradient-warm rounded-2xl p-6">
                  <p className="text-primary-foreground font-medium">
                    Everyone on the waitlist will have a chance to join —
                    <br />
                    your place in line is based on when you sign up.
                  </p>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* How Lumi Works Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-12">
              How Lumi Works
            </h2>
          </ScrollReveal>

          <StaggerChildren className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Package,
                title: "Choose your offer",
                description: "Lumi picks the perfect campaign type using current best practices."
              },
              {
                icon: Layers,
                title: "Get your Customer Journey creative",
                description: "Grow → Nurture → Convert scripts, b-roll, carousels, and copy."
              },
              {
                icon: Wand2,
                title: "Lumi builds the whole campaign for you",
                description: "No Ads Manager required. One click → done."
              }
            ].map((card, i) => (
              <StaggerItem key={i}>
                <Card className="border-0 shadow-card bg-card h-full hover:shadow-elevated transition-shadow duration-300">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-warm flex items-center justify-center mx-auto mb-4 shadow-lumi">
                      <card.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-heading text-xl text-foreground mb-2">{card.title}</h3>
                    <p className="text-muted-foreground">{card.description}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Psychology + Customer Journey Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Powered by buyer psychology.
              <br />
              <span className="text-primary">Delivered through Meta's automated sequencing.</span>
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Your buyers move through a natural customer journey:
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {[
                { stage: "Grow", action: "Discover", color: "bg-primary" },
                { stage: "Nurture", action: "Trust", color: "bg-secondary" },
                { stage: "Convert", action: "Act", color: "bg-lumi-yellow" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`px-4 py-2 rounded-full ${item.color} text-primary-foreground font-semibold`}>
                    {item.stage}
                  </div>
                  <span className="text-muted-foreground">→ {item.action}</span>
                  {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground mx-2 hidden sm:block" />}
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <Card className="border-0 shadow-card bg-card">
              <CardContent className="p-8">
                <p className="text-muted-foreground mb-4">
                  Lumi builds creative for each stage using real buyer psychology.
                  <br />
                  Then Meta's automated sequencing shows the right message to the right people at the right time.
                </p>
                <p className="font-semibold text-foreground">
                  You never need to learn any of this.
                  <br />
                  <span className="text-primary">Lumi handles it behind the scenes.</span>
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-8">
              Who Lumi is for
            </h2>
          </ScrollReveal>

          <StaggerChildren className="flex flex-wrap justify-center gap-3">
            {[
              "Coaches",
              "Course creators",
              "Service providers",
              "Digital product creators",
              "Small business owners",
              "Creators who want simple, guided, done-for-you ads"
            ].map((item, i) => (
              <StaggerItem key={i}>
                <div className="px-5 py-3 rounded-full bg-muted border border-border text-foreground font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors duration-300 cursor-default">
                  {item}
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-lumi-yellow/25 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <FloatingElement duration={4} distance={8}>
              <div className="w-20 h-20 rounded-3xl bg-gradient-warm flex items-center justify-center mx-auto mb-8 shadow-glow">
                <Lightbulb className="w-10 h-10 text-primary-foreground" />
              </div>
            </FloatingElement>

            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Turn on the light — <span className="text-primary">Lumi is almost here.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-8">
              Be among the first to access Lumi when early invites begin rolling out January 8th.
            </p>

            <div className="flex flex-col items-center gap-4">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 rounded-2xl border-border bg-card px-4 text-base"
                  disabled={isSubmitted}
                />
                <Button 
                  type="submit" 
                  size="lg" 
                  className="h-12 px-6 rounded-2xl whitespace-nowrap"
                  disabled={isSubmitting || isSubmitted}
                >
                  {isSubmitting ? (
                    "Saving your spot..."
                  ) : isSubmitted ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      You're in!
                    </>
                  ) : (
                    <>
                      Join the Waitlist
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                See How Lumi Works
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-warm flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl text-foreground">Lumi</span>
          </div>

          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No pressure. No spam. Just Lumi updates and a warm invite when your spot is ready.
          </p>

          <p className="text-xs text-muted-foreground/60 mt-6">
            © {new Date().getFullYear()} Lumi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Waitlist;
