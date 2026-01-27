import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, ArrowLeft, MessageSquare, Zap, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import lumiLogo from "@/assets/lumi-logo.png";

interface DemoMessage {
  role: 'user' | 'assistant';
  content: string;
  followups?: { label: string; message: string }[];
}

const DEMO_RESPONSES: Record<string, { response: string; followups: { label: string; message: string }[] }> = {
  default: {
    response: "Hey! 👋 I'm Lumi, your AI ad strategist. I help coaches, course creators, and service providers create Meta ads that actually convert.\n\n**What I can help with:**\n\n• Planning your ad strategy\n• Writing scroll-stopping hooks\n• Crafting copy that sells\n• Analyzing your ad performance\n\nWhat are you working on?",
    followups: [
      { label: "Plan my first ad", message: "I want to plan my first Meta ad campaign" },
      { label: "Write ad copy", message: "Help me write ad copy for my offer" },
      { label: "Improve my ads", message: "My current ads aren't performing well" }
    ]
  },
  "first ad": {
    response: "Exciting! Let's build your first winning ad. 🎯\n\n**Quick question:** What are you promoting?\n\n• A course or program\n• Coaching services\n• A free lead magnet\n• Something else\n\nThis helps me recommend the right campaign structure for you.",
    followups: [
      { label: "Online course", message: "I'm promoting an online course" },
      { label: "Coaching program", message: "I'm selling coaching services" },
      { label: "Free webinar", message: "I want to promote a free webinar" }
    ]
  },
  "online course": {
    response: "Perfect! Courses are my specialty. ✨\n\nFor course launches, I typically recommend a **3-phase approach:**\n\n**1. Training Campaign** — Always-on content to warm your audience\n\n**2. Cold Campaign** — Broad targeting to reach new buyers\n\n**3. Warm Campaign** — Retarget people who've engaged\n\n**What's your course about?** Give me a one-liner and I'll start crafting angles.",
    followups: [
      { label: "Give me hooks", message: "Can you give me some hook ideas?" },
      { label: "Budget advice", message: "What budget should I start with?" },
      { label: "Target audience", message: "How do I find my target audience?" }
    ]
  },
  "ad copy": {
    response: "Let's write some copy that converts! ✍️\n\nTo create scroll-stopping ads, I need to know:\n\n**1. What's your offer?** (Course, coaching, service)\n\n**2. Who's it for?** (Their biggest pain point)\n\n**3. What transformation do you promise?**\n\nShare what you've got and I'll craft some hooks + primary copy variations.",
    followups: [
      { label: "Hook formulas", message: "Show me your best hook formulas" },
      { label: "Copy examples", message: "Give me ad copy examples" },
      { label: "Pain points", message: "Help me identify pain points" }
    ]
  },
  "hook": {
    response: "Here are some **high-converting hook formulas** for your ads:\n\n**🔥 Problem-Agitate:**\n\"Still struggling with [problem]? Here's why...\"\n\n**✨ Curiosity Gap:**\n\"I made $X doing [thing] and here's the weird part...\"\n\n**💡 Pattern Interrupt:**\n\"Stop scrolling if you've ever [relatable frustration]\"\n\n**🎯 Direct Challenge:**\n\"If you're a [target] who wants [outcome], this is for you\"\n\nWant me to customize these for your specific offer?",
    followups: [
      { label: "Customize for me", message: "Yes, customize these for my offer" },
      { label: "More examples", message: "Show me more hook examples" },
      { label: "Video hooks", message: "What about video ad hooks?" }
    ]
  },
  "performing": {
    response: "Let's diagnose what's happening. 🔍\n\n**Common reasons ads underperform:**\n\n• **Low CTR (<1%)** → Your hook isn't grabbing attention\n• **High CPC** → Audience targeting is too narrow\n• **No conversions** → Landing page or offer mismatch\n• **High frequency (>4)** → Creative fatigue\n\n**What's your biggest issue right now?** I'll give you a specific fix.",
    followups: [
      { label: "Low CTR", message: "My click-through rate is really low" },
      { label: "No conversions", message: "I'm getting clicks but no sales" },
      { label: "Costs too high", message: "My cost per lead is too high" }
    ]
  },
  "ctr": {
    response: "Low CTR means your creative isn't stopping the scroll. 🛑\n\n**Quick fixes:**\n\n**1. Test a new hook** — First 3 seconds matter most\n\n**2. Add text overlay** — Many watch without sound\n\n**3. Use movement** — Static images lose to video\n\n**4. Call out your audience** — \"Hey coaches!\" or \"If you're a...\"\n\n**Pro tip:** Your hook should create curiosity OR hit a pain point hard.\n\nWant me to write some new hooks for you?",
    followups: [
      { label: "Write new hooks", message: "Yes, write some hooks for me" },
      { label: "Video tips", message: "How do I make better video ads?" },
      { label: "Test strategy", message: "How should I test different creatives?" }
    ]
  }
};

function getResponse(message: string): { response: string; followups: { label: string; message: string }[] } {
  const lower = message.toLowerCase();
  
  if (lower.includes('first') && lower.includes('ad')) return DEMO_RESPONSES['first ad'];
  if (lower.includes('course')) return DEMO_RESPONSES['online course'];
  if (lower.includes('copy') || lower.includes('write')) return DEMO_RESPONSES['ad copy'];
  if (lower.includes('hook')) return DEMO_RESPONSES['hook'];
  if (lower.includes('perform') || lower.includes('not working') || lower.includes("aren't")) return DEMO_RESPONSES['performing'];
  if (lower.includes('ctr') || lower.includes('click')) return DEMO_RESPONSES['ctr'];
  
  return DEMO_RESPONSES.default;
}

export default function Demo() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show initial greeting after a short delay
    const timer = setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setMessages([{
          role: 'assistant',
          content: DEMO_RESPONSES.default.response,
          followups: DEMO_RESPONSES.default.followups
        }]);
        setIsTyping(false);
      }, 1000);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (text: string) => {
    if (!text.trim() || isTyping) return;
    
    const userMessage: DemoMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const { response, followups } = getResponse(text);
      setMessages(prev => [...prev, { role: 'assistant', content: response, followups }]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">Back to Home</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <img src={lumiLogo} alt="Lumi" className="h-8 w-8" />
            <span className="font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Lumi Demo
            </span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Try it free
            </span>
          </div>

          <Link to="/auth?signup=true">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Feature Pills */}
      <div className="container max-w-4xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { icon: Target, label: "Ad Strategy" },
            { icon: Sparkles, label: "AI Copy" },
            { icon: TrendingUp, label: "Performance Tips" },
            { icon: Zap, label: "Quick Fixes" }
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-full text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <main className="flex-1 container max-w-4xl mx-auto px-4 pb-32">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <img src={lumiLogo} alt="" className="w-5 h-5" />
                    </div>
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[85%] sm:max-w-[75%]",
                  msg.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3" 
                    : "space-y-3"
                )}>
                  <Card className={cn(
                    msg.role === 'user' && "border-0 shadow-none bg-transparent"
                  )}>
                    <CardContent className={cn(
                      "p-0",
                      msg.role === 'assistant' && "p-4"
                    )}>
                      <div className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                        {msg.content.split('\n').map((line, lineIdx) => {
                          // Handle bold text
                          const parts = line.split(/(\*\*[^*]+\*\*)/g);
                          return (
                            <p key={lineIdx} className={cn("mb-1", !line && "h-2")}>
                              {parts.map((part, partIdx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                                }
                                return <span key={partIdx}>{part}</span>;
                              })}
                            </p>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Follow-up buttons */}
                  {msg.role === 'assistant' && msg.followups && msg.followups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.followups.map((followup, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 bg-card hover:bg-primary/5 hover:border-primary/30"
                          onClick={() => handleSend(followup.message)}
                          disabled={isTyping}
                        >
                          {followup.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <img src={lumiLogo} alt="" className="w-5 h-5" />
              </div>
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 bg-primary/50 rounded-full"
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 sm:pb-6">
        <div className="container max-w-4xl mx-auto px-4">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Lumi anything about ads..."
                className="h-12 pr-12 bg-card border-border rounded-xl text-sm sm:text-base"
                disabled={isTyping}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isTyping}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
          
          <p className="text-center text-xs text-muted-foreground mt-3">
            This is a demo. <Link to="/auth?signup=true" className="text-primary hover:underline">Sign up</Link> to unlock the full experience.
          </p>
        </div>
      </div>
    </div>
  );
}
