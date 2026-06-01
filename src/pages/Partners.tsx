import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, CreditCard, ExternalLink, Sparkles, TrendingUp, Heart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import lumiLogo from "@/assets/lumi-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const }
  })
};

export default function Partners() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [audienceDescription, setAudienceDescription] = useState('');
  const [promotionPlan, setPromotionPlan] = useState('');

  const scrollToSignup = () => {
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-partner-application', {
        body: {
          firstName, lastName, email, website,
          audienceDescription, promotionPlan,
          applicationType: 'partner',
        }
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error("Something went wrong. Please email hello@adsbylumi.com");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const faqItems = [
    { q: "How much do Partners earn?", a: "Partners earn 30% of every subscription payment their referrals make — every month, for as long as they stay subscribed. There's no cap on earnings." },
    { q: "When do I get paid?", a: "Payouts are sent monthly. You'll connect a PayPal or Wise account in your partner dashboard and complete a quick tax form before your first payout." },
    { q: "How does tracking work?", a: "We use a 60-day tracking cookie. As long as someone clicks your link and subscribes within 60 days, you get full credit." },
    { q: "Who is the Partner Program for?", a: "It's designed for agencies, coaches, educators, and influencers with an engaged audience in the coaching, course creation, or service-provider space." },
    { q: "How long does approval take?", a: "We review every application within 2 business days. You'll hear from us either way via email." },
    { q: "Do I need to be a LUMI subscriber?", a: "Nope! Though we find that partners who actually use LUMI convert significantly better. 😉" },
    { q: "What if I have questions?", a: "Email us at hello@adsbylumi.com and we'll get back to you within 1 business day." },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center">
          <Link to="/">
            <img src={lumiLogo} alt="Lumi" className="h-8 w-auto" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--lumi-pink-1)/0.08)] via-[hsl(var(--lumi-purple-1)/0.06)] to-[hsl(var(--lumi-orange-1)/0.08)]" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-[hsl(var(--lumi-pink-1)/0.1)] rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-[hsl(var(--lumi-purple-1)/0.08)] rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
            <Badge className="mb-6 bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 px-4 py-1.5 text-sm font-medium">
              Partner Program — 30% Recurring ✨
            </Badge>
          </motion.div>

          <motion.h1 custom={1} initial="hidden" animate="visible" variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "'Red Hat Display', sans-serif" }}
          >
            Earn 30% Monthly Sharing{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] bg-clip-text text-transparent">
              LUMI
            </span>
          </motion.h1>

          <motion.p custom={2} initial="hidden" animate="visible" variants={fadeUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Built for agencies, coaches, and educators with an engaged audience. Refer clients to LUMI and earn 30% of every payment they make — every month, for life.
          </motion.p>

          <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}>
            <Button
              size="lg"
              className="bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 shadow-lg shadow-[hsl(var(--lumi-pink-1)/0.3)] hover:shadow-xl transition-all text-base px-10"
              onClick={scrollToSignup}
            >
              Apply Now →
            </Button>
          </motion.div>

          <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-3 mt-10"
          >
            {[
              { emoji: "🔄", text: "30% recurring commissions" },
              { emoji: "📅", text: "Paid out monthly" },
              { emoji: "♾️", text: "No cap on earnings" },
            ].map((stat) => (
              <span key={stat.text} className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm font-medium shadow-sm">
                {stat.emoji} {stat.text}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
              How the Partner Program works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Three simple steps to start earning recurring income with LUMI.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: Sparkles, step: "1", title: "Apply & get approved", desc: "Tell us about your audience and how you plan to share LUMI. We review applications within 2 business days." },
              { icon: Heart, step: "2", title: "Share your partner link", desc: "Get your unique partner link and share it with your audience through email, social, podcasts, or client conversations." },
              { icon: TrendingUp, step: "3", title: "Earn 30% monthly, forever", desc: "Every time a referral subscribes, you earn 30% of their payment — every month, for as long as they're a member." },
            ].map((item, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i + 1} variants={fadeUp}>
                <Card className="h-full border-border/50 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 sm:p-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] flex items-center justify-center mx-auto mb-4">
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Payout Info */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={4} variants={fadeUp}>
            <Card className="bg-muted/50 border-border/50">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Payouts go out monthly via PayPal or Wise. Before your first payout you'll complete a quick tax form (W-9 for US, W-8BEN international) — takes 2 minutes and is handled automatically through your partner dashboard.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Earning Potential */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-[hsl(var(--lumi-purple-1)/0.03)] to-transparent">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
              Your earning potential
            </h2>
            <p className="text-muted-foreground">With 30% recurring commissions, even a few referrals add up fast.</p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { referrals: "5", monthly: "$220+", label: "per month" },
                { referrals: "15", monthly: "$660+", label: "per month" },
                { referrals: "50", monthly: "$2,200+", label: "per month" },
              ].map((tier, i) => (
                <Card key={i} className={`border-border/50 ${i === 2 ? 'border-2 border-[hsl(var(--lumi-pink-1)/0.4)] shadow-lg' : ''}`}>
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-1">{tier.referrals} active referrals</p>
                    <p className="text-3xl font-extrabold bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] bg-clip-text text-transparent mb-1">
                      {tier.monthly}
                    </p>
                    <p className="text-xs text-muted-foreground">{tier.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              *Based on average LUMI subscription of ~$147/mo. Actual earnings depend on referral subscription tier.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}>
            <Card className="border-border/50 shadow-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))]" />
              <CardContent className="p-6 sm:p-8">
                {submitted ? (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-3">✅</div>
                    <h3 className="text-xl font-bold mb-2">Application submitted!</h3>
                    <p className="text-muted-foreground mb-2">
                      We'll review your application and email you at <strong>{email}</strong> within 2 business days.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Questions? Email us at{" "}
                      <a href="mailto:hello@adsbylumi.com" className="text-primary hover:underline">hello@adsbylumi.com</a>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                        Apply for the Partner Program
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Tell us a bit about yourself and your audience. We'll be in touch within 2 business days.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input id="firstName" required value={firstName} onChange={e => setFirstName(e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input id="lastName" required value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="website">Website or Social Profile URL *</Label>
                        <Input id="website" required value={website} onChange={e => setWebsite(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="audience">Tell us about your audience *</Label>
                        <Textarea id="audience" required value={audienceDescription} onChange={e => setAudienceDescription(e.target.value)}
                          placeholder="Who do you serve? How large is your audience?" rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="promotionPlan">How can we support you in sharing about LUMI? *</Label>
                        <Textarea id="promotionPlan" required value={promotionPlan} onChange={e => setPromotionPlan(e.target.value)}
                          placeholder="Would you like to have us do a free training in your community, offer additional resources, or do you have other ideas? We're all ears!" rows={3}
                        />
                      </div>

                      <Button type="submit" disabled={loading}
                        className="w-full bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 shadow-lg"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting...
                          </span>
                        ) : (
                          "Apply for Partner Program →"
                        )}
                      </Button>

                      <p className="text-xs text-muted-foreground text-center">
                        Applications are reviewed within 2 business days. You'll hear from us either way.
                      </p>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}>
            <h2 className="text-3xl font-bold text-center mb-10" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
              Frequently Asked Questions
            </h2>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqItems.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-xl px-4 bg-card">
                  <AccordionTrigger className="text-left font-semibold text-sm sm:text-base hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
              Ready to start earning?
            </h2>
            <Button
              size="lg"
              className="bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 shadow-lg mb-6"
              onClick={scrollToSignup}
            >
              Apply for Partner Program →
            </Button>
            <p className="text-sm text-muted-foreground">
              Already a partner?{" "}
              <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Log in to your dashboard →
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} LUMI by After Organic. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
