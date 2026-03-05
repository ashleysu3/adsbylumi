import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Link2, Users, CreditCard, ChevronRight, Copy, Check, ExternalLink, Sparkles } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'affiliate' | 'partner'>(
    (searchParams.get('type') as 'affiliate' | 'partner') || 'affiliate'
  );
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [audienceDescription, setAudienceDescription] = useState('');
  const [promotionPlan, setPromotionPlan] = useState('');
  const [howWillYouShare, setHowWillYouShare] = useState('');

  const scrollToSignup = (type: 'affiliate' | 'partner') => {
    setActiveTab(type);
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Copied! 🎉");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-partner-application', {
        body: {
          firstName, lastName, email, website,
          audienceDescription, promotionPlan, howWillYouShare,
          applicationType: activeTab,
        }
      });

      if (error) throw error;

      if (data.exists) {
        setAlreadyExists(true);
      } else {
        setReferralLink(data.referralLink || '');
        setReferralCode(data.referralCode || '');
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error("Something went wrong. Please email hello@adsbylumi.com");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const faqItems = [
    { q: "What's the difference between Affiliate and Partner?", a: "Affiliates earn a one-time $40 for each person who subscribes through their link. Partners earn 30% of every subscription payment that person makes, every month, for as long as they stay subscribed. Partner status requires approval." },
    { q: "When do I get paid?", a: "Payouts are sent monthly. You'll connect a PayPal or Wise account in your affiliate dashboard and complete a quick tax form before your first payout." },
    { q: "Is there a limit to how much I can earn?", a: "No limits at all. The more people you refer, the more you earn. Partners with recurring commissions can build real passive income over time." },
    { q: "How does tracking work?", a: "We use a 60-day tracking cookie. As long as someone clicks your link and subscribes within 60 days, you get full credit." },
    { q: "Do I need to be a LUMI subscriber?", a: "Nope! Though we find that affiliates who actually use LUMI convert significantly better. 😉" },
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
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--lumi-orange-1)/0.08)] via-[hsl(var(--lumi-pink-1)/0.06)] to-[hsl(var(--lumi-purple-1)/0.08)]" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-[hsl(var(--lumi-pink-1)/0.1)] rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-[hsl(var(--lumi-purple-1)/0.08)] rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
            <Badge className="mb-6 bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-pink-1))] text-white border-0 px-4 py-1.5 text-sm font-medium">
              Now Accepting Affiliates & Partners ✨
            </Badge>
          </motion.div>

          <motion.h1 custom={1} initial="hidden" animate="visible" variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6"
            style={{ fontFamily: "'Red Hat Display', sans-serif" }}
          >
            Get Paid to Share{" "}
            <span className="bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] bg-clip-text text-transparent">
              LUMI
            </span>
          </motion.h1>

          <motion.p custom={2} initial="hidden" animate="visible" variants={fadeUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Refer coaches, course creators, and service providers to LUMI and earn every time they subscribe.
          </motion.p>

          <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 shadow-lg shadow-[hsl(var(--lumi-pink-1)/0.3)] hover:shadow-xl transition-all text-base px-8"
              onClick={() => scrollToSignup('affiliate')}
            >
              Become an Affiliate — Earn $40
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-foreground/20 hover:border-foreground/40 text-base px-8"
              onClick={() => scrollToSignup('partner')}
            >
              Apply to Partner Program — Earn 30% Monthly
            </Button>
          </motion.div>

          <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { emoji: "💸", text: "$40 per referral" },
              { emoji: "🔄", text: "30% recurring for Partners" },
              { emoji: "📅", text: "Paid out monthly" },
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
              Two ways to earn
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Affiliate Card */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}>
              <Card className="h-full border-border/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 sm:p-8">
                  <Badge variant="secondary" className="mb-4 bg-green-100 text-green-800 border-0">Open to everyone</Badge>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-pink-1))] flex items-center justify-center">
                      <Link2 className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">Refer & Earn $40</h3>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Share your unique link. When someone clicks it and subscribes to LUMI, you earn $40. Simple as that.
                  </p>
                  <ol className="space-y-3 mb-6">
                    {["Get your unique referral link", "Share it with your audience", "Earn $40 when they subscribe"].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--lumi-orange-1)/0.15)] text-[hsl(var(--lumi-orange-1))] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted-foreground border-t border-border/50 pt-4">
                    Instant approval • No limits on earnings
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Partner Card */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={2} variants={fadeUp}>
              <Card className="h-full border-2 border-[hsl(var(--lumi-pink-1)/0.3)] hover:shadow-lg transition-shadow relative">
                <div className="absolute -top-px left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] rounded-t-xl" />
                <CardContent className="p-6 sm:p-8">
                  <Badge className="mb-4 bg-amber-100 text-amber-800 border-0">Application required</Badge>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">Partner & Earn 30% Monthly</h3>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Built for agencies, coaches, and influencers with an engaged audience. Earn 30% of every payment your referrals make — every month, for life.
                  </p>
                  <ol className="space-y-3 mb-6">
                    {["Apply and get approved", "Share your partner link", "Earn 30% recurring, forever"].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--lumi-pink-1)/0.15)] text-[hsl(var(--lumi-pink-1))] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted-foreground border-t border-border/50 pt-4">
                    Reviewed within 2 business days
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Payout Info */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={3} variants={fadeUp}>
            <Card className="bg-muted/50 border-border/50">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Payouts go out monthly via PayPal or Wise. Before your first payout you'll complete a quick tax form (W-9 for US, W-8BEN international) — takes 2 minutes and is handled automatically through your affiliate dashboard.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Signup Section */}
      <section id="signup" className="py-20 px-4 bg-gradient-to-b from-transparent via-[hsl(var(--lumi-pink-1)/0.03)] to-transparent">
        <div className="max-w-2xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}>
            <Card className="border-border/50 shadow-xl overflow-hidden">
              {/* Tab Toggle */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => { setActiveTab('affiliate'); setSubmitted(false); }}
                  className={`flex-1 py-4 px-4 text-sm font-semibold transition-all ${
                    activeTab === 'affiliate'
                      ? 'bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-pink-1))] text-white'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Affiliate — $40/referral
                </button>
                <button
                  onClick={() => { setActiveTab('partner'); setSubmitted(false); }}
                  className={`flex-1 py-4 px-4 text-sm font-semibold transition-all ${
                    activeTab === 'partner'
                      ? 'bg-gradient-to-r from-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  Partner — 30% recurring
                </button>
              </div>

              <CardContent className="p-6 sm:p-8">
                {submitted ? (
                  <div className="text-center py-6">
                    {alreadyExists ? (
                      <>
                        <p className="text-lg font-semibold mb-2">Looks like you already have an account!</p>
                        <p className="text-muted-foreground mb-4">
                          Log in at{" "}
                          <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            app.rewardful.com
                          </a>{" "}
                          to get your link.
                        </p>
                      </>
                    ) : activeTab === 'affiliate' ? (
                      <>
                        <div className="text-4xl mb-3">🎉</div>
                        <h3 className="text-xl font-bold mb-2">You're in! Here's your referral link:</h3>
                        <div className="flex items-center gap-2 mb-4">
                          <Input value={referralLink} readOnly className="text-center font-medium" />
                          <Button variant="outline" size="icon" onClick={handleCopy}>
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        {referralCode && (
                          <Badge className="mb-4 bg-muted text-foreground border-border">Your code: {referralCode}</Badge>
                        )}
                        <p className="text-sm text-muted-foreground mb-4">
                          Share this link anywhere — every time someone subscribes through it, you earn $40.
                        </p>
                        <a href="https://app.rewardful.com" target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Manage your account & payouts <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    ) : (
                      <>
                        <div className="text-4xl mb-3">✅</div>
                        <h3 className="text-xl font-bold mb-2">Application submitted!</h3>
                        <p className="text-muted-foreground mb-2">
                          We'll review your application and email you at <strong>{email}</strong> within 2 business days.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Questions? Email us at{" "}
                          <a href="mailto:hello@adsbylumi.com" className="text-primary hover:underline">hello@adsbylumi.com</a>
                        </p>
                      </>
                    )}
                  </div>
                ) : (
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

                    {activeTab === 'affiliate' ? (
                      <div>
                        <Label htmlFor="howShare">How will you share LUMI?</Label>
                        <Textarea id="howShare" value={howWillYouShare} onChange={e => setHowWillYouShare(e.target.value)}
                          placeholder="e.g. email newsletter, Instagram, podcast, client referrals..." rows={3}
                        />
                      </div>
                    ) : (
                      <>
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
                          <Label htmlFor="promotionPlan">How do you plan to promote LUMI? *</Label>
                          <Textarea id="promotionPlan" required value={promotionPlan} onChange={e => setPromotionPlan(e.target.value)}
                            placeholder="e.g. dedicated email, Instagram story, YouTube mention..." rows={3}
                          />
                        </div>
                      </>
                    )}

                    <Button type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 shadow-lg"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {activeTab === 'affiliate' ? 'Creating your link...' : 'Submitting...'}
                        </span>
                      ) : activeTab === 'affiliate' ? (
                        "Get My Referral Link →"
                      ) : (
                        "Apply for Partner Program →"
                      )}
                    </Button>

                    {activeTab === 'partner' && (
                      <p className="text-xs text-muted-foreground text-center">
                        Partner applications are reviewed within 2 business days. You'll hear from us either way.
                      </p>
                    )}
                  </form>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] via-[hsl(var(--lumi-pink-1))] to-[hsl(var(--lumi-purple-1))] text-white border-0 shadow-lg"
                onClick={() => scrollToSignup('affiliate')}
              >
                Become an Affiliate — Earn $40
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSignup('partner')}>
                Apply to Partner Program
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
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
