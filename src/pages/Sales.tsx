import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Target,
  Palette,
  FolderKanban,
  Rocket,
  BarChart3,
  Brain,
  MessageCircle,
  CheckCircle,
  X,
} from "lucide-react";
const Sales = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      {/* Header with Login */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <img
            src="/lovable-uploads/a7a24c2a-2692-4a35-b5ea-17ffd8f9dd0a.png"
            alt="Your Ad Assistant"
            className="h-16"
          />
          <Button onClick={() => navigate("/auth")} variant="outline">
            Log In / Sign Up
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded-full">
            <span className="text-sm font-medium text-primary">For Coaches, Course Creators + Service Providers</span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight">
            Finally: Meta ads that feel simple, strategic, and actually doable.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            You don't have to learn ads, to run ads.
          </p>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed text-foreground/90 mb-4 text-center">
              The buttons. The settings. The "random" performance swings. The 47 opinions on TikTok. The fear you'll
              mess something up and waste money.
            </p>
            <p className="text-xl font-medium text-foreground mt-8 mb-4 text-center">
              Your Ad Assistant takes all that stress and says:{" "}
              <span className="text-primary">"Let me take it from here."</span>
            </p>
            <p className="text-lg leading-relaxed text-foreground/90 text-center">
              This isn't another marketing course or a complicated dashboard. It's a smart, friendly, hands-on tool that
              walks you through planning, creating, launching, and improving Meta ads — step by step.
            </p>
            <p className="text-lg font-medium text-foreground mt-6 text-center">
              No overwhelm. No guesswork. No Ads Manager spirals.
            </p>
          </div>
        </div>
      </section>

      {/* Key Promise */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-12 rounded-3xl border border-border">
            <p className="text-2xl md:text-3xl font-display leading-relaxed">
              If you can paste your url and upload your creative…
              <br />
              <span className="text-primary text-5xl">Your Ad Assistant does the rest.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="font-display text-4xl text-center mb-16">Here's how:</h2>

          <div className="space-y-16">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-3xl mb-4">💡 STEP 1 — Choose What You Want to Run</h3>
                <p className="text-lg text-muted-foreground mb-6">
                  Skip the guessing, skip the questions you don't understand, skip the "what objective do I use??"
                  panic.
                </p>
                <p className="text-lg font-medium mb-4">Just select the goal of your ads:</p>
                <ul className="space-y-2 text-lg">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Webinar Signups
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Lead Magnet Downloads
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Low-Ticket Product Sales
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Book a Discovery Call
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Traffic to Instagram/Facebook
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Video Views (Trust Builder)
                  </li>
                </ul>
                <p className="text-lg mt-6 font-medium">
                  Your Ad Assistant loads the exact structure Meta prefers in 2025. No thinking required.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Palette className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-3xl mb-4">🎨 STEP 2 — Get Your Full-Funnel Creative Plan</h3>
                <p className="text-lg text-muted-foreground mb-6">
                  Once you enter your offer details… Your Creative Department generates:
                </p>

                <div className="space-y-6">
                  <div>
                    <p className="font-medium text-lg mb-3">✓ TOFU ads</p>
                    <ul className="space-y-1 text-muted-foreground ml-6">
                      <li>• Hooks</li>
                      <li>• Talking-head scripts</li>
                      <li>• B-roll shot lists</li>
                      <li>• Pattern interrupts</li>
                      <li>• Curiosity angles</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-lg mb-3">✓ MOFU ads</p>
                    <ul className="space-y-1 text-muted-foreground ml-6">
                      <li>• Story-based scripts</li>
                      <li>• Teaching carousels</li>
                      <li>• Trust-building visuals</li>
                      <li>• Proof-driven messages</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-lg mb-3">✓ BOFU ads</p>
                    <ul className="space-y-1 text-muted-foreground ml-6">
                      <li>• Offer breakdown graphics</li>
                      <li>• Benefits carousels</li>
                      <li>• CTA-focused creative</li>
                      <li>• "What's Included" visuals</li>
                    </ul>
                  </div>

                  <div className="mt-8 p-6 bg-background rounded-xl border border-border">
                    <p className="font-medium text-lg mb-3">AND THEN — You also get:</p>
                    <ul className="grid md:grid-cols-2 gap-2 text-muted-foreground">
                      <li>• Text overlays</li>
                      <li>• Additional variations</li>
                      <li>• "Give me more ideas" expansion</li>
                      <li>• Niche-specific messaging</li>
                      <li>• Psychology-aligned hooks</li>
                      <li>• Production checklists</li>
                      <li>• Aspect ratios + recording guidance</li>
                      <li>• B-roll examples</li>
                      <li>• Filming tips</li>
                      <li>• Script alternates</li>
                    </ul>
                  </div>
                </div>

                <p className="text-lg mt-6 font-medium">
                  Everything you need to record or design the right creative — without scrolling for inspiration or
                  guessing what to do.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-3xl mb-4">🗂 STEP 3 — Save Your Campaign & Track Your Progress</h3>
                <p className="text-lg text-muted-foreground mb-6">
                  Each campaign gets its own workspace, where you can:
                </p>
                <ul className="space-y-2 text-lg">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Save scripts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Expand creative
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Regenerate creative you don't love
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Store your brand voice
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Upload your final videos + graphics
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Check off a production list
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> See exactly what you still need to record
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" /> Come back any time
                  </li>
                </ul>
                <p className="text-lg mt-6 font-medium">
                  It's like having a creative studio, strategist, and production manager — all inside one tidy space.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-3xl mb-4">
                  🚀 STEP 4 — Hit "Create Campaign" and Your Ad Assistant Builds It for You
                </h3>
                <p className="text-lg font-medium mb-6">
                  Yep. Like actually builds the entire campaign in Ads Manager using the Meta API.
                </p>
                <p className="text-lg mb-4">Your Ad Assistant:</p>
                <ul className="space-y-2 text-lg text-muted-foreground">
                  <li>• Combines your creative with your strategy</li>
                  <li>• Pulls all required fields</li>
                  <li>• Asks you a few simple questions (budget, dates, anything Meta needs)</li>
                  <li>• Recommends beginner-friendly settings</li>
                  <li>• Double-checks everything is correct</li>
                  <li>• Pushes the campaign live for you</li>
                </ul>
                <p className="text-lg mt-6 font-medium">
                  You never have to go into Ads Manager. (No toggles, no hidden settings, no fifteen screens.)
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-3xl mb-4">📊 STEP 5 — Get Weekly Guidance (Without the Panic)</h3>
                <p className="text-lg text-muted-foreground mb-6">Each week, Your Ad Assistant sends you:</p>
                <ul className="space-y-2 text-lg text-muted-foreground">
                  <li>• A clean, simple performance report</li>
                  <li>• CTR, CPC, CPL, CPP, ROAS</li>
                  <li>• Warm audience health</li>
                  <li>• Creative fatigue alerts</li>
                  <li>• Full-funnel diagnostics</li>
                  <li>• "What's working + why"</li>
                  <li>• "What needs attention + why"</li>
                  <li>• Seasonal context ("Don't worry — July CPMs always spike")</li>
                  <li>• New creative ideas based on what's underperforming</li>
                  <li>• Benchmarks based on your niche + campaign type</li>
                </ul>
                <p className="text-lg mt-6 font-medium">
                  Everything is written in friendly, real-person language, not data noise.
                </p>
                <p className="text-xl mt-6 text-primary font-medium">This isn't a dashboard. It's a partner.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display text-4xl text-center mb-12">🌟 Why It Works So Well</h2>
          <p className="text-xl text-center text-muted-foreground mb-12">
            Your Ad Assistant is powered by thousands of hours of:
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            {[
              "Meta ad strategy",
              "Creative psychology",
              "Performance troubleshooting",
              "Offer mapping",
              "Funnel breakdown analysis",
              "Script writing",
              "Copy frameworks",
              "Meta best practices",
              "Seasonality predictions",
              "Hook libraries",
              "Niche messaging",
              "Audience builder logic",
              "B-roll direction",
              "High-performing creative systems",
              "API-backed campaign builds",
            ].map((item) => (
              <div key={item} className="p-4 bg-muted/30 rounded-lg border border-border">
                <p className="text-sm">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-xl text-center mt-12 font-medium">
            …and all of that lives inside an app that feels simple, warm, and helpful.
          </p>
        </div>
      </section>

      {/* Think of it like this */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="font-display text-4xl text-center mb-12">🧠 Think of it like this…</h2>
          <p className="text-xl text-center mb-12">Your Ad Assistant is:</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-background rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <MessageCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-lg mb-2">💬 Your strategist</p>
                  <p className="text-muted-foreground">Telling you exactly which campaign to run.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-background rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <Palette className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-lg mb-2">🎨 Your creative director</p>
                  <p className="text-muted-foreground">Giving you hooks, scripts, b-roll, and graphics.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-background rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <Target className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-lg mb-2">🎥 Your producer</p>
                  <p className="text-muted-foreground">Showing you how to film and what to record.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-background rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <Rocket className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-lg mb-2">🛠 Your campaign builder</p>
                  <p className="text-muted-foreground">Creating everything directly in Ads Manager.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-background rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <BarChart3 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-lg mb-2">📊 Your analyst</p>
                  <p className="text-muted-foreground">Reviewing your data and telling you what to fix.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-background rounded-xl border border-border">
              <div className="flex items-start gap-4">
                <Brain className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-lg mb-2">✨ Your supportive business bestie</p>
                  <p className="text-muted-foreground">Encouraging you and keeping things simple.</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xl text-center mt-12 font-medium">All in one clean, friendly tool.</p>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="font-display text-3xl mb-6">🎯 Who It's For</h2>
              <p className="text-lg mb-6">
                Coaches, course creators, service providers, creators, and small business owners who:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Want better ads</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Are tired of guessing</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Want to save time</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Want someone (or something) to tell them what to do</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Want clarity, not chaos</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Want ads that feel doable, not overwhelming</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span>Want a tool that meets them where they are</span>
                </li>
              </ul>
              <p className="text-lg mt-6 font-medium">
                If you're ready to run ads with confidence — without becoming a media buyer — this is for you.
              </p>
            </div>

            <div>
              <h2 className="font-display text-3xl mb-6">❌ Who It's Not For</h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                  <span>People looking for hacks</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                  <span>People who won't record any creative at all</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                  <span>People who want to manually tweak every toggle</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                  <span>People who expect results without testing</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
                  <span>Agencies who only run 30-adset Frankenstein structures</span>
                </li>
              </ul>
              <p className="text-lg mt-6 font-medium">
                This is for people who want smart, simple, strategic ads — done the right way.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl mb-6">💵 Pricing</h2>
          <p className="text-2xl font-medium text-primary mb-4">COMING SOON</p>
          <p className="text-lg text-muted-foreground">(with solo, creator, and agency tiers)</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-5xl mb-8 md:text-5xl">🚀 Ready to run ads with clarity?</h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Your Ad Assistant is coming. And it's about to make your business feel lighter, simpler, and more strategic.
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 py-6">
            Join the Waitlist
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2025 Your Ad Assistant. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
export default Sales;
